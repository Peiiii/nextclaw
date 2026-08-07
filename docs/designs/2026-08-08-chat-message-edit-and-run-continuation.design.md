# 会话消息编辑与中断后继续运行方案

## 1. 目标与产品语义

NextClaw 补齐两个会话连续性能力：

1. 对标 Codex / Cursor，用户可以编辑当前会话最近一条用户消息；确认后直接改写当前会话历史，删除该消息及其后的旧 AI、reasoning、tool 进展，再以编辑后的消息继续运行。
2. 当 AI 运行被用户终止或异常中断时，用户可以保留已经产生的内容与工具进展，在同一会话中继续运行。

两者都不是“重试”：编辑只在用户输入发生变化时重新执行；继续运行保留已有进展，不清空后重新生成。

### 成功标准

- 编辑确认后，当前界面中的用户消息立即变成编辑后的内容，不创建新会话、不跳路由、不产生后台会话通知。
- 被编辑消息之后的旧 assistant、reasoning、tool call、tool result 从当前历史与持久化记录中删除。
- AI 在同一个 session 中基于改写后的历史继续回复，当前 live stream 不切换、不丢事件。
- 运行中完全不展示编辑图标；只有真正可以提交编辑时才显示。
- 继续运行保留全部已有历史，只追加模型可见、UI 隐藏的 continuation 指令。
- 原始供应商错误继续完整保留；不新增“重新运行”“重新生成”入口。

## 2. 已验证现状与约束

- `AgentRunRequestManager` 是 send / abort 的业务 owner，`SessionRun` 是当前会话内存态与运行队列 owner。
- session journal 是当前历史的持久化事实源；已有 `importSessionSnapshot` 能原子重建一个 session 的 journal、消息分页投影和摘要索引。
- `MessageAbort` / `RunError` 会保留已生成的 assistant parts，并把 activity preview 持久化为 `cancelled` / `failed`。
- 当前 React 会话 hook 始终订阅现有 session 的 NCP stream，因此同 session 编辑可以避免新会话订阅竞态。
- 历史 hydration 过去只支持 prepend，不能移除旧尾部；编辑完成后必须用重写后的 seed replace 当前前端 history。

## 3. 编辑消息合同

### 3.1 用户可见语义

“编辑消息”是同会话历史改写：

```text
[m1, m2, target-user, old-assistant, old-tools]
                    ↓ edit
[m1, m2, edited-user] + new run
```

不是 child session、branch、retry 或后台任务。

### 3.2 不变量

- 只允许编辑最近一条非隐藏 user message。
- session 正在运行或存在 queued input 时，编辑入口隐藏，服务端也必须拒绝请求。
- 持久化重写只保留目标消息之前的历史；目标消息由编辑后的新 user message替代。
- sessionId、runtime、model、project root 和会话身份不变。
- 编辑请求失败时保留内联编辑内容；历史重写完成后即使 runtime startup 失败，编辑后的 user message 与错误仍留在当前会话。
- 同一 `sessionId:messageId` 的并发提交合并；同一 session 内不同编辑/继续命令互斥，不能生成重复消息或交叉改写历史。

### 3.3 Owner 与执行顺序

`AgentRunRequestManager`：

1. 校验 session idle、message 可发送、目标是最近 visible user。
2. 调用 `SessionManager.rewindSessionBeforeMessage` 重建 journal，只保留锚点之前的历史。
3. 调用 `SessionRun.replaceMessages` 同步内存会话历史。
4. 复用既有 `send` 主链路，把 edited user message 发送到同一个 session 并启动 run。

`SessionManager` 是持久化历史重写的唯一 owner；UI 和 router 不切数组后直接写存储。

## 4. 继续运行合同

“继续运行”是在同一 session 中追加一个新 run，不复活已经 terminal 的旧 run，也不删除半截回复。

只有 activity preview 为 `cancelled` / `failed` 且 session idle 时允许继续。Kernel 生成：

```ts
{
  role: "user",
  status: "final",
  parts: [{
    type: "text",
    text: "Continue from where you stopped. Preserve completed work and avoid repeating it."
  }],
  metadata: {
    ncp_internal_visibility: "hidden",
    nextclaw_run_intent: "continue"
  }
}
```

