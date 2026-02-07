#!/bin/bash
# OpenGloves Installation Script v0.02
# Supports macOS and Linux

set -e  # Exit on error

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

OS_TYPE=$(detect_os)

echo "🧤 OpenGloves v0.02 安装脚本"
echo "🖥️  检测到系统: $OS_TYPE"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 需要 Node.js 18+"
    if [ "$OS_TYPE" = "macos" ]; then
        echo "请安装: brew install node"
    elif [ "$OS_TYPE" = "linux" ]; then
        echo "请安装: sudo apt install nodejs npm  # Debian/Ubuntu"
        echo "        sudo yum install nodejs npm  # RHEL/CentOS"
    fi
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js 版本过低: $(node --version)"
    echo "   需要 Node.js 18 或更高版本"
    exit 1
fi

echo "✅ Node.js $(node --version)"
echo ""
# 克隆仓库
echo "📥 下载 OpenGloves..."
INSTALL_DIR="$HOME/.opengloves"

# 检查是否已存在
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  检测到已安装的 OpenGloves"
    echo "   位置: $INSTALL_DIR"
    echo ""
    read -p "是否要删除并重新安装? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 安装已取消"
        echo "💡 如需升级，请使用: bash <(curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh)"
        exit 1
    fi
    rm -rf "$INSTALL_DIR"
fi

git clone https://github.com/buxue2025/opengloves.git "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Install dependencies
echo "📦 安装依赖..."
if npm install; then
    echo "✅ 依赖安装完成"
else
    echo "❌ 依赖安装失败"
    exit 1
fi
echo ""

# 复制配置
echo "⚙️  配置中..."
cp config.example.json config.json
# 尝试自动配置
if [ -f "$HOME/.openclaw/openclaw.json" ]; then
    echo "🔍 检测到 OpenClaw，自动配置中..."
    
    # 提取 token
    TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.openclaw/openclaw.json')).get('gateway', {}).get('auth', {}).get('token', ''))" 2>/dev/null)
    
    if [ -n "$TOKEN" ]; then
        # 获取本机 IP
        LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
        
        # 生成随机访问密码
        ACCESS_PASSWORD=$(openssl rand -hex 8)
        
        # 更新配置
        python3 << EOF
import json
with open('config.json', 'r') as f:
    config = json.load(f)
config['gateway']['url'] = f'ws://${LOCAL_IP}:18789'
config['gateway']['token'] = '$TOKEN'
config['gateway']['fallbackUrls'] = ['ws://localhost:18789']
# 添加 v0.02 UI 配置
if 'ui' not in config:
    config['ui'] = {}
config['ui']['title'] = 'OpenGloves'
config['ui']['sessionKey'] = 'main'
config['ui']['accessPassword'] = '$ACCESS_PASSWORD'
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2)
EOF
        echo "✅ 自动配置完成"
        echo "🔐 访问密码已设置为: $ACCESS_PASSWORD"
        
        # 更新 OpenClaw allowedOrigins
        echo "🔧 配置 OpenClaw allowedOrigins..."
        python3 << 'PYEOF'
import json
import os

openclaw_config = os.path.expanduser('~/.openclaw/openclaw.json')

try:
    with open(openclaw_config, 'r') as f:
        config = json.load(f)
    
    # 获取当前 allowedOrigins
    origins = config.get('gateway', {}).get('controlUi', {}).get('allowedOrigins', [])
    
    # 获取本机 IP
    import socket
    local_ip = '$LOCAL_IP' if '$LOCAL_IP' else '192.168.1.100'
    
    # 添加必需的 origins (HTTPS + port 8443)
    required_origins = [
        'https://localhost:8443', 
        'https://127.0.0.1:8443',
        f'https://{local_ip}:8443'
    ]
    added = []
    for origin in required_origins:
        if origin not in origins:
            origins.append(origin)
            added.append(origin)
    
    # 更新配置
    if 'gateway' not in config:
        config['gateway'] = {}
    if 'controlUi' not in config['gateway']:
        config['gateway']['controlUi'] = {}
    config['gateway']['controlUi']['allowedOrigins'] = origins
    
    # 保存
    with open(openclaw_config, 'w') as f:
        json.dump(config, f, indent=2)
    
    if added:
        print(f"✅ 已添加 {len(added)} 个 origins 到 allowedOrigins")
        print("⚠️  请重启 OpenClaw Gateway 使配置生效:")
        print("   systemctl --user restart openclaw-gateway")
        print("   或: openclaw gateway restart")
    else:
        print("✅ allowedOrigins 已配置")
except Exception as e:
    print(f"⚠️  无法自动更新 allowedOrigins: {e}")
    print("   请手动添加 'http://localhost:8080' 到 ~/.openclaw/openclaw.json")
