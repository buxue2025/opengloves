# 🧤 OpenGloves

一个独立的、现代化的 Web 界面，用于与 **OpenClaw** AI 助手聊天。

## ✨ 特性

- 🔧 **手机上易于使用** - 首次访问后可通过浏览器安装到手机
- 🎨 **现代化深色主题** - 美观、护眼的界面设计
- 📱 **移动端友好** - 响应式设计，适配所有设备
- 🔒 **安全可靠** - 支持 HTTPS，自动生成证书
- ⚡ **实时聊天** - 基于 WebSocket 的实时消息更新
- 📎 **文件上传** - 发送图片和文档给 AI
- 🌐 **局域网访问** - 从网络中的任何设备访问
- 🔧 **零配置** - 自动检测网关，开箱即用

## 🚀 快速开始

### 环境要求

- **Node.js** 18+（使用 `node --version` 检查）
- 运行在同一台机器或网络中的 **OpenClaw** 网关

### 安装方法

```bash
# 克隆或下载仓库
cd opengloves

# 复制示例配置并编辑
cp config.example.json config.json
# 编辑 config.json，填入你的网关 token

# 启动服务器（HTTP 模式）
npm start
```

在浏览器中访问 `http://localhost:8080`！

## ⚠️ 重要：OpenClaw 网关配置

**连接前必须确保 OpenClaw 网关允许 OpenGloves 的访问！**

编辑 `~/.openclaw/openclaw.json`，在 `gateway.controlUi.allowedOrigins` 中添加 OpenGloves 的访问地址：

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:8080",      // 本机访问
        "http://127.0.0.1:8080"       // 本机IP访问
      ]
    }
  }
}
```

修改后重启 Gateway：
```bash
systemctl --user restart openclaw-gateway
# 或
openclaw gateway restart
```

## 📝 配置说明

编辑 `config.json` 来自定义你的设置：

```json
{
  "server": {
    "host": "0.0.0.0",
    "http": {
      "enabled": true,
      "port": 8080
    },
    "https": {
      "enabled": false,
      "port": 8443,
      "autoGenerateCert": true
    }
  },
  "gateway": {
    "url": "ws://localhost:18789",
    "token": "your-gateway-token-here",
    "autoDetectUrl": true
  }
}
```

### 获取网关 Token

你的 OpenClaw 网关 token 可以在以下位置找到：
```bash
~/.openclaw/openclaw.json
```

查找 `gateway.auth.token`。

## 🔐 HTTPS 设置

### 自动配置（推荐）

在 `config.json` 中启用 HTTPS：

```json
{
  "server": {
    "https": {
      "enabled": true,
      "autoGenerateCert": true
    }
  }
}
```

然后启动服务器：

```bash
npm start
```

自签名证书将自动在 `./certs/` 目录中生成。

### 首次访问

通过 HTTPS 访问时，浏览器会显示安全警告。对于自签名证书这是正常的！

1. 点击 **"高级"** 或 **"显示详情"**
2. 点击 **"继续访问"** 或 **"接受风险"**
3.（可选）导入证书以避免未来的警告

## 🌐 局域网访问

从本地网络中的另一台设备访问是自动的！只需访问服务器的 IP 地址即可。

## 🛠️ 故障排除

### 网关连接失败

1. 检查网关是否正在运行：`openclaw gateway status`
2. 验证 `config.json` 中的 token 是否与 `~/.openclaw/openclaw.json` 匹配
3. 确保网关的 `bind` 设置为 `"lan"`（不是 `"loopback"`）

### HTTPS 证书错误

- 浏览器显示警告 → 这是正常的，点击"继续"
- 证书生成失败 → 确保已安装 OpenSSL

### 其他设备无法访问

1. 检查防火墙是否允许端口 8080/8443
2. 验证 `server.host` 是 `"0.0.0.0"`（不是 `"localhost"`）
3. 检查网关的 `allowedOrigins` 包含你的服务器 IP

## 📄 许可证

MIT License

## 🙏 致谢

专为 **OpenClaw** - 一个优秀的 AI 助手平台而构建。
