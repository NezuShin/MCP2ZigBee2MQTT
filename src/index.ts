import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ZigbeeDatabase } from './database.js';
import { MqttListener, MqttConfig } from './mqtt-listener.js';
import { ZigbeeMcpServer } from './mcp-server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './logger.js';

// Load environment variables (from process.env and optional .env file via dotenv)
const config: MqttConfig = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
  baseTopic: process.env.MQTT_BASE_TOPIC || 'zigbee2mqtt',
};

const dbPath = process.env.DB_PATH || './zigbee2mqtt.db';
const transportMode = process.env.TRANSPORT_MODE || 'stdio'; // 'stdio' or 'http'
const httpPort = parseInt(process.env.HTTP_PORT || '3235');
const apiKey = process.env.API_KEY || undefined;

async function startStdioMode(db: ZigbeeDatabase, mqtt: MqttListener) {
  logger.debug('Starting in STDIO mode...');
  const mcpServer = new ZigbeeMcpServer(db, mqtt, config.baseTopic);
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  logger.info('MCP Server ready');
}

async function startHttpMode(db: ZigbeeDatabase, mqtt: MqttListener) {
  logger.debug(`Starting in HTTP/SSE mode on port ${httpPort}...`);

  const app = express();
  app.use(cors());
  app.use(express.json());

  // One Protocol/Server instance per client session (SDK forbids reuse)
  const transports: Record<string, SSEServerTransport | StreamableHTTPServerTransport> = {};

  const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
    if (!apiKey) {
      next();
      return;
    }
    const providedKey = req.headers['authorization']?.replace('Bearer ', '');
    if (providedKey !== apiKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  // Health check endpoint
  app.get('/health', (_req, res) => {
    const stats = db.getStats();
    res.json({
      status: 'ok',
      mqtt_connected: mqtt.isConnected(),
      active_sessions: Object.keys(transports).length,
      ...stats,
    });
  });

  // Streamable HTTP (preferred by newer MCP clients like LM Studio)
  app.all('/mcp', requireApiKey, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        const existing = transports[sessionId];
        if (!(existing instanceof StreamableHTTPServerTransport)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session exists but uses a different transport protocol',
            },
            id: null,
          });
          return;
        }
        transport = existing;
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            logger.info(`Streamable HTTP session initialized: ${sid}`);
            transports[sid] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            logger.info(`Streamable HTTP session closed: ${sid}`);
            delete transports[sid];
          }
        };

        const mcpServer = new ZigbeeMcpServer(db, mqtt, config.baseTopic);
        await mcpServer.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling /mcp request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // Legacy SSE: GET establishes stream (one Server instance per connection)
  app.get('/sse', requireApiKey, async (req, res) => {
    try {
      logger.info('New SSE connection from:', req.ip);
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      transport.onclose = () => {
        logger.info(`SSE session closed: ${sessionId}`);
        delete transports[sessionId];
      };

      const mcpServer = new ZigbeeMcpServer(db, mqtt, config.baseTopic);
      await mcpServer.connect(transport);
      logger.info(`SSE session established: ${sessionId}`);
    } catch (error) {
      logger.error('Error establishing SSE stream:', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });

  // Legacy SSE: POST client messages for a session
  app.post('/messages', requireApiKey, async (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    if (!sessionId) {
      res.status(400).send('Missing sessionId parameter');
      return;
    }

    const transport = transports[sessionId];
    if (!transport || !(transport instanceof SSEServerTransport)) {
      res.status(404).send('Session not found');
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      logger.error('Error handling /messages request:', error);
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  });

  await new Promise<void>((resolve) => {
    app.listen(httpPort, () => {
      logger.startup(`✓ HTTP Server listening on port ${httpPort}`);
      logger.info(`  - Health: http://localhost:${httpPort}/health`);
      logger.info(`  - MCP (Streamable HTTP): http://localhost:${httpPort}/mcp`);
      logger.info(`  - MCP SSE (legacy): http://localhost:${httpPort}/sse`);
      if (apiKey) {
        logger.info(`  - API Key authentication enabled`);
      }
      resolve();
    });
  });
}

async function main() {
  logger.startup('=== ZigBee2MQTT MCP Server ===');
  logger.debug(`Transport Mode: ${transportMode}`);
  logger.debug(`Database: ${dbPath}`);
  logger.debug(`MQTT Broker: ${config.brokerUrl}`);
  logger.debug(`Base Topic: ${config.baseTopic}`);

  // Initialize database
  const db = new ZigbeeDatabase(dbPath);
  logger.debug('Database initialized');

  // Initialize MQTT listener
  const mqtt = new MqttListener(config, db);

  try {
    // Connect to MQTT broker
    await mqtt.connect();
    logger.info('MQTT connected');

    // Wait a moment for initial retained messages to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Show initial stats
    const stats = db.getStats();
    logger.startup(`✓ Ready: ${stats.deviceCount} devices, ${stats.fieldCount} fields, ${stats.capabilityCount} capabilities`);

    // Start MCP server in selected mode
    if (transportMode === 'http') {
      await startHttpMode(db, mqtt);
    } else {
      await startStdioMode(db, mqtt);
    }

    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await mqtt.disconnect();
      db.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');
      await mqtt.disconnect();
      db.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error:', error);
    await mqtt.disconnect();
    db.close();
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
