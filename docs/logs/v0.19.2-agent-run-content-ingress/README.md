# v0.19.2 Agent Run Content Ingress

## 迭代完成说明

本次为 `/api/ncp/agent/send` 与 `agent-run.send` ingress 增加轻量 `content` 输入形态。外部调用方可以继续传完整 `message`，也可以传 `content: NcpMessagePart[]`，由 `AgentRunRequestManager` 在内部生成 `id`、`role`、`status`、`timestamp` 并 materialize 为标准 `NcpMessage`。

本次没有修改公共 NCP transport adapter，也没有新增 prompt/input 平行协议。

后续补齐了 webhook 使用文档与 AI 自管理 guide 可发现性：

- 顶层 `USAGE.md` 只保留 webhook 索引、地址发现规则和最小示例，避免把完整 payload 参数表塞进 AI 高频上下文。
- 新增 `docs/usage/http-webhook-ingress.md` 作为按需细节页，承载完整 webhook envelope、`agent-run.send` payload、session 续写、验证与错误语义。
- `packages/nextclaw/scripts/sync-usage-resource.mjs` 同步 `docs/usage/*.md` 到包内 `resources/usage/*.md`，确保 packaged runtime AI 也能按需读取细节页。
- `nextclaw-self-manage` skill 明确本地 HTTP/API/webhook 地址通过 `nextclaw status --json` 的 `endpoints.uiUrl` / `endpoints.apiUrl` 发现，避免 AI 猜端口。
- `nextclaw-agent-instructions-governance` 沉淀 AI 可读 guide 的分层原则：顶层做索引和高频规则，长参数表、协议细节、排障图谱拆到 focused linked files。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- agent-run-request.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- router.ncp-agent.test.ts router.ncp-agent-runtime-manager.test.ts`
- `pnpm --filter @nextclaw/shared tsc`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/shared lint`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/server lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-shared/src/configs/ingress-keys.config.ts packages/nextclaw-server/src/app/router.ts packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts packages/nextclaw-kernel/src/managers/agent-run-request.manager.test.ts packages/nextclaw-server/src/app/tests/router.ncp-agent-runtime-manager.test.ts`

文档分层 follow-up 验证：

- `nextclaw status --json`：确认现有 CLI 已提供 `endpoints.uiUrl` / `endpoints.apiUrl`。
- `node packages/nextclaw/scripts/sync-usage-resource.mjs`
- 自定义 Node 校验：确认 `docs/USAGE.md` 与 `packages/nextclaw/resources/USAGE.md` 同步，且 `docs/usage/http-webhook-ingress.md` 与 `packages/nextclaw/resources/usage/http-webhook-ingress.md` 同步。
- `git diff --check -- docs/USAGE.md docs/usage/http-webhook-ingress.md packages/nextclaw/resources/USAGE.md packages/nextclaw/resources/usage/http-webhook-ingress.md packages/nextclaw/scripts/sync-usage-resource.mjs packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-self-manage/SKILL.md .agents/skills/nextclaw-agent-instructions-governance/SKILL.md`
- `pnpm -C packages/nextclaw exec eslint scripts/sync-usage-resource.mjs`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths docs/USAGE.md docs/usage/http-webhook-ingress.md packages/nextclaw/resources/USAGE.md packages/nextclaw/resources/usage/http-webhook-ingress.md packages/nextclaw/scripts/sync-usage-resource.mjs packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-self-manage/SKILL.md .agents/skills/nextclaw-agent-instructions-governance/SKILL.md`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

未执行发布或部署。本次触达 `@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server` 源码，并在 follow-up 触达 `nextclaw` 包内资源同步脚本与 `@nextclaw/core` 内置 self-management skill，后续应随常规 NPM/桌面发布批次一起发布。

## 用户/产品视角的验收步骤

1. 向 `/api/ncp/agent/send` 发送仅包含 `content` 与可选 `metadata/sessionId` 的请求。
2. 确认接口返回 run handle。
3. 确认 agent runtime 收到由系统生成的 user message，且 `content` 中的 text/file 等多模态 part 被保留。
4. 同时传 `message` 与 `content` 时，应返回 `INVALID_BODY`。
5. 需要从 AI 或脚本调用 webhook 时，先运行 `nextclaw status --json`，使用 `endpoints.uiUrl` 拼接 `/webhook`。
6. 只需要知道 webhook 存在时读取 `USAGE.md` 索引；需要实现或排障时再读取 `docs/usage/http-webhook-ingress.md`。

## 可维护性总结汇总

本次复用既有 `NcpMessagePart[]` 与 `AgentRunRequestManager` owner，避免新增独立 prompt/input 协议或平行 DTO 体系。新增代码主要集中在边界校验、owner 内 materialize 和定向测试；维护性检查存在一个既有目录预算 warning，未新增直接文件导致目录继续膨胀。

文档分层 follow-up 的正向减债动作是降低 AI 高频 guide 的 token 压力和心智负担：把完整 webhook 参数细节移到按需专题页，并同步升级包内资源同步脚本，避免出现 repo docs 可读但 packaged runtime AI 不可达的断链。该 follow-up 属于新增文档可发现性与同步能力，生产脚本净增长是为了让分层资源成为打包产物的一部分，而不是只做 repo 内链接。

## NPM 包发布记录

待统一发布：`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/core`、`nextclaw`。
