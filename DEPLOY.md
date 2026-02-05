# 🚀 OpenGloves Deployment Guide

Complete guide for packaging and deploying OpenGloves to another machine.

## 📦 Quick Deployment (Recommended)

### On Source Machine (Where OpenGloves is Now)

```bash
# 1. Navigate to opengloves directory
cd ~/cbxprojects/opengloves

# 2. Create distribution package
./scripts/package.sh

# 3. Transfer to target machine
scp dist/opengloves-v1.0.0.tar.gz user@target-mac:~/
```

### On Target Machine (Mac Mini)

```bash
# 1. Extract package
cd ~
tar -xzf opengloves-v1.0.0.tar.gz
cd opengloves-v1.0.0

# 2. Run installation script
./scripts/install.sh

# 3. Start server
npm start
```

That's it! 🎉

---

## 📋 Detailed Step-by-Step Guide

### Phase 1: Preparation on Source Machine

#### 1.1 Verify Current Setup

```bash
cd ~/cbxprojects/opengloves

# Check that everything works
npm start
# Visit http://localhost:8080 to verify
# Press Ctrl+C to stop
```

#### 1.2 Create Distribution Package

```bash
# Run packaging script
./scripts/package.sh
```

This will create:
- `dist/opengloves-v1.0.0.tar.gz` (for Linux/macOS)
- `dist/opengloves-v1.0.0.zip` (for Windows/macOS)

**What's included:**
- ✅ All source code
- ✅ Configuration template
- ✅ Installation scripts
- ✅ Documentation
- ❌ No `node_modules` (will be installed on target)
- ❌ No `config.json` (will be created during install)
- ❌ No certificates (will be generated on target)

### Phase 2: Transfer to Target Machine

#### Option A: Using SCP (Secure Copy)

```bash
# From source machine
scp dist/opengloves-v1.0.0.tar.gz username@target-mac.local:~/
```

#### Option B: Using USB Drive

```bash
# Copy to USB
cp dist/opengloves-v1.0.0.tar.gz /Volumes/USB_DRIVE/

# On target machine, copy from USB
cp /Volumes/USB_DRIVE/opengloves-v1.0.0.tar.gz ~/
```

#### Option C: Using Shared Folder (Airdrop/Network)

macOS: Use AirDrop or drag file to shared folder

### Phase 3: Installation on Target Machine

#### 3.1 Prerequisites Check

Ensure target Mac Mini has:

**Required:**
- ✅ **Node.js 18+**
  ```bash
  # Check version
  node --version
  
  # If not installed
  brew install node
  ```

- ✅ **OpenClaw installed and running**
  ```bash
  openclaw gateway status
  ```

**Optional:**
- OpenSSL (for HTTPS) - usually pre-installed on macOS

#### 3.2 Extract and Install

```bash
# Navigate to home directory
cd ~

# Extract package
tar -xzf opengloves-v1.0.0.tar.gz
cd opengloves-v1.0.0

# Run installation script
./scripts/install.sh
```

**Installation script will:**
1. ✅ Check Node.js and OpenSSL
2. ✅ Create `config.json` from template
3. ✅ Auto-detect OpenClaw gateway settings
4. ✅ Configure gateway URL and token
5. ✅ Create necessary directories
6. ✅ Test server startup
7. ✅ Show next steps

#### 3.3 Manual Configuration (if auto-detection fails)

If the install script can't auto-detect your OpenClaw settings:

```bash
# Open config editor
nano config.json
```

Update these values:

```json
{
  "gateway": {
    "url": "ws://localhost:18789",  // ← Change if needed
    "token": "YOUR_GATEWAY_TOKEN",  // ← From ~/.openclaw/openclaw.json
    "autoDetectUrl": true
  }
}
```

**Finding your gateway token:**
```bash
# View OpenClaw config
cat ~/.openclaw/openclaw.json | grep -A 3 '"auth"'

# Look for: "token": "abc123..."
```

### Phase 4: Starting OpenGloves

#### 4.1 Test Run (Foreground)

```bash
cd ~/opengloves-v1.0.0
npm start
```

You should see:
```
✨ OpenGloves is ready!
   Gateway: ws://192.168.x.x:18789
   Press Ctrl+C to stop

🌐 HTTP server running on http://0.0.0.0:8080
   Local network access:
   → http://192.168.x.x:8080
```

**Test access:**
- Local: http://localhost:8080
- LAN: http://YOUR_MAC_IP:8080

Press `Ctrl+C` to stop.

#### 4.2 Production Run (Background with PM2)

For always-on operation:

```bash
# Install PM2 globally
npm install -g pm2

# Start OpenGloves
cd ~/opengloves-v1.0.0
pm2 start server.js --name opengloves

# Save PM2 configuration
pm2 save

# Enable auto-start on boot
pm2 startup

# Check status
pm2 status
```

**PM2 Commands:**
```bash
pm2 list          # Show all processes
pm2 logs opengloves  # View logs
pm2 restart opengloves  # Restart
pm2 stop opengloves  # Stop
pm2 delete opengloves  # Remove
```

---

## 🔐 HTTPS Setup (Optional but Recommended)

### Enable HTTPS

```bash
# Edit config
nano ~/opengloves-v1.0.0/config.json
```

Change:
```json
{
  "server": {
    "https": {
      "enabled": true,  // ← Change to true
      "port": 8443,
      "autoGenerateCert": true
    }
  }
}
```

