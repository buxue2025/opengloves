#!/bin/bash
# Mac Mini OpenGloves 连接修复脚本

echo "🔧 OpenGloves 连接修复工具"
echo "============================"
echo ""

cd ~/opengloves

echo "步骤 1: 备份当前配置"
cp config.json config.json.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ 已备份"
echo ""

echo "步骤 2: 读取 OpenClaw 配置"
if [ -f "$HOME/.openclaw/openclaw.json" ]; then
    TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.openclaw/openclaw.json')).get('gateway', {}).get('auth', {}).get('token', ''))" 2>/dev/null)
    GATEWAY_PORT=$(python3 -c "import json; print(json.load(open('$HOME/.openclaw/openclaw.json')).get('gateway', {}).get('port', 18789))" 2>/dev/null)
    
    if [ -n "$TOKEN" ]; then
        echo "✅ 找到 Token"
    else
        echo "❌ 无法读取 Token"
        echo "请手动编辑 config.json 添加 token"
        exit 1
    fi
else
    echo "❌ 未找到 OpenClaw 配置"
    exit 1
fi
echo ""

echo "步骤 3: 更新 OpenGloves 配置"
python3 << EOF
import json

# 读取当前配置
with open('config.json', 'r') as f:
    config = json.load(f)

# 更新配置
config['gateway']['url'] = 'ws://localhost:18789'  # 本机访问用 localhost
config['gateway']['token'] = '$TOKEN'
config['gateway']['autoDetectUrl'] = True
config['gateway']['fallbackUrls'] = [
    'ws://localhost:18789',
    'ws://127.0.0.1:18789'
]
config['server']['host'] = '0.0.0.0'  # 监听所有接口

# 保存
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2)

print("✅ 配置已更新:")
print(f"   Gateway URL: {config['gateway']['url']}")
print(f"   Token: {config['gateway']['token'][:20]}...")
print(f"   Server Host: {config['server']['host']}")
EOF
echo ""

echo "步骤 4: 重启 OpenGloves"
# 停止现有进程
pkill -f "node.*server.js" 2>/dev/null || true
sleep 2

# 启动
echo "正在启动 OpenGloves..."
nohup npm start > /tmp/opengloves.log 2>&1 &
sleep 3

# 检查是否启动成功
if lsof -i :8080 > /dev/null 2>&1; then
    echo "✅ OpenGloves 已启动"
    echo ""
    echo "🌐 访问地址:"
    echo "   本机: http://localhost:8080"
    echo "   局域网: http://$(ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1):8080"
else
    echo "❌ 启动失败，查看日志:"
    tail -20 /tmp/opengloves.log
fi
echo ""

echo "============================"
echo "修复完成！"
echo ""
echo "如果仍然无法连接，请检查:"
echo "1. OpenClaw Gateway 是否运行: openclaw gateway status"
echo "2. 浏览器控制台是否有错误信息"
echo "3. 查看日志: tail -f /tmp/opengloves.log"
