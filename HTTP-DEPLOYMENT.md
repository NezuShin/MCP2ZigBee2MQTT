# HTTP Deployment Guide (Local Network)

## Overview

This guide shows how to run the ZigBee2MQTT MCP Server in **HTTP mode** on a server and access it via **HTTP/SSE** (without SSH!) from your Mac.

**Perfect for local network - no API key needed!**

```
┌─────────────────────────────────────────────────────────┐
│  Server (192.168.1.100)                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Docker Container                                 │  │
│  │  - HTTP Server on port 3235                      │  │
│  │  - /sse endpoint for MCP                         │  │
│  │  - /health for status                            │  │
│  │  - NO API Key (local network)                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ HTTP (Port 3235)
                  │ Local Network
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Mac (192.168.1.10)                                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Claude Desktop                                   │  │
│  │  └─ mcp-remote                                    │  │
│  │     └─ http://192.168.1.100:3235/sse              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Part 1: Server Setup

### 1. Copy Project to Server

**From your Mac:**

```bash
# Copy project to server
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude 'data' \
  /path/to/zigbeeMCP/ \
  USER@SERVER_IP:/opt/zigbeeMCP/

# Example:
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude 'data' \
  ~/zigbeeMCP/ \
  pi@192.168.1.100:/opt/zigbeeMCP/
```

### 2. Configure .env File

**On server:**

```bash
ssh USER@SERVER_IP
cd /opt/zigbeeMCP
cp .env.example .env
nano .env
```

**Important settings:**

```env
# MQTT Broker (usually localhost on server)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_mqtt_user
MQTT_PASSWORD=your_mqtt_password
MQTT_BASE_TOPIC=zigbee2mqtt

# Database
DB_PATH=/data/zigbee2mqtt.db

# IMPORTANT: HTTP mode!
TRANSPORT_MODE=http

# Port (default: 3235, or 80 if you prefer)
HTTP_PORT=3235

# API Key (LEAVE EMPTY for local network!)
API_KEY=

# Log Level
LOG_LEVEL=error
```

**Important:**
- `TRANSPORT_MODE=http` - Must be set to http!
- `API_KEY=` - Leave empty = no authentication (OK in local network)
- `HTTP_PORT=3235` - Or `80` if preferred

### 3. Start Container in HTTP Mode

```bash
cd /opt/zigbeeMCP

# Start container with remote config
docker compose -f docker-compose-remote.yml up -d

# Check logs
docker compose -f docker-compose-remote.yml logs -f
```

**Expected output:**

```
=== ZigBee2MQTT MCP Server ===
✓ Ready: XX devices, XXX fields, XXX capabilities
✓ HTTP Server listening on port 3235
  - Health: http://localhost:3235/health
  - MCP SSE: http://localhost:3235/sse
```

### 4. Open Firewall Port (if needed)

**On server:**

```bash
# Ubuntu/Debian
sudo ufw allow 3235/tcp

# Or for port 80
sudo ufw allow 80/tcp

# Check status
sudo ufw status
```

**Important:** Usually not needed in local network!

### 5. Test Health Check

**From your Mac:**

```bash
# Replace SERVER_IP with your server IP
curl http://192.168.1.100:3235/health
```

**Expected response:**

```json
{
  "status": "ok",
  "mqtt_connected": true,
  "deviceCount": 56,
  "fieldCount": 346,
  "capabilityCount": 119
}
```

✅ If this works, the HTTP server is running!

---

## Part 2: Mac Setup (Claude Desktop)

### 1. Claude Desktop Configuration

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://192.168.1.100:3235/sse"
      ]
    }
  }
}
```

**Important:**
- Replace `192.168.1.100` with your server IP
- Port `3235` or whatever you set in `.env`
- No API key needed (since empty in `.env`)

### 2. Restart Claude Desktop

1. **Completely quit Claude Desktop** (Cmd+Q)
2. **Restart**

### 3. Test

**New chat in Claude Desktop:**

```
Which MCP servers are available?
→ Should show "zigbee2mqtt"

Show me all my ZigBee devices
→ Should show your device list

How many devices are in the ZigBee network?
→ Should show the count

Which devices were added in the last 7 days?
→ Tests the new get_recent_devices tool
```

---

## Using Port 80 (optional)

If you want to use port 80 instead of 3235:

### On Server:

**1. Change .env:**

```bash
nano /opt/zigbeeMCP/.env
```

```env
HTTP_PORT=80
```

