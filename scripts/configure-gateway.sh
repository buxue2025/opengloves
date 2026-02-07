#!/bin/bash
# Configure OpenClaw Gateway allowedOrigins for OpenGloves

echo "🔧 OpenClaw Gateway 配置工具"
echo ""

# Check if OpenClaw config exists
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
if [ ! -f "$OPENCLAW_CONFIG" ]; then
    echo "❌ 未找到 OpenClaw 配置文件: $OPENCLAW_CONFIG"
    echo "   请确保 OpenClaw Gateway 已安装"
    exit 1
fi

echo "📝 检测当前网络配置..."
echo ""

# Get local IP addresses
LOCAL_IPS=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1')

echo "🌐 检测到的本机 IP 地址:"
echo "$LOCAL_IPS" | while read ip; do
    echo "   - $ip"
done
echo ""

# Ask user for confirmation
echo "🔐 将添加以下 origins 到 allowedOrigins:"
echo "   - https://localhost:8443"
echo "   - https://127.0.0.1:8443"
echo "$LOCAL_IPS" | while read ip; do
    echo "   - https://$ip:8443"
done
echo ""

read -p "是否继续？(Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "❌ 已取消"
    exit 0
fi

# Update OpenClaw config
echo ""
echo "⚙️  更新配置中..."

python3 << 'EOF'
import json
import os
import subprocess

config_path = os.path.expanduser('~/.openclaw/openclaw.json')

with open(config_path, 'r') as f:
    config = json.load(f)

# Get local IPs
try:
    result = subprocess.run(['hostname', '-I'], capture_output=True, text=True)
    local_ips = [ip.strip() for ip in result.stdout.split() if ip.strip() and not ip.startswith('127.')]
except:
    local_ips = []

# Build origins list
origins = [
    "https://localhost:8443",
    "https://127.0.0.1:8443"
]

for ip in local_ips:
    origins.append(f"https://{ip}:8443")

# Update config
if 'gateway' not in config:
    config['gateway'] = {}
if 'controlUi' not in config['gateway']:
    config['gateway']['controlUi'] = {}

old_origins = config['gateway']['controlUi'].get('allowedOrigins', [])
config['gateway']['controlUi']['allowedOrigins'] = origins

# Save config
with open(config_path, 'w') as f:
    json.dump(config, f, indent=4)

print("✅ 配置已更新")
print("")
print("新的 allowedOrigins:")
for origin in origins:
    marker = "🆕" if origin not in old_origins else "  "
    print(f"   {marker} {origin}")

EOF

echo ""
echo "🔄 重启 OpenClaw Gateway..."

# Try different restart methods
if systemctl --user restart openclaw-gateway 2>/dev/null; then
    echo "✅ Gateway 已通过 systemctl 重启"
elif command -v openclaw &> /dev/null; then
    openclaw gateway restart
    echo "✅ Gateway 已通过 openclaw 命令重启"
else
    echo "⚠️  请手动重启 OpenClaw Gateway:"
    echo "   systemctl --user restart openclaw-gateway"
    echo "   或: openclaw gateway restart"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 配置完成！"
echo ""
echo "🌐 现在可以从以下地址访问 OpenGloves:"
echo "   • https://localhost:8443"
echo "   • https://127.0.0.1:8443"
python3 -c "
import subprocess
try:
    result = subprocess.run(['hostname', '-I'], capture_output=True, text=True)
    ips = [ip.strip() for ip in result.stdout.split() if ip.strip() and not ip.startswith('127.')]
    for ip in ips:
        print(f'   • https://{ip}:8443')
except:
    pass
"
echo ""
echo "💡 提示: 首次访问会看到证书警告，点击'继续访问'即可"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
