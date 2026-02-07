# 📦 OpenGloves 升级指南

## v0.01 → v0.02 升级

### 🆕 v0.02 主要新特性
- ⚡ **快捷命令系统** - `/help`, `/clear`, `/export`, `/theme`, `/reconnect`
- 🔐 **独立访问密码** - 界面认证与 Gateway 分离
- 📱 **移动端优化** - 专门的移动界面和触控优化
- 📲 **PWA 支持** - 可安装为原生应用
- 🌐 **单端口部署** - 内置 WebSocket 代理

---

## 🚀 升级方法

### 方法一：一键自动升级（推荐）⭐

使用自动升级脚本，全程无需手动操作：

```bash
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh | bash
```

**脚本会自动：**
- 🔍 检测安装位置（~/opengloves 或 ~/.opengloves）
- 🚚 迁移到标准位置 ~/.opengloves（如果需要）
- 📦 完成所有升级步骤

**或者如果已在安装目录中：**

```bash
cd ~/opengloves  # 或 cd ~/.opengloves
bash <(curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/upgrade.sh)
```

**自动升级脚本会：**
- 🔍 自动检测安装位置
- 🚚 迁移到标准位置 ~/.opengloves（如果从旧位置升级）
- ✅ 自动备份当前配置
- ✅ 保存现有的 Gateway Token
- ✅ 拉取最新代码
- ✅ 自动更新配置文件
- ✅ 生成安全访问密码（或保留现有密码）
- ✅ 显示升级后的使用说明

---

### 方法二：手动升级

```bash
# 1. 进入 opengloves 目录（旧位置或新位置）
cd ~/opengloves  # 或 cd ~/.opengloves

# 2. 备份当前配置
cp config.json config.json.backup

# 3. 拉取最新代码
git pull origin main

# 4. 更新配置文件
```

然后手动添加新的 UI 配置到 `config.json`：

```json
{
  "ui": {
    "title": "OpenGloves",
    "sessionKey": "main",
    "accessPassword": "changeme123"
  }
}
```

```bash
# 5. 重启服务
npm start
```

---

### 方法三：全新安装

如果遇到任何问题，建议完全重新安装：

```bash
# 1. 备份旧配置中的 token（如果存在）
if [ -f ~/opengloves/config.json ]; then
    cat ~/opengloves/config.json  # 记下你的 gateway token
elif [ -f ~/.opengloves/config.json ]; then
    cat ~/.opengloves/config.json
fi

# 2. 删除旧版本
rm -rf ~/opengloves ~/.opengloves

# 3. 重新安装（自动安装到 ~/.opengloves）
curl -fsSL https://raw.githubusercontent.com/buxue2025/opengloves/main/install-opengloves.sh | bash

# 4. 如果需要，手动恢复 token
cd ~/.opengloves
# 编辑 config.json，填入之前的 token
```

---

## 🔧 配置变更说明

### 新增配置项

**config.json 新增 UI 配置：**
```json
{
  "ui": {
    "title": "OpenGloves",           // 界面标题
    "sessionKey": "main",             // 会话密钥
    "accessPassword": "changeme123"   // 访问密码（必需）
  }
}
```

### ⚠️ 重要变更

1. **访问密码是必需的**
   - v0.02 引入了独立的访问密码认证
   - 首次访问需要输入密码
   - 默认密码：`changeme123`（建议修改）

2. **WebSocket 代理**
   - v0.02 内置了 WebSocket 代理
   - Gateway URL 会自动通过代理访问
   - 公网部署只需开放一个端口（8080）

3. **移动端界面**
   - 移动设备会显示专门优化的界面
   - 侧边栏在移动端自动隐藏

---

## 📝 升级后的使用

### 访问方式变更

**v0.01：**
```
1. 访问 http://localhost:8080
2. 直接连接
```

**v0.02：**
```
1. 访问 http://localhost:8080
2. 输入访问密码（默认：changeme123）
3. 点击 Connect 按钮
```

### 新功能使用

**快捷命令：**
```
/help           - 查看所有命令
/clear          - 清空聊天记录
/status         - 显示连接状态
/export md      - 导出为 Markdown
/theme dark     - 切换主题
/reconnect      - 重新连接
```

**PWA 安装：**
- 在支持的浏览器中查看页面底部
- 点击 "📱 安装为应用" 按钮
- 确认安装即可

---

## 🔐 安全建议

升级后请务必：

1. **修改默认密码**
   ```bash
   # 编辑 config.json
   {
     "ui": {
       "accessPassword": "your-secure-password-here"
     }
   }
   ```

2. **如果公网访问，启用 HTTPS**
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

3. **限制访问来源**（可选）
   ```json
   {
     "security": {
       "corsOrigins": ["https://yourdomain.com"]
     }
   }
   ```

---

## ❓ 常见问题

### Q: 升级后无法连接？
**A:** 检查是否添加了 `ui.accessPassword` 配置项。

### Q: 密码在哪里设置？
**A:** 在 `config.json` 的 `ui.accessPassword` 字段。

### Q: 可以保留原来的 token 吗？
**A:** 可以，token 配置不变，只需添加 UI 密码配置。

### Q: 移动端看不到侧边栏？
**A:** 这是正常的，v0.02 在移动端隐藏侧边栏，使用专门的移动连接面板。

### Q: 旧版本的聊天记录还在吗？
**A:** 聊天记录不会自动保存。v0.02 可以使用 `/export` 命令导出聊天记录。

---

## 💡 升级建议

- ✅ **个人使用**：方法一（自动升级）即可
- ✅ **生产环境**：建议方法二（全新安装）
- ✅ **首次升级**：建议先在测试环境尝试
- ✅ **有自定义修改**：需要仔细合并配置文件

---

## 📞 获取帮助

如果升级遇到问题：

1. 查看 [README.md](./README.md) 获取基础信息
2. 查看 [TROUBLESHOOTING-MAC.md](./TROUBLESHOOTING-MAC.md) 排查问题
3. 在 GitHub 提交 Issue

---

**升级成功后，享受 v0.02 的新特性！** 🎉
