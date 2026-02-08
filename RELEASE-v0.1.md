# OpenGloves v0.1 Release Notes

## 🎉 What's New

### Session Management
- **Session Dropdown Selector**: Click ▼ next to Session Key to see all available sessions
- **Session Icons**: Visual indicators for different session types
  - 🏠 Main session
  - 👥 Group chats
  - 📢 Channels
  - ⏰ Cron jobs
  - 🔗 Webhooks
  - 🖥️ Node sessions
  - 💬 Other sessions
- **Activity Time**: Shows last active time (now, 5m ago, 2h ago, 1d ago)
- **Current Session Highlight**: Active session is highlighted in the list
- **Auto-load on Connect**: Sessions load automatically when connected
- **Manual Refresh**: 🔄 Refresh button to update session list
- **Cross-device Sync**: Session selection syncs between desktop and mobile

### Mobile Optimization (High-DPI Screens)
Optimized for devices like:
- Huawei Mate 70 Pro (460 PPI)
- iPhone 16 Pro Max (460 PPI)
- Samsung Galaxy S24 Ultra

**Improvements:**
- Larger font sizes for better readability
- Bigger touch targets (48×48px buttons)
- iOS safe area support (notch/_dynamic island)
- Disabled double-tap zoom on buttons
- Improved spacing and padding

### UI Improvements
- Fixed header stays at top while scrolling
- Connection status displayed next to logo
- Collapsible settings panel (click header to expand/collapse)
- Two-row input layout: message box on top, buttons centered below
- Bottom attachment and send buttons centered

## 📦 Installation

```bash
# Fresh install
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/install-opengloves.sh | bash

# Or manually
git clone https://github.com/buxue2025/opengloves.git ~/.opengloves
cd ~/.opengloves
npm install
node server.js
```

## ⬆️ Upgrade from v0.01

```bash
cd ~/.opengloves  # or ~/opengloves
git pull
bash upgrade.sh
```

## 🔧 Configuration

Session dropdown requires connection to OpenClaw Gateway. Configure in `config.json`:

```json
{
  "gateway": {
    "url": "ws://your-gateway:18789",
    "token": "your-token"
  },
  "ui": {
    "sessionKey": "main",
    "accessPassword": "changeme123"
  }
}
```

## 📱 Access

After starting the server:
- **Local**: https://localhost:8443
- **Network**: Check console output for IP address

**Note**: Self-signed certificates will show a security warning. Click "Advanced" → "Continue" to proceed.

## 🐛 Known Issues

- Session list requires active connection to OpenClaw Gateway
- First load may take a moment to populate session list

## 🔮 Future Plans

- Multi-session tabs
- Session search/filter
- Session favorites
- Quick session switch with keyboard shortcuts

---

**Full Changelog**: https://github.com/buxue2025/opengloves/compare/v0.01...v0.1
