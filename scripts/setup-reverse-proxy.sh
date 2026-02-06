#!/bin/bash

# OpenGloves 反向代理设置脚本
# 支持 Nginx 和 Caddy

echo "🌐 OpenGloves 反向代理设置"
echo "=========================="

# 检测系统和工具
if command -v nginx &> /dev/null; then
    PROXY="nginx"
elif command -v caddy &> /dev/null; then
    PROXY="caddy"
else
    echo "❌ 未找到 nginx 或 caddy"
    echo "请安装其中之一:"
    echo "  nginx: brew install nginx / sudo apt install nginx"
    echo "  caddy: brew install caddy / sudo apt install caddy"
    exit 1
fi

echo "✅ 检测到: $PROXY"

# 获取域名
read -p "📝 输入你的域名 (例如: yourdomain.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "❌ 域名不能为空"
    exit 1
fi

# 获取 OpenGloves 和 OpenClaw 端口
OPENGLOVES_PORT=${1:-8080}
OPENCLAW_PORT=${2:-18789}

echo ""
echo "配置信息:"
echo "  域名: $DOMAIN"
echo "  OpenGloves: localhost:$OPENGLOVES_PORT"
echo "  OpenClaw: localhost:$OPENCLAW_PORT"
echo ""

if [ "$PROXY" = "nginx" ]; then
    # Nginx 配置
    cat > "/tmp/opengloves-nginx.conf" << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # 重定向到 HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL 证书 (使用 Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # OpenGloves 静态文件
    location / {
        proxy_pass http://localhost:$OPENGLOVES_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # OpenClaw Gateway WebSocket
    location /gateway {
        proxy_pass http://localhost:$OPENCLAW_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket 超时设置
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF
    
    echo "✅ Nginx 配置已生成: /tmp/opengloves-nginx.conf"
    echo ""
    echo "📋 下一步:"
    echo "1. 安装证书:"
    echo "   sudo certbot --nginx -d $DOMAIN"
    echo ""
    echo "2. 复制配置:"
    echo "   sudo cp /tmp/opengloves-nginx.conf /etc/nginx/sites-available/opengloves"
    echo "   sudo ln -s /etc/nginx/sites-available/opengloves /etc/nginx/sites-enabled/"
    echo ""
    echo "3. 测试并重启:"
    echo "   sudo nginx -t"
    echo "   sudo systemctl restart nginx"

elif [ "$PROXY" = "caddy" ]; then
    # Caddy 配置
    cat > "/tmp/Caddyfile-opengloves" << EOF
$DOMAIN {
    # 自动 HTTPS
    
    # OpenGloves 静态文件
    handle {
        reverse_proxy localhost:$OPENGLOVES_PORT
    }
    
    # OpenClaw Gateway WebSocket
    handle /gateway* {
        reverse_proxy localhost:$OPENCLAW_PORT
    }
}
EOF
    
    echo "✅ Caddy 配置已生成: /tmp/Caddyfile-opengloves"
    echo ""
    echo "📋 下一步:"
    echo "1. 复制配置:"
    echo "   sudo cp /tmp/Caddyfile-opengloves /etc/caddy/Caddyfile"
    echo ""
    echo "2. 重启 Caddy:"
    echo "   sudo systemctl restart caddy"
fi

echo ""
echo "🔧 OpenGloves 配置更新:"
echo "编辑 config.json:"
cat << EOF
{
  "gateway": {
    "url": "wss://$DOMAIN/gateway",
    "token": "your-token-here"
  }
}
EOF

echo ""
echo "🔒 OpenClaw Gateway 配置:"
echo "编辑 ~/.openclaw/openclaw.json:"
cat << EOF
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "https://$DOMAIN"
      ]
    }
  }
}
EOF

echo ""
echo "=========================="
echo "✅ 配置完成"
echo ""
echo "🌐 访问地址: https://$DOMAIN"
echo "🔒 只需要开放 80/443 端口到公网"
echo "🛡️  OpenClaw Gateway 不直接暴露"