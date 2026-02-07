#!/bin/bash
# OpenGloves Auto Upgrade Script
# Upgrades from v0.01 to v0.02
# Also migrates from ~/opengloves to ~/.opengloves

set -e  # Exit on error

echo "🧤 OpenGloves 自动升级脚本 v0.01 → v0.02"
echo ""

# Detect current installation directory
CURRENT_DIR=$(pwd)
OLD_LOCATION="$HOME/opengloves"
NEW_LOCATION="$HOME/.opengloves"

# Check if we're in an opengloves directory
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在 opengloves 目录中运行此脚本"
    echo "   cd ~/opengloves && bash upgrade.sh"
    echo "   或 cd ~/.opengloves && bash upgrade.sh"
    exit 1
fi

# Check if this is the old location
MIGRATE_LOCATION=false
if [ "$CURRENT_DIR" = "$OLD_LOCATION" ]; then
    echo "📦 检测到旧安装位置: ~/opengloves"
    echo "💡 建议迁移到标准位置: ~/.opengloves"
    echo ""
    read -p "是否要迁移到新位置？(Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        MIGRATE_LOCATION=true
    fi
    echo ""
fi

# Auto-detect installation if not in a directory
if [ ! -f "package.json" ]; then
    echo "🔍 自动检测安装位置..."
    
    if [ -d "$NEW_LOCATION" ]; then
        cd "$NEW_LOCATION"
        echo "✅ 找到安装: $NEW_LOCATION"
        CURRENT_DIR="$NEW_LOCATION"
    elif [ -d "$OLD_LOCATION" ]; then
        cd "$OLD_LOCATION"
        echo "✅ 找到安装: $OLD_LOCATION"
        CURRENT_DIR="$OLD_LOCATION"
        MIGRATE_LOCATION=true
        echo "💡 将迁移到标准位置: $NEW_LOCATION"
    else
        echo "❌ 错误：未找到 OpenGloves 安装"
        echo "   请先安装 OpenGloves"
        exit 1
    fi
    echo ""
fi

# Check if config.json exists
if [ ! -f "config.json" ]; then
    echo "❌ 错误：未找到 config.json 文件"
    exit 1
fi

echo "📋 升级前检查..."
echo ""

# Show current version
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo "当前版本: $CURRENT_VERSION"
echo ""

# Backup current config
echo "💾 备份配置文件..."
BACKUP_FILE="config.json.backup.$(date +%Y%m%d_%H%M%S)"
cp config.json "$BACKUP_FILE"
echo "✅ 已备份到: $BACKUP_FILE"
echo ""

# Save current config values
echo "📝 读取当前配置..."
GATEWAY_URL=$(python3 -c "import json; print(json.load(open('config.json')).get('gateway', {}).get('url', 'ws://localhost:18789'))" 2>/dev/null || echo "ws://localhost:18789")
GATEWAY_TOKEN=$(python3 -c "import json; print(json.load(open('config.json')).get('gateway', {}).get('token', ''))" 2>/dev/null || echo "")
SESSION_KEY=$(python3 -c "import json; print(json.load(open('config.json')).get('ui', {}).get('sessionKey', 'main'))" 2>/dev/null || echo "main")

echo "  Gateway URL: $GATEWAY_URL"
echo "  Token: ${GATEWAY_TOKEN:0:20}..." 
echo "  Session Key: $SESSION_KEY"
echo ""

# Stop any running server
echo "🛑 停止正在运行的服务器..."
pkill -f "node server.js" 2>/dev/null || true
sleep 2
echo ""

# Pull latest code
echo "📥 拉取最新代码..."
git fetch origin
git pull origin main
echo ""

# Show new version
NEW_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo "✅ 已更新到版本: $NEW_VERSION"
echo ""

# Check if UI config exists
HAS_UI_CONFIG=$(python3 -c "import json; print('ui' in json.load(open('config.json')))" 2>/dev/null || echo "False")

if [ "$HAS_UI_CONFIG" = "False" ]; then
    echo "🔧 更新配置文件..."
    
    # Generate random password
    if command -v openssl &> /dev/null; then
        ACCESS_PASSWORD=$(openssl rand -hex 8)
    else
        ACCESS_PASSWORD="changeme123"
    fi
    
    # Update config.json with Python
    python3 << EOF
import json

# Read current config
with open('config.json', 'r') as f:
    config = json.load(f)

# Add UI configuration if not exists
if 'ui' not in config:
    config['ui'] = {}

config['ui']['title'] = 'OpenGloves'
config['ui']['sessionKey'] = '$SESSION_KEY'
config['ui']['accessPassword'] = '$ACCESS_PASSWORD'

# Preserve gateway settings
if 'gateway' not in config:
    config['gateway'] = {}
config['gateway']['url'] = '$GATEWAY_URL'
if '$GATEWAY_TOKEN':
    config['gateway']['token'] = '$GATEWAY_TOKEN'

# Write updated config
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2)

print('✅ 配置文件已更新')
EOF

    echo ""
    echo "🔐 访问密码已设置为: $ACCESS_PASSWORD"
    echo "   （请保存此密码，登录时需要使用）"
    echo ""
else
    echo "✅ 配置文件已包含 UI 设置，跳过更新"
    # Check if accessPassword exists
    HAS_PASSWORD=$(python3 -c "import json; print('accessPassword' in json.load(open('config.json')).get('ui', {}))" 2>/dev/null || echo "False")
    
    if [ "$HAS_PASSWORD" = "False" ]; then
        echo "⚠️  未检测到访问密码，添加默认密码..."
        
        if command -v openssl &> /dev/null; then
            ACCESS_PASSWORD=$(openssl rand -hex 8)
        else
            ACCESS_PASSWORD="changeme123"
        fi
        
        python3 << EOF
