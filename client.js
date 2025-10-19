#!/usr/bin/env node

/**
 * MCP HTTP Client
 * Verbindet sich zu einem Remote MCP Server über HTTP/SSE
 * und stellt die Verbindung über stdio für Claude Desktop bereit
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Konfiguration aus Umgebungsvariablen
const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3235/sse';
const apiKey = process.env.MCP_API_KEY || '';

async function main() {
  // SSE Transport zum Remote-Server
  const sseTransport = new SSEClientTransport(new URL(serverUrl), {
    headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
  });

  // Stdio Transport für Claude Desktop
  const stdioTransport = new StdioClientTransport();

  const client = new Client({
    name: 'zigbee2mqtt-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    // Verbinde zum Remote-Server
    await client.connect(sseTransport);
    console.error(`✓ Connected to remote MCP server: ${serverUrl}`);

    // Leite die Kommunikation zu stdio weiter
    // (Dies ist ein vereinfachtes Beispiel - in der Praxis würde man
    // die Messages zwischen beiden Transports weiterleiten)

    // Keep alive
    await new Promise(() => {});
  } catch (error) {
    console.error('Connection error:', error);
    process.exit(1);
  }
}

main();
