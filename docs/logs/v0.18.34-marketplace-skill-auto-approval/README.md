# v0.18.34 Marketplace Skill Auto Approval

## 迭代完成说明

- 为 marketplace skill 发布链路增加服务端自动审批策略配置：`MARKETPLACE_SKILL_AUTO_APPROVE=false|true|off|on|0|1|all`。
- 运行时缺省值保持 `false`，但本次 worker 部署配置显式设为 `true`；发布后用户 scope skill upsert 直接写入 `published`。
- 自动审批会写入 `review_note = "Auto-approved by marketplace policy."` 与 `reviewed_at`，避免后台无法区分待审核与系统通过。
- 同批次把被触达的 marketplace worker 文件命名收敛到当前 role suffix 规则，并补齐 worker 现有 `main.ts`、`infrastructure/`、`presentation/` 结构在 module-structure contract 中的真实入口。

## 测试/验证/验收方式

- `pnpm -C workers/marketplace-api tsc`：通过。
- `pnpm -C workers/marketplace-api lint`：通过。
- `pnpm lint:new-code:governance`：全量被无关文件 `packages/nextclaw-openclaw-compat/src/plugins/plugin-capability-registration.ts` 的既有命名治理问题阻塞；本次 marketplace worker 触达范围已逐项运行对应定向治理命令并通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <marketplace-worker-touched-paths>`：通过，0 errors，4 warnings。
- `pnpm -C workers/marketplace-api exec wrangler deploy --dry-run --outdir /tmp/nextclaw-marketplace-api-dry-run`：通过，确认 worker bundle 识别新增 env var 与 `@/` alias。

## 发布/部署方式

- 本次通过 `pnpm -C workers/marketplace-api run deploy` 部署 marketplace worker。
- Cloudflare Worker Version ID：`614a0850-b053-4a47-9a85-fe3a9fe99833`。
- 本次部署配置将 `MARKETPLACE_SKILL_AUTO_APPROVE` 设置为 `true`，发布后用户 scope skill 默认不再需要人工审批。
- 不涉及数据库 migration；复用既有 `publish_status`、`review_note`、`reviewed_at` 字段。

## 用户/产品视角的验收步骤

1. 在 marketplace worker 环境保持 `MARKETPLACE_SKILL_AUTO_APPROVE=true`，用平台用户发布个人 scope skill，后台应看到 `publishStatus=published`。
2. 自动通过的 skill 应带有 `reviewNote=Auto-approved by marketplace policy.`，且 `reviewedAt` 有值。
3. 官方 `@nextclaw/*` scope 仍保持 admin 发布即 published 的既有行为。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-review` 做收尾复核。
- 本次新增能力引入少量代码，但同步删除旧 barrel 混合导出、收敛文件角色后缀，并把 runtime 配置解析从 `main.ts` 抽到 `utils/marketplace-runtime-config.utils.ts`，使入口文件从 391 行降到 387 行。
- 仍保留的 watchpoint：`d1-marketplace-skill.repository.ts` 接近 400 行预算；后续再扩 marketplace skill 持久化逻辑时应优先拆策略/持久化支持对象。

## NPM 包发布记录

不涉及 NPM 包发布。
