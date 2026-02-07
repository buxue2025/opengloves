# 🧤 OpenGloves

A standalone, modern web interface for chatting with your **OpenClaw** AI assistant.

## ✨ Features

### 🆕 v0.02 New Features
- ⚡ **Slash Commands** - Quick actions with `/help`, `/clear`, `/export`, `/theme`, `/status`
- 🔐 **Independent Authentication** - Secure access control separate from Gateway
- 📱 **Enhanced Mobile UI** - Dedicated mobile interface with optimized controls
- 📲 **PWA Support** - Install as native app on mobile and desktop

### Core Features
- 🌐 **Single Port Access** - Built-in WebSocket proxy, only needs port 18948 for internet access
- 🎨 **Modern Dark Theme** - Beautiful, easy-on-the-eyes interface with theme switching
- 📱 **Mobile-Optimized** - Responsive design with touch-friendly controls
- 🔒 **Secure** - HTTPS support with automatic certificate generation
- ⚡ **Real-time** - WebSocket-based live chat updates
- 📎 **File Upload** - Send images and documents to your AI
- 🌐 **LAN Access** - Access from any device on your network
- 🔧 **Zero Config** - Auto-detects gateway and works out of the box

## 🚀 Quick Start

> **Upgrading from v0.01?** Use one-command upgrade (auto-migrates to ~/.opengloves):
> ```bash
> curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh | bash
> ```
> The script will detect your installation location automatically.
> See [UPGRADE.md](./UPGRADE.md) for detailed instructions.

### Remote Installation (Recommended)

One-command installation with automatic configuration:

```bash
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/install-opengloves.sh | bash
```

**What this does:**
- ✅ Automatically downloads OpenGloves
- ✅ Detects and configures OpenClaw gateway (if available)
- ✅ Generates secure access password
- ✅ Sets up PWA manifest
- ✅ Configures WebSocket proxy

**After installation:**
```bash
cd ~/.opengloves
npm start
```

Then visit `https://localhost:18948` and enter the access password shown during installation!

### Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **OpenClaw** gateway running on the same machine or network

### Manual Installation

```bash
# Clone or download the repository
cd opengloves

# Copy example config and edit it
cp config.example.json config.json
# Edit config.json with your gateway token

# Start the server (HTTP mode)
npm start
```

Visit `https://localhost:18948` in your browser!

**Note:** You'll see a security warning because of the self-signed certificate. This is normal - click "Advanced" → "Proceed to localhost" to continue.

### 🔐 Access Setup
1. Enter the access password: `changeme123` (default)
2. Click **Connect** to access your OpenClaw gateway
3. Start chatting or use slash commands like `/help`

## 📝 Configuration

Edit `config.json` to customize your setup:

```json
{
  "server": {
    "host": "0.0.0.0",
    "http": {
      "enabled": false,
      "port": 8080
    },
    "https": {
      "enabled": true,
      "port": 18948,
      "autoGenerateCert": true
    }
  },
  "gateway": {
    "url": "ws://localhost:18789",
    "token": "your-gateway-token-here",
    "autoDetectUrl": true
  },
  "ui": {
    "title": "OpenGloves",
    "sessionKey": "main",
    "accessPassword": "changeme123"
  }
}
```

### Getting Your Gateway Token

Your OpenClaw gateway token can be found in:
```bash
~/.openclaw/openclaw.json
```

Look for `gateway.auth.token`.

## 🔒 Security Features

### Password Protection (v0.02)

OpenGloves v0.02 implements secure password authentication:

- 🔐 **Challenge-Response Authentication**
  - Server generates random nonce for each login
  - Client hashes password with nonce using SHA-256
  - Password never transmitted in plain text

- 🛡️ **Defense Against Attacks**
  - Prevents password sniffing
  - Mitigates replay attacks
  - Protects against rainbow table attacks

### ⚠️ HTTPS Requirement

**For public/internet access, HTTPS is mandatory:**

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

**Why HTTPS is essential:**
- Even with password hashing, session data needs encryption
- Protects chat content from eavesdropping
- Prevents man-in-the-middle attacks
- Required for secure PWA installation

**Warning:** OpenGloves will display a warning if accessed over HTTP from non-localhost addresses.

## ⚡ Using Slash Commands

OpenGloves supports convenient slash commands:

- `/help` - Show all available commands
- `/clear` - Clear chat history  
- `/status` - Show connection status and statistics
- `/export [format]` - Export chat (json/md/txt)
- `/theme [mode]` - Switch theme (dark/light/auto)
- `/reconnect` - Reconnect to gateway

Example: Type `/export md` to download your chat as Markdown.

## 📱 Mobile & PWA Usage

### Mobile Interface
- On mobile devices, OpenGloves shows a compact interface
- Password and connection controls are grouped for easy access
- Touch-optimized buttons and spacing

### Install as App (PWA)
1. Open OpenGloves in a supported browser (Chrome, Edge, Safari)
2. Look for "📱 Install as App" button at the bottom
3. Click to install as a native app on your device
4. Access from your home screen/app drawer

### Mobile Tips
- Swipe gestures work for navigation
- File upload via camera or gallery
- Offline capability when installed as PWA

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

1. Check firewall allows port 18948
2. Verify `server.host` is `"0.0.0.0"` (not `"localhost"`)
3. Check gateway `allowedOrigins` includes your server IP

## 📄 License

MIT License

## 🙏 Credits

Built for **OpenClaw** - An amazing AI assistant platform.
