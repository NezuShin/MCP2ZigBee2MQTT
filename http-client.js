#!/usr/bin/env node

/**
 * HTTP MCP Client
 * Verbindet sich zu einem MCP Server über HTTP/SSE (lokal oder remote)
 * und stellt stdio-Interface für Claude Desktop bereit
 */

import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

// Konfiguration
const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3235';
const API_KEY = process.env.MCP_API_KEY || '';

const SSE_URL = `${SERVER_URL}/sse`;
const MESSAGE_URL = `${SERVER_URL}/messages`;

const headers = API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {};

// SSE Verbindung zum Server
const eventSource = new EventSource(SSE_URL, { headers });

// Stdin von Claude Desktop lesen
process.stdin.setEncoding('utf8');
let buffer = '';

eventSource.onopen = () => {
  console.error('✓ Connected to MCP server:', SERVER_URL);
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  process.exit(1);
};

eventSource.onmessage = (event) => {
  // Nachricht vom Server -> an stdout (zu Claude Desktop)
  console.log(event.data);
};

// Stdin von Claude Desktop -> an Server via POST
process.stdin.on('data', async (chunk) => {
  buffer += chunk;

  // JSON-RPC Messages sind line-delimited
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        // Sende an Server
        const response = await fetch(MESSAGE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: line
        });

        if (!response.ok) {
          console.error('Server error:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Send error:', error);
      }
    }
  }
});

process.stdin.on('end', () => {
  eventSource.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  eventSource.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  eventSource.close();
  process.exit(0);
});
