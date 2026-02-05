# 🚀 OpenGloves 快速部署指南

## 从当前机器到 Mac Mini 的完整流程

### 📦 步骤1: 打包（当前机器）

```bash
cd ~/cbxprojects/opengloves
./scripts/package.sh
```

✅ 完成后会在 `dist/` 目录生成: `opengloves-v1.0.0.tar.gz`

### 📤 步骤2: 传输到 Mac Mini

**选项A - 使用SCP (推荐)**
```bash
scp dist/opengloves-v1.0.0.tar.gz user@mac-mini.local:~/
```

**选项B - 使用USB**
```bash
cp dist/opengloves-v1.0.0.tar.gz /Volumes/USB_DRIVE/
```

**选项C - 使用AirDrop**
直接拖拽 `dist/opengloves-v1.0.0.tar.gz` 到 Mac Mini

### 📥 步骤3: 安装（Mac Mini）

```bash
# 解压
cd ~
tar -xzf opengloves-v1.0.0.tar.gz
cd opengloves-v1.0.0

# 运行安装脚本（会自动检测OpenClaw配置）
./scripts/install.sh

# 启动服务器
npm start
```

### ✅ 步骤4: 访问测试

- 本地访问: http://localhost:8080
- 局域网访问: http://MAC_MINI_IP:8080

### 🔧 可选: 设置为后台服务

```bash
# 安装PM2
npm install -g pm2

# 启动服务
cd ~/opengloves-v1.0.0
pm2 start server.js --name opengloves
pm2 save
pm2 startup
```

---

## ⚙️ 配置检查清单

在 Mac Mini 上确保：

1. **OpenClaw Gateway 正在运行**
   ```bash
   openclaw gateway status
   ```

2. **Gateway 配置为 LAN 模式**
   ```bash
   # 编辑 ~/.openclaw/openclaw.json
   {
     "gateway": {
       "bind": "lan"  // ← 确保是 "lan" 不是 "loopback"
     }
   }
   ```

3. **重启 Gateway（如果修改了配置）**
   ```bash
   systemctl --user restart openclaw-gateway
   ```

---

## 🆘 常见问题

### 无法连接到Gateway

检查 `config.json` 中的 token 是否正确:
```bash
# 查看OpenClaw的token
cat ~/.openclaw/openclaw.json | grep token

# 对比OpenGloves的token
cat ~/opengloves-v1.0.0/config.json | grep token
```

### 其他设备无法访问

确保 `config.json` 中:
```json
{
  "server": {
    "host": "0.0.0.0"  // ← 必须是 "0.0.0.0"
  }
}
```

### 需要HTTPS

编辑 `config.json`:
```json
{
  "server": {
    "https": {
      "enabled": true
    }
  }
}
```

---

## 📚 完整文档

- **详细部署指南**: `DEPLOY.md`
- **用户文档**: `README.md`
- **安装说明**: `INSTALL.txt` (打包后自动生成)

---

**就这么简单！** 🎉
