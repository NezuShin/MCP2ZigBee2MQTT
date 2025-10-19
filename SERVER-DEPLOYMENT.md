# Server Deployment Guide

## Overview

This guide shows how to run the ZigBee2MQTT MCP Server permanently on a **remote server** (e.g., Raspberry Pi, Linux server) and access it from your **Mac with Claude Desktop**.

## Benefits

✅ **Container runs 24/7** - Continuously collects data
✅ **Timestamp tracking** - `last_seen`, `created_at`, `updated_at` automatically updated
✅ **Persistent database** - Data persists after restart
✅ **Auto-restart** - Container starts automatically after reboot
✅ **Access from anywhere** - Via SSH from your Mac

---

## Part 1: Server Setup

### 1. Transfer Project to Server

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

### 2. Login to Server

```bash
ssh USER@SERVER_IP

# Example:
ssh pi@192.168.1.100
```

### 3. Environment Configuration

```bash
cd /opt/zigbeeMCP

# Create .env file
cp .env.example .env
nano .env
```

**Important settings in `.env`:**

```env
# MQTT Broker (usually localhost on server)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_mqtt_user
MQTT_PASSWORD=your_mqtt_password
MQTT_BASE_TOPIC=zigbee2mqtt

# Database
DB_PATH=/data/zigbee2mqtt.db

# Transport Mode (IMPORTANT: stdio for SSH access!)
TRANSPORT_MODE=stdio

# Log Level (error = minimal output)
LOG_LEVEL=error
```

**Important:**
- `MQTT_BROKER_URL`: If MQTT broker runs on server → `mqtt://localhost:1883`
- `TRANSPORT_MODE`: **MUST be `stdio`** for SSH access from Claude Desktop!

### 4. Start Container

```bash
cd /opt/zigbeeMCP

# Build and start container
docker compose up -d

# Check logs
docker compose logs -f
```

**Expected output:**
```
=== ZigBee2MQTT MCP Server ===
✓ Ready: XX devices, XXX fields, XXX capabilities
```

**Check container status:**
```bash
docker ps | grep zigbee
```

You should see:
```
zigbee2mqtt-mcp   Up X minutes
```

### 5. Verify Database Persistence

```bash
# Check if database was created
ls -lh /opt/zigbeeMCP/data/

# You should see:
# zigbee2mqtt.db
```

### 6. Test Auto-Start After Reboot

```bash
# Restart server
sudo reboot

# Login again after restart
ssh USER@SERVER_IP

# Check if container is running
docker ps | grep zigbee

# Should have started automatically!
```

---

## Part 2: Mac Setup (Claude Desktop Access)

### 1. SSH Key Setup (Passwordless)

**On your Mac:**

```bash
# Generate SSH key (if not already present)
ssh-keygen -t ed25519 -C "claude-mcp"
# Enter, Enter, Enter (no password!)

# Copy public key to server
ssh-copy-id USER@SERVER_IP

# Example:
ssh-copy-id pi@192.168.1.100

# Test (should work without password)
ssh USER@SERVER_IP whoami
```

### 2. SSH Config (Optional, but recommended)

**Create `~/.ssh/config`:**

```bash
nano ~/.ssh/config
```

**Contents:**