### Restart Server

```bash
# If using npm start
# Just stop (Ctrl+C) and run: npm start

# If using PM2
pm2 restart opengloves
```

Certificates will be auto-generated in `~/opengloves-v1.0.0/certs/`.

### Access via HTTPS

Visit: `https://YOUR_MAC_IP:8443`

**Browser Security Warning:**
- Click "Advanced" → "Continue"
- This is normal for self-signed certificates
- See README.md for importing certificate to avoid warnings

---

## 🌐 Network Configuration

### Enable LAN Access

On the **Mac Mini** running OpenClaw:

1. **Update Gateway Config:**
   ```bash
   nano ~/.openclaw/openclaw.json
   ```

2. **Change bind mode:**
   ```json
   {
     "gateway": {
       "bind": "lan",  // ← Change from "loopback" to "lan"
       "port": 18789,
       "controlUi": {
         "allowedOrigins": [
           "http://localhost:8080",
           "http://192.168.x.x:8080",   // ← Add your Mac IP
           "https://192.168.x.x:8443"    // ← If using HTTPS
         ]
       }
     }
   }
   ```

3. **Restart Gateway:**
   ```bash
   systemctl --user restart openclaw-gateway
   # or
   openclaw gateway restart
   ```

### Check Firewall (if needed)

```bash
# macOS - usually doesn't block local network
# Check System Preferences → Security & Privacy → Firewall

# Linux (if applicable)
sudo ufw allow 8080/tcp
sudo ufw allow 8443/tcp
sudo ufw allow 18789/tcp
```

---

## 🔄 Updating OpenGloves

### From Source Machine

```bash
cd ~/cbxprojects/opengloves

# Make your changes...

# Create new package
./scripts/package.sh

# Transfer to target
scp dist/opengloves-v1.0.0.tar.gz user@target-mac:~/
```

### On Target Machine

```bash
# Stop running server
pm2 stop opengloves  # if using PM2
# or Ctrl+C if running in foreground

# Backup current config
cp ~/opengloves-v1.0.0/config.json ~/opengloves-config-backup.json

# Remove old version
rm -rf ~/opengloves-v1.0.0

# Extract new version
tar -xzf opengloves-v1.0.0.tar.gz
cd opengloves-v1.0.0

# Restore config
cp ~/opengloves-config-backup.json config.json

# Restart
pm2 restart opengloves
# or: npm start
```

---

## 🆘 Troubleshooting

### Gateway Connection Failed

**Symptom:** Can't connect to OpenClaw gateway

**Solutions:**
1. Check gateway is running:
   ```bash
   openclaw gateway status
   ```

2. Verify token matches:
   ```bash
   # OpenClaw config
   cat ~/.openclaw/openclaw.json | grep token
   
   # OpenGloves config
   cat ~/opengloves-v1.0.0/config.json | grep token
   ```

3. Check gateway bind mode:
   ```bash
   openclaw gateway status | grep bind
   # Should show: bind=lan
   ```

### Can't Access from Other Devices

**Symptom:** Works on localhost but not from other computers

**Solutions:**
1. Check server is bound to all interfaces:
   ```bash
   cat config.json | grep host
   # Should be: "host": "0.0.0.0"
   ```

2. Find Mac IP address:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

3. Test from target machine:
   ```bash
   curl http://YOUR_MAC_IP:8080/api/config
   ```

### HTTPS Certificate Issues

**Symptom:** Certificate generation failed

**Solutions:**
1. Check OpenSSL:
   ```bash
   which openssl
   openssl version
   ```

2. Manually generate certificate:
   ```bash
   cd ~/opengloves-v1.0.0/certs
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=OpenGloves"
   ```

### Port Already in Use

**Symptom:** Error: EADDRINUSE

**Solutions:**
1. Find process using port:
   ```bash
   lsof -i :8080
   ```

2. Kill process:
   ```bash
   kill -9 PID
   ```

3. Or change port in `config.json`

---

## 📊 Performance Tips

### Mac Mini Optimization

```bash
# Use PM2 with cluster mode (if multi-core)
pm2 start server.js -i max --name opengloves

# Set memory limit
pm2 start server.js --max-memory-restart 500M --name opengloves

# Monitor performance
pm2 monit
```

### Log Management

```bash
# PM2 logs
pm2 logs opengloves --lines 100

# Rotate logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 📞 Support

- **Documentation:** See `README.md` in the OpenGloves directory
- **OpenClaw Docs:** https://docs.openclaw.ai
- **Issues:** Check logs in `~/opengloves-v1.0.0/logs/`

---

## ✅ Deployment Checklist

**Before Transfer:**
- [ ] Test OpenGloves locally
- [ ] Create package with `./scripts/package.sh`
- [ ] Verify package contents

**On Target Machine:**
- [ ] Node.js 18+ installed
- [ ] OpenClaw gateway running
- [ ] Extract package
- [ ] Run `./scripts/install.sh`
- [ ] Review/edit `config.json`
- [ ] Test with `npm start`
- [ ] Setup PM2 for production

**Network Setup:**
- [ ] Gateway bind mode = "lan"
- [ ] Gateway allowedOrigins updated
- [ ] Firewall configured
- [ ] Test LAN access

**Optional:**
- [ ] Enable HTTPS
- [ ] Import certificate
- [ ] Setup monitoring
- [ ] Configure backups

---

Happy deploying! 🚀
