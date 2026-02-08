# OpenClaw Session 智能附着逻辑 (OpenCode 专用)

## 1. 核心目标
使 OpenCode / OpenGloves 启动时，无需手动输入 Session Key。系统应自动定位用户当前正在对话的上下文，实现从手机/Web 聊天到 IDE 编码的无缝切换。

## 2. 自动检索算法 (Auto-Attach Logic)
按照以下优先级获取目标 `sessionKey`：

1.  **最后活跃度优先**：检索最近一条消息发送时间 (`last_message_at`) 最晚的 Session。
2.  **存活过滤**：排除已手动关闭或极长时间未活跃的 Session。
3.  **回退方案**：若无任何 Session，则新建一个带 `label: opencode-auto` 的 Session。

## 3. 实现指南 (CLI)

在 OpenCode 启动环境或集成终端中运行：

### 快速获取最后活跃 Key (Bash + jq)
```bash
# 获取最近一次交互的 sessionKey
TARGET_SESSION=$(openclaw sessions list --limit 5 --json | jq -r '
  sort_by(.last_message_at) | last | .sessionKey
')

echo "Target Session Key: $TARGET_SESSION"
```

## 4. 给 Alex 的操作建议

- **工作流**：在手机上讨论完需求后，回到 OpenCode。启动脚本通过此逻辑自动附着到刚才的 Session，AI 立即拥有刚才讨论的所有上下文。
- **环境隔离**：如果你开启了新项目，只需在命令行开启一个新 Session，OpenCode 会自动“跟随”到最新的这个项目语境中。
