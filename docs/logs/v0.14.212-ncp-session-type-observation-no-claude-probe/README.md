# v0.14.212-ncp-session-type-observation-no-claude-probe

## 迭代完成说明

- 修正 NCP `session-types` 读取链路的契约，给 session type 描述流程增加 `describeMode`，把纯读取的 `observation` 与显式探测的 `probe` 拆开。
- `/api/ncp/session-types` 现在固定走 `observation` 模式，避免前端页面加载或自动刷新时顺带触发 Claude 的外部 capability probe。
- Claude NCP runtime 插件调整为：`observation` 只做本地配置判断，不做外部探测；只有显式 `probe` 才允许调用 Claude capability probe。
- 修正 Claude session type 描述器的缓存粒度，避免先走 `observation` 后把后续显式 `probe` 错误地命中旧缓存。
- 补充回归测试，覆盖路由层 observation 传参，以及 Claude 描述器的 observation/probe 分流。

## 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
- 测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/claude-session-type-describe.test.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server test -- --run src/ui/router.ncp-agent.test.ts`
- 可维护性检查：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/index.ts packages/nextclaw-openclaw-compat/src/plugins/types.ts packages/nextclaw-server/src/ui/router.ncp-agent.test.ts packages/nextclaw-server/src/ui/router/ncp-session.controller.ts packages/nextclaw-server/src/ui/types.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts packages/nextclaw/src/cli/commands/ncp/ui-ncp-runtime-registry.ts packages/nextclaw/src/cli/commands/ncp/claude-session-type-describe.test.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.claude.test.ts`
- 验收重点：
  - 请求 `/api/ncp/session-types` 时，不应因读接口自动触发 Claude 外部探测。
  - Claude session type 在 observation 模式仍能给出本地配置层面的可用状态。
  - 若后续有显式 probe 调用，仍应能走真实 probe，不会被 observation 缓存短路。

## 发布/部署方式

- 本次为服务端与 CLI 代码修正，无单独前端静态资源发布步骤。
- 合并后按常规工程发布流程执行受影响包的版本管理、构建与发布。
- 若仅在本地验证，可直接重启当前 NextClaw 服务进程，使新的 `/api/ncp/session-types` 行为生效。

## 用户/产品视角的验收步骤

1. 启动包含 Claude NCP runtime 插件的 NextClaw 实例。
2. 打开前端聊天页或任何会自动请求 NCP session type 的页面。
3. 观察日志或外部依赖侧，不应在页面初始加载时出现 Claude capability probe / 外部探测动作。
4. 在 UI 中仍能看到 Claude 作为 session type 出现，且本地缺配置时仍会展示 setup 提示。
5. 若后续接入显式“检测 Claude 能力”按钮或命令，该动作触发时才允许出现外部 probe。