**2. Adjust docker-compose-remote.yml:**

```bash
nano /opt/zigbeeMCP/docker-compose-remote.yml
```

Change:
```yaml
ports:
  - "80:80"
```

**3. Restart container:**

```bash
docker compose -f docker-compose-remote.yml down
docker compose -f docker-compose-remote.yml up -d
```

### On Mac:

**Claude Desktop config:**

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://192.168.1.100/sse"
      ]
    }
  }
}
```

---

## Benefits of This Solution

✅ **No SSH needed** - Direct HTTP connection
✅ **No API key** - Not needed in local network
✅ **Simpler** - Just IP and port
✅ **Faster** - Direct connection without SSH overhead
✅ **Runs 24/7** - Container continuously collects data
✅ **NAT protected** - Secure behind your router

---

## Monitoring

### Check Server Status

```bash
# On server
ssh USER@SERVER_IP

# Container running?
docker ps | grep zigbee

# View logs
docker compose -f /opt/zigbeeMCP/docker-compose-remote.yml logs -f

# Health check
curl http://localhost:3235/health
```

### From Mac

```bash
# Server reachable?
curl http://192.168.1.100:3235/health

# Should return:
# {"status":"ok","mqtt_connected":true, ...}
```

---

## Troubleshooting

### "Connection refused" from Mac

**1. Check server port:**

```bash
ssh USER@SERVER_IP
netstat -tulpn | grep 3235

# Should show:
# tcp6  0  0 :::3235  :::*  LISTEN  <PID>/node
```

**2. Check firewall:**

```bash
# On server
sudo ufw status

# If 3235 is blocked:
sudo ufw allow 3235/tcp
```

**3. Container running?**

```bash
docker ps | grep zigbee
docker compose -f docker-compose-remote.yml logs
```

### "Server not found" in Claude Desktop

**1. Check config:**

```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**2. Validate JSON syntax on jsonlint.com**

**3. Completely restart Claude Desktop**

**4. Test mcp-remote manually:**

```bash
npx -y mcp-remote http://192.168.1.100:3235/sse
# Should connect and wait for input
```

### Container won't start

```bash
# Check logs
docker compose -f docker-compose-remote.yml logs

# Common problems:
# - MQTT broker unreachable
# - Port already in use
# - TRANSPORT_MODE not set to 'http'
```

### Timestamps not updating

See SERVER-DEPLOYMENT.md for details on timestamp tracking.

---

## Restart Container

```bash
ssh USER@SERVER_IP
cd /opt/zigbeeMCP

# Restart
docker compose -f docker-compose-remote.yml restart

# Or rebuild completely
docker compose -f docker-compose-remote.yml down
docker compose -f docker-compose-remote.yml build --no-cache
docker compose -f docker-compose-remote.yml up -d
```

---

## Deploy Updates

**From your Mac:**

```bash
# Copy code to server
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude 'data' \
  /path/to/zigbeeMCP/ \
  USER@SERVER_IP:/opt/zigbeeMCP/

# Rebuild container
ssh USER@SERVER_IP "cd /opt/zigbeeMCP && docker compose -f docker-compose-remote.yml down && docker compose -f docker-compose-remote.yml build --no-cache && docker compose -f docker-compose-remote.yml up -d"
```

---

## Summary

### On Server (one-time):

```bash
# 1. Copy project
rsync -avz /path/to/zigbeeMCP/ USER@SERVER:/opt/zigbeeMCP/

# 2. Configure .env
ssh USER@SERVER
cd /opt/zigbeeMCP
cp .env.example .env
nano .env
# Set: TRANSPORT_MODE=http, API_KEY= (empty!)

# 3. Start container
docker compose -f docker-compose-remote.yml up -d

# 4. Test
curl http://localhost:3235/health
```

### On Mac (one-time):

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://192.168.1.100:3235/sse"]
    }
  }
}
```

**Restart Claude Desktop → Done!** 🎉

---

## Security

### In Local Network:

✅ **No API key needed** - All devices in LAN are trusted
✅ **NAT protects** - Not accessible from outside
✅ **HTTP OK** - No sensitive data, only device status

### For Internet Access:

⚠️ Then **DO NOT** use this method!
→ Use SSH tunnel instead (see SERVER-DEPLOYMENT.md)
→ Or enable API_KEY in .env

---

**Good luck!** For questions, also see:
- SERVER-DEPLOYMENT.md (SSH variant)
- REMOTE-SETUP.md (Detailed remote guide)
