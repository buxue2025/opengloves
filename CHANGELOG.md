# 📝 OpenGloves 更新日志

## v0.1 (2026-02-07) - 生产就绪版本

### 🎉 主要特性

#### ⚡ 快捷命令系统
- `/help` - 显示所有可用命令
- `/clear` - 清空聊天记录
- `/status` - 显示连接状态和统计信息
- `/export [format]` - 导出聊天记录（json/md/txt）
- `/theme [mode]` - 切换主题（dark/light/auto）
- `/reconnect` - 重新连接网关

#### 🔐 企业级安全
- **挑战-响应认证**：SHA-256 密码哈希 + 随机 nonce
- **独立访问控制**：与 Gateway token 分离的界面密码
- **HTTPS 默认启用**：端口 8443，自动生成自签名证书
- **加密传输**：所有流量通过 TLS 加密
- **防重放攻击**：每次登录使用新的挑战值

#### 📱 移动端优化
- **专属移动界面**：紧凑的连接面板
- **触控优化**：大按钮、友好间距
- **可折叠设置**：移动端独立设置面板
- **响应式布局**：自动适配屏幕尺寸
- **PWA 支持**：可安装为原生应用

#### 📲 PWA 功能
- **应用安装**：一键安装到主屏幕
- **离线支持**：Service Worker 缓存
- **系统通知**：后台消息提醒
- **原生体验**：全屏显示、独立窗口

#### 🌐 单端口部署
- **内置 WebSocket 代理**：无需暴露 Gateway 端口
- **统一端口访问**：仅需开放 8443 端口
- **自动 URL 检测**：局域网自动配置
- **简化部署**：公网访问更安全简单

### 🔧 技术改进

#### 服务管理
- **macOS launchd 支持**：自动启动、崩溃恢复
- **Linux systemd 支持**：完整的服务管理
- **统一日志**：标准化日志输出
- **开机自启**：登录后自动运行

#### 安装和升级
- **一键安装**：`curl | bash` 完全自动化
- **一键升级**：自动检测位置、迁移、配置
- **路径迁移**：从 `~/opengloves` 到 `~/.opengloves`
- **配置保留**：升级时保留所有设置
- **Gateway 自动配置**：自动更新 allowedOrigins

#### 开发者工具
- **配置助手**：`scripts/configure-gateway.sh`
- **OS 检测**：自动识别 macOS/Linux
- **依赖检查**：Node.js 版本验证
- **错误处理**：完善的错误提示

### 📚 文档

#### 新增文档
- **UPGRADE.md** - 完整升级指南
- **SERVICE-MACOS.md** - macOS 服务管理
- **SERVICE-MANAGEMENT.md** - Linux 服务管理
- **CHANGELOG.md** - 版本更新日志

#### 更新文档
- **README.md** - 添加安全特性、服务管理
- **README-CN.md** - 完整中文文档
- **PUBLIC-ACCESS.md** - 公网部署指南

### 🐛 Bug 修复

- 修复移动端重复密码输入框
- 修复桌面/移动端设置同步问题
- 修复 npm install 缺失导致的启动失败
- 修复 Gateway allowedOrigins 配置错误
- 修复证书警告和 HTTPS 检测

### 🎨 UI/UX 改进

- 移动端专属连接面板
- 文件和发送按钮紧邻布局
- 连接控制移至页面顶部
- 移动端可折叠设置面板
- PWA 安装提示按钮

### 🔄 Breaking Changes

- **默认端口变更**：8080 (HTTP) → 8443 (HTTPS)
- **默认安装位置**：`~/opengloves` → `~/.opengloves`
- **访问方式**：需要输入访问密码
- **协议变更**：HTTP → HTTPS
- **Gateway 配置**：需要更新 allowedOrigins

### 📊 性能

- WebSocket 代理零延迟转发
- 客户端哈希计算 <1ms
- 页面加载优化，资源缓存
- Service Worker 离线缓存

### 🧪 测试覆盖

- ✅ macOS 安装和服务管理
- ✅ Linux 安装和服务管理
- ✅ 本地访问（localhost）
- ✅ 局域网访问（LAN）
- ✅ 移动端界面和 PWA
- ✅ 系统通知功能
- ✅ 快捷命令系统
- ✅ 密码哈希认证
- ✅ HTTPS 加密通信
- ✅ 自动升级流程

---

## v0.01 → v0.1 升级

### 主要变化

**安全性**：
- 明文密码 → SHA-256 哈希 + 挑战响应
- HTTP → HTTPS
- 无认证 → 独立密码保护

**用户体验**：
- 基础界面 → 移动优化 + PWA
- 手动启动 → 自动服务管理
- 有限功能 → 完整命令系统

**部署**：
- 双端口 → 单端口
- 复杂配置 → 一键安装
- 手动升级 → 自动升级

### 升级命令

```bash
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh | bash
```

---

## 贡献者

- 核心开发：OpenGloves Team
- 测试：Mac Mini + 移动设备
- 文档：中英双语

---

## 许可证

MIT License - 自由使用和修改

---

**OpenGloves v0.1 - Production Ready! 🎉**
