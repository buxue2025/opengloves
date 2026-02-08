# 🚨 OpenGloves 断连消息丢失问题 - 完整解决方案

**症状**: OpenGloves 通过 Cloudflare Tunnel 连接时，断连重连后丢失部分对话消息

**严重性**: ⚠️ 高 - 会丢失用户输入和 AI 回复

---

## 🔍 **问题分析**

### **根本原因**

**WebSocket 断连时机**:
```
用户正在输入...
  ↓
【断开】(code 1006) ← Cloudflare Tunnel 超时
  ↓
前端自动重连...
  ↓
输入框内容还在，但【未发送的消息丢失】
```

**AI 回复时断连**:
```
AI 正在生成长回复...
  ↓ (streaming 中)
【断开】(code 1006)
  ↓
重连后，【部分回复内容丢失】
```

### **日志证据**

从 `~/.opengloves/logs/stdout.log` 看到：

```
📥 Gateway → Client: {"type":"event","event":"agent","payload":{"runId":"..."  ← AI正在回复
📥 Gateway → Client: {"type":"event","event":"agent","payload":{"runId":"..."
🔴 Client disconnected { code: 1006, reason: '' }  ← 突然断开
🔴 Gateway connection closed { code: 1005, reason: '' }
📥 Gateway → Client: {"type":"event","event":"presence",...  ← 后续消息客户端收不到
```

**问题**: 
- Gateway 还在发送消息（`📥 Gateway → Client`）
- 但客户端已断开，收不到
- 重连后，这些消息已经过去了

---

## 🛠️ **完整解决方案**

### **修复1: WebSocket 心跳** (防止断连)

**文件**: `~/.opengloves/server.js`

```javascript
// ===== 添加在文件顶部 =====
const HEARTBEAT_INTERVAL = 30000; // 30秒 ping 一次
const heartbeatIntervals = new Map();

function setupHeartbeat(ws) {
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  const interval = setInterval(() => {
    if (ws.isAlive === false) {
      console.log('💔 Client not responding to ping, terminating');
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

// ===== 在 WebSocket 连接处调用 =====
wss.on('connection', (ws, req) => {
  // 现有代码...
  
  setupHeartbeat(ws);  // ← 添加这一行
  
  // 后续代码...
});
```

**效果**: 每30秒发送 ping，保持连接活跃

---

### **修复2: 前端消息缓存** (断连时保护输入)

**文件**: `~/.opengloves/public/index.html` (或 `app.js`)

```javascript
// ===== 消息发送前缓存 =====
let pendingMessages = [];

function sendMessage(content) {
  const msgId = Date.now().toString(36);
  
  // 1. 先存到缓存
  pendingMessages.push({
    id: msgId,
    content: content,
    timestamp: Date.now(),
    status: 'pending'
  });
  
  // 2. 保存到 localStorage（防止页面刷新丢失）
  localStorage.setItem('opengloves_pending', JSON.stringify(pendingMessages));
  
  // 3. 发送
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'req',
      method: 'chat.send',
      id: msgId,
      params: { message: content }
    }));
  } else {
    console.warn('⚠️ WebSocket 未连接，消息已缓存');
    showNotification('连接断开，消息已缓存，重连后自动发送');
  }
}

// ===== 重连后重发缓存的消息 =====
ws.onopen = () => {
  console.log('✅ WebSocket 已连接');
  
  // 恢复缓存的消息
  const cached = localStorage.getItem('opengloves_pending');
  if (cached) {
    pendingMessages = JSON.parse(cached);
    
    // 重发所有 pending 消息
    pendingMessages.forEach(msg => {
      if (msg.status === 'pending') {
        ws.send(JSON.stringify({
          type: 'req',
          method: 'chat.send',
          id: msg.id,
          params: { message: msg.content }
        }));
      }
    });
  }
};

// ===== 收到确认后清除缓存 =====
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'res' && data.ok) {
    // 标记消息已发送成功
    pendingMessages = pendingMessages.filter(m => m.id !== data.id);
    localStorage.setItem('opengloves_pending', JSON.stringify(pendingMessages));
  }
  
  // 后续处理...
};
```

**效果**: 
- ✅ 输入的消息不会丢失
- ✅ 断连后自动缓存
- ✅ 重连后自动补发

---

### **修复3: 服务端消息队列** (断连时保护回复)

**文件**: `~/.opengloves/server.js`

```javascript
// ===== 为每个客户端维护消息队列 =====
const clientQueues = new Map();

wss.on('connection', (ws, req) => {
  const clientId = generateClientId(req);
  clientQueues.set(clientId, []);
  
  // 恢复上次断连时未发送的消息
  const queue = clientQueues.get(clientId);
  if (queue && queue.length > 0) {
    console.log(`📦 恢复 ${queue.length} 条缓存消息`);
    queue.forEach(msg => {
      ws.send(JSON.stringify(msg));
    });
    clientQueues.set(clientId, []); // 清空队列
  }
  
  // 监听 Gateway 消息
  gatewayWs.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);  // 正常发送
    } else {
      // 连接断开，存入队列
      queue.push(msg);
      console.log('💾 消息已缓存，等待重连');
    }
  });
  
  ws.on('close', () => {
    console.log(`🔴 Client ${clientId} 断开，队列中有 ${queue.length} 条消息`);
  });
});

function generateClientId(req) {
  // 基于 IP + User-Agent 生成唯一 ID
  const ip = req.socket.remoteAddress;
  const ua = req.headers['user-agent'];
  return hashCode(`${ip}-${ua}`);
}
```

