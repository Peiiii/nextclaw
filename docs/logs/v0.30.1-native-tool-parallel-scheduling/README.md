# v0.30.1 Native 工具并行调度

## 迭代完成说明

- Native runtime 原先能够接收同一模型轮次中的多个 tool call，但 `RuntimeToolCallExecutor` 只有一个 FIFO worker，所有调用都会逐个等待完成。
- `NcpTool` 新增可选的 `supportsParallelToolCalls` 能力声明；只有显式声明为安全的工具才进入共享并行窗口，缺省工具继续独占执行。
- 调度器按 FIFO 实现共享/独占准入，独占调用形成公平性栅栏，并把同时在途调用限制为 8 个。
- 首批并行白名单为 `read_file`、`list_dir`、`view_image`、`web_search`、`web_fetch`、`memory_search`、`memory_get`。
- 写入、编辑、shell、gateway、消息、cron、subagent/spawn、MCP 和未来未声明工具保持独占。
- result 事件按真实完成时间发布，conversation state 仍按 `toolCallId` 原位回填，下一轮模型输入保持原始调用顺序。
- 方案与完整合同见 `docs/designs/2026-08-10-native-tool-call-parallel-scheduling.design.md`。

## 测试/验证/验收方式

- `@nextclaw/ncp`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/ncp-toolkit`、`@nextclaw/core`、`@nextclaw/kernel` 的 TypeScript 检查通过。
- Runtime 20/20、Toolkit 46/46、Core 217/217；Kernel 的目标工具 provider 测试 3/3 通过。
- 调度器定向覆盖并行重叠、默认独占、独占 FIFO 栅栏、8 路上限、完成顺序和取消后不再启动排队调用。
- conversation state 定向覆盖结果乱序到达但 invocation/model 顺序不变。
- targeted ESLint、`lint:new-code:governance`、changeset 状态检查和 diff whitespace 检查通过。
- Kernel 全量回归为 304/305；唯一失败是既有 panel VM 测试未注入 `URLSearchParams`，独立复跑仍失败，与本次工具调度链路无关。

## 发布/部署方式

- 本次只提交源码、测试、设计文档、changeset 和迭代记录。
- 不执行 NPM 发布、部署、tag、GitHub Release 或服务重启。
- 后续由稳定发布批次消费 `.changeset/native-tool-parallel-scheduling.md`。

## 用户/产品视角的验收步骤

1. 从当前仓库构建并启动隔离的 Native runtime。
2. 使用 `minimax/MiniMax-M3`，在同一模型响应中发出两个各延迟 1.5 秒的 `web_fetch` 调用。
3. 本地延迟服务记录两个请求启动时间仅相差 95ms，证明两个请求真实重叠，而非串行执行。
4. NCP SSE 出现两组 tool-call 事件和两个 result；下一轮模型返回 `PARALLEL-SMOKE-OK`，terminal event 为 `run.finished`。
5. 读取会话消息投影，确认两个结果仍位于各自原始 tool invocation 位置。
6. 验收后停止隔离 runtime 与延迟服务，确认端口无残留监听。

## 可维护性总结汇总

- 并行能力事实归 `NcpTool`，调度状态与生命周期归 `RuntimeToolCallExecutor`，没有新增全局 parallel/sequential 配置或第二套策略 owner。
- 使用基类默认 `false` 和 runtime 的显式 `=== true` 判断，避免为每个写工具增加重复配置，也保证未来新增与 MCP 工具默认安全。
- 非测试生产代码净增保持在实现能力合同和调度状态所需的最小范围，没有增加 wrapper、adapter 或兼容分支。
- 自动维护性检查无阻塞项；4 个警告均为既有文件/目录接近预算线，本次没有新增 provider 文件。因跨模块 owner 变化执行了主观复核，结论为无可维护性发现。
- 新增设计、测试和迭代路径均通过文件组织 preflight 与治理检查。

## NPM 包发布记录

需要随下一次稳定批次统一发布，当前本地版本与 npm 已发布版本一致，本次提交尚未发布：

- `@nextclaw/core@0.15.21`：待统一发布。
- `@nextclaw/kernel@0.6.23`：待统一发布。
- `@nextclaw/ncp-agent-runtime-next@0.1.16`：待统一发布。
- `@nextclaw/ncp@0.7.16`：待统一发布。
- `nextclaw@0.30.0`：待统一发布。
