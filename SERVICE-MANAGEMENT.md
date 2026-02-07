# 🔧 OpenGloves 服务管理指南

## systemd 用户服务

OpenGloves 可以作为 systemd 用户服务运行，实现开机自启和后台运行。

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
# 1. 复制服务文件
mkdir -p ~/.config/systemd/user
cp ~/.opengloves/opengloves.service ~/.config/systemd/user/

# 2. 重载 systemd
systemctl --user daemon-reload

# 3. 启用并启动服务
systemctl --user enable opengloves.service
systemctl --user start opengloves.service
```

---

## 🎮 服务管理命令

### 基本操作

```bash
# 启动服务
systemctl --user start opengloves

# 停止服务
systemctl --user stop opengloves

# 重启服务
systemctl --user restart opengloves

# 查看状态
systemctl --user status opengloves

# 启用开机自启
systemctl --user enable opengloves

# 禁用开机自启
systemctl --user disable opengloves
```

### 日志查看

```bash
# 查看实时日志
journalctl --user -u opengloves -f

# 查看最近日志
journalctl --user -u opengloves -n 50

# 查看今天的日志
journalctl --user -u opengloves --since today

# 查看错误日志
journalctl --user -u opengloves -p err
```

---

## 🔄 升级后重启服务

升级 OpenGloves 后，**必须重启服务**使新代码生效：

```bash
# 方法1: 使用升级脚本（自动重启）
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh | bash

# 方法2: 手动重启
systemctl --user restart opengloves
```

---

## 📊 服务状态检查

### 检查服务是否运行

```bash
systemctl --user status opengloves
```

**输出示例：**
```
● opengloves.service - OpenGloves - Web Interface for OpenClaw (v0.02)
     Loaded: loaded
     Active: active (running) since ...
   Main PID: 12345
```

### 检查端口是否监听

```bash
ss -tlnp | grep 8443
```

**应该看到：**
```
LISTEN 0  511  0.0.0.0:8443  0.0.0.0:*
```

---

## 🐛 故障排除

### 服务无法启动

```bash
# 查看详细错误
journalctl --user -u opengloves -n 50 --no-pager

# 检查配置文件
cat ~/.opengloves/config.json

# 手动测试启动
cd ~/.opengloves
node server.js
```

### 端口被占用

```bash
# 查看占用端口的进程
ss -tlnp | grep 8443

# 如果有其他进程，先停止
pkill -f "node server.js"

# 然后重启服务
systemctl --user restart opengloves
```

### 服务崩溃自动重启

服务配置了自动重启（Restart=always），崩溃后会自动恢复。

查看崩溃日志：
```bash
journalctl --user -u opengloves --since "10 minutes ago"
```

---

## 🔄 更新服务文件

如果修改了 `opengloves.service`：

```bash
# 1. 复制新的服务文件
cp ~/.opengloves/opengloves.service ~/.config/systemd/user/

# 2. 重载配置
systemctl --user daemon-reload

# 3. 重启服务
systemctl --user restart opengloves
```

---

## ❌ 卸载服务

```bash
# 1. 停止并禁用服务
systemctl --user stop opengloves
systemctl --user disable opengloves

# 2. 删除服务文件
rm ~/.config/systemd/user/opengloves.service

# 3. 重载 systemd
systemctl --user daemon-reload
```

---

## 💡 最佳实践

### 开发环境
使用手动启动以便查看实时输出：
```bash
cd ~/.opengloves
npm start
```

### 生产环境
使用 systemd 服务实现后台运行和自动重启：
```bash
systemctl --user enable opengloves
systemctl --user start opengloves
```

### 监控服务
定期检查服务状态和日志：
```bash
# 每日检查
systemctl --user status opengloves

# 查看最近错误
journalctl --user -u opengloves -p err --since today
```

---

## 🔗 相关服务

OpenGloves 依赖 OpenClaw Gateway：

```bash
# 确保 Gateway 运行
systemctl --user status openclaw-gateway

# 同时重启两个服务
systemctl --user restart openclaw-gateway opengloves
```

---

## 📞 获取帮助

如果遇到服务问题：

1. 查看服务状态和日志
2. 检查配置文件格式
3. 验证端口未被占用
4. 确认 Gateway 正在运行
5. 在 GitHub 提交 Issue

---

**使用 systemd 服务享受稳定的 OpenGloves 体验！** 🚀
