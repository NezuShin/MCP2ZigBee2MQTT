#!/bin/bash

# MCP Wrapper Script
# Startet den Container automatisch falls er nicht läuft
# und führt dann den MCP Server aus

PROJECT_DIR="/Users/jschattka/git_private/zigbeeMCP"
CONTAINER_NAME="zigbee2mqtt-mcp"

# Prüfe ob Container läuft
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Container ${CONTAINER_NAME} nicht gefunden. Starte Container..." >&2
    cd "$PROJECT_DIR"
    docker compose up -d

    # Warte kurz bis Container bereit ist
    echo "Warte auf Container-Start..." >&2
    sleep 3

    # Prüfe nochmal
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "FEHLER: Container konnte nicht gestartet werden!" >&2
        exit 1
    fi

    echo "Container erfolgreich gestartet." >&2
fi

# Führe MCP Server im Container aus
exec docker exec -i "$CONTAINER_NAME" node dist/index.js