PYEOF
    fi
else
    echo "⚠️  未检测到 OpenClaw，使用默认配置"
    # 设置默认访问密码
    DEFAULT_PASSWORD="changeme123"
    python3 << EOF
import json
with open('config.json', 'r') as f:
    config = json.load(f)
# 添加 v0.02 UI 配置
if 'ui' not in config:
    config['ui'] = {}
config['ui']['title'] = 'OpenGloves'
config['ui']['sessionKey'] = 'main'
config['ui']['accessPassword'] = '$DEFAULT_PASSWORD'
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2)
EOF
    echo "🔐 默认访问密码: $DEFAULT_PASSWORD"
    ACCESS_PASSWORD="$DEFAULT_PASSWORD"
fi
echo ""

# Install service (macOS or Linux)
echo "📦 安装后台服务..."

# Create logs directory
mkdir -p "$INSTALL_DIR/logs"

# Detect OS and install appropriate service
if [ "$OS_TYPE" = "macos" ]; then
    # macOS - use launchd
    PLIST_FILE="$HOME/Library/LaunchAgents/com.opengloves.plist"
    
    # Generate plist with correct username and paths
    USERNAME=$(whoami)
    NODE_PATH=$(which node)
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.opengloves</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/logs/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
EOF
    
    # Load service
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    launchctl load "$PLIST_FILE"
    
    if launchctl list | grep -q com.opengloves; then
        echo "✅ OpenGloves 服务已启动 (launchd)"
        SERVICE_INSTALLED=true
    else
        echo "⚠️  服务启动失败，请使用手动启动"
        SERVICE_INSTALLED=false
    fi
    
elif [ "$OS_TYPE" = "linux" ]; then
    # Linux - use systemd
    SYSTEMD_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SYSTEMD_DIR"
    
    cp opengloves.service "$SYSTEMD_DIR/opengloves.service"
    systemctl --user daemon-reload
    systemctl --user enable opengloves.service
    systemctl --user start opengloves.service
    
    if systemctl --user is-active --quiet opengloves.service; then
        echo "✅ OpenGloves 服务已启动 (systemd)"
        SERVICE_INSTALLED=true
    else
        echo "⚠️  服务启动失败，请使用手动启动"
        SERVICE_INSTALLED=false
    fi
else
    echo "⚠️  未知系统，跳过服务安装"
    SERVICE_INSTALLED=false
fi

echo ""
echo "🎉 OpenGloves v0.02 安装完成！"
echo ""
echo "📍 安装位置: $INSTALL_DIR"
echo ""
echo "🆕 v0.02 新特性:"
echo "  ⚡ 快捷命令系统 (/help, /clear, /export, /theme)"
echo "  🔐 挑战-响应密码认证（SHA-256哈希）"
echo "  📱 移动端优化界面"
echo "  📲 PWA 应用支持"
echo ""
if [ "$SERVICE_INSTALLED" = true ]; then
    echo "🔧 服务管理命令:"
    if [ "$OS_TYPE" = "macos" ]; then
        echo "  停止: launchctl unload ~/Library/LaunchAgents/com.opengloves.plist"
        echo "  启动: launchctl load ~/Library/LaunchAgents/com.opengloves.plist"
        echo "  重启: launchctl unload ~/Library/LaunchAgents/com.opengloves.plist && launchctl load ~/Library/LaunchAgents/com.opengloves.plist"
        echo "  状态: launchctl list | grep opengloves"
        echo "  日志: tail -f ~/.opengloves/logs/stdout.log"
    else
        echo "  启动: systemctl --user start opengloves"
        echo "  停止: systemctl --user stop opengloves"
        echo "  重启: systemctl --user restart opengloves"
        echo "  状态: systemctl --user status opengloves"
        echo "  日志: journalctl --user -u opengloves -f"
    fi
else
    echo "🔧 手动启动:"
    echo "  cd ~/.opengloves && npm start"
fi
echo ""
echo "访问: https://localhost:8443"
echo "⚠️  首次访问会看到安全警告（自签名证书），点击'继续访问'即可"
if [ -n "$ACCESS_PASSWORD" ]; then
    echo "🔑 访问密码: $ACCESS_PASSWORD"
fi
echo ""
echo "💡 使用提示:"
echo "  1. 输入访问密码后点击 Connect"
echo "  2. 在聊天中输入 /help 查看快捷命令"
echo "  3. 移动设备可点击 '📱 安装为应用'"
echo "  4. 使用 /export md 导出聊天记录"
echo ""
echo "🔒 安全提醒:"
echo "  • 本地访问: 已启用密码哈希保护"
echo "  • 公网访问: 必须启用 HTTPS"
echo "  • 建议修改默认密码: 编辑 config.json 中的 ui.accessPassword"
