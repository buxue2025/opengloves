#!/bin/bash
# OpenGloves Uninstallation Script for macOS
# Completely removes OpenGloves and all associated files

set -e

echo "🧤 OpenGloves Uninstaller for macOS"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS only."
    echo "For Linux, please use the manual uninstallation steps."
    exit 1
fi

INSTALL_DIR="$HOME/.opengloves"
PLIST_FILE="$HOME/Library/LaunchAgents/com.opengloves.plist"

# Check if OpenGloves is installed
if [ ! -d "$INSTALL_DIR" ] && [ ! -f "$PLIST_FILE" ]; then
    print_warning "OpenGloves does not appear to be installed."
    echo "   Neither ~/.opengloves directory nor the launchd plist file was found."
    exit 0
fi

# Show what will be removed
echo "The following will be removed:"
if [ -d "$INSTALL_DIR" ]; then
    echo "  • Application directory: $INSTALL_DIR"
    echo "    - Server files and configuration"
    echo "    - Node.js dependencies"
    echo "    - SSL certificates"
    echo "    - Log files"
fi
if [ -f "$PLIST_FILE" ]; then
    echo "  • LaunchAgent plist: $PLIST_FILE"
fi
echo ""

# Ask for confirmation
read -p "Are you sure you want to uninstall OpenGloves? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

echo ""
echo "Starting uninstallation..."
echo ""

# Step 1: Stop and unload the service
if [ -f "$PLIST_FILE" ]; then
    echo "Stopping OpenGloves service..."
    if launchctl list | grep -q com.opengloves; then
        if launchctl unload "$PLIST_FILE" 2>/dev/null; then
            print_status "Service stopped and unloaded"
        else
            print_warning "Could not unload service (may already be stopped)"
        fi
    else
        print_status "Service was not running"
    fi
else
    print_warning "LaunchAgent plist not found"
fi

# Step 2: Remove the plist file
if [ -f "$PLIST_FILE" ]; then
    echo "Removing LaunchAgent plist..."
    if rm "$PLIST_FILE"; then
        print_status "Removed: $PLIST_FILE"
    else
        print_error "Failed to remove: $PLIST_FILE"
    fi
fi

# Step 3: Remove the installation directory
if [ -d "$INSTALL_DIR" ]; then
    echo "Removing application directory..."
    if rm -rf "$INSTALL_DIR"; then
        print_status "Removed: $INSTALL_DIR"
    else
        print_error "Failed to remove: $INSTALL_DIR"
        echo "   You may need to manually delete this directory"
    fi
fi

# Step 4: Clean up any lingering processes
echo "Checking for lingering processes..."
OPENGLOVES_PIDS=$(pgrep -f "node.*server.js" 2>/dev/null || true)
if [ -n "$OPENGLOVES_PIDS" ]; then
    print_warning "Found lingering OpenGloves processes"
    echo "   PIDs: $OPENGLOVES_PIDS"
    read -p "Kill these processes? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$OPENGLOVES_PIDS" | xargs kill -9 2>/dev/null || true
        print_status "Killed lingering processes"
    fi
else
    print_status "No lingering processes found"
fi

# Step 5: Verify removal
echo ""
echo "Verifying removal..."
INSTALL_REMOVED=true
PLIST_REMOVED=true

if [ -d "$INSTALL_DIR" ]; then
    print_error "Directory still exists: $INSTALL_DIR"
    INSTALL_REMOVED=false
fi

if [ -f "$PLIST_FILE" ]; then
    print_error "Plist still exists: $PLIST_FILE"
    PLIST_REMOVED=false
fi

echo ""
echo "===================================="
if [ "$INSTALL_REMOVED" = true ] && [ "$PLIST_REMOVED" = true ]; then
    echo -e "${GREEN}🎉 OpenGloves has been successfully uninstalled!${NC}"
    echo ""
    echo "All OpenGloves files and services have been removed from your system."
else
    print_warning "Uninstallation completed with issues"
    echo ""
    echo "Some files could not be removed. You may need to manually delete them:"
    [ "$INSTALL_REMOVED" = false ] && echo "  sudo rm -rf $INSTALL_DIR"
    [ "$PLIST_REMOVED" = false ] && echo "  sudo rm $PLIST_FILE"
fi

echo ""
echo "Note: Your OpenClaw gateway (if installed separately) was not affected."
echo "      To uninstall OpenClaw, use: openclaw uninstall"
