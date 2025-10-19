# Remote Setup Guide

This guide shows how to run the ZigBee2MQTT MCP Server on a **remote server** and access it from your **local Mac** with Claude Desktop.

## Architecture

```
┌─────────────────────────┐
│   Mac (Local)           │
│   - Claude Desktop      │
│   - HTTP MCP Client     │
└────────────┬────────────┘
             │ HTTP/SSE
             │ (Port 3235)
             │
       ┌─────▼──────────────────────────┐
       │   Server (Remote)              │
       │   ┌────────────────────────┐   │
       │   │ Docker Container       │   │
       │   │ - MCP Server (HTTP)    │   │
       │   │ - MQTT Listener        │   │
       │   │ - SQLite DB            │   │
       │   └───────┬────────────────┘   │
       │           │                    │
       │   ┌───────▼────────────┐       │
       │   │ MQTT Broker        │       │
       │   │ (Mosquitto)        │       │
       │   └───────┬────────────┘       │
       │           │                    │
       │   ┌───────▼────────────┐       │
       │   │ ZigBee2MQTT        │       │
       │   └────────────────────┘       │
       └────────────────────────────────┘
```

## Benefits

✅ **Server runs 24/7** - Continuously collects data
✅ **Mac doesn't need to be always on** - Access only when needed
✅ **Closer to MQTT broker** - Better performance
✅ **Central management** - Multiple clients can access
✅ **Docker runs on server** - No Docker needed on Mac

## Server Setup

### 1. Transfer Project to Server

```bash
# On your local Mac
cd /Users/jschattka/git_private/zigbeeMCP
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude 'data' \
  . user@your-server:/opt/zigbeeMCP/
```

### 2. Create .env File on Server

```bash
# SSH to server
ssh user@your-server

# Go to project directory
cd /opt/zigbeeMCP

# Create .env file
cp .env.example .env
nano .env
```

**Important settings:**

```env
# MQTT Broker (usually localhost on server)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_user
MQTT_PASSWORD=your_password
MQTT_BASE_TOPIC=zigbee2mqtt

# Database
DB_PATH=/data/zigbee2mqtt.db

# IMPORTANT: Enable HTTP mode!
TRANSPORT_MODE=http

# Port (default: 3235)
HTTP_PORT=3235

# API Key for security (IMPORTANT!)
API_KEY=your-super-secret-api-key-here

# Log Level (debug, info, warn, error, silent)
# Recommended: error (minimal output)
LOG_LEVEL=error
```

**Generate API Key:**

```bash
# Generate random API key
openssl rand -hex 32
# or
uuidgen
```

### 3. Start Container on Server

```bash
cd /opt/zigbeeMCP

# Start with remote config
docker compose -f docker-compose-remote.yml up -d

# Check logs
docker compose -f docker-compose-remote.yml logs -f
```

You should see:

```
=== ZigBee2MQTT MCP Server ===
Transport Mode: http
...
✓ HTTP Server listening on port 3235
  - Health: http://localhost:3235/health
  - MCP SSE: http://localhost:3235/sse
  - API Key authentication enabled
```

### 4. Configure Firewall (if needed)

```bash
# Ubuntu/Debian
sudo ufw allow 3235/tcp

# If you want to use SSH tunnel (more secure!)
# then DON'T open port 3235
```

### 5. Test Health Check

```bash
# On the server:
curl http://localhost:3235/health

# From your Mac (if port is open):
curl http://your-server:3235/health
```

Expected response:

```json
{
  "status": "ok",
  "mqtt_connected": true,
  "deviceCount": 15,
  "fieldCount": 87,
  "capabilityCount": 42
}
```

## Mac Setup (Claude Desktop)

### Option 1: Direct HTTP Access (simple)

**Prerequisite:** Port 3235 is open on the server

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "url": "http://your-server.local:3235/sse",
      "headers": {
        "Authorization": "Bearer your-super-secret-api-key-here"
      }
    }
  }
}
```

**Replace:**
- `your-server.local` with your server IP or hostname (e.g. `192.168.1.100`)
- `your-super-secret-api-key-here` with your API key from `.env`

### Option 2: SSH Tunnel (more secure!)

**Recommended for internet access!**

**1. Create SSH tunnel script:**

```bash
nano ~/ssh-tunnel-zigbee.sh
```

```bash
#!/bin/bash
# SSH Tunnel to ZigBee MCP Server
ssh -N -L 3235:localhost:3235 user@your-server
```

```bash
chmod +x ~/ssh-tunnel-zigbee.sh
```

**2. Start tunnel (in separate terminal):**

```bash
~/ssh-tunnel-zigbee.sh
# Runs continuously - don't close!
```

**3. Claude Desktop config:**

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "url": "http://localhost:3235/sse",
      "headers": {
        "Authorization": "Bearer your-super-secret-api-key-here"
      }
    }
  }
}
```

