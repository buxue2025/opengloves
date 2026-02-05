#!/usr/bin/env node

/**
 * OpenGloves Server
 * A standalone web server for OpenGloves chat interface
 * Supports both HTTP and HTTPS with automatic self-signed certificate generation
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
    // Generate certificate using OpenSSL
    const cmd = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=OpenGloves/O=OpenGloves/C=US"`;
    execSync(cmd, { stdio: 'ignore' });
    console.log('✅ Certificate generated successfully');
    console.log(`   Cert: ${certPath}`);
    console.log(`   Key:  ${keyPath}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to generate certificate:', error.message);
    console.error('   Please ensure OpenSSL is installed on your system.');
    return false;
  }
}

// Create API endpoint to serve config
function createApiHandler(req, res) {
  if (req.url === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    
    // Only expose necessary config to client
    const clientConfig = {
      gateway: {
        url: config.gateway.url,
        token: config.gateway.token,
        autoDetectUrl: config.gateway.autoDetectUrl,
        fallbackUrls: config.gateway.fallbackUrls || []
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
    
    // Remove query string
    filePath = filePath.split('?')[0];
    
    // Security: prevent directory traversal
    if (filePath.includes('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const fullPath = path.join(publicDir, filePath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Check if file exists
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      // SPA fallback: serve index.html for unknown routes
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

    // Serve file
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

  // Start HTTP server
  if (config.server.http.enabled) {
    const httpServer = http.createServer(requestHandler);
    httpServer.listen(config.server.http.port, config.server.host, () => {
      console.log(`🌐 HTTP server running on http://${config.server.host}:${config.server.http.port}`);
      
      // Show local network IPs
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

    // Check if certificates exist, generate if needed
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      if (config.server.https.autoGenerateCert) {
        if (!generateSelfSignedCert(certPath, keyPath)) {
          console.error('❌ Cannot start HTTPS server without certificates');
          if (servers.length === 0) {
            process.exit(1);
          }
          return;
        }
      } else {
        console.error('❌ HTTPS certificates not found:');
        console.error(`   Cert: ${certPath}`);
        console.error(`   Key:  ${keyPath}`);
        console.error('   Please generate certificates or enable autoGenerateCert in config.json');
        if (servers.length === 0) {
          process.exit(1);
        }
        return;
      }
    }

    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const httpsServer = https.createServer(httpsOptions, requestHandler);
    httpsServer.listen(config.server.https.port, config.server.host, () => {
      console.log(`🔒 HTTPS server running on https://${config.server.host}:${config.server.https.port}`);
      
      // Show local network IPs
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
      console.log(`   Or import the certificate: ${certPath}`);
    });
    servers.push(httpsServer);
  }

  if (servers.length === 0) {
    console.error('❌ No servers enabled. Please enable HTTP or HTTPS in config.json');
    process.exit(1);
  }

  console.log('\n✨ OpenGloves is ready!');
  console.log(`   Gateway: ${config.gateway.url}`);
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
