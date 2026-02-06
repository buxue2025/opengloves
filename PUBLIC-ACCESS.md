# 🌐 OpenGloves 公网访问指南

将 OpenGloves 部署到公网，让任何人都能通过互联网访问。

## 🆕 v2.0 安全改进

OpenGloves v2.0 带来了重要的安全增强：
- 🔐 **独立界面密码** - 与 OpenClaw Gateway 认证分离
- 🎯 **单端口访问** - 内置 WebSocket 代理，仅需开放 8080 端口
- 📱 **移动端优化** - 专门的移动界面和 PWA 支持
- ⚡ **快捷命令** - `/help`, `/export`, `/clear` 等便捷操作

## ⚠️ 重要安全考虑

公网部署需要特别注意安全：
- 🔒 **必须使用 HTTPS** (SSL/TLS 加密)
- 🔑 **设置强访问密码** (OpenGloves 界面密码)
- 🛡️ **最小化暴露** (只需开放一个端口)
- 🚫 **访问控制** (IP 白名单或防火墙规则)

---

## 📊 方案对比

| 方案 | 端口映射 | 安全性 | 复杂度 | 推荐度 |
|------|----------|--------|--------|--------|
| **单端口部署** | 仅8080 | ✅ 高 | 🟢 简单 | 🌟 推荐 |
| **反向代理** | 仅443 | ✅ 最高 | 🟡 中等 | 企业级 |
| **Cloudflare Tunnel** | 无需映射 | ✅ 最高 | 🟡 中等 | 企业级 |

---

## 🔧 方案1: 单端口部署（推荐）

> 🆕 **v2.0 新特性**：OpenGloves 现在内置 WebSocket 代理，只需映射一个端口！

### 网络配置

**路由器/防火墙设置**:
```
外部端口 8080 → 内部 Mac Mini:8080 (OpenGloves + 内置代理)
```

**或者使用非标准端口提高安全性**:
```
外部端口 28080 → 内部 Mac Mini:8080
```

### 🔐 安全配置

**第一步：设置访问密码**
```json
{
  "ui": {
    "title": "OpenGloves",
    "sessionKey": "main",
    "accessPassword": "your-strong-password-here"
  }
}
```

### OpenGloves 配置

```json
{
  "server": {
    "https": {
      "enabled": true,
      "port": 8443
    }
  },
  "gateway": {
    "url": "wss://你的公网IP:18789",
    "token": "strong-random-token-here"
  }
}
```

### OpenClaw 安全配置

```bash
# 编辑 OpenClaw 配置
nano ~/.openclaw/openclaw.json
```

```json
{
  "gateway": {
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "strong-random-token-minimum-32-characters"
    },
    "controlUi": {
      "allowedOrigins": [
        "https://你的公网IP:8080",
        "https://yourdomain.com:8080"
      ]
    }
  }
}
```

---

## 🌟 方案2: 反向代理（推荐）

### 架构优势

```
Internet → 防火墙:443 → 反向代理 → OpenGloves:8080
                              ↓ 
                         → OpenClaw:18789
```

**优点**:
- ✅ 只需开放 80/443 端口
- ✅ 自动 HTTPS 证书
- ✅ 统一域名访问
- ✅ OpenClaw 不直接暴露

### 使用脚本自动配置

```bash
cd ~/opengloves
./scripts/setup-reverse-proxy.sh
```

输入你的域名，脚本会自动生成 Nginx 或 Caddy 配置。

### 手动配置 Nginx

**1. 安装 Nginx 和 Certbot**:
```bash
# Ubuntu/Debian
sudo apt install nginx certbot python3-certbot-nginx

# macOS
brew install nginx certbot
```

**2. 创建配置文件**:
```bash
sudo nano /etc/nginx/sites-available/opengloves
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # OpenGloves
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # OpenClaw Gateway
    location /gateway {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

**3. 启用配置**:
```bash
sudo ln -s /etc/nginx/sites-available/opengloves /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**4. 申请 SSL 证书**:
```bash
sudo certbot --nginx -d yourdomain.com
```

### 更新 OpenGloves 配置

```json
{
  "gateway": {
    "url": "wss://yourdomain.com/gateway",
    "token": "your-token-here"
  }
}
```

