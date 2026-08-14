# Command Execution Duration

## 迭代完成说明

本轮把 Codex 风格的命令执行耗时接入 NextClaw 的 NCP 主链。命令只有在越过校验和安全拦截、真正进入执行边界后才开始计时；运行中由 UI 基于标准起点本地派生 elapsed，不向协议、store 或 journal 写入每秒 tick；成功、失败或取消后优先冻结 producer 用单调时钟测得的 `durationMs`。

协议新增一次性的 `message.tool-execution-started`、通用 `NcpToolExecutionTiming`、兼容默认终态的 `final` 标志和工具侧 `reportExecutionStarted` 回调。conversation state manager 负责把事件事实投影到 tool part，journal replay 保留终态最强 timing，内置 legacy/runtime-next 与 Codex SDK/app-server adapter 统一生产同一合同。共享 terminal tool card 只读取标准 execution timing，不从 opaque result JSON 猜测耗时。

完整设计与三轮方案自审见 [`../../designs/2026-08-14-command-execution-timing.design.md`](../../designs/2026-08-14-command-execution-timing.design.md)。

## 测试/验证/验收方式

- 10 个触达包的 `tsc` 全部通过：NCP、toolkit、legacy/runtime-next、Codex adapter、core、kernel、agent-chat、agent-chat-ui 与 UI。
- 五个直接受影响包完整测试通过，共 413 项：toolkit 50、runtime-next 22、legacy runtime 20、Codex adapter 35、agent-chat-ui 286。
- kernel journal replay 定向测试 17 项、ExecTool 定向测试 15 项、NextClaw tool-card adapter 定向测试 9 项通过；合计 454 项测试通过。
- Codex adapter `build` 通过，证明新增 tool-event helper 可进入真实构建产物。
- 精确 ESLint 与 `git diff --check` 通过。
- diff-only maintainability Review 首轮发现 7 个结构错误；抽取事件路由、runtime tool execution、Codex tool-event mapper，并把测试与计时组件迁入既有子域后复查为 0 errors、8 warnings。warning 均为既有大文件接近预算或本次已缩小但仍接近阈值。
- `pnpm lint:new-code:governance` 的新增文件名、目录名与文档名检查通过；整体仍被 3 个本轮触达的历史文件名拦截：`agent-conversation-message-normalizer.ts`、`types/message.ts`、`types/ui-message.ts`。本轮不以跨包公共重命名扩大命令计时范围。

未重启 NextClaw 宿主或当前桌面实例，因此没有执行依赖重启的真实浏览器 smoke；交互、状态、计时器清理和终态冻结由组件 fake-timer/DOM 测试证明，视觉偏好仍可在后续现有开发实例热更新后主观确认。

## 发布/部署方式

本轮没有执行 commit、push、发布、部署或宿主重启。

已新增 `.changeset/command-execution-duration.md`，相关包后续进入统一 NPM/runtime 发布流程；当前工作区包含其它任务改动，交付时必须按本功能路径精确 stage，不能整库提交。

## 用户/产品视角的验收步骤

1. 在 Native 或 Codex 会话中触发一条能实际执行的终端命令。
2. 确认参数准备和安全校验阶段不出现计时；命令真正开始后，状态旁出现持续更新的已运行时长。
3. 分别验证成功、非零退出和取消：状态正确，耗时在终态冻结，不再继续增长。
4. 刷新或重新进入会话，确认完成命令仍显示相同耗时；仍在运行且已有标准起点的命令继续显示近似 elapsed。
5. 触发安全拦截命令，确认显示 blocked/failed，但不伪造执行耗时。
6. 同时执行两条命令，确认每条命令按独立 `toolCallId` 计时，不相互串值。

## 可维护性总结汇总

本轮遵循单一 owner 和单一主链：producer 拥有真实执行边界与单调 duration，NCP 拥有通用合同，toolkit 拥有 event-to-message projection，journal 只保存/回放，UI 只负责本地派生和格式化。没有新增 timer store、heartbeat、并行 command registry 或 opaque-result fallback。

第一轮自动检查发现的超预算增长已触发主观 Review 和结构返工：state event routing、runtime tool execution、Codex tool events 与 terminal duration 分别进入清晰模块；两个测试文件进入既有 `__tests__`，UI 计时组件进入既有 terminal 子域。原本超预算的四个主文件均降回硬阈值以内，目录文件数没有继续恶化。

保留的维护性风险是少数历史主文件仍接近预算，以及三个 legacy 文件名不符合当前 role suffix 规则；它们需要独立迁移计划，不应绑在本次协议与体验变更中做跨包重命名。

## NPM 包发布记录

涉及 NPM 包变更，但本轮未发布，状态均为 `待统一发布`：

- `@nextclaw/ncp`：新增可选 execution timing 事件与公共类型，需要 minor。
- `@nextclaw/ncp-toolkit`：新增 execution timing 投影合同，需要 patch。
- `@nextclaw/ncp-agent-runtime`、`@nextclaw/ncp-agent-runtime-next`：第一方 runtime 生产真实 execution started 与终态 duration，需要 patch。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：Codex SDK/app-server command execution 保留 upstream duration 并区分 progress/final，需要 patch。
- `@nextclaw/core`：内置 ExecTool 在真实进程启动边界报告 execution started，需要 patch。
- `@nextclaw/kernel`：journal replay 保留 terminal timing 且不缓存 progress 结果，需要 patch。
- `@nextclaw/agent-chat`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui`：标准 timing 进入 view model，并在 terminal card 展示运行中/终态耗时，需要 patch。

外部阻塞：需先完成精确提交与统一发布授权；本轮没有获得 commit、push 或 publish 授权。