import json
with open('config.json', 'r') as f:
    config = json.load(f)
config['ui']['accessPassword'] = '$ACCESS_PASSWORD'
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2)
EOF
        echo "🔐 访问密码已设置为: $ACCESS_PASSWORD"
    else
        EXISTING_PASSWORD=$(python3 -c "import json; print(json.load(open('config.json')).get('ui', {}).get('accessPassword', ''))" 2>/dev/null || echo "")
        echo "🔐 使用现有访问密码: ${EXISTING_PASSWORD:0:5}***"
    fi
    echo ""
fi

# Install any new dependencies (if needed)
if [ -f "package-lock.json" ]; then
    echo "📦 检查依赖..."
    npm install --silent 2>/dev/null || true
    echo ""
fi

# Configure OpenClaw Gateway allowedOrigins
echo "🔧 配置 OpenClaw Gateway..."
if [ -f "$HOME/.openclaw/openclaw.json" ]; then
    # Get local IPs
    LOCAL_IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '^127\.' | head -3)
    
    python3 << 'PYEOF'
import json
import os
import subprocess

openclaw_config = os.path.expanduser('~/.openclaw/openclaw.json')

try:
    with open(openclaw_config, 'r') as f:
        config = json.load(f)
    
    # Get local IPs
    try:
        result = subprocess.run(['hostname', '-I'], capture_output=True, text=True)
        local_ips = [ip.strip() for ip in result.stdout.split() if ip.strip() and not ip.startswith('127.')]
    except:
        local_ips = []
    
    # Build origins list with HTTPS and port 8443
    origins = [
        "https://localhost:8443",
        "https://127.0.0.1:8443"
    ]
    
    for ip in local_ips[:3]:  # Limit to first 3 IPs
        origins.append(f"https://{ip}:8443")
    
    # Get current origins
    current_origins = config.get('gateway', {}).get('controlUi', {}).get('allowedOrigins', [])
    
    # Merge origins (keep existing, add new)
    all_origins = list(set(current_origins + origins))
    
    # Update config
    if 'gateway' not in config:
        config['gateway'] = {}
    if 'controlUi' not in config['gateway']:
        config['gateway']['controlUi'] = {}
    config['gateway']['controlUi']['allowedOrigins'] = all_origins
    
    # Save
    with open(openclaw_config, 'w') as f:
        json.dump(config, f, indent=4)
    
    print("✅ Gateway allowedOrigins 已更新")
    
    # Check if gateway restart is needed
    new_origins = [o for o in origins if o not in current_origins]
    if new_origins:
        print("   新增 origins:")
        for origin in new_origins:
            print(f"      - {origin}")
        print("")
        print("⚠️  需要重启 OpenClaw Gateway:")
        print("   systemctl --user restart openclaw-gateway")
    else:
        print("   所有必需的 origins 已存在")
    
except Exception as e:
    print(f"⚠️  无法自动配置 Gateway: {e}")
    print("   请运行: bash scripts/configure-gateway.sh")
PYEOF
    echo ""
else
    echo "⚠️  未找到 OpenClaw 配置，跳过 Gateway 配置"
    echo "   如需配置，请运行: bash scripts/configure-gateway.sh"
    echo ""
fi

# Migrate to new location if requested
if [ "$MIGRATE_LOCATION" = true ]; then
    echo "🚚 迁移到新位置..."
    
    # Ensure new location doesn't exist
    if [ -d "$NEW_LOCATION" ]; then
        echo "⚠️  目标位置已存在，删除中..."
        rm -rf "$NEW_LOCATION"
    fi
    
    # Copy to new location
    cp -r "$OLD_LOCATION" "$NEW_LOCATION"
    
    echo "✅ 已迁移到: $NEW_LOCATION"
    echo ""
    echo "🗑️  删除旧位置..."
    rm -rf "$OLD_LOCATION"
    echo "✅ 已清理旧文件"
    echo ""
    
    # Change to new directory
    cd "$NEW_LOCATION"
    CURRENT_DIR="$NEW_LOCATION"
fi

echo "✨ 升级完成！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ "$MIGRATE_LOCATION" = true ]; then
    echo "📍 新安装位置: $NEW_LOCATION"
    echo ""
fi
echo "🆕 v0.02 新特性："
echo "  ⚡ 快捷命令系统 (/help, /clear, /export, /theme)"
echo "  🔐 挑战-响应密码认证（SHA-256 哈希）"
echo "  📱 移动端优化界面"
echo "  📲 PWA 应用支持"
echo "  🛡️ 密码哈希传输，防止嗅探和重放攻击"
echo ""
echo "🚀 启动服务器："
if [ "$MIGRATE_LOCATION" = true ]; then
    echo "  cd ~/.opengloves"
else
    echo "  cd $CURRENT_DIR"
fi
echo "  npm start"
echo ""
echo "🌐 访问地址："
echo "  https://localhost:8443"
echo "  ⚠️  首次访问会看到证书警告，点击'继续访问'即可"
echo ""
if [ -n "$ACCESS_PASSWORD" ]; then
    echo "🔑 访问密码："
    echo "  $ACCESS_PASSWORD"
    echo ""
fi
echo "💡 使用提示："
echo "  1. 输入访问密码后点击 Connect"
echo "  2. 输入 /help 查看所有快捷命令"
echo "  3. 使用 /export md 导出聊天记录"
echo "  4. 移动端可安装为 PWA 应用"
echo ""
echo "🔒 安全提醒："
echo "  • 密码已使用 SHA-256 哈希传输"
echo "  • 公网访问请务必启用 HTTPS"
echo "  • 建议修改默认密码（编辑 config.json）"
echo ""
echo "📋 备份文件："
echo "  $BACKUP_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
