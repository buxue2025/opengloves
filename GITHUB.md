# 📤 推送 OpenGloves 到 GitHub

## 🚀 方法 1: 手动创建（最简单，推荐）

### 步骤 1: 在 GitHub 创建仓库

1. 访问: https://github.com/new
2. 填写仓库信息:
   - **Repository name**: `opengloves`
   - **Description**: `A standalone, modern web interface for chatting with OpenClaw AI assistant`
   - **Visibility**: 
     - ✅ **Public** (推荐) - 开源项目，任何人可见
     - 或 **Private** - 仅你可见
   - ⚠️ **不要勾选** "Initialize this repository with:"
     - 不要添加 README
     - 不要添加 .gitignore
     - 不要添加 license
3. 点击 "Create repository"

### 步骤 2: 推送本地代码

GitHub 会显示命令，或者在终端运行：

```bash
cd ~/cbxprojects/opengloves

# 添加远程仓库 (替换 YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/opengloves.git

# 重命名分支为 main (如果需要)
git branch -M main

# 推送到 GitHub
git push -u origin main
```

**如果你使用 SSH Key:**
```bash
git remote add origin git@github.com:YOUR_USERNAME/opengloves.git
git branch -M main
git push -u origin main
```

### 步骤 3: 验证

访问: `https://github.com/YOUR_USERNAME/opengloves`

应该能看到所有文件和 README.md！

---

## 🚀 方法 2: 使用 GitHub CLI (自动化)

### 安装 GitHub CLI

**macOS:**
```bash
brew install gh
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh -y
```

### 登录 GitHub

```bash
gh auth login
```

选择:
1. GitHub.com
2. HTTPS 或 SSH
3. Login with a web browser (最简单)
4. 跟随浏览器完成授权

### 创建仓库并推送

```bash
cd ~/cbxprojects/opengloves

# 创建 public 仓库并推送
gh repo create opengloves --public --source=. --push

# 或创建 private 仓库
gh repo create opengloves --private --source=. --push
```

一条命令搞定！

---

## 🔑 关于认证方式

### HTTPS (推荐给新手)

**优点:**
- ✅ 简单，开箱即用
- ✅ 防火墙友好

**缺点:**
- ⚠️ 每次推送需要输入密码或 token

**使用 Personal Access Token:**
1. 访问: https://github.com/settings/tokens
2. Generate new token (classic)
3. 勾选 `repo` 权限
4. 生成后复制 token
5. 推送时用 token 作为密码

### SSH (推荐给开发者)

**优点:**
- ✅ 一次配置，永久使用
- ✅ 不需要输入密码

**配置 SSH Key:**
```bash
# 生成 SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# 复制公钥
cat ~/.ssh/id_ed25519.pub

# 添加到 GitHub:
# https://github.com/settings/keys
# 点击 "New SSH key"，粘贴公钥
```

---

## 📝 添加 LICENSE 和其他文件

### 添加 MIT License (推荐)

```bash
cd ~/cbxprojects/opengloves

cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2026 OpenGloves Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

git add LICENSE
git commit -m "Add MIT License"
git push
```

### 添加 Contributing 指南 (可选)

```bash
cat > CONTRIBUTING.md << 'EOF'
# Contributing to OpenGloves

Thank you for considering contributing to OpenGloves!

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Setup

See [README.md](README.md) for installation instructions.

## Code Style

- Use ESM modules
- Follow existing code style
- Add comments for complex logic
- Keep files under 500 LOC when possible

## Reporting Issues

Please use GitHub Issues to report bugs or request features.
EOF

git add CONTRIBUTING.md
git commit -m "Add contributing guidelines"
git push
```

---

## 🎨 美化 GitHub 仓库

### 添加 Badges (徽章)

在 README.md 顶部添加:

```markdown
# 🧤 OpenGloves

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Compatible-blue.svg)](https://openclaw.ai)

A standalone, modern web interface for chatting with your **OpenClaw** AI assistant.
```

### 添加 Topics (标签)

在 GitHub 仓库页面:
1. 点击右侧的 ⚙️ (Settings)
2. 找到 "Topics"
3. 添加标签: `openclaw`, `ai`, `chat`, `web-interface`, `nodejs`, `websocket`

### 添加 Description

在仓库首页点击 ⚙️，添加:
```
A standalone, modern web interface for chatting with OpenClaw AI assistant
```

Website: `https://openclaw.ai` (或你的文档链接)

---

## 🔄 后续更新

### 推送新的修改

```bash
cd ~/cbxprojects/opengloves

# 查看修改
git status

# 添加修改
git add .

# 提交
git commit -m "描述你的修改"

# 推送
git push
```

### 创建 Release (版本发布)

```bash
# 使用 GitHub CLI
gh release create v1.0.0 \
  --title "OpenGloves v1.0.0" \
  --notes "Initial release" \
  dist/opengloves-v1.0.0.tar.gz

# 或在 GitHub 网站:
# https://github.com/YOUR_USERNAME/opengloves/releases/new
```

---

## 🆘 常见问题

### 推送时要求输入密码

**HTTPS 方式:**
使用 Personal Access Token 代替密码

**或切换到 SSH:**
```bash
git remote set-url origin git@github.com:YOUR_USERNAME/opengloves.git
```

### 提示 "remote: Repository not found"

1. 检查仓库名称是否正确
2. 确认你有该仓库的访问权限
3. 如果是 HTTPS，尝试重新输入凭证

### 提示 "failed to push some refs"

远程有新的提交，需要先拉取:
```bash
git pull --rebase origin main
git push
```

---

## 📚 参考资源

- GitHub 官方文档: https://docs.github.com/
- GitHub CLI 文档: https://cli.github.com/manual/
- Git 教程: https://git-scm.com/book/zh/v2

---

**完成后别忘了分享你的仓库链接！** 🎉
