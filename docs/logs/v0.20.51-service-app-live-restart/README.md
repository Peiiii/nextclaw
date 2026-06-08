# v0.20.51 Service App Live Restart

## 迭代完成说明

本次新增 `nextclaw app restart <app-id> --json`，让 AI 修改 Service App 后可以主动断开 live 产品实例里的旧 MCP runtime，再进行服务应用面板或 Panel-to-Service 调用复测。

根因：Service App 的产品内调用链会按 `appId` 复用 `McpServerLifecycleManager` 中的 ready connection；`nextclaw app dev/call` 使用隔离临时 runtime，不能代表当前 UI 中已运行的 live 连接。此前 AI 若通过 live 产品实例复测，可能仍在调用修改前的进程。

修复点：不新增后端合同，复用既有 `POST /api/service-apps/:appId/restart`，在 CLI 层补一个可脚本化入口，并同步 `USAGE` 与 Service App 创建相关 skill 的验收规则。

## 测试/验证/验收方式

- `pnpm --filter nextclaw test -- --run src/cli/app/services/service-app-live-runtime.service.test.ts src/cli/app/services/service-app-dev.service.test.ts`
- `pnpm --filter nextclaw exec eslint src/cli/app/services/service-app-live-runtime.service.ts src/cli/app/services/service-app-live-runtime.service.test.ts src/cli/app/controllers/app-restart-command.controller.ts src/cli/app/register-app-commands.ts src/cli/app/types/service-app-dev.types.ts`
- `pnpm --filter nextclaw tsc`
- `pnpm --filter nextclaw dev:build app restart --help`
- `pnpm --filter nextclaw lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

尚未发布。该变更需要随下一次 `nextclaw` NPM 包发布进入用户可用 CLI。

## 用户/产品视角的验收步骤

1. 修改一个已经在产品 UI 中运行过的 `service-apps/<app-id>`。
2. 运行 `nextclaw app restart <app-id> --json`，确认返回 `ok: true` 且状态回到 idle。
3. 通过服务应用面板重新 discover，或从 Panel App 触发对应 action。
4. 确认调用命中新代码，而不是旧运行进程。

## 可维护性总结汇总

本次是新增用户可见 CLI 能力，非测试生产代码有净增长。实现选择复用既有后端 restart API，没有引入新 API 路由或 runtime 双路径；CLI 只负责本地 UI runtime 发现、bridge auth 和意图级输出。`post-edit-maintainability-review` 结论为通过，剩余关注点是后续若做自动 signature 失效，应把本命令保留为显式控制入口，而不是继续堆叠平行 reload 语义。

## NPM 包发布记录

需要后续统一发布 `nextclaw` 包；本次未执行 NPM 发布。
