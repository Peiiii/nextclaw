# v0.20.47 Knowledge Governance

## 迭代完成说明

本次新增 `docs/thoughts` 作为 NextClaw 产品、架构、交互和战略思考的轻量沉淀层，用于承接已经超过一句话想法、但尚未成熟到 `docs/designs` 或 `docs/plans` 的讨论。

同时新增 `nextclaw-knowledge-governance` skill，统一维护 `docs/TODO.md`、`docs/thoughts`、`docs/designs`、`docs/plans`、`docs/prd`、`docs/ROADMAP.md` 与 `docs/logs` 之间的分流和升级关系。

本次还把 `docs/thoughts` 接入现有文档命名治理：`docs/thoughts`、`docs/designs`、`docs/plans` 下的文档都必须使用 `YYYY-MM-DD-` 日期前缀和 `.thought` / `.design` / `.plan` 点分角色后缀。

## 测试/验证/验收方式

- `node --test scripts/governance/lint-doc-file-names.test.mjs`
- `pnpm lint:new-code:doc-file-names`
- `pnpm lint:new-code:governance`
- `pnpm exec eslint scripts/governance/doc-file-name-shared.mjs scripts/governance/lint-doc-file-names.mjs scripts/governance/lint-doc-file-names.test.mjs`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths scripts/governance/doc-file-name-shared.mjs scripts/governance/lint-doc-file-names.mjs scripts/governance/lint-doc-file-names.test.mjs`

验证结果均通过。maintainability guard 报告 `scripts/governance` 目录存在已记录的目录预算 warning，本次没有新增该目录文件数；脚本非测试净增为 0。

## 发布/部署方式

不涉及部署。

本次只调整仓库知识治理、文档沉淀和治理脚本，不涉及线上服务、数据库、运行时 update channel 或桌面发布。

## 用户/产品视角的验收步骤

1. 查看 `docs/thoughts/README.md`，确认 thoughts 层级定位清楚。
2. 查看 `docs/thoughts/2026-06-08-agent-os-everything-entry.thought.md`，确认 Everything Entry 思考已被轻量沉淀。
3. 查看 `.agents/skills/nextclaw-knowledge-governance/SKILL.md`，确认后续关于想法、思考、设计、计划和迭代记录的分流有统一 skill owner。
4. 新增一个无日期前缀或无 `.thought` 后缀的 `docs/thoughts/*.md` 时，`pnpm lint:new-code:doc-file-names` 应阻断并提示正确命名。

## 可维护性总结汇总

本次是非功能治理改动，目标是减少知识沉淀机制的歧义，而不是新增产品能力。

可维护性处理：

- 没有为 `docs/thoughts` 新增独立脚本，而是复用现有 `lint-doc-file-names` owner。
- 脚本修改保持在现有共享 helper 和测试内，没有新增治理目录文件。
- AGENTS 只新增短路由，长流程落在 `nextclaw-knowledge-governance` skill。
- `docs/logs` 只用于本次实际治理交付留痕，不用于普通 thought 起草。

## NPM 包发布记录

不涉及 NPM 包发布。
