#!/bin/bash

# MCP Client Wrapper für Remote-Server via SSH Tunnel
# Dieser Wrapper startet den MCP Server über SSH und leitet stdio durch

SERVER="user@dein-server"  # Ändere dies zu deinem Server
REMOTE_PATH="/opt/zigbeeMCP"

# Stelle sicher, dass SSH Tunnel zum Server besteht
# und führe den MCP Server im stdio Mode aus
ssh "${SERVER}" "cd ${REMOTE_PATH} && docker exec -i zigbee2mqtt-mcp node dist/index.js"
