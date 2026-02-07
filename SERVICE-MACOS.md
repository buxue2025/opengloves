# 🍎 OpenGloves macOS 服务管理指南

## launchd 用户服务

在 macOS 上，OpenGloves 使用 **launchd** 作为后台服务运行。

---

## 📦 服务安装

### 自动安装（推荐）

安装和升级脚本会自动安装服务：

```bash
# 新安装
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/install-opengloves.sh | bash

# 升级
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh | bash
```

### 手动安装

```bash
# 服务文件位置
~/Library/LaunchAgents/com.opengloves.plist

# 加载服务
launchctl load ~/Library/LaunchAgents/com.opengloves.plist
```

---

## 🎮 服务管理命令

### 基本操作

```bash
# 启动服务
launchctl load ~/Library/LaunchAgents/com.opengloves.plist

# 停止服务
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist

# 重启服务（升级后必须执行）
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist
launchctl load ~/Library/LaunchAgents/com.opengloves.plist

# 查看服务状态
launchctl list | grep opengloves
```

### 日志查看

```bash
# 查看实时日志
tail -f ~/.opengloves/logs/stdout.log

# 查看错误日志
tail -f ~/.opengloves/logs/stderr.log

# 查看最近日志
tail -n 50 ~/.opengloves/logs/stdout.log

# 同时查看两个日志
tail -f ~/.opengloves/logs/*.log
```

---

## 🔄 升级后重启服务

**重要**：升级 OpenGloves 后，必须重启服务使新代码生效！

### 方法1: 使用升级脚本（自动重启）

```bash
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh | bash
```

### 方法2: 手动重启

```bash
# 停止服务
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist

# 等待1秒
sleep 1

# 启动服务
launchctl load ~/Library/LaunchAgents/com.opengloves.plist

# 验证服务运行
launchctl list | grep opengloves
```

### 快捷重启命令

创建别名方便使用：

```bash
# 添加到 ~/.zshrc 或 ~/.bash_profile
alias opengloves-restart='launchctl unload ~/Library/LaunchAgents/com.opengloves.plist && sleep 1 && launchctl load ~/Library/LaunchAgents/com.opengloves.plist'
alias opengloves-logs='tail -f ~/.opengloves/logs/stdout.log'
alias opengloves-status='launchctl list | grep opengloves'

# 使用别名
opengloves-restart
```

---

## 📊 服务状态检查

### 检查服务是否运行

```bash
launchctl list | grep opengloves
```

**输出示例：**
```
12345  0  com.opengloves
```
- 第一列是 PID（进程ID）
- 如果显示 "-" 表示未运行

### 检查端口是否监听

```bash
lsof -i :8443
```

**应该看到：**
```
COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    12345   alex   21u  IPv4  ...     0t0  TCP *:8443 (LISTEN)
```

---

## 🐛 故障排除

### 服务无法启动

```bash
# 1. 查看错误日志
cat ~/.opengloves/logs/stderr.log

# 2. 手动测试启动
cd ~/.opengloves
node server.js

# 3. 检查配置文件
cat ~/.opengloves/config.json

# 4. 检查 Node.js 路径
which node
# 确保 plist 中的路径正确
```

### 端口被占用

```bash
# 查看占用 8443 端口的进程
lsof -i :8443

# 如果有其他进程，先杀掉
kill <PID>

# 然后重启服务
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist
launchctl load ~/Library/LaunchAgents/com.opengloves.plist
```

### 服务频繁崩溃

```bash
# 查看崩溃日志
cat ~/.opengloves/logs/stderr.log

# 查看系统日志
log show --predicate 'process == "node"' --last 10m

# 禁用服务，手动调试
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist
cd ~/.opengloves
node server.js
```

---

## 🔧 修改服务配置

如果需要修改 plist 文件：

```bash
# 1. 编辑 plist
nano ~/Library/LaunchAgents/com.opengloves.plist

# 2. 重新加载
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist
launchctl load ~/Library/LaunchAgents/com.opengloves.plist
```

**常见修改：**
- Node.js 路径：`<string>/path/to/node</string>`
- 工作目录：`<string>/Users/username/.opengloves</string>`
- 日志路径：`<string>/path/to/logs/stdout.log</string>`

---

## ❌ 卸载服务

```bash
# 1. 停止并卸载服务
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist

# 2. 删除 plist 文件
rm ~/Library/LaunchAgents/com.opengloves.plist

# 3. 删除日志（可选）
rm -rf ~/.opengloves/logs
```

---

## 💡 macOS 特定注意事项

### 权限问题

macOS 可能需要授予终端完全磁盘访问权限：
1. 系统偏好设置 → 安全性与隐私 → 隐私 → 完全磁盘访问权限
2. 添加您的终端应用

### 开机自启

launchd 的 `RunAtLoad` 设置为 `true`，服务会在登录时自动启动。

### 日志轮转

macOS 不自动轮转日志，建议定期清理：

```bash
# 清空日志
> ~/.opengloves/logs/stdout.log
> ~/.opengloves/logs/stderr.log
```

---

## 🔗 相关服务

OpenGloves 依赖 OpenClaw Gateway：

```bash
# 重启 Gateway（如果使用 systemctl）
systemctl --user restart openclaw-gateway

# 或使用 openclaw 命令
openclaw gateway restart

# 同时重启两个服务
launchctl unload ~/Library/LaunchAgents/com.opengloves.plist
systemctl --user restart openclaw-gateway
launchctl load ~/Library/LaunchAgents/com.opengloves.plist
```

---

## 📞 获取帮助

macOS 服务问题：

1. 检查日志文件
2. 验证 plist 语法：`plutil -lint ~/Library/LaunchAgents/com.opengloves.plist`
3. 确认 Node.js 路径正确
4. 查看系统日志：Console.app
5. 在 GitHub 提交 Issue

---

## 🎯 快速参考

| 操作 | macOS 命令 |
|------|-----------|
| 启动 | `launchctl load ~/Library/LaunchAgents/com.opengloves.plist` |
| 停止 | `launchctl unload ~/Library/LaunchAgents/com.opengloves.plist` |
| 重启 | unload + load |
| 状态 | `launchctl list \| grep opengloves` |
| 日志 | `tail -f ~/.opengloves/logs/stdout.log` |
| 端口 | `lsof -i :8443` |

---

**在 macOS 上享受稳定的 OpenGloves 服务！** 🍎
