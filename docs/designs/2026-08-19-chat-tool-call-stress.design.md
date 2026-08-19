# 聊天工具调用高负载压测设计

## 背景

用户反馈 NextClaw 聊天界面可能卡顿。现有消息虚拟时间线已经限制了大量消息行的挂载数量，但它不能限制单条 assistant 消息内部的工具调用数量、参数大小与工具结果大小。一个包含数百个工具调用的消息仍会在进入视口时完成完整的数据适配、工具分组与详情渲染。

## 目标与范围

建立可重复的隔离本地会话种子器，并配套开发态浏览器压测页。种子器使用真实 NCP `tool-invocation` 消息结构模拟：

- 大量 user / assistant 消息，覆盖分页与虚拟时间线；
- 每一条 assistant 消息内的高密度工具调用；
- 每次调用的深层 JSON 参数与结果；
- 初次渲染、工具组展开和流式追加三个用户可感知动作。

种子器只写入调用者明确指定的隔离 `NEXTCLAW_HOME`，不改变运行时、网络或用户日常数据，也不把调试页面打进生产构建。

## 方案比较

1. 只做 Vitest/JSDOM 渲染测试：可防止夹具退化，但没有浏览器绘制与交互耗时证据。
2. 造普通文本长消息：实现简单，但没有经过 tool-card adapter、分组和详情路径，不能代表问题。
3. 开发态真实浏览器压测页加夹具测试：既可观察真实渲染和交互，又能通过测试固定负载形状，但不覆盖真实 session 读取、投影和分页。
4. 隔离的本地 session journal 种子器，配合正常开发服务和 UI：覆盖存储、投影、API 分页、虚拟时间线和工具详情，且不污染用户数据。

采用方案 4 为主、方案 3 为辅。种子器通过 `NcpAgentSessionJournalStore.importSessionSnapshot` 写入，而不是手写 journal；该 owner 会同时维护 journal、消息 projection 和 session summary index。浏览器压测页保留为单消息微基准，用来隔离 UI 侧成本。

## 结构与生命周期

`seed-chat-tool-call-session.mts` 生成一组交替的 user / assistant `NcpMessage`，每个 assistant message 都包含稳定 ID、混合工具类型、嵌套 args、嵌套 result 和可配置字节量；最后一条 assistant message 可额外提升工具调用数，形成可定位的峰值行。它调用 `NcpAgentSessionJournalStore.importSessionSnapshot` 写入调用者指定的 `NEXTCLAW_HOME/sessions/.ncp-agent-journal`，并重新读取页数据校验结果。

用该隔离 home 启动正常的 NextClaw 开发服务后，真实 session 会按标准 API、分页、虚拟时间线和工具卡片路径被读取。开发环境访问 `/__debug/chat-tool-call-stress` 时，入口动态加载单消息微基准组件；生产构建仍走正常应用入口。它允许在受限范围内调节调用数与参数/结果大小，记录 React commit 耗时与下一帧延迟，方便 Playwright 或人工复现读取。

## 不变量与验证

- 工具调用必须是真实 `tool-invocation`，不能退化成 text 或预造的 tool-card。
- 大参数和大结果同时存在，且嵌套对象深度固定可检验。
- 默认种子同时包含大量 message rows 和每条大内容；最后一条峰值 message 使展开工具详情的极端路径可稳定进入视口。
- 默认折叠；展开时才挂载完整卡片，以便分别测两种负载。
- 调试入口仅在 `import.meta.env.DEV` 生效，不访问服务端、不修改用户数据。

验证包括种子器写入后由新 journal store 重新读取并分页、夹具单测、开发构建 TypeScript、定向 UI 测试，以及 Playwright 访问隔离开发实例并打开真实会话；微基准页再用于读取默认和极端负载下的 commit/下一帧指标。