隐藏消息不进入消息列表、会话预览和用户通知，但进入模型上下文。

## 5. Transport 与前端同步

NextClaw ingress 与 `AgentRunsService` 提供：

- `POST /api/agent-runs/edit-message`
- `POST /api/agent-runs/continue`

两者返回标准 `NcpRunHandle`。

编辑提交后不导航。`useNcpSessionConversation` 先用编辑后的消息乐观替换当前 React history，让用户立即看到内容和旧尾部消失；请求失败时先恢复内存快照，再尝试读取同一 session 的 canonical seed 校正。stream 始终订阅原 session，新 run 后续事件继续进入同一个 manager。这样同时解决：

- 原消息提交后不变化；
- 已删除的旧 assistant 仍残留；
- AI 在后台回复但当前页面收不到；
- 活跃会话被误判为后台会话并弹通知。

## 6. 交互设计

| 状态 | composer 内容 | 主按钮 | 编辑入口 | assistant 继续入口 |
| --- | --- | --- | --- | --- |
| running / queued | 任意 | 停止或排队发送 | 完全隐藏 | 隐藏 |
| completed / idle | 空 | 普通发送 disabled | 最近 user 显示 | 隐藏 |
| cancelled / failed | 空 | 继续运行 | 最近 user 显示 | 最近 partial assistant 显示 |
| cancelled / failed | 非空 | 普通发送 | 最近 user 显示 | 保留显示 |
| edit / continue pending | 任意 | pending | 完全隐藏 | 隐藏 |

### 内联编辑

- 点击铅笔后，在原 user bubble 位置切换为共享 Lexical composer core。
- 编辑器挂载后自动聚焦，光标落在最后一个可编辑文本位置；用户不需要再点一次。
- 不显示模型、thinking 等主 composer 工具栏；保留文本、inline token、原附件、取消和发送。
- `Escape` 取消，`Enter` 提交，`Shift+Enter` 换行。
- 提交成功前 editor 不消失；失败时不丢编辑内容。
- 所有纯图标操作均提供可见 tooltip、aria-label 和 focus-visible；消息尾部继续使用线性 `CirclePlay`，输入框主按钮保留圆形容器并使用非实心三角，避免媒体播放感和双圆环。

## 7. 失败与并发边界

- 目标不存在、不是最近 user、session busy、消息为空：明确失败且不改历史。
- 历史重写与内存 `SessionRun` 必须保持相同消息集合；不得只改数据库或只改前端。
- 编辑成功后 history replace 失败：保留原始错误并触发同 session 重新 hydration，不创建补偿会话。
- 双击编辑/继续：UI 用同步命令锁在 React 重渲染前拦截重复动作；Kernel session 级 pending command 合并同一命令并拒绝不同命令交叉执行。
- completed/idle 不可 continue；任何 reconnect/hydration 不得自动 continue。

## 8. 验证清单

### Kernel / history

- 编辑最近 user 后 sessionId 不变，目标及其后历史被删除，edited user 成为新尾部并启动 run。
- journal、消息分页投影、SessionRun snapshot 三者一致。
- 编辑更早 user、隐藏 user、busy session 均失败且历史完全不变。
- continuation 保留 partial assistant/tool parts，只追加一条隐藏 user message。
- 并发 edit / continue 不产生重复消息或重复 run。

### Transport / React / UI

- edit / continue route 校验 payload 并返回同 session 的 `NcpRunHandle`。
- 编辑后不调用导航，不产生新 session summary；当前消息立即更新，旧 assistant 消失。
- 当前 session stream 持续接收新 AI 回复，不触发后台完成通知。
- 运行中不渲染编辑图标；idle 时只有最近 user 渲染一个编辑入口。
- cancelled/failed + 空 composer 显示继续；输入后恢复发送；两个继续入口调用同一命令。
- 主继续按钮与消息继续/编辑图标 hover、键盘 focus 都能看到明确操作名。
- 编辑器进入后自动聚焦到末尾；文本、token、附件 round-trip，取消/失败不丢内容。
