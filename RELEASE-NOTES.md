# 🎉 OpenGloves v0.09 - Production Ready Release

**Release Date:** 2026-02-07

OpenGloves v0.09 is a major release that transforms OpenGloves from a basic web interface into a production-ready, secure, and feature-rich PWA for accessing your OpenClaw AI assistant.

---

## 🌟 Highlights

### 🔒 Enterprise-Grade Security
- **Challenge-Response Authentication** with SHA-256 password hashing
- **HTTPS by default** on port 8443 with auto-generated certificates
- **Encrypted WebSocket** (WSS) for all Gateway communications
- **Independent access control** separate from Gateway authentication

### 📱 Mobile-First Design
- **Dedicated mobile interface** with optimized touch controls
- **PWA installation** - install as native app on any device
- **System notifications** - get alerts even in background
- **Collapsible settings** - full control on mobile

### ⚡ Power User Features
- **Slash commands** - `/help`, `/clear`, `/export`, `/theme`, `/status`, `/reconnect`
- **Chat export** - download conversations in JSON, Markdown, or TXT
- **Theme switching** - dark, light, and auto modes
- **Real-time status** - connection monitoring and statistics

### 🚀 Deployment Simplified
- **Single port** - only expose 8443 for both HTTP and WebSocket
- **One-command install** - fully automated setup
- **One-command upgrade** - seamless migration from v0.01
- **Auto-service management** - launchd (macOS) or systemd (Linux)

---

## 📦 Installation

### New Installation

```bash
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/install-opengloves.sh | bash
```

**What you get:**
- ✅ Auto-installed to `~/.opengloves`
- ✅ Secure random access password generated
- ✅ HTTPS enabled by default
- ✅ Service auto-starts on boot
- ✅ Gateway configured automatically

### Upgrading from v0.01

```bash
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh | bash
```

**Upgrade features:**
- ✅ Automatic location migration
- ✅ Configuration preserved
- ✅ Gateway allowedOrigins updated
- ✅ Service restarted automatically
- ✅ Zero downtime upgrade

---

## 🔑 Quick Start

1. **Install OpenGloves:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/install-opengloves.sh | bash
   ```

2. **Access the interface:**
   - Visit: `https://localhost:8443`
   - Accept self-signed certificate warning
   - Enter the access password (shown during install)
   - Click Connect

3. **Try slash commands:**
   - Type `/help` to see all commands
   - Type `/export md` to download chat history
   - Type `/theme dark` to switch themes

4. **Install as PWA (optional):**
   - Click "📱 Install as App" at the bottom
   - Access from your home screen/app drawer

---

## 🔐 Security Features

### Password Authentication

**v0.09 implements secure authentication flow:**

1. Client requests challenge from `/api/auth/challenge`
2. Server returns random 32-byte nonce
3. Client computes: `hash = SHA-256(password + nonce)`
4. Client sends hash and nonce to `/api/auth`
5. Server verifies hash matches expected value

**Benefits:**
- Password never transmitted in plain text
- Each login uses unique nonce (prevents replay attacks)
- Works with HTTPS for complete security

### HTTPS Encryption

**Default configuration:**
```json
{
  "server": {
    "http": { "enabled": false },
    "https": { 
      "enabled": true, 
      "port": 8443,
      "autoGenerateCert": true
    }
  }
}
```

**Production deployment:**
- Replace self-signed cert with trusted CA certificate
- Use reverse proxy (nginx/caddy) for port 443
- Or use Cloudflare Tunnel for zero-config SSL

---

## 📱 Mobile & PWA

### Mobile Interface Features

- Compact connection panel below header
- Password + Connect/Disconnect buttons grouped
- Session key input for easy switching
- Collapsible settings panel (⚙️ button)
- Touch-optimized button sizes (44x44px)
- Automatic sidebar hiding on narrow screens

### PWA Capabilities

- **Install as App:** Appears in app drawer/home screen
- **Offline Support:** Service Worker caches static assets
- **System Notifications:** Native alerts when in background
- **Full Screen:** Immersive app experience
- **Auto-Update:** Detects and prompts for updates

### Notification Features

- Shows preview of assistant messages (first 100 chars)
- Only appears when app is in background
- Click notification to bring app to foreground
- Respects system notification preferences
- Toggle on/off in settings

---

## 🎮 Service Management

### macOS (launchd)

```bash
# Restart service
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist
launchctl load ~/Library/LaunchAgents/com.opengloves.plist

# View logs
tail -f ~/.opengloves/logs/stdout.log

# Check status
launchctl list | grep opengloves
```

### Linux (systemd)

```bash
# Restart service
systemctl --user restart opengloves

# View logs
journalctl --user -u opengloves -f

# Check status
systemctl --user status opengloves
```

---

## 🌐 Deployment Scenarios

### Local Development
- Access: `https://localhost:8443`
- Default password: `changeme123`
- Self-signed certificate (accept warning)

### LAN Access
- Access: `https://YOUR_LAN_IP:8443`
- Ensure Gateway allowedOrigins configured
- Run: `bash scripts/configure-gateway.sh`

### Public Internet
- Port forward: External → Internal 8443
- Use trusted SSL certificate
- Set strong access password
- Consider IP whitelist/firewall rules

---

## 📋 Configuration

### Minimal config.json

```json
{
  "server": {
    "https": { "enabled": true, "port": 8443 }
  },
  "gateway": {
    "url": "ws://localhost:18789",
    "token": "your-gateway-token"
  },
  "ui": {
    "accessPassword": "your-secure-password"
  }
}
```

### Gateway allowedOrigins

Edit `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "https://localhost:8443",
        "https://YOUR_LAN_IP:8443"
      ]
    }
  }
}
```

---

## 🐛 Known Issues

None reported in v0.09.

---

## 🔮 Future Plans

- Multi-session management
- Message search functionality
- File drag-and-drop upload
- Syntax highlighting for code blocks
- Message editing and regeneration
- Multiple gateway connections
- Theme customization

---

## 📞 Support

- **Documentation:** [README.md](./README.md)
- **Troubleshooting:** [TROUBLESHOOTING-MAC.md](./TROUBLESHOOTING-MAC.md)
- **Service Help:** [SERVICE-MACOS.md](./SERVICE-MACOS.md)
- **Issues:** https://github.com/buxue2025/opengloves/issues

---

## 🙏 Acknowledgments

Thanks to:
- OpenClaw team for the amazing AI assistant
- All testers on Mac Mini and mobile devices
- Contributors and feedback providers

---

**Enjoy OpenGloves v0.09!** 🧤✨
