# v0.19.48 Panel App Agent API

## 迭代完成说明

本次为 Panel App 增加 Agent API MVP：

- `window.nextclaw.agent.send(input)`：通过现有 agent-run 主链路触发会话 run，返回 `NcpRunHandle`，不等待最终回复。
- `window.nextclaw.agent.generateObject(input)`：通过底层 `agent-run.send` 的 `peerId` 机制复用同一持续会话，并通过 `nextclaw_submit_result` 工具拿回结构化 object。
- 新增 `StructuredResultToolProvider` 与 `StructuredResultSubmitTool`，按 message metadata 临时贡献结构化结果工具，不新增 parallel agent run 链路。
- Panel App manifest 支持 `<meta name="nextclaw-panel-capabilities" content="agent:send agent:generateObject">`，并新增独立 capability grant 存储。
- server、client-sdk、UI bridge 补齐对应薄 adapter；iframe 仍只通过宿主注入 bridge 和 `postMessage` 调用。
- 更新产品内置 `panel-app-creator` skill，明确 Panel App 必须走 `window.nextclaw.serviceActions` / `window.nextclaw.agent`，禁止直接 fetch 本地 service server。
- 修正过程中的一处落点错误：曾误把 `panel-app-creator` 写到仓库协作层 `.agents/skills`，已删除该错误新增文件，改为更新真正的产品内置 skill 源文件 `packages/nextclaw-core/src/features/agent/shared/skills/panel-app-creator/SKILL.md`，并运行 `copy-skills` 同步到本地 `dist/skills`。
- 补充产品内置 `panel-app-creator` 的布局约束：Panel App 默认运行在较窄的右侧栏中，生成时必须窄侧栏优先，按 `320px-480px` 窄面板保证核心流程可用，再增强宽屏布局。

根因背景：Panel App 只有纯前端和 Service Action 时，缺少把 UI 局部状态投送到持续 Agent 会话并拿回结构化结果的闭环。这里选择复用现有 `Ingress -> AgentRunRequestManager -> runtime -> EventBus` 主链路，只补结构化结果工具和 Panel App bridge adapter。

补充纠偏：原实现把 `peerId -> 稳定 sessionId` 写在 `PanelAppManager.generateObject` 内部，导致 `generateObject` 绕过底层 `agent-run.send` 合同，`agent.send` 也无法用固定 `peerId` 保持会话。这与本意不符。正确合同是：外部扩展不能生成稳定 sessionId；如果要固定会话，只能传 `peerId`。`peerId` 进入 `Ingress agent-run.send`，由 `AgentRunRequestManager` 带到 `SessionManager.getOrCreateAgentRunSession(...)`，最终由 `SessionManager` 作为 session 事实 owner 内部派生稳定 sessionId。`generateObject` 现在只构造结构化结果 message draft 并传 `peerId`，不再生成 sessionId。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel test -- src/managers/__tests__/panel-app.manager.test.ts src/contributions/tool-provider/providers/structured-result-tool.provider.test.ts`：通过，覆盖 manifest capability、授权、`agent.send` metadata、`generateObject` structured tool result。
- `pnpm -C packages/nextclaw-server test -- src/features/panel-apps/controllers/panel-apps.controller.test.ts src/features/service-apps/controllers/service-apps.controller.test.ts`：通过，覆盖新 route header、授权错误映射与既有 service action bridge session。
- `pnpm -C packages/nextclaw-ui test -- src/features/panel-apps/managers/panel-app-bridge.manager.test.ts`：通过，覆盖 UI bridge 自动授权并重试 `agent.generateObject`。
- `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/skills.test.ts`：通过，覆盖内置 `panel-app-creator` skill 包含 `window.nextclaw.agent.send`、`window.nextclaw.agent.generateObject` 与 capability 声明。
- 补充验证：同一测试覆盖 `panel-app-creator` skill 包含 `peerId`、禁止自行生成稳定 `sessionId`、以及窄侧栏优先布局约束。
- `pnpm -C packages/nextclaw-core exec eslint src/features/agent/features/tests/skills.test.ts`：通过。
- `node packages/nextclaw-core/scripts/copy-skills.mjs`：已把内置 skill 源文件同步到本地 `packages/nextclaw-core/dist/skills`。
- `pnpm -C packages/nextclaw-kernel lint`：通过。
- `pnpm -C packages/nextclaw-server lint`：通过，有既有 warning。
- `pnpm -C packages/nextclaw-client-sdk lint`：通过。
- targeted ESLint：kernel / server / client-sdk / UI 本次触达文件均通过。
- `git diff --check`：通过。
- `pnpm -C packages/nextclaw-client-sdk tsc`：通过。
- `pnpm -C packages/nextclaw-kernel tsc` / `pnpm -C packages/nextclaw-server tsc`：被当前工作区另一批 session-manager 整合改动阻塞，错误集中在 `SessionManager` / `SessionRepository` 类型迁移，不是 Panel App Agent API 新增链路自身的错误。
- `pnpm -C packages/nextclaw-ui tsc`：被既有 `@nextclaw/server` 类型解析和 UI 旧 lint/类型问题阻塞。

## 发布/部署方式

未发布。需要在当前工作区其他未完成改动收敛、全量 `tsc` 和发布检查恢复后，再纳入统一 beta/NPM 发布闭环。

## 用户/产品视角的验收步骤

1. 在 `panels/` 放置一个声明 `agent:generateObject` 的 `*.panel.html`。
2. 页面内调用 `window.nextclaw.agent.generateObject({ peerId, prompt, context, schema })`。
3. 首次调用应触发宿主授权确认；授权后同一请求重试并返回 object。
4. 同一个 Panel App + 同一个 `peerId` 应复用同一个稳定 session，且 Panel App 侧不生成或传入 sessionId。
5. 未声明 capability 或未授权时，应得到明确错误，而不是静默失败。
6. 调用 `window.nextclaw.agent.send({ peerId, content })` 应返回 run handle；同一 `peerId` 再调应继续投送到同一会话。历史 continuation 仍可传 `sessionId`，但不能和 `peerId` 同时传。

## 可维护性总结汇总

- 本次是新增用户能力，非测试代码净增为正是预期结果。
- 先实现时 `PanelAppManager` 越过文件预算，已将无状态 agent request / structured result 逻辑抽到 `utils/panel-app-agent.utils.ts`，让 manager 保持身份、授权和状态 owner。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：本次触达文件 0 error，仍有 `PanelAppManager` 接近预算、client-sdk services 目录既有超限等 warning。
- 全量 maintainability guard 当前被另一批未完成的 `packages/nextclaw-kernel/src/managers/session.manager.ts` 新文件超预算阻塞。
- `pnpm lint:new-code:governance` 当前被另一批未完成的 `packages/nextclaw-service/src/shared/services/restart/restart-sentinel.service.ts` 角色边界问题阻塞；本次触达文件 targeted ESLint 与 package-public-imports 已通过。

## NPM 包发布记录

未发布 NPM 包。涉及 `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` 源码变更，后续需要在当前工作区其他改动收敛后统一评估 beta 发布。