**SSH Tunnel advantages:**
- ✅ Port doesn't need to be public
- ✅ SSH encryption
- ✅ No additional firewall rule needed

## Testing

1. **Restart Claude Desktop**

2. **Ask Claude:**
   ```
   Which MCP servers are available?
   ```
   → Should show "zigbee2mqtt"

3. **Query devices:**
   ```
   Show me all my ZigBee devices
   ```

4. **Check server health:**
   ```
   How many devices are in the ZigBee network?
   ```

## Troubleshooting

### Connection fails

**1. Health check from Mac:**

```bash
# Without SSH tunnel
curl http://your-server:3235/health

# With SSH tunnel
curl http://localhost:3235/health
```

**2. Check API key:**

```bash
# Test with API key
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3235/health
```

### "Unauthorized" error

- API key set in `.env` on server?
- Same API key in Claude Desktop config?
- Restart container: `docker compose -f docker-compose-remote.yml restart`

### SSH Tunnel disconnects

**Auto-reconnect script:**

```bash
nano ~/ssh-tunnel-zigbee-autoreconnect.sh
```

```bash
#!/bin/bash
while true; do
    echo "Starting SSH tunnel..."
    ssh -N -L 3235:localhost:3235 user@your-server
    echo "SSH tunnel disconnected. Reconnecting in 5 seconds..."
    sleep 5
done
```

```bash
chmod +x ~/ssh-tunnel-zigbee-autoreconnect.sh
```

**As LaunchAgent (starts automatically):**

```bash
nano ~/Library/LaunchAgents/com.zigbee.sshtunnel.plist
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.zigbee.sshtunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/YOUR_USERNAME/ssh-tunnel-zigbee-autoreconnect.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/zigbee-tunnel.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/zigbee-tunnel-error.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.zigbee.sshtunnel.plist
```

### Container not running

```bash
# Check logs
docker compose -f docker-compose-remote.yml logs -f

# Container status
docker ps -a | grep zigbee

# Restart
docker compose -f docker-compose-remote.yml down
docker compose -f docker-compose-remote.yml up -d
```

### Too many logs

**Adjust server `.env`:**
```env
LOG_LEVEL=error  # Minimal output
```

**Restart container:**
```bash
docker compose -f docker-compose-remote.yml restart
```

**Available log levels:**
- `silent` - No logs
- `error` - Only errors (recommended)
- `warn` - Warnings + errors
- `info` - Normal
- `debug` - Everything

## Security

### Recommendations

1. **Use API key** - ALWAYS! (not optional for production)
2. **Use SSH tunnel** - Instead of opening port
3. **Configure firewall** - If port is open, only from your IP
4. **Use HTTPS** - When accessing over internet (reverse proxy)

### Example: Nginx Reverse Proxy with HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name zigbee.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/zigbee.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zigbee.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3235;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # SSE specific
        proxy_buffering off;
        proxy_cache off;
    }
}
```

Claude Desktop config with HTTPS:

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "url": "https://zigbee.your-domain.com/sse",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

## Updates

### Update Server Code

```bash
# On local Mac
cd /Users/jschattka/git_private/zigbeeMCP
git pull  # or your own changes

# Transfer to server
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude 'data' \
  . user@your-server:/opt/zigbeeMCP/

# On server
ssh user@your-server
cd /opt/zigbeeMCP
docker compose -f docker-compose-remote.yml down
docker compose -f docker-compose-remote.yml build
docker compose -f docker-compose-remote.yml up -d
```

## Monitoring

### Monitor Container Status

```bash
# Watchtower for auto-updates (optional)
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  zigbee2mqtt-mcp
```

### Logs

```bash
# Live logs
docker compose -f docker-compose-remote.yml logs -f

# Last 100 lines
docker compose -f docker-compose-remote.yml logs --tail=100

# Only errors
docker compose -f docker-compose-remote.yml logs | grep -i error
```

## Summary

**On Server:**
```bash
cd /opt/zigbeeMCP
docker compose -f docker-compose-remote.yml up -d
```

**On Mac (with SSH tunnel):**
```bash
# Terminal 1: SSH Tunnel
~/ssh-tunnel-zigbee.sh

# Claude Desktop Config:
# http://localhost:3235/sse with API key
```

**Done!** 🎉

Your MCP server now runs 24/7 on the server and continuously collects data. You only access it from your Mac when needed!
