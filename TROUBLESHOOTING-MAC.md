# 🔧 Mac Mini 连接问题排查指南

## 🚨 常见连接问题及解决方案

### 问题 1: Gateway 未运行或配置错误

**症状**: 连接失败，控制台显示无法连接到 ws://... 

**检查步骤**:

```bash
# 1. 检查 OpenClaw Gateway 是否运行
openclaw gateway status

# 应该显示类似：
# Gateway: bind=lan (0.0.0.0), port=18789
# Runtime: running
```

**如果未运行**:
```bash
# 启动 Gateway
openclaw gateway run --bind lan --port 18789

# 或者使用 systemd
systemctl --user start openclaw-gateway
```

**检查 bind 模式**:
```bash
# 查看当前配置
cat ~/.openclaw/openclaw.json | grep -A 5 '"gateway"'
```

确保配置是：
```json
{
  "gateway": {
    "bind": "lan",        // ← 必须是 "lan"，不是 "loopback"
    "port": 18789,
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:8080",
        "http://YOUR_MAC_IP:8080"    // ← 添加你的 Mac IP
      ]
    }
  }
}
```

**修改后重启**:
```bash
systemctl --user restart openclaw-gateway
# 或者
openclaw gateway restart
```

---

### 问题 2: Token 不匹配

**症状**: 连接后立即断开，或显示认证失败

**检查步骤**:

```bash
# 1. 查看 OpenClaw 的 token
cat ~/.openclaw/openclaw.json | grep -A 3 '"auth"'

# 2. 查看 OpenGloves 的 token
cat ~/opengloves/config.json | grep token

# 3. 对比两者是否一致
```

**修复**:
```bash
cd ~/opengloves

# 手动更新 config.json
nano config.json

# 或者使用脚本自动同步
cp ~/.openclaw/openclaw.json /tmp/openclaw_backup.json
python3 << 'EOF'
import json

# 读取 OpenClaw 配置
with open('/tmp/openclaw_backup.json', 'r') as f:
    openclaw_config = json.load(f)

token = openclaw_config.get('gateway', {}).get('auth', {}).get('token', '')

# 读取 OpenGloves 配置
with open('config.json', 'r') as f:
    opengloves_config = json.load(f)

# 更新 token
opengloves_config['gateway']['token'] = token

# 保存
with open('config.json', 'w') as f:
    json.dump(opengloves_config, f, indent=2)

print(f"✅ Token 已更新: {token[:20]}...")
EOF
```

---

### 问题 3: 防火墙或网络问题

**症状**: 无法从其他设备访问，但本机可以

**检查步骤**:

```bash
# 1. 检查 Mac Mini 的 IP 地址
ifconfig | grep "inet " | grep -v 127.0.0.1

# 应该显示类似：
# inet 192.168.1.100 netmask ...

# 2. 检查端口是否监听
lsof -i :8080    # OpenGloves
lsof -i :18789   # OpenClaw Gateway

# 3. 测试本地连接
curl http://localhost:8080/api/config

# 4. 测试网络连接（从其他设备）
# 在另一台电脑上：
# curl http://MAC_MINI_IP:8080/api/config
```

**修复防火墙（macOS）**:
```bash
# 检查防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 如果显示 "Firewall is enabled"，可能需要添加例外
# 或者暂时关闭测试（不推荐长期使用）
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off

# 测试完成后可以重新开启
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

---

### 问题 4: Gateway URL 配置错误

**症状**: OpenGloves 页面显示但连接失败

**场景**: 
- OpenGloves 运行在 Mac Mini (192.168.1.100:8080)
- 你从 iPhone 访问 http://192.168.1.100:8080
- 但 OpenGloves 尝试连接 ws://localhost:18789

**问题**: localhost 在 iPhone 上是 iPhone 自己，不是 Mac Mini！

**修复**:

```bash
cd ~/opengloves
nano config.json
```

确保配置为：
```json
{
  "gateway": {
    "url": "ws://192.168.1.100:18789",  // ← 使用 Mac Mini 的真实 IP
    "token": "your-token",
    "autoDetectUrl": true,               // ← 启用自动检测
    "fallbackUrls": [
      "ws://localhost:18789",
      "ws://127.0.0.1:18789"
    ]
  }
}
```

**自动获取 IP 的脚本**:
```bash
cd ~/opengloves

