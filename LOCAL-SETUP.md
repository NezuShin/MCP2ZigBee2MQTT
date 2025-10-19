# Local Installation (Container on Mac)

The simplest method for local operation.

## Setup

### 1. Create .env File

```bash
cd /path/to/zigbeeMCP
cp .env.example .env
nano .env
```

**`.env` content:**
```env
# MQTT Broker (where does your Mosquitto run?)
# If on Mac: localhost
# If on another device: IP address
MQTT_BROKER_URL=mqtt://localhost:1883

# MQTT Credentials (if needed)
MQTT_USERNAME=
MQTT_PASSWORD=

# ZigBee2MQTT Base Topic
MQTT_BASE_TOPIC=zigbee2mqtt

# Database Path (in container)
DB_PATH=/data/zigbee2mqtt.db

# Transport Mode: stdio for local access
TRANSPORT_MODE=stdio

# Log Level (debug, info, warn, error, silent)
# Recommendation: 'error' for minimal output in Claude Desktop
LOG_LEVEL=error
```

**Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

### 2. Start Container

```bash
docker compose up -d
```

**Check:**
```bash
docker compose logs -f
```

You should see (with `LOG_LEVEL=error`):
```
=== ZigBee2MQTT MCP Server ===
✓ Ready: 15 devices, 87 fields, 42 capabilities
```

Or with `LOG_LEVEL=info` (more details):
```
[INFO] MQTT connected
[INFO] Discovered 15 devices
[INFO] MCP Server ready
✓ Ready: 15 devices, 87 fields, 42 capabilities
```

**Stop with:** `Ctrl+C`

### 3. Configure Claude Desktop

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "zigbee2mqtt-mcp",
        "node",
        "dist/index.js"
      ]
    }
  }
}
```

### 4. Restart Claude Desktop

**Completely quit** and restart!

### 5. Test

In Claude Desktop:
```
Which MCP servers are available?
```

Should show: `zigbee2mqtt`

Then:
```
Show me all my ZigBee devices
```

## Adjust Log Level

The MCP server has 5 log levels for different levels of detail:

**Change in `.env`:**
```env
LOG_LEVEL=silent   # Absolutely nothing (only on errors)
LOG_LEVEL=error    # Only errors - RECOMMENDED for Claude Desktop
LOG_LEVEL=warn     # Errors + warnings
LOG_LEVEL=info     # Normal - all important events
LOG_LEVEL=debug    # Everything - for debugging
```

**After changes:**
```bash
docker compose restart
```

**Why is `error` recommended?**
- Minimal output in Claude Desktop
- No distracting logs while chatting
- Only real errors are shown
- Best user experience

## Troubleshooting

### Container not running

```bash
docker ps | grep zigbee
# Should show zigbee2mqtt-mcp

# If not:
docker compose up -d
```

### MQTT connection fails

**MQTT on Mac?**
```env
MQTT_BROKER_URL=mqtt://host.docker.internal:1883
```

**MQTT on another device?**
```env
MQTT_BROKER_URL=mqtt://192.168.1.100:1883
```

### Claude Desktop doesn't find server

1. Check config:
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Validate JSON syntax

3. **Completely** restart Claude Desktop

### Check Container Status

```bash
# View logs
docker compose logs

# Last 50 lines
docker compose logs --tail=50

# Live logs
docker compose logs -f
```

### Reset Database

```bash
docker compose down
rm -rf data/
docker compose up -d
```

## Container Management

### Start
```bash
docker compose up -d
```

### Stop
```bash
docker compose down
```

### Restart
```bash
docker compose restart
```

### Logs
```bash
docker compose logs -f
```

### Status
```bash
docker ps | grep zigbee
```

### Show Statistics
```bash
docker exec zigbee2mqtt-mcp node -e "
const db = require('better-sqlite3')('/data/zigbee2mqtt.db');
const stats = db.prepare('SELECT COUNT(*) as count FROM devices').get();
console.log('Devices:', stats.count);
db.close();
"
```

## Updates

### Update Code

```bash
cd /path/to/zigbeeMCP
git pull  # or: your own changes

# Rebuild
docker compose down
docker compose build
docker compose up -d
```

## Advantages of This Solution

✅ **Simple** - Just Docker + Claude Desktop config
✅ **Local** - Everything on your Mac
✅ **Fast** - No network latency
✅ **Secure** - No external port
✅ **Reliable** - Standard stdio transport

## Health Check (optional)

If you still want HTTP health check:

**Change `.env`:**
```env
TRANSPORT_MODE=http
HTTP_PORT=3235
```

**Restart container:**
```bash
docker compose -f docker-compose-remote.yml up -d
```

**Health check:**
```bash
curl http://localhost:3235/health
```

But then switch back to `stdio` for Claude Desktop!
