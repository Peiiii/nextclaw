# v0.19.11 sessions_spawn notify 参数契约修复

## 迭代完成说明

- 修复 `sessions_spawn` 首次工具调用容易生成 `request` + DSML 片段导致 JSON 解析失败的问题。
- 根因：真实接口复现显示，模型在嵌套 `request.notify` 参数处输出了 `request">\n<｜｜DSML｜｜parameter: "final_reply"`，该片段已经进入 `message.tool-call-args-delta`，不是 UI 或执行器后处理制造。
- 确认方式：用真实接口只发送“测试一下子代理”，检查 NCP journal，失败样本首次 `sessions_spawn` 参数含 DSML，修复后样本只发出一次 `sessions_spawn`，参数为顶层 `notify: "final_reply"`。
- 修复方式：将 `sessions_spawn` 对模型公开和执行层接受的启动参数统一收敛为顶层 `notify`；未知字段通过通用 `Tool` schema 严格校验拒绝，避免在业务工具里为 `request.notify` 写特判。
- 同步修复 `final_reply` 等待链路：补齐合成 `message.completed` 的 `correlationId`，并支持先收到 `message.completed`、后收到带关联信息的 `run.finished`。
- 同步改善异常展示：`invalid_tool_arguments` 在聊天卡片里按失败态展示，并保留原始参数与解析错误。

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

## NPM 包发布记录

- 不涉及 NPM 包发布。