# 获取本机 IP
MAC_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

# 更新配置
python3 << EOF
import json
with open('config.json', 'r') as f:
    config = json.load(f)
config['gateway']['url'] = f'ws://{MAC_IP}:18789'
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2)
print(f"✅ Gateway URL 已更新为: ws://{MAC_IP}:18789")
EOF

# 重启 OpenGloves
pm2 restart opengloves 2>/dev/null || pkill -f "node.*server.js" && npm start
```

---

### 问题 5: 跨域 (CORS) 问题

**症状**: 浏览器控制台显示 CORS 错误

**检查 OpenClaw 配置**:
```bash
cat ~/.openclaw/openclaw.json | grep -A 10 '"controlUi"'
```

**必须包含访问来源的 IP**:
```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://192.168.1.100:8080",     // ← Mac Mini IP
        "http://192.168.1.101:8080"      // ← 其他设备 IP（如果需要）
      ]
    }
  }
}
```

---

## 🔍 完整诊断脚本

创建一个诊断脚本 `diagnose.sh`:

```bash
#!/bin/bash

echo "🔍 OpenGloves 连接诊断"
echo "========================"
echo ""

# 1. 检查 OpenClaw
echo "1️⃣  检查 OpenClaw Gateway..."
if command -v openclaw &> /dev/null; then
    openclaw gateway status 2>&1 | head -10
else
    echo "❌ OpenClaw 未安装"
fi
echo ""

# 2. 检查 Node.js
echo "2️⃣  检查 Node.js..."
node --version
echo ""

# 3. 检查端口
echo "3️⃣  检查端口占用..."
echo "OpenGloves (8080):"
lsof -i :8080 2>/dev/null || echo "  未运行"
echo "OpenClaw (18789):"
lsof -i :18789 2>/dev/null || echo "  未运行"
echo ""

# 4. 检查配置
echo "4️⃣  检查 OpenGloves 配置..."
if [ -f "config.json" ]; then
    echo "✅ config.json 存在"
    cat config.json | grep -A 5 '"gateway"'
else
    echo "❌ config.json 不存在"
fi
echo ""

# 5. 检查网络
echo "5️⃣  检查网络配置..."
echo "本机 IP:"
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -2
echo ""

# 6. 测试连接
echo "6️⃣  测试本地连接..."
curl -s http://localhost:8080/api/config 2>&1 | head -1 || echo "❌ 连接失败"
echo ""

echo "========================"
echo "诊断完成"
```

**使用方法**:
```bash
cd ~/opengloves
chmod +x diagnose.sh
./diagnose.sh
```

---

## 🛠️ 快速修复清单

按顺序执行：

```bash
# 1. 确保在 opengloves 目录
cd ~/opengloves

# 2. 停止现有服务
pkill -f "node.*server.js" 2>/dev/null || true

# 3. 更新 Gateway URL 为真实 IP
MAC_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
python3 << EOF
import json
with open('config.json', 'r') as f:
    config = json.load(f)
config['gateway']['url'] = f'ws://{MAC_IP}:18789'
config['server']['host'] = '0.0.0.0'
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2)
print(f"✅ 配置已更新: {MAC_IP}")
EOF

# 4. 检查并启动 Gateway
if ! pgrep -f "openclaw.*gateway" > /dev/null; then
    echo "⚠️  Gateway 未运行，正在启动..."
    openclaw gateway run --bind lan --port 18789 &
    sleep 3
fi

# 5. 启动 OpenGloves
npm start
```

---

## 📞 如果还是不行

请提供以下信息：

1. **OpenClaw 状态**: `openclaw gateway status`
2. **OpenGloves 配置**: `cat config.json`
3. **Mac Mini IP**: `ifconfig | grep "inet "`
4. **错误信息**: 浏览器控制台截图或错误文本
5. **访问方式**: 
   - 是从 Mac Mini 本机访问？
   - 还是从其他设备（iPhone/iPad/其他电脑）访问？
   - 使用的 URL 是什么？

这样我可以更准确地帮你解决问题！
