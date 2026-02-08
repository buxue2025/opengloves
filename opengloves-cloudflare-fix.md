# 🔧 OpenGloves + Cloudflare Tunnel 断连问题修复方案

**问题**: 通过 Cloudflare Tunnel 访问时，WebSocket 连接频繁断开（code 1006）

**根本原因**: Cloudflare Tunnel 的 WebSocket 超时（~100秒无活动自动断开）

**解决方案**: 在 OpenGloves 服务端添加 WebSocket 心跳机制

---

## 📝 代码修改

### **文件**: `~/.opengloves/server.js`

**在文件顶部已有的导入之后添加**:

```javascript
// 在现有的 import 语句之后，创建服务器之前添加

// WebSocket 心跳配置
const HEARTBEAT_INTERVAL = 30000; // 30秒
const heartbeatIntervals = new Map();

function setupHeartbeat(ws) {
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  const interval = setInterval(() => {
    if (ws.isAlive === false) {
      console.log('💔 Client not responding to ping, terminating connection');
      clearInterval(interval);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);
  
  heartbeatIntervals.set(ws, interval);
  
  ws.on('close', () => {
    const interval = heartbeatIntervals.get(ws);
    if (interval) {
      clearInterval(interval);
      heartbeatIntervals.delete(ws);
    }
  });
}
```

---

### **在 WebSocket 连接建立时调用心跳**

找到创建 WebSocketServer 的代码（应该类似）：

```javascript
// 查找类似这样的代码：
wss.on('connection', (ws, req) => {
  // 现有的连接处理逻辑...
  
  // 【在此处添加】
  setupHeartbeat(ws);
  
  // 后续代码...
});
```

---

## 🔄 **应用修改**

### **1. 备份原文件**
```bash
cd ~/.opengloves
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
```

### **2. 编辑文件**
```bash
nano ~/.opengloves/server.js
# 或
code ~/.opengloves/server.js
```

### **3. 重启服务**
```bash
launchctl stop com.opengloves
launchctl start com.opengloves

# 或者
launchctl kickstart -k gui/$(id -u)/com.opengloves
```

### **4. 验证**
```bash
tail -f ~/.opengloves/logs/stdout.log
# 应该看到连接保持稳定，没有频繁的 disconnected
```

---

## 📊 **预期效果**

**修改前**:
```
🟢 连接 → 工作 → [100秒] → 🔴 断开(1006) → 重连 → 循环...
```

**修改后**:
```
🟢 连接 → 💓 ping → 💓 ping → 💓 ping → 持续稳定...
```

---

## 🎯 **完整修改示例**

如果不确定插入位置，可以参考这个完整的心跳实现：

```javascript
import { WebSocketServer, WebSocket } from 'ws';

// 心跳配置
const HEARTBEAT_INTERVAL = 30000;
const heartbeatIntervals = new Map();

function setupHeartbeat(ws) {
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  const interval = setInterval(() => {
    if (ws.isAlive === false) {
      console.log('💔 Client not responding, terminating');
      clearInterval(interval);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);
  
  heartbeatIntervals.set(ws, interval);
  
  ws.on('close', () => {
    const interval = heartbeatIntervals.get(ws);
    if (interval) {
      clearInterval(interval);
      heartbeatIntervals.delete(ws);
    }
  });
}

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server: httpsServer });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  const origin = req.headers.origin || 'unknown';
  
  console.log('🟢 New WebSocket connection from', clientIp);
  console.log('   Origin:', origin);
  
  // 【关键】添加心跳
  setupHeartbeat(ws);
  
  // ... 其他连接处理逻辑
});
```

---

## ⚠️ **注意事项**

1. **确保修改正确**
   - 如果语法错误，服务会无法启动
   - 先备份原文件！

2. **测试方法**
   - 修改后测试30-60分钟
   - 保持页面打开但不操作
   - 看是否还会断开

3. **回滚方案**
   ```bash
   # 如果出问题，恢复备份
   cd ~/.opengloves
   cp server.js.backup.YYYYMMDD_HHMMSS server.js
   launchctl kickstart -k gui/$(id -u)/com.opengloves
   ```

---

## 📈 **监控命令**

修改后用这个命令实时监控：

```bash
tail -f ~/.opengloves/logs/stdout.log | grep -E "disconnected|New WebSocket|ping|pong"
```

**健康状态**应该是：
```
🟢 New WebSocket connection from 127.0.0.1
（30秒后没有断开消息 = 成功）
```

---

## 🔄 **备选方案**

如果添加心跳后仍然断开，可以尝试：

### **备选1: 增加 Cloudflare Tunnel 超时**
```bash
# 修改 cloudflared 启动参数
cloudflared tunnel run \
  --token YOUR_TOKEN \
  --proxy-connection-timeout 300s \
  --proxy-read-timeout 300s
```

### **备选2: 客户端自动重连**
在 OpenGloves 的前端 JavaScript 中添加：
```javascript
ws.onclose = () => {
  setTimeout(() => {
    console.log('🔄 自动重连中...');
    initWebSocket();
  }, 3000);
};
```

---

**修改完成后，告诉我结果！** 🦉
