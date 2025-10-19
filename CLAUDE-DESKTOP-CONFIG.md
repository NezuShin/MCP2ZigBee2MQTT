# Claude Desktop Configuration for Remote Server

## Problem

Claude Desktop currently only supports **stdio** transport, not directly HTTP/SSE.

## Solution: SSH + Docker Exec

The container runs on the server, Claude Desktop connects via SSH.

---

## Setup

### 1. Container on Server (STDIO Mode!)

**Important:** Container must run in **stdio** mode (not HTTP):

**On server:**
```bash
cd /opt/zigbeeMCP
nano .env
```

**`.env` on server:**
```env
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_user
MQTT_PASSWORD=your_password
MQTT_BASE_TOPIC=zigbee2mqtt
DB_PATH=/data/zigbee2mqtt.db

# IMPORTANT: stdio mode for remote access via SSH!
TRANSPORT_MODE=stdio

# Log Level (debug, info, warn, error, silent)
# Recommended: error (minimal output in Claude Desktop)
LOG_LEVEL=error
```

**Start container:**
```bash
# Use the normal docker-compose.yml (NOT remote!)
docker compose up -d
```

### 2. SSH Key Setup (Passwordless)

So Claude Desktop can connect without password prompt:

```bash
# On your Mac: Generate SSH key (if not already present)
ssh-keygen -t ed25519 -C "claude-mcp"
# Enter, Enter, Enter (no password!)

# Copy public key to server
ssh-copy-id user@your-server

# Test (should work without password)
ssh user@your-server whoami
```

### 3. Claude Desktop Configuration

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "ssh",
      "args": [
        "user@your-server",
        "docker",
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

**Replace:**
- `user@your-server` with your SSH login (e.g. `pi@192.168.1.100`)

### 4. Restart Claude Desktop

Completely quit and restart!

---

## Alternative: Wrapper Script (if SSH key not possible)

If you don't want to use an SSH key without password:

**1. Create wrapper:**

```bash
nano ~/mcp-zigbee-wrapper.sh
```

```bash
#!/bin/bash
# SSH to server and run MCP server
# Password NOT stored here - use SSH agent!

ssh user@your-server "docker exec -i zigbee2mqtt-mcp node dist/index.js"
```

```bash
chmod +x ~/mcp-zigbee-wrapper.sh
```

**2. Claude Desktop config:**

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "/Users/your-username/mcp-zigbee-wrapper.sh"
    }
  }
}
```

---

## SSH Config (Optional, but recommended)

Makes the connection simpler and more reliable:

**`~/.ssh/config`:**

```
Host zigbee-server
    HostName 192.168.1.100
    User pi
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

**Claude Desktop config then:**

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "ssh",
      "args": [
        "zigbee-server",
        "docker",
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

---

## Testing

### 1. Manual Test

```bash
# Should show MCP server output
ssh user@your-server "docker exec -i zigbee2mqtt-mcp node dist/index.js"

# You should see:
# === ZigBee2MQTT MCP Server ===
# Transport Mode: stdio
# ...
```

Exit with `Ctrl+C`.

### 2. Test Claude Desktop

1. Open Claude Desktop
2. New chat
3. Ask: "Which MCP servers are available?"
4. Should show "zigbee2mqtt"

### 3. Functional Test

"Show me all my ZigBee devices"

---

## Troubleshooting

### "Permission denied (publickey)"

SSH key not set up correctly:

```bash
# Copy key again
ssh-copy-id user@your-server

# Test
ssh user@your-server echo "OK"
```

### "Container zigbee2mqtt-mcp not found"

Container not running:

```bash
ssh user@your-server
docker ps | grep zigbee
# If not there:
cd /opt/zigbeeMCP
docker compose up -d
```

### "Transport Mode: http" in logs

Wrong config! Container running in HTTP mode:

```bash
ssh user@your-server
cd /opt/zigbeeMCP
nano .env
# Set: TRANSPORT_MODE=stdio
docker compose restart
```

### Claude Desktop doesn't see server

1. Check config file:
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Validate JSON syntax (e.g. on jsonlint.com)

3. Completely restart Claude Desktop

### Connection is slow

Enable SSH compression:

**`~/.ssh/config`:**
```
Host zigbee-server
    HostName 192.168.1.100
    User pi
    IdentityFile ~/.ssh/id_ed25519
    Compression yes
    ServerAliveInterval 60
```

### Too many logs

**Adjust server `.env`:**
```env
LOG_LEVEL=error  # Minimal output
```

**Restart container:**
```bash
ssh user@your-server
cd /opt/zigbeeMCP
docker compose restart
```

**Log levels:**
- `silent` - No output
- `error` - Only errors (recommended for Claude Desktop)
- `warn` - Warnings + errors
- `info` - Normal
- `debug` - All details

---

## Advantages of This Solution

✅ **Simple** - No HTTP/SSE layer needed
✅ **Secure** - SSH encrypted
✅ **Reliable** - Standard protocol
✅ **No additional port** - Only SSH (22)
✅ **Container runs continuously** - Always collecting data

---

## Summary

```bash
# On server
cd /opt/zigbeeMCP
# .env: TRANSPORT_MODE=stdio
docker compose up -d

# On Mac
ssh-copy-id user@server

# Claude Desktop config
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "ssh",
      "args": [
        "user@server",
        "docker", "exec", "-i",
        "zigbee2mqtt-mcp",
        "node", "dist/index.js"
      ]
    }
  }
}

# Restart Claude Desktop
```

**Done!** 🎉
