# 🧤 OpenGloves

一个独立的、现代化的 Web 界面，用于与 **OpenClaw** AI 助手聊天。

## ✨ 特性

### 🆕 v0.1 新功能
- ⚡ **快捷命令** - 使用 `/help`、`/clear`、`/export`、`/theme`、`/status` 等快速操作
- 🔐 **独立认证系统** - 与网关认证分离的安全访问控制
- 📱 **增强移动界面** - 专门的移动端界面，触控优化
- 📲 **PWA 支持** - 可安装为手机和桌面原生应用

### 核心功能
- 🌐 **单端口访问** - 内置 WebSocket 代理，公网访问仅需开放 8443 端口
- 🎨 **现代化主题** - 美观护眼界面，支持主题切换
- 📱 **移动端优化** - 响应式设计，触控友好的控件
- 🔒 **安全可靠** - 支持 HTTPS，自动生成证书
- ⚡ **实时聊天** - 基于 WebSocket 的实时消息更新
- 📎 **文件上传** - 发送图片和文档给 AI
- 🌐 **局域网访问** - 从网络中的任何设备访问
- 🔧 **零配置** - 自动检测网关，开箱即用

## 🚀 快速开始

> **从 v0.01 升级？** 使用一键升级命令（自动迁移到 ~/.opengloves）：
> ```bash
> curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh | bash
> ```
> 脚本会自动检测您的安装位置。
> 查看 [UPGRADE.md](./UPGRADE.md) 获取详细说明。

### 远程安装（推荐）

一键安装，自动配置：

```bash
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/install-opengloves.sh | bash
```

**安装脚本会自动完成：**
- ✅ 自动下载 OpenGloves
- ✅ 检测并配置 OpenClaw 网关（如果可用）
- ✅ 生成安全的访问密码
- ✅ 设置 PWA 应用清单
- ✅ 配置 WebSocket 代理

**安装完成后：**

服务自动启动！访问 `https://localhost:8443`，输入安装时显示的访问密码即可！

**服务管理命令：**
```bash
systemctl --user status opengloves  # 查看状态
systemctl --user restart opengloves # 重启服务
systemctl --user stop opengloves    # 停止服务
journalctl --user -u opengloves -f  # 查看日志
```

**或手动运行：**
```bash
cd ~/.opengloves
npm start
```

### OpenClaw Gateway 配置

**安装脚本会自动配置 OpenClaw Gateway**，但如果需要手动配置或支持局域网访问：

```bash
# 运行配置助手脚本
cd ~/.opengloves
bash scripts/configure-gateway.sh
```

或手动编辑 `~/.openclaw/openclaw.json`：
```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "https://localhost:8443",
        "https://127.0.0.1:8443",
        "https://你的局域网IP:8443"
      ]
    }
  }
}
```

编辑后重启 Gateway：
```bash
systemctl --user restart openclaw-gateway
```

### 环境要求

- **Node.js** 18+（使用 `node --version` 检查）
- 运行在同一台机器或网络中的 **OpenClaw** 网关

### 手动安装

```bash
# 克隆或下载仓库
cd opengloves

# 复制示例配置并编辑
cp config.example.json config.json
# 编辑 config.json，填入你的网关 token

# 启动服务器（HTTP 模式）
npm start
```

在浏览器中访问 `https://localhost:8443`！

**注意：** 由于使用自签名证书，浏览器会显示安全警告。这是正常的 - 点击"高级" → "继续访问"即可。

### 🔐 访问设置
1. 输入访问密码：`changeme123`（默认）
2. 点击 **Connect** 连接到 OpenClaw 网关
3. 开始聊天或使用快捷命令如 `/help`

## ⚠️ 重要：OpenClaw 网关配置

**连接前必须确保 OpenClaw 网关允许 OpenGloves 的访问！**

编辑 `~/.openclaw/openclaw.json`，在 `gateway.controlUi.allowedOrigins` 中添加 OpenGloves 的访问地址：

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "https://localhost:8443",      // 本机访问
        "https://127.0.0.1:8443"       // 本机IP访问
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
      "port": 8443
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
  },
  "ui": {
    "title": "OpenGloves",
    "sessionKey": "main",
    "accessPassword": "changeme123"
  }
}
```

### 获取网关 Token

你的 OpenClaw 网关 token 可以在以下位置找到：
```bash
~/.openclaw/openclaw.json
```

查找 `gateway.auth.token`。

## 🔒 安全特性

### 密码保护（v0.1）

OpenGloves v0.1 实现了安全的密码认证：

- 🔐 **挑战-响应认证**
  - 服务器为每次登录生成随机 nonce
  - 客户端使用 SHA-256 哈希密码和 nonce
  - 密码永远不会明文传输

- 🛡️ **防御攻击**
  - 防止密码嗅探
  - 缓解重放攻击
  - 防御彩虹表攻击

### ⚠️ HTTPS 要求

**公网/互联网访问必须使用 HTTPS：**

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

**为什么 HTTPS 至关重要：**
- 即使密码已哈希，会话数据仍需加密
- 保护聊天内容不被窃听
- 防止中间人攻击
- PWA 安装需要安全连接

**警告：** 从非本地地址通过 HTTP 访问时，OpenGloves 会显示警告。

## ⚡ 快捷命令使用

OpenGloves 支持便捷的快捷命令：

- `/help` - 显示所有可用命令
- `/clear` - 清空聊天记录
- `/status` - 显示连接状态和统计信息
- `/export [格式]` - 导出聊天记录（json/md/txt）
- `/theme [模式]` - 切换主题（dark/light/auto）
- `/reconnect` - 重新连接网关

例如：输入 `/export md` 下载 Markdown 格式的聊天记录。

## 📱 移动端和 PWA 使用

### 移动端界面
- 在移动设备上，OpenGloves 显示紧凑界面
- 密码和连接控件组合在一起，便于访问
- 触控优化的按钮和间距

### 安装为应用（PWA）
1. 在支持的浏览器中打开 OpenGloves（Chrome、Edge、Safari）
2. 查找页面底部的"📱 安装为应用"按钮
3. 点击安装为设备上的原生应用
4. 从主屏幕/应用抽屉访问

### 移动端技巧
- 支持滑动手势导航
- 通过相机或相册上传文件
- 安装为 PWA 后支持离线功能

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

1. 检查防火墙是否允许端口 8443
2. 验证 `server.host` 是 `"0.0.0.0"`（不是 `"localhost"`）
3. 检查网关的 `allowedOrigins` 包含你的服务器 IP

## 📄 许可证

MIT License

## 🙏 致谢

专为 **OpenClaw** - 一个优秀的 AI 助手平台而构建。
