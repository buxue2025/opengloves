# 🧤 OpenGloves

A standalone, modern web interface for chatting with your **OpenClaw** AI assistant.

## ✨ Features

- 🎨 **Modern Dark Theme** - Beautiful, easy-on-the-eyes interface
- 📱 **Mobile-Friendly** - Responsive design works on all devices
- 🔒 **Secure** - HTTPS support with automatic certificate generation
- ⚡ **Real-time** - WebSocket-based live chat updates
- 📎 **File Upload** - Send images and documents to your AI
- 🌐 **LAN Access** - Access from any device on your network
- 🔧 **Zero Config** - Auto-detects gateway and works out of the box

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **OpenClaw** gateway running on the same machine or network

### Installation

```bash
# Clone or download the repository
cd opengloves

# Copy example config and edit it
cp config.example.json config.json
# Edit config.json with your gateway token

# Start the server (HTTP mode)
npm start
```

Visit `http://localhost:8080` in your browser!

## 📝 Configuration

Edit `config.json` to customize your setup:

```json
{
  "server": {
    "host": "0.0.0.0",
    "http": {
      "enabled": true,
      "port": 8080
    },
    "https": {
      "enabled": false,
      "port": 8443,
      "autoGenerateCert": true
    }
  },
  "gateway": {
    "url": "ws://localhost:18789",
    "token": "your-gateway-token-here",
    "autoDetectUrl": true
  }
}
```

### Getting Your Gateway Token

Your OpenClaw gateway token can be found in:
```bash
~/.openclaw/openclaw.json
```

Look for `gateway.auth.token`.

## 🔐 HTTPS Setup

### Automatic (Recommended)

Enable HTTPS in `config.json`:

```json
{
  "server": {
    "https": {
      "enabled": true,
      "autoGenerateCert": true
    }
  }
}
```

Then start the server:

```bash
npm start
```

A self-signed certificate will be automatically generated in `./certs/`.

### First Access

When accessing via HTTPS, your browser will show a security warning. This is normal for self-signed certificates!

1. Click **"Advanced"** or **"Show Details"**
2. Click **"Continue"** or **"Accept Risk"**
3. (Optional) Import the certificate to avoid future warnings

## 🌐 LAN Access

Access from another device on your local network is automatic! Just visit your server's IP address.

## 🛠️ Troubleshooting

### Gateway Connection Failed

1. Check gateway is running: `openclaw gateway status`
2. Verify token in `config.json` matches `~/.openclaw/openclaw.json`
3. Ensure gateway `bind` is set to `"lan"` (not `"loopback"`)

### HTTPS Certificate Error

- Browser shows warning → This is normal, click "Continue"
- Certificate generation failed → Ensure OpenSSL is installed

### Can't Access from Other Devices

1. Check firewall allows ports 8080/8443
2. Verify `server.host` is `"0.0.0.0"` (not `"localhost"`)
3. Check gateway `allowedOrigins` includes your server IP

## 📄 License

MIT License

## 🙏 Credits

Built for **OpenClaw** - An amazing AI assistant platform.