```
Host zigbee-server
    HostName 192.168.1.100
    User pi
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

**Advantage:** You can then simply use `ssh zigbee-server` instead of `ssh pi@192.168.1.100`.

### 3. Claude Desktop Configuration

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Option A: With SSH Config (recommended)**

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

**Option B: Without SSH Config**

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "ssh",
      "args": [
        "USER@SERVER_IP",
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

**Example:**

```json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "ssh",
      "args": [
        "pi@192.168.1.100",
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

### 4. Test Claude Desktop

1. **Completely quit Claude Desktop** (Cmd+Q)
2. **Restart**
3. **New chat**
4. **Test questions:**

```
Which MCP servers are available?
→ Should show "zigbee2mqtt"

Show me all my ZigBee devices
→ Should show your device list

Which devices were added in the last 7 days?
→ Tests the new get_recent_devices tool
```

---

## Part 3: Verify Timestamp Tracking

### On the server:

```bash
ssh USER@SERVER_IP
cd /opt/zigbeeMCP

# Display timestamps of last 5 devices
sqlite3 data/zigbee2mqtt.db "
  SELECT
    friendly_name,
    datetime(created_at/1000, 'unixepoch', 'localtime') as created,
    datetime(last_seen/1000, 'unixepoch', 'localtime') as last_seen
  FROM devices
  ORDER BY last_seen DESC
  LIMIT 5;
"
```

**Expected output:**

```
Router03|2025-10-18 20:35:08|2025-10-19 06:09:37
BedroomCeilingLight|2025-10-18 20:35:08|2025-10-19 06:07:15
...
```

**What you should see:**
- `created`: Stays the same (when device was added)
- `last_seen`: **Changes continuously** when devices send MQTT messages!

### Via Claude Desktop:

```
Show me info for "Router03"
```

Claude should respond with:
- `created_at`: Unix timestamp
- `last_seen`: Unix timestamp (current!)
- `updated_at`: Unix timestamp

---

## Part 4: Maintenance & Monitoring

### Check Container Status

```bash
# On server
ssh USER@SERVER_IP

# Container running?
docker ps | grep zigbee

# View logs
docker compose -f /opt/zigbeeMCP/docker-compose.yml logs -f

# Last 50 lines
docker compose -f /opt/zigbeeMCP/docker-compose.yml logs --tail=50
```

### Restart Container

```bash
ssh USER@SERVER_IP
cd /opt/zigbeeMCP

docker compose restart

# Or rebuild completely
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database Backup

```bash
# On server
ssh USER@SERVER_IP

# Create backup
cp /opt/zigbeeMCP/data/zigbee2mqtt.db \
   /opt/zigbeeMCP/data/zigbee2mqtt.db.backup-$(date +%Y%m%d)

# Automatic backup (Cron)
# Add to crontab: crontab -e
0 3 * * * cp /opt/zigbeeMCP/data/zigbee2mqtt.db /opt/zigbeeMCP/data/zigbee2mqtt.db.backup-$(date +\%Y\%m\%d)
```

### Deploy Updates

**From your Mac:**

```bash
# Copy code changes to server
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude 'data' \
  /path/to/zigbeeMCP/ \
  USER@SERVER_IP:/opt/zigbeeMCP/

# Rebuild on server
ssh USER@SERVER_IP "cd /opt/zigbeeMCP && docker compose down && docker compose build --no-cache && docker compose up -d"
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs

# Common problems:
# - MQTT broker unreachable → Check MQTT_BROKER_URL
# - Port conflict → Stop other containers
# - Permissions → sudo chown -R $USER:$USER /opt/zigbeeMCP/data
```

### SSH connection fails

```bash
# Test SSH key
ssh -v USER@SERVER_IP

# Copy key again
ssh-copy-id USER@SERVER_IP
```

### Claude Desktop doesn't see MCP server

1. Check config file:
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Validate JSON syntax: jsonlint.com

3. Completely restart Claude Desktop

4. Test manually:
   ```bash
   ssh USER@SERVER_IP docker exec -i zigbee2mqtt-mcp node dist/index.js
   # Should start MCP server
   ```

### Timestamps not updating

```bash
# On server: check logs
docker compose logs -f | grep -i "update\|state\|mqtt"

# Should see:
# - MQTT messages being received
# - Device states being updated
```

### "Container not found"

```bash
# Container running?
docker ps -a | grep zigbee

# Start container
cd /opt/zigbeeMCP
docker compose up -d
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
nano .env  # MQTT_BROKER_URL, TRANSPORT_MODE=stdio

# 3. Start container
docker compose up -d

# 4. Verify
docker compose logs -f
```

### On Mac (one-time):

```bash
# 1. SSH key setup
ssh-copy-id USER@SERVER

# 2. Claude Desktop config
# File: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "zigbee2mqtt": {
      "command": "ssh",
      "args": ["USER@SERVER", "docker", "exec", "-i", "zigbee2mqtt-mcp", "node", "dist/index.js"]
    }
  }
}

# 3. Restart Claude Desktop
```

### Then everything runs automatically!

✅ Container runs 24/7 on server
✅ Continuously collects data
✅ Timestamps updated in real-time
✅ Access from Claude Desktop via SSH

**Done!** 🎉
