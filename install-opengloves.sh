#!/bin/bash
# save as: install-opengloves.sh
echo "🧤 OpenGloves 安装脚本 for Mac Mini"
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
        
        # 更新配置
        python3 << EOF
import json
with open('config.json', 'r') as f:
    config = json.load(f)
config['gateway']['url'] = f'ws://{LOCAL_IP}:18789'
config['gateway']['token'] = '$TOKEN'
config['gateway']['fallbackUrls'] = ['ws://localhost:18789']
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2)
EOF
        echo "✅ 自动配置完成"
    fi
else
    echo "⚠️  未检测到 OpenClaw，请手动编辑 config.json"
fi
echo ""
echo "🎉 安装完成！"
echo ""
echo "启动命令:"
echo "  cd ~/opengloves"
echo "  npm start"
echo ""
echo "访问: http://localhost:8080"