### 更新 OpenClaw 配置

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "https://yourdomain.com"
      ]
    }
  }
}
```

---

## 🔒 方案3: Cloudflare Tunnel（企业级）

### 优势

- ✅ **零端口映射** - 完全不需要开放防火墙端口
- ✅ **自动 DDoS 保护**
- ✅ **全球 CDN 加速**
- ✅ **自动 SSL 证书**
- ✅ **访问控制** - 可集成身份验证

### 设置步骤

**1. 安装 Cloudflared**:
```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
```

**2. 登录 Cloudflare**:
```bash
cloudflared tunnel login
```

**3. 创建 Tunnel**:
```bash
cloudflared tunnel create opengloves
```

**4. 配置 DNS**:
```bash
cloudflared tunnel route dns opengloves yourdomain.com
```

**5. 创建配置文件**:
```bash
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: your-tunnel-id
credentials-file: /path/to/your-tunnel-credentials.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:8080
  - hostname: gateway.yourdomain.com  # 可选：独立的网关域名
    service: http://localhost:18789
  - service: http_status:404
```

**6. 运行 Tunnel**:
```bash
cloudflared tunnel run opengloves
```

**7. 设置开机自启**:
```bash
sudo cloudflared service install
```

---

## 🛡️ 安全最佳实践

### 1. 强化 Token 认证

```bash
# 生成强随机 Token
openssl rand -hex 32
# 或
python3 -c "import secrets; print(secrets.token_hex(32))"
```

更新 OpenClaw 配置：
```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "your-64-character-random-token"
    }
  }
}
```

### 2. 启用访问日志

**Nginx**:
```nginx
access_log /var/log/nginx/opengloves-access.log;
error_log /var/log/nginx/opengloves-error.log;
```

**Cloudflare**:
- 在 Cloudflare Dashboard → Analytics → Logs 中查看

### 3. 配置防火墙

```bash
# Ubuntu/Debian - UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8080/tcp   # 阻止直接访问
sudo ufw deny 18789/tcp  # 阻止直接访问

# CentOS/RHEL - firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 4. 定期更新

```bash
# 定期更新 OpenGloves
cd ~/opengloves
git pull origin main
npm start

# 定期更新 OpenClaw
openclaw update

# 续期 SSL 证书 (Let's Encrypt 会自动续期)
sudo certbot renew --dry-run
```

---

## 📊 性能优化

### 1. 启用 Gzip 压缩

**Nginx**:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

### 2. 配置缓存

**Nginx**:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 限制连接数

```nginx
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=5r/s;

server {
    limit_conn conn_limit_per_ip 10;
    limit_req zone=req_limit_per_ip burst=10 nodelay;
}
```

---

## 🆘 故障排除

### 常见问题

**1. WebSocket 连接失败**
- 检查反向代理的 WebSocket 配置
- 确认 `Upgrade` 和 `Connection` 头部正确设置

**2. CORS 错误**
- 检查 OpenClaw 的 `allowedOrigins` 配置
- 确保包含正确的 HTTPS 域名

**3. SSL 证书问题**
- 检查证书是否有效：`openssl s_client -connect yourdomain.com:443`
- 续期证书：`sudo certbot renew`

**4. 502 Bad Gateway**
- 检查 OpenGloves 是否运行：`lsof -i :8080`
- 检查 OpenClaw 是否运行：`openclaw gateway status`

---

## 📋 完整部署清单

### 准备阶段
- [ ] 域名已解析到服务器 IP
- [ ] 服务器防火墙配置正确
- [ ] OpenGloves 在本地正常工作
- [ ] OpenClaw Gateway 正常运行

### 反向代理部署
- [ ] 安装 Nginx/Caddy
- [ ] 配置反向代理规则
- [ ] 申请 SSL 证书
- [ ] 测试 HTTP → HTTPS 重定向

### OpenGloves 配置
- [ ] 更新 Gateway URL 为 WSS
- [ ] 配置强随机 Token
- [ ] 启用 HTTPS 模式（可选）
- [ ] 测试连接

### OpenClaw 配置
- [ ] 更新 allowedOrigins
- [ ] 强化 Token 认证
- [ ] 重启 Gateway
- [ ] 测试连接

### 安全验证
- [ ] 确认直接访问 8080/18789 端口被阻止
- [ ] 验证 HTTPS 证书有效
- [ ] 测试 WebSocket 连接正常
- [ ] 检查访问日志

---

**选择适合你的方案开始部署！** 🚀

需要帮助？查看故障排除部分或检查服务器日志。