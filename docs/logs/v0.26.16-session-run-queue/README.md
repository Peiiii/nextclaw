# v0.26.16 Session 级消息排队后端化

## 迭代完成说明

- 根因：输入框把待发消息保存在页面组件的本地 state，并由前端 effect 监听运行状态后发送队首；队列既不属于 session owner，也不参与后端调度，因此切换会话、刷新页面和多客户端连接时都可能丢失或竞争。
- 复现确认：旧实现的本地队列项只有输入快照与本地 ID，没有 session ID；后端 `AgentRunRequestManager` 在 session 已有 active run 时拒绝新请求，证明权威队列此前不存在于运行链路。
- 修复方式：把完整请求 FIFO 放入 kernel 的 `SessionRun`，由 `AgentRunRequestManager` 在同一 session 内串行、不同 session 间并行调度；Server/SDK 暴露 session 子资源，前端只查询、展示、编辑和删除后端事实。
- 修复命中根因：页面不再保存队列，也不再用 effect 决定何时发送下一条；调度生命周期、隔离键和队列数据现在共同归属于唯一的 session 运行 owner。

## 测试/验证/验收方式

- 六个触达 package 的最终 TypeScript 检查全部通过：`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ncp-react`、`@nextclaw/ui`；并发技能引用改动与本任务 controller 的交叠类型也已兼容闭合。
- 定向测试通过：kernel 18 项、server 4 项、client SDK 2 项、UI/NCP React 17 项，共 41 项；覆盖同 session FIFO、跨 session 并行、队列删除与隔离、主动停止后续跑下一项、HTTP 路由、SDK 编码、刷新查询、编辑无损恢复、运行中继续发送，以及 runtime 自报 `MessageSent` 不会形成第二条前端事件。
- 触达文件 ESLint 通过，0 error、0 warning。
- 真实链路验收通过：在隔离的当前源码实例中，同 session 首条立即获得 `runId`，第二条返回 `runId: null` 并可由 session 队列 API 查询；另一 session 同时立即运行，最终原 session 按 `FIRST -> SECOND` 顺序执行，另一 session 独立执行 `OTHER`。
- 浏览器验收通过：隔离实例 UI 在运行中显示后端待发项及“编辑排队输入 / 删除排队输入”操作，浏览器控制台无错误。
- native chat 冒烟最终返回 `EVENT-ONCE`，事件流只有一个 `message.sent`，随后正常进入 `run.started`、`message.completed` 和 `run.finished`。
- 中止续跑冒烟通过：首条运行时第二条返回 `runId: null` 且队列长度为 1；调用后端 abort 后第二条自动启动并完成，队列归零。
- 完整包级回归检查中，shared 15 项、server 155 项（另 2 项 skip）、client SDK 17 项通过；kernel 与 UI 的完整测试存在未触达旧测试/并发 WIP 失败，因此最终结论以本任务定向测试和真实运行验收为准。
- scoped 与全工作区 `lint:new-code:governance`、governance backlog ratchet 均通过；最终全工作区 maintainability 为 0 error。

## 发布/部署方式

- 已添加 patch changeset：`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ncp-react`、`@nextclaw/ui`。
- 本轮未执行 commit、push、NPM 发布、runtime channel 发布或线上部署。
- 数据库 migration 不适用：本次队列是 `SessionRun` 的进程内运行态，明确不承诺服务进程重启后的 durable 恢复。
- Desktop installer / manifest 不适用：未触达桌面安装与更新合同。

## 用户/产品视角的验收步骤

1. 在一个会话正在回复时继续发送两条消息，确认两条都显示在该会话输入框上方的待发区。
2. 切换到另一个会话，确认看不到前一个会话的待发消息，并且新会话可以独立开始回复。
3. 切回原会话或刷新页面，确认仍能从后端重新看到该会话的待发消息。
4. 编辑包含技能或附件的待发消息，确认输入框能恢复原始文本、技能与附件；删除只影响选中的待发项。
5. 等待当前回复结束，确认待发消息按 FIFO 依次进入 transcript 并执行，每条用户消息只出现一次。

## 可维护性总结汇总

- 正向减债：删除前端本地队列 state 与自动续发 effect，删除外部 runtime wrapper 主动生成 `MessageSent` 的平行路径，并在所有 runtime 的统一出口过滤自报重复事件，把调度与消息进入收敛到唯一 kernel owner。
- 为避免调度 manager 膨胀，把纯请求规范化、事件构造和 run spec 映射提取到同责任域的纯工具文件；调度主流程保持可见，没有新增 queue service、factory 或第二状态源。
- 本任务 scoped 统计为总计 `+1720 / -760 / net +960`，非测试代码 `+976 / -653 / net +323`。这是新增用户能力，非功能改动净增门槛不适用；新增主要来自 kernel 队列合同、session 子资源与覆盖测试，旧的前端调度路径同时被删除。
- scoped maintainability guard 为 0 error、4 warning；warning 均为既有目录例外或接近预算提示：client SDK services 目录、kernel 既有 manager 测试、server app 目录、server API 聚合类型。主观复核确认没有新增平行 owner、额外 service/factory 或第二状态源。

## NPM 包发布记录

- `@nextclaw/shared`：patch changeset 待统一发布。
- `@nextclaw/kernel`：patch changeset 待统一发布。
- `@nextclaw/server`：patch changeset 待统一发布。
- `@nextclaw/client-sdk`：patch changeset 待统一发布。
- `@nextclaw/ncp-react`：patch changeset 待统一发布。
- `@nextclaw/ui`：patch changeset 待统一发布。
- `nextclaw`：由后续统一 public workspace 发布流程评估并闭合依赖批次，本轮未发布。