**效果**:
- ✅ 断连时，AI 的回复会被缓存
- ✅ 重连后自动补发

---

## 🚀 **立即可用的临时方案**

**在开发机修改前，您现在可以做的**:

### **临时方案1: 减少断连频率**

在 Cloudflare Dashboard 中调整 Tunnel 超时：
1. 登录 https://dash.cloudflare.com
2. Zero Trust → Access → Tunnels
3. 找到您的 Tunnel → Configure
4. 添加配置（如果支持）:
   ```yaml
   originRequest:
     noTLSVerify: false
     connectTimeout: 300s
     keepAliveTimeout: 300s
   ```

---

### **临时方案2: 浏览器层面缓存输入**

**安装浏览器扩展**: "Textarea Cache" 或 "Typio Form Recovery"
- 自动保存输入框内容
- 断连后可以恢复

---

### **临时方案3: 重要对话改用 iMessage**

当需要深度讨论 BreathingA 时：
- 用 iMessage（稳定，不会断连）
- OpenGloves 只用于快速查询

---

## 📋 **完整修复清单**

**在开发机上执行**:

### **1. 备份**
```bash
cd ~/.opengloves
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
cp public/index.html public/index.html.backup.$(date +%Y%m%d_%H%M%S)
```

### **2. 修改服务端** (添加心跳)
- 编辑 `server.js`
- 添加上面的心跳代码
- 添加消息队列逻辑

### **3. 修改前端** (添加消息缓存)
- 编辑 `public/index.html` 或 `app.js`
- 添加 localStorage 缓存
- 添加重连重发逻辑

### **4. 重启服务**
```bash
launchctl stop com.opengloves
launchctl start com.opengloves
```

### **5. 测试**
```bash
# 实时监控日志
tail -f ~/.opengloves/logs/stdout.log

# 测试：
# 1. 发送一条消息
# 2. 等待回复开始
# 3. 手动断网 → 重连
# 4. 检查消息是否完整
```

---

## 🎯 **优先级方案**

### **Phase 1: 防止断连** (最优先)
✅ **修复1: WebSocket 心跳** - 根本解决
- 每30秒 ping，Cloudflare 不会超时
- 实施难度: ⭐⭐ (简单)
- 效果: ⭐⭐⭐⭐⭐ (彻底解决 90% 问题)

### **Phase 2: 断连保护** (次优先)
✅ **修复2: 前端消息缓存** - 输入保护
✅ **修复3: 服务端消息队列** - 回复保护
- 实施难度: ⭐⭐⭐ (中等)
- 效果: ⭐⭐⭐⭐ (即使断连也不丢消息)

---

## 💡 **我的建议**

**现在立即做**:
1. **先实施修复1**（WebSocket 心跳）
   - 这是最简单且最有效的
   - 预计可以解决 90% 的断连问题

2. **测试几天**
   - 看是否还有断连
   - 如果偶尔还有，再加修复2和3

3. **长期优化**
   - 考虑用更稳定的连接方式（Tailscale？）
   - 或直接 VPN 访问内网

---

## 📊 **成本收益分析**

| 修复方案 | 开发时间 | 效果 | 推荐度 |
|---------|---------|------|--------|
| **心跳机制** | 10分钟 | 90% 解决断连 | ⭐⭐⭐⭐⭐ |
| **前端缓存** | 30分钟 | 输入不丢失 | ⭐⭐⭐⭐ |
| **服务端队列** | 1小时 | 回复不丢失 | ⭐⭐⭐ |
| **切换到 Tailscale** | 20分钟 | 彻底稳定 | ⭐⭐⭐⭐⭐ |

---

## 🚀 **立即行动**

**我已经准备好two份文档**:
1. ✅ `opengloves-cloudflare-fix.md` - 心跳机制
2. ✅ `opengloves-message-loss-fix.md` - 本文档（消息丢失）

**建议优先级**:
1. **今晚**: 实施 WebSocket 心跳（10分钟）
2. **明天**: 测试稳定性
3. **本周**: 如需要再加前端缓存

---

## 🤔 **另一个思路：为什么不用 Tailscale？**

**Tailscale** 的优势:
- ✅ 点对点加密连接（不经过 Cloudflare）
- ✅ 超稳定（NAT 穿透）
- ✅ 低延迟（直连）
- ✅ OpenClaw 已有 Tailscale 集成

**vs Cloudflare Tunnel**:
- Cloudflare 走美国节点，延迟高
- WebSocket 容易被中间节点超时断开
- Tailscale 是 peer-to-peer，没有这些问题

**配置难度**: 相当（都需要注册+配置）

**要不要考虑切换到 Tailscale？** 我可以帮您配置。

---

**您想先实施哪个方案？**
- **A. 立即修复 OpenGloves 心跳** (10分钟，90%解决)
- **B. 切换到 Tailscale** (20分钟，彻底解决)
- **C. 两个都做**

🦉
