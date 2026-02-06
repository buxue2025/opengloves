#!/usr/bin/env node

/**
 * OpenGloves Server with WebSocket Proxy
 * Includes built-in WebSocket proxy to forward connections to local OpenClaw Gateway
 * This eliminates the need to expose OpenClaw port 18789 to the internet
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const configPath = path.join(__dirname, 'config.json');
let config;

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
} catch (error) {
  console.error('❌ Failed to load config.json');
  console.error('   Please copy config.example.json to config.json and configure it.');
  process.exit(1);
}

// MIME types
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// Generate self-signed certificate
function generateSelfSignedCert(certPath, keyPath) {
  console.log('🔐 Generating self-signed certificate...');
  
  const certDir = path.dirname(certPath);
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  try {
    const cmd = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=OpenGloves/O=OpenGloves/C=US"`;
    execSync(cmd, { stdio: 'ignore' });
    console.log('✅ Certificate generated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to generate certificate:', error.message);
    return false;
  }
}

// WebSocket proxy to OpenClaw Gateway
function createWebSocketProxy(server, gatewayUrl) {
  const wss = new WebSocketServer({ 
    server,
    path: '/gateway'
  });

  console.log('🔌 WebSocket proxy initialized on /gateway');

  wss.on('connection', (clientWs, request) => {
    console.log('🟢 New WebSocket connection from', request.socket.remoteAddress);
    
    // Connect to local OpenClaw Gateway
    const gatewayWs = new WebSocket(gatewayUrl);
    
    gatewayWs.on('open', () => {
      console.log('✅ Connected to OpenClaw Gateway');
    });
    
    gatewayWs.on('error', (error) => {
      console.error('❌ Gateway connection error:', error.message);
      clientWs.close(1006, 'Gateway connection failed');
    });
    
    gatewayWs.on('close', () => {
      console.log('🔴 Gateway connection closed');
      clientWs.close();
    });
    
    // Forward messages from client to gateway
    clientWs.on('message', (data) => {
      if (gatewayWs.readyState === WebSocket.OPEN) {
        gatewayWs.send(data);
      }
    });
    
    // Forward messages from gateway to client
    gatewayWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });
    
    // Handle client disconnect
    clientWs.on('close', () => {
      console.log('🔴 Client disconnected');
      gatewayWs.close();
    });
  });
  
  return wss;
}

// Create API endpoint to serve config
function createApiHandler(req, res) {
  if (req.url === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    
    // Update gateway URL to use proxy endpoint
    const protocol = req.headers['x-forwarded-proto'] || 
                    (req.connection.encrypted ? 'wss' : 'ws');
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    
    const clientConfig = {
      gateway: {
        url: `${protocol}://${host}/gateway`,  // Use proxy endpoint
        token: config.gateway.token,
        autoDetectUrl: false,  // Disable auto-detect since we're using proxy
        fallbackUrls: []
      },
      ui: config.ui
    };
    
    res.end(JSON.stringify(clientConfig));
    return true;
  }
  return false;
}

// Static file server
function createRequestHandler(publicDir) {
  return (req, res) => {
    // Try API endpoints first
    if (createApiHandler(req, res)) {
      return;
    }

    // Parse URL
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = filePath.split('?')[0];
    
    if (filePath.includes('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const fullPath = path.join(publicDir, filePath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      const indexPath = path.join(publicDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
      return;
    }

    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(fullPath).pipe(res);
  };
}

// Start servers
function startServer() {
  const publicDir = path.join(__dirname, 'public');
  const requestHandler = createRequestHandler(publicDir);
  const servers = [];

  // Get local gateway URL (always use localhost for internal connection)
  const gatewayUrl = config.gateway.url.replace(/ws:\/\/[^:]+:/, 'ws://localhost:');
  console.log('🔌 Gateway URL for proxy:', gatewayUrl);

  // Start HTTP server
  if (config.server.http.enabled) {
    const httpServer = http.createServer(requestHandler);
    
    // Add WebSocket proxy
    createWebSocketProxy(httpServer, gatewayUrl);
    
    httpServer.listen(config.server.http.port, config.server.host, () => {
      console.log(`🌐 HTTP server running on http://${config.server.host}:${config.server.http.port}`);
      
      const networkInterfaces = os.networkInterfaces();
      const ips = [];
      for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            ips.push(net.address);
          }
        }
      }
      if (ips.length > 0) {
        console.log('   Local network access:');
        ips.forEach(ip => {
          console.log(`   → http://${ip}:${config.server.http.port}`);
        });
      }
    });
    servers.push(httpServer);
  }

  // Start HTTPS server
  if (config.server.https.enabled) {
    const certPath = path.resolve(__dirname, config.server.https.certPath);
    const keyPath = path.resolve(__dirname, config.server.https.keyPath);

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      if (config.server.https.autoGenerateCert) {
        if (!generateSelfSignedCert(certPath, keyPath)) {
          console.error('❌ Cannot start HTTPS server without certificates');
          if (servers.length === 0) process.exit(1);
          return;
        }
      } else {
        console.error('❌ HTTPS certificates not found');
        if (servers.length === 0) process.exit(1);
        return;
      }
    }

    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const httpsServer = https.createServer(httpsOptions, requestHandler);
    
    // Add WebSocket proxy
    createWebSocketProxy(httpsServer, gatewayUrl);
    
    httpsServer.listen(config.server.https.port, config.server.host, () => {
      console.log(`🔒 HTTPS server running on https://${config.server.host}:${config.server.https.port}`);
      
      const networkInterfaces = os.networkInterfaces();
      const ips = [];
      for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            ips.push(net.address);
          }
        }
      }
      if (ips.length > 0) {
        console.log('   Local network access:');
        ips.forEach(ip => {
          console.log(`   → https://${ip}:${config.server.https.port}`);
        });
      }
      
      console.log('\n⚠️  Using self-signed certificate - your browser will show a security warning.');
      console.log('   This is normal! Click "Advanced" → "Continue" to proceed.');
    });
    servers.push(httpsServer);
  }

  if (servers.length === 0) {
    console.error('❌ No servers enabled. Please enable HTTP or HTTPS in config.json');
    process.exit(1);
  }

  console.log('\n✨ OpenGloves with WebSocket Proxy is ready!');
  console.log(`   Gateway: ${gatewayUrl} (proxied to /gateway)`);
  console.log('   Press Ctrl+C to stop\n');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    servers.forEach(server => server.close());
    process.exit(0);
  });
}

// Start the server
startServer();