# v0.19.11 sessions_spawn notify 参数契约修复

## 迭代完成说明

- 修复 `sessions_spawn` 首次工具调用容易生成 `request` + DSML 片段导致 JSON 解析失败的问题。
- 根因：真实接口复现显示，模型在嵌套 `request.notify` 参数处输出了 `request">\n<｜｜DSML｜｜parameter: "final_reply"`，该片段已经进入 `message.tool-call-args-delta`，不是 UI 或执行器后处理制造。
- 确认方式：用真实接口只发送“测试一下子代理”，检查 NCP journal，失败样本首次 `sessions_spawn` 参数含 DSML，修复后样本只发出一次 `sessions_spawn`，参数为顶层 `notify: "final_reply"`。
- 修复方式：将 `sessions_spawn` 对模型公开和执行层接受的启动参数统一收敛为顶层 `notify`；未知字段通过通用 `Tool` schema 严格校验拒绝，避免在业务工具里为 `request.notify` 写特判。
- 同步修复 `final_reply` 等待链路：补齐合成 `message.completed` 的 `correlationId`，并支持先收到 `message.completed`、后收到带关联信息的 `run.finished`。
- 同步改善异常展示：`invalid_tool_arguments` 在聊天卡片里按失败态展示，并保留原始参数与解析错误。
- 后续 owner 收敛：删除 `NcpSessionManager` 构造参数中的 `getConfig`、`isLiveSessionRunning`、`onSessionUpdated` 回调片段，改为直接依赖 `ConfigManager`、`SessionSearchManager`、`EventBus` 等 owner。
- 后续 metadata 链路收敛：删除 runtime factory params 里的 `setSessionMetadata` / `updateSessionMetadata` 回调，runtime metadata 解析前移到 `AgentRuntimeManager` / `SessionRunManager`，context compaction preflight 改由 `ContextCompactionManager` 直接调用 `SessionRunManager.updateSessionMetadata()`。
- 后续 live metadata 同步：删除 `installLiveMetadataWriter` 反向注入，`NcpSessionManager` 在 metadata set/update 成功后发布标准 `session.metadata.changed` 事件，`SessionRunManager` 订阅该事实同步 live cache，避免回调切片和持久层/live 层双写口子继续扩散。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- src/tools/session-spawn.tools.test.ts src/utils/session-run.utils.test.ts src/features/session-request/utils/agent-runtime-session-request-dispatcher.utils.test.ts src/managers/__tests__/ncp-session.manager.test.ts`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/utils/chat-message-invalid-tool-arguments.utils.test.ts src/features/chat/utils/chat-message.utils.test.ts`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm exec eslint packages/nextclaw-ui/src/features/chat/utils/chat-message-part.utils.ts packages/nextclaw-ui/src/features/chat/utils/chat-message-invalid-tool-arguments.utils.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm --filter @nextclaw/kernel build`
- 后续 owner 收敛补充验证：
  - `pnpm --filter @nextclaw/shared tsc`
  - `pnpm --filter @nextclaw/core tsc`
  - `pnpm --filter @nextclaw/kernel tsc`
  - `pnpm --filter @nextclaw/server tsc`
  - `pnpm --filter @nextclaw/ncp-toolkit tsc`
  - `pnpm --filter @nextclaw/ncp-toolkit build`
  - `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/ncp-session.manager.test.ts src/managers/__tests__/session-run.manager.test.ts src/managers/__tests__/agent-run-request.manager.test.ts src/features/session-request/managers/session-request.manager.test.ts`
  - `pnpm --filter @nextclaw/server test -- src/app/tests/router.ncp-agent-runtime-manager.test.ts`
  - `pnpm --filter @nextclaw/shared lint`
  - `pnpm --filter @nextclaw/core lint`
  - `pnpm --filter @nextclaw/kernel lint`
  - `pnpm --filter @nextclaw/server lint`
  - `pnpm --filter @nextclaw/ncp-toolkit lint`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

- 未发布。
- 本地真实接口复测使用构建后的 `@nextclaw/kernel` dist，并在临时端口启动服务验证。
- 现有已运行的服务进程需要重启后加载新构建产物。

## 用户/产品视角的验收步骤

- 在聊天里只输入“测试一下子代理”。
- 预期父会话最多出现一次 `sessions_spawn` 子代理启动调用，参数使用顶层 `notify`，不出现 DSML 参数碎片或 `invalid_tool_arguments`；手动传入任何未声明字段应被通用 schema 校验拒绝。
- 子会话完成后，父会话能继续收到子会话最终回复。

## 可维护性总结汇总

- 本次属于非功能 bugfix，非测试代码净增门槛已通过，最终非测试代码净增为 `-1`。
- 优先通过契约收敛解决根因，没有在流式 delta 层增加 DSML 字符串修补分支。
- `sessions_spawn` 的模型可见参数更扁平，owner 仍在工具层与 session-request manager。
- 用户复核后进一步删除旧 `request.notify` 兼容读取，并把未知字段拒绝上移到通用 schema 校验层，确保工具协议只有一条规范链路。
- 用户继续指出学习机制本身缺少闭环后，补充 `learning-from-failures` 与 `nextclaw-delivery-workflow`：机制改进必须检查常驻层、触发层、执行层和验证层，避免只把教训写进文件却无法在下次自动生效。
- 已使用 maintainability guard；未新增目录结构漂移。
- 后续 owner 收敛的维护性复核：总代码新增 `472` 行、删除 `317` 行、净增 `155` 行；非测试代码新增 `274` 行、删除 `277` 行、净增 `-3` 行。
- 正向减债动作：职责收敛 + 删除 + 简化。删除 runtime metadata 写回调、live metadata writer 反向注入、SessionSearch 的 `onSessionUpdated` 回调和 context compaction 的旧调用返回链路；metadata 写入只保留 `setSessionMetadata` / `updateSessionMetadata` 两个语义入口，update 保持 merge 语义。
- 剩余观察点：`agent-run-request.manager.test.ts` 本次为覆盖 owner 链路增长较多，后续再次触达时应优先拆出 fixture/builder，避免测试文件继续膨胀。

## NPM 包发布记录

- 不涉及 NPM 包发布。
