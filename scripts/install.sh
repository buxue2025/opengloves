#!/usr/bin/env bash

#
# OpenGloves Installation Script
# Installs OpenGloves and configures it to work with OpenClaw
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

prompt() {
    echo -e "${YELLOW}?${NC} $1"
}

# Banner
echo ""
echo "╔════════════════════════════════════════╗"
echo "║     OpenGloves Installation v1.0.0     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if running on macOS or Linux
OS="$(uname -s)"
info "Detected OS: $OS"

# Check Node.js
info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    error "Node.js is not installed!"
    echo ""
    echo "Please install Node.js 18+ from:"
    echo "  macOS: brew install node"
    echo "  Linux: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
success "Node.js $NODE_VERSION found"

# Check OpenSSL (needed for HTTPS certificates)
info "Checking OpenSSL installation..."
if ! command -v openssl &> /dev/null; then
    warning "OpenSSL is not installed. HTTPS will not be available."
    echo "  To install: brew install openssl (macOS) or apt install openssl (Linux)"
else
    success "OpenSSL found"
fi

# Get installation directory
INSTALL_DIR="$(pwd)"
info "Installing to: $INSTALL_DIR"

# Check if config.json already exists
if [ -f "$INSTALL_DIR/config.json" ]; then
    warning "config.json already exists"
    read -p "Do you want to keep the existing configuration? (Y/n): " KEEP_CONFIG
    KEEP_CONFIG=${KEEP_CONFIG:-Y}
else
    KEEP_CONFIG="N"
fi

# Create config.json from example if needed
if [ "$KEEP_CONFIG" != "Y" ] && [ "$KEEP_CONFIG" != "y" ]; then
    if [ ! -f "$INSTALL_DIR/config.example.json" ]; then
        error "config.example.json not found!"
        exit 1
    fi
    
    info "Creating config.json from template..."
    cp "$INSTALL_DIR/config.example.json" "$INSTALL_DIR/config.json"
    success "Created config.json"
    
    # Try to detect OpenClaw gateway
    info "Attempting to detect OpenClaw gateway configuration..."
    OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
    
    if [ -f "$OPENCLAW_CONFIG" ]; then
        success "Found OpenClaw configuration"
        
        # Extract gateway token (using python or perl for JSON parsing)
        if command -v python3 &> /dev/null; then
            GATEWAY_TOKEN=$(python3 -c "import json; print(json.load(open('$OPENCLAW_CONFIG')).get('gateway', {}).get('auth', {}).get('token', ''))" 2>/dev/null || echo "")
            GATEWAY_PORT=$(python3 -c "import json; print(json.load(open('$OPENCLAW_CONFIG')).get('gateway', {}).get('port', 18789))" 2>/dev/null || echo "18789")
        else
            GATEWAY_TOKEN=""
            GATEWAY_PORT="18789"
        fi
        
        if [ -n "$GATEWAY_TOKEN" ]; then
            success "Found gateway token"
            
            # Get local IP address
            if [ "$OS" == "Darwin" ]; then
                # macOS
                LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
            else
                # Linux
                LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
            fi
            
            info "Detected local IP: $LOCAL_IP"
            
            # Update config.json with detected values
            if command -v python3 &> /dev/null; then
                python3 << EOF
import json
with open('$INSTALL_DIR/config.json', 'r') as f:
    config = json.load(f)
config['gateway']['url'] = 'ws://$LOCAL_IP:$GATEWAY_PORT'
config['gateway']['token'] = '$GATEWAY_TOKEN'
config['gateway']['fallbackUrls'] = ['ws://localhost:$GATEWAY_PORT', 'ws://127.0.0.1:$GATEWAY_PORT']
with open('$INSTALL_DIR/config.json', 'w') as f:
    json.dump(config, f, indent=2)
EOF
                success "Auto-configured gateway settings"
            fi
        else
            warning "Could not extract gateway token automatically"
        fi
    else
        warning "OpenClaw configuration not found at $OPENCLAW_CONFIG"
    fi
    
    echo ""
    prompt "Please review and edit config.json with your settings"
    echo "  Gateway token: Look in ~/.openclaw/openclaw.json for gateway.auth.token"
    echo "  Gateway URL: Usually ws://localhost:18789 or ws://YOUR_IP:18789"
    echo ""
    read -p "Press Enter to open config.json in editor (or skip): " EDIT_CONFIG
    
    if [ -n "$EDIT_CONFIG" ]; then
        if command -v nano &> /dev/null; then
            nano "$INSTALL_DIR/config.json"
        elif command -v vim &> /dev/null; then
            vim "$INSTALL_DIR/config.json"
        else
            warning "No editor found. Please edit config.json manually."
        fi
    fi
fi

# Ask about HTTPS
echo ""
prompt "Do you want to enable HTTPS? (y/N): "
read ENABLE_HTTPS
ENABLE_HTTPS=${ENABLE_HTTPS:-N}

if [ "$ENABLE_HTTPS" == "y" ] || [ "$ENABLE_HTTPS" == "Y" ]; then
    info "Enabling HTTPS in configuration..."
    if command -v python3 &> /dev/null; then
        python3 << EOF
import json
with open('$INSTALL_DIR/config.json', 'r') as f:
    config = json.load(f)
config['server']['https']['enabled'] = True
with open('$INSTALL_DIR/config.json', 'w') as f:
    json.dump(config, f, indent=2)
EOF
        success "HTTPS enabled"
    else
        warning "Python3 not found. Please enable HTTPS manually in config.json"
    fi
fi

# Create necessary directories
info "Creating directories..."
mkdir -p "$INSTALL_DIR/certs"
mkdir -p "$INSTALL_DIR/logs"
success "Directories created"

# Make server.js executable
if [ -f "$INSTALL_DIR/server.js" ]; then
    chmod +x "$INSTALL_DIR/server.js"
    success "Made server.js executable"
fi

# Test server startup
echo ""
info "Testing server startup..."
if timeout 3 node "$INSTALL_DIR/server.js" 2>&1 | head -10; then
    success "Server test passed"
else
    warning "Server test had issues. Check configuration."
fi

# Installation complete
echo ""
echo "╔════════════════════════════════════════╗"
echo "║     Installation Complete! 🎉          ║"
echo "╚════════════════════════════════════════╝"
echo ""
success "OpenGloves is installed at: $INSTALL_DIR"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Review configuration:"
echo "   nano $INSTALL_DIR/config.json"
echo ""
echo "2. Start the server:"
echo "   cd $INSTALL_DIR"
echo "   npm start"
echo ""
echo "3. Access OpenGloves:"
echo "   HTTP:  http://localhost:8080"
if [ "$ENABLE_HTTPS" == "y" ] || [ "$ENABLE_HTTPS" == "Y" ]; then
    echo "   HTTPS: https://localhost:8443"
fi
if [ "$LOCAL_IP" != "localhost" ] && [ -n "$LOCAL_IP" ]; then
    echo "   LAN:   http://$LOCAL_IP:8080"
fi
echo ""
echo "4. (Optional) Install as service:"
echo "   npm install -g pm2"
echo "   pm2 start $INSTALL_DIR/server.js --name opengloves"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "📚 Documentation: $INSTALL_DIR/README.md"
echo ""
