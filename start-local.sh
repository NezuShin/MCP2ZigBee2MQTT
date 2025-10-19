#!/bin/bash

# Lokales Start-Skript für Entwicklung
# Erstelle .env Datei mit deinen Einstellungen vor dem Starten

if [ ! -f .env ]; then
    echo "❌ .env Datei nicht gefunden!"
    echo "Erstelle eine .env Datei basierend auf .env.example"
    exit 1
fi

# Load .env
export $(cat .env | grep -v '^#' | xargs)

echo "=== ZigBee2MQTT MCP Server (Lokal) ==="
echo "MQTT Broker: $MQTT_BROKER_URL"
echo "Base Topic: $MQTT_BASE_TOPIC"
echo "Database: $DB_PATH"
echo ""

# Build if needed
if [ ! -d "dist" ]; then
    echo "Building TypeScript..."
    npm run build
fi

# Start server
node dist/index.js
