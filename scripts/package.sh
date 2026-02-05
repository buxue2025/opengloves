#!/usr/bin/env bash

#
# OpenGloves Package Script
# Creates a distribution package for deployment
#

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Get version from package.json
if command -v node &> /dev/null; then
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
else
    VERSION="1.0.0"
fi

PACKAGE_NAME="opengloves-v${VERSION}"
DIST_DIR="dist"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   OpenGloves Package Builder v${VERSION}   ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Clean previous builds
if [ -d "$DIST_DIR" ]; then
    info "Cleaning previous build..."
    rm -rf "$DIST_DIR"
fi

# Create dist directory
info "Creating distribution directory..."
mkdir -p "$DIST_DIR/$PACKAGE_NAME"

# Copy files
info "Copying files..."
cp -r public "$DIST_DIR/$PACKAGE_NAME/"
cp -r scripts "$DIST_DIR/$PACKAGE_NAME/"
cp server.js "$DIST_DIR/$PACKAGE_NAME/"
cp package.json "$DIST_DIR/$PACKAGE_NAME/"
cp config.example.json "$DIST_DIR/$PACKAGE_NAME/"
cp README.md "$DIST_DIR/$PACKAGE_NAME/"
cp .gitignore "$DIST_DIR/$PACKAGE_NAME/"

# Create DEPLOY.md if it exists
if [ -f "DEPLOY.md" ]; then
    cp DEPLOY.md "$DIST_DIR/$PACKAGE_NAME/"
fi

# Create empty directories
mkdir -p "$DIST_DIR/$PACKAGE_NAME/certs"
mkdir -p "$DIST_DIR/$PACKAGE_NAME/logs"

# Create .gitkeep files for empty directories
touch "$DIST_DIR/$PACKAGE_NAME/certs/.gitkeep"
touch "$DIST_DIR/$PACKAGE_NAME/logs/.gitkeep"

success "Files copied"

# Create installation instructions
info "Creating INSTALL.txt..."
cat > "$DIST_DIR/$PACKAGE_NAME/INSTALL.txt" << 'EOF'
╔════════════════════════════════════════╗
║     OpenGloves Installation Guide      ║
╚════════════════════════════════════════╝

🚀 Quick Start
--------------
1. Run the installation script:
   ./scripts/install.sh

2. Start the server:
   npm start

3. Access OpenGloves:
   http://localhost:8080

📋 Manual Installation
----------------------
If the install script doesn't work:

1. Copy config:
   cp config.example.json config.json

2. Edit config.json:
   - Set gateway.url (e.g., ws://localhost:18789)
   - Set gateway.token (from ~/.openclaw/openclaw.json)

3. Start server:
   node server.js

🔐 HTTPS Setup
---------------
To enable HTTPS, edit config.json:
   "server": {
     "https": {
       "enabled": true,
       "autoGenerateCert": true
     }
   }

Certificates will be auto-generated on first start.

📚 Full Documentation
--------------------
See README.md for complete documentation.

🆘 Troubleshooting
------------------
- Gateway connection failed?
  → Check token and URL in config.json
  → Ensure OpenClaw gateway is running
  → Verify gateway bind mode is "lan"

- Can't access from other devices?
  → Check firewall allows port 8080/8443
  → Verify server.host is "0.0.0.0"

Need help? Check README.md or visit:
https://docs.openclaw.ai
EOF

success "Created INSTALL.txt"

# Create archive
cd "$DIST_DIR"
info "Creating archive..."

if command -v tar &> /dev/null; then
    tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"
    success "Created ${PACKAGE_NAME}.tar.gz"
    
    # Also create zip for Windows users
    if command -v zip &> /dev/null; then
        zip -r -q "${PACKAGE_NAME}.zip" "$PACKAGE_NAME"
        success "Created ${PACKAGE_NAME}.zip"
    fi
else
    warning "tar command not found, skipping archive creation"
fi

cd ..

# Show package contents
echo ""
info "Package contents:"
if [ -f "$DIST_DIR/${PACKAGE_NAME}.tar.gz" ]; then
    tar -tzf "$DIST_DIR/${PACKAGE_NAME}.tar.gz" | head -20
    echo "  ..."
fi

# Calculate sizes
if [ -f "$DIST_DIR/${PACKAGE_NAME}.tar.gz" ]; then
    TAR_SIZE=$(du -h "$DIST_DIR/${PACKAGE_NAME}.tar.gz" | cut -f1)
    echo ""
    success "Package size: $TAR_SIZE"
fi

# Final output
echo ""
echo "╔════════════════════════════════════════╗"
echo "║      Package Creation Complete! 📦     ║"
echo "╚════════════════════════════════════════╝"
echo ""
success "Distribution packages created in: $DIST_DIR/"
echo ""
echo "📦 Available packages:"
if [ -f "$DIST_DIR/${PACKAGE_NAME}.tar.gz" ]; then
    echo "  • ${PACKAGE_NAME}.tar.gz (Linux/macOS)"
fi
if [ -f "$DIST_DIR/${PACKAGE_NAME}.zip" ]; then
    echo "  • ${PACKAGE_NAME}.zip (Windows/macOS)"
fi
echo ""
echo "📤 Transfer to target machine:"
echo "  scp $DIST_DIR/${PACKAGE_NAME}.tar.gz user@target-host:~/"
echo ""
echo "📥 On target machine:"
echo "  tar -xzf ${PACKAGE_NAME}.tar.gz"
echo "  cd ${PACKAGE_NAME}"
echo "  ./scripts/install.sh"
echo ""
