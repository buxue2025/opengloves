#!/bin/bash
# save as: install-opengloves.sh
echo "🧤 OpenGloves v2.0 安装脚本 for Mac Mini"
# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 需要 Node.js 18+"
    echo "请安装: brew install node"
    exit 1
fi
# 克隆仓库
echo "📥 下载 OpenGloves..."
cd ~
git clone https://github.com/buxue2025/opengloves.git
cd opengloves
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
# 添加 v2.0 UI 配置
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
    
    # 添加必需的 origins
    required_origins = ['http://localhost:8080', 'http://127.0.0.1:8080']
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
# 添加 v2.0 UI 配置
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
echo "🎉 OpenGloves v2.0 安装完成！"
echo ""
echo "🆕 v2.0 新特性:"
echo "  ⚡ 快捷命令系统 (/help, /clear, /export, etc.)"
echo "  🔐 独立访问密码认证"
echo "  📱 移动端优化界面"
echo "  📲 PWA 应用安装支持"
echo ""
echo "启动命令:"
echo "  cd ~/opengloves"
echo "  npm start"
echo ""
echo "访问: http://localhost:8080"
if [ -n "$ACCESS_PASSWORD" ]; then
    echo "🔑 访问密码: $ACCESS_PASSWORD"
fi
echo ""
echo "💡 使用提示:"
echo "  1. 输入访问密码后点击 Connect"
echo "  2. 在聊天中输入 /help 查看快捷命令"
echo "  3. 移动设备可点击 '📱 安装为应用'"
echo "  4. 使用 /export md 导出聊天记录"
