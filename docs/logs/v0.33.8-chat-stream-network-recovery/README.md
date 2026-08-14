# v0.33.8 Web Chat 流式网络恢复

## 迭代完成说明

- 根因：浏览器到服务器的 SSE 在普通网络抖动后可能进入半开状态，底层 `reader.read()` 既收不到新字节，也不抛错或结束；前端因此不会进入既有重连逻辑。即使连接显式断开，历史补拉与新流订阅之间仍有竞态，最终回复可能落在窗口内而只在刷新后出现。
- 确认方式：使用隔离 TCP 代理转发真实开发服务器的首个响应块后停止转发，但不发送 FIN/RST。修复前真实 HTTP client 在 4 秒观察窗口后仍保持 pending；边界复现同时证明完成事件若落在补拉与订阅之间，UI 会停留在 `running`。
- 根因修复：HTTP transport 增加 stream open timeout 与 raw-byte idle timeout，SSE comment heartbeat 也会续期；超时后终止当前 fetch 并进入现有重连主链路。连接建立后再执行一次只读历史 reconcile，按消息终态合并实时快照，避免覆盖更晚到达的完成事件。
- Web Chat 配置为 15 秒连接超时、70 秒无字节超时；服务器现有 25 秒 heartbeat 能持续保持健康连接。
- 修复直接建立流存活判定并闭合重连窗口，没有重试消息 POST、依赖 `navigator.onLine`、引入轮询或要求用户刷新。

## 测试/验证/验收方式

- `@nextclaw/ncp`、`@nextclaw/ncp-http-agent-client`、`@nextclaw/ncp-toolkit`、`@nextclaw/ncp-react`、`@nextclaw/ui` 的匹配范围 TypeScript 检查通过。
- HTTP agent client 测试 9/9 通过，覆盖连接超时、半开 idle timeout、heartbeat 活动续期和 `onOpen`。
- in-process toolkit 测试 3/3 通过；hydration/reconnect 定向测试 7/7 通过，覆盖连续两次断线后恢复、恢复后继续发送，以及 post-open 历史补拉不覆盖实时完成事件。
- 触达文件 targeted ESLint 通过；`git diff --check` 通过。
- 真实开发服务器 `/api/health` 返回 200；真实 SSE 连接在 25 秒收到 `: keepalive`。
- 同一 TCP 黑洞代理复验在测试用 1 秒 idle timeout 下返回 `timeout-error`，`onOpen=true`，耗时约 1.05 秒，并且只发布一个 endpoint error。
- diff-only maintainability guard 为 0 error、1 warning；唯一 warning 是 HTTP client 文件增长至 363 行但仍低于 400 行预算，主观复核结论为无可维护性发现。

## 发布/部署方式

本次只创建本地代码提交，不 push、不发布 NPM、不生成 runtime/desktop 产物，也不部署服务器。源码需要进入后续统一版本并部署到目标服务器后才会生效；普通显式断线会按既有 500 ms 间隔重连，半开连接最迟在约 70 秒无字节后进入恢复。

## 用户/产品视角的验收步骤

1. 从服务器入口打开 Web Chat 并发送一条会产生持续流式输出的消息。
2. 在生成期间让网络短暂中断或让代理停止转发下行数据，但不要刷新页面。
3. 恢复网络并等待自动重连；确认最终回复自动出现，运行状态结束。
4. 继续发送下一条消息，确认会话仍可用且没有重复用户消息。
5. 保持正常连接超过 70 秒，确认 25 秒 heartbeat 会维持连接，不触发误重连。

## 可维护性总结汇总

- stream liveness 归 HTTP transport，历史与实时状态合并归 React hydration owner，Web Chat 只配置产品级阈值；没有把网络状态塞入展示组件。
- 复用既有重连循环、server heartbeat 和 conversation manager，没有新增平行 polling、消息重试或兼容路径。
- 公共 `onOpen` observer 是 post-open reconcile 所需的最小传输合同；HTTP 与 in-process client 均实现该合同。
- HTTP client 的文件增长来自同一请求生命周期。自动 guard 的文件预算 warning 已触发主观复核；当前拆出 wrapper 会增加名字和跳转，未发现更清晰的真实 owner 缝。
- 新 changeset 与迭代路径均通过 planned-path preflight；本次没有覆盖或混入并行中的 session token、子会话、UI 构建产物及其它工作区改动。

## NPM 包发布记录

本次没有发布 NPM 包。以下包均需随本修复待统一 patch 发布：

- `@nextclaw/ncp`：工作区与 registry 均为 `0.7.17`，新增 stream observer 公共合同，待统一发布。
- `@nextclaw/ncp-http-agent-client`：工作区与 registry 均为 `0.4.17`，新增 SSE 存活超时，待统一发布。
- `@nextclaw/ncp-toolkit`：工作区与 registry 均为 `0.6.19`，补齐 in-process observer 合同，待统一发布。
- `@nextclaw/ncp-react`：工作区与 registry 均为 `0.5.21`，新增 post-open history reconcile，待统一发布。
- `@nextclaw/ui`：工作区为 `0.15.28`，registry 当前为 `0.17.1`；统一发布前必须先核对版本倒挂与目标分支，本次不擅自改版本或发布。

对应 changeset：`.changeset/fix-chat-stream-network-recovery.md`。
