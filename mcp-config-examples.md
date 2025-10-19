# MCP Configuration Examples

## Option 1: Docker Container (when container is running)

**Prerequisite:** Container must be running (`docker compose up -d`)

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "docker",
      "args": ["exec", "-i", "zigbee2mqtt-mcp", "node", "dist/index.js"]
    }
  }
}
```

**How it works:**
- Claude Desktop calls `docker exec -i zigbee2mqtt-mcp node dist/index.js`
- Runs the script in the **already running** container
- Communicates via stdio with the container

**Advantages:**
- Container runs continuously and collects data
- Database is always up to date
- Faster MCP startup (container already running)

**Disadvantages:**
- Container must be started beforehand
- If container not running → error

---

## Option 2: Start Docker Container on demand

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file", "/path/to/zigbeeMCP/.env",
        "-v", "/path/to/zigbeeMCP/data:/data",
        "zigbee2mqtt-mcp"
      ]
    }
  }
}
```

**How it works:**
- Claude Desktop starts a **new** container on each call
- `--rm`: Container is automatically deleted after use
- `-i`: Interactive mode for stdio
- `--env-file`: Loads .env file
- `-v`: Mounts database volume

**Advantages:**
- Container doesn't need to run continuously
- Starts automatically when needed

**Disadvantages:**
- Slower startup (container must start first)
- MQTT listener only collects data when Claude Desktop is running
- Not ideal for our use case (we want continuous collection)

---

## Option 3: Local Installation (without Docker)

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "node",
      "args": ["/path/to/zigbeeMCP/dist/index.js"],
      "env": {
        "MQTT_BROKER_URL": "mqtt://192.168.1.100:1883",
        "MQTT_USERNAME": "your_user",
        "MQTT_PASSWORD": "your_password",
        "MQTT_BASE_TOPIC": "zigbee2mqtt",
        "DB_PATH": "/path/to/zigbeeMCP/data/zigbee2mqtt.db"
      }
    }
  }
}
```

**How it works:**
- Starts Node.js directly on your Mac
- No Docker needed
- Environment variables directly in config

**Advantages:**
- Easier for debugging
- No Docker dependency

**Disadvantages:**
- Node.js must be installed locally
- Only runs when Claude Desktop is running
- No continuous data collection

**Tip:** Set `LOG_LEVEL=error` in the config for minimal output!

---

## Option 4: Wrapper Script for continuously running container

**Create:** `/path/to/zigbeeMCP/mcp-wrapper.sh`

```bash
#!/bin/bash

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q '^zigbee2mqtt-mcp$'; then
    echo "Starting container..." >&2
    cd /path/to/zigbeeMCP
    docker compose up -d
    sleep 2
fi

# Run MCP server
exec docker exec -i zigbee2mqtt-mcp node dist/index.js
```

```bash
chmod +x /path/to/zigbeeMCP/mcp-wrapper.sh
```

**Claude Desktop config:**

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "/path/to/zigbeeMCP/mcp-wrapper.sh"
    }
  }
}
```

**Advantages:**
- Starts container automatically when needed
- Always works
- Container continues to run

**RECOMMENDED for this use case!**

---

## Recommendation

I recommend **Option 1** or **Option 4**:

### Setup:

**1. Keep container running continuously:**
```bash
cd /path/to/zigbeeMCP
docker compose up -d
```

**2. Claude Desktop config (Option 1):**
```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "docker",
      "args": ["exec", "-i", "zigbee2mqtt-mcp", "node", "dist/index.js"]
    }
  }
}
```

**OR 2. Claude Desktop config (Option 4 - Auto-start):**

First create wrapper, then:

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "/path/to/zigbeeMCP/mcp-wrapper.sh"
    }
  }
}
```

---

## How do I test the config?

### Manual tests:

**1. Check if container is running:**
```bash
docker ps | grep zigbee2mqtt-mcp
```

**2. Test MCP server manually:**
```bash
docker exec -i zigbee2mqtt-mcp node dist/index.js
```

You should see:
```
=== ZigBee2MQTT MCP Server ===
Database: /data/zigbee2mqtt.db
MQTT Broker: mqtt://...
...
```

**3. Send a test request (in the same terminal):**
```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

Then **Ctrl+D** or **Ctrl+C** to exit.

### Test Claude Desktop:

1. **Close Claude Desktop** (quit completely)
2. Insert config into: `~/Library/Application Support/Claude/claude_desktop_config.json`
3. **Restart Claude Desktop**
4. In a chat, ask: "Which MCP servers are available?"
5. You should see "zigbee2mqtt"

---

## Common Problems

### "Container zigbee2mqtt-mcp not found"
→ Container not running. Start it first:
```bash
docker compose up -d
```

### "Cannot connect to MQTT broker"
→ Check `.env` file and MQTT broker URL

### "Permission denied: mcp-wrapper.sh"
→ Make it executable:
```bash
chmod +x /path/to/zigbeeMCP/mcp-wrapper.sh
```

### Claude Desktop doesn't see the MCP server
→ Check config path:
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Too many logs in Claude Desktop

Set in `.env`:
```env
LOG_LEVEL=error  # Minimal output
```

Then restart container:
```bash
docker compose restart
```

**Available log levels:**
- `silent` - No output
- `error` - Only errors (recommended)
- `warn` - Warnings + errors
- `info` - Normal
- `debug` - All details
