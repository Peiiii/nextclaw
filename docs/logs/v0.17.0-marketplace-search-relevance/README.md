# v0.17.0 Marketplace Search Relevance

## 迭代完成说明（改了什么）

本次修复命令行 marketplace skills 搜索准确性问题。根因是 marketplace API 的 catalog 搜索逻辑只把整段 `q` 当成一个连续小写字符串做 `includes`，没有处理空格、连字符、下划线、斜杠等分隔符，也没有做分词全命中判断。因此 `ui ux` 无法命中 `ui-ux-pro-max`，但 `ui-ux` 可以命中；CLI 只是把 query 原样传给 `/api/v1/skills/items?q=...`，第一处合同违约点在 marketplace API 的搜索归一化与评分逻辑。

根因确认方式：

- 线上 API 对比验证：`q=ui%20ux` 返回 0，`q=ui-ux` 返回 `ui-ux-pro-max`。
- 代码路径确认：`packages/nextclaw/src/cli/commands/skills/skills-query.service.ts` 只负责传参；实际过滤和排序在 `workers/marketplace-api/src/infrastructure/in-memory-section-repository-base.service.ts`。
- 修复命中根因：在同一个 repository owner 内把评分逻辑改为原始 query 匹配、去分隔符 compact 匹配、分词全命中三层判断，没有在 CLI 展示层或下游安装链路补兜底。

同时顺手治理被触达 marketplace repository 文件命名：

- `in-memory-section-repository-base.ts` -> `in-memory-section-repository-base.service.ts`
- `in-memory-mcp-repository.ts` -> `in-memory-mcp.repository.ts`
- `in-memory-plugin-repository.ts` -> `in-memory-plugin.repository.ts`
- `in-memory-skill-repository.ts` -> `in-memory-skill.repository.ts`

## 测试/验证/验收方式

- `pnpm -C workers/marketplace-api tsc`：通过。
- `pnpm -C workers/marketplace-api build`：通过。
- `pnpm -C workers/marketplace-api lint`：通过。
- 定向 smoke：通过临时 `tsx` 片段调用 `InMemorySkillRepository`，确认 `ui ux`、`ux ui`、`uiux`、`pro max` 均命中 `ui-ux-pro-max`，`missing term` 不误命中。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过，非测试代码净增 0；仅提示 `workers/marketplace-api/src/main.ts` 接近 400 行预算。

未完全通过项：

- `pnpm lint:new-code:governance` 失败，剩余问题来自本轮开始前已存在且未触达的 `packages/nextclaw-ui/src/shared/lib/i18n/chat.ts` 命名治理问题。
- `pnpm check:governance-backlog-ratchet` 失败，剩余问题为仓库既有 doc file-name violations 当前值 13 高于 baseline 11，非本次 marketplace 搜索改动引入。

## 发布/部署方式

本次改动位于 `workers/marketplace-api`，已部署到 Cloudflare Workers：

- Worker：`nextclaw-marketplace-api`
- Custom domains：`marketplace-api.nextclaw.io`、`apps-registry.nextclaw.io`
- Version ID：`7b8cecb1-faf1-4a26-8b48-9fb8d1d8adc8`

## 用户/产品视角的验收步骤

部署后通过命令行执行：

```bash
nextclaw marketplace skills search --query "ui ux"
nextclaw marketplace skills search --query "ux ui"
nextclaw marketplace skills search --query "uiux"
```

预期结果：均应能返回 `ui-ux-pro-max`，且无关 query 不应误返回该 skill。

线上 API smoke 已确认 `https://marketplace-api.nextclaw.io/api/v1/skills/items?q=ui%20ux&pageSize=10` 返回 `ui-ux-pro-max`。

## 可维护性总结汇总

本次已尽最大努力优化可维护性：是。修复留在 marketplace API 的 repository owner 中，未增加 CLI fallback、展示层特判或双路径。

本次遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”：是。最终通过文件命名治理和实现压缩，将非测试代码净增压到 0。

总代码量、分支数、函数数、文件数或目录平铺度：没有继续恶化。文件数因历史命名治理表现为 rename，实际职责数量没有增加；搜索逻辑仍在原 repository owner 内。

抽象、模块边界、class/helper/service/store 职责划分：更清晰。搜索评分仍由 `InMemorySectionRepositoryBase` 统一负责，未新增 helper 文件或额外服务层。

目录结构与文件组织：本次触达的 marketplace repository 文件已改为治理认可的角色后缀；仓库中仍存在与本次无关的治理失败项，已在验证结果中记录。

独立可维护性复核：

- 可维护性复核结论：通过。
- 本次顺手减债：是。
- 代码增减报告：新增 324 行，删除 324 行，净增 0 行。
- 非测试代码增减报告：新增 324 行，删除 324 行，净增 0 行。
- 长期目标对齐 / 可维护性推进：本次让 marketplace 作为生态入口的发现能力更可靠，同时没有增加 fallback 或新层级，顺着“代码不增长、边界更清晰、复杂点更少”的方向推进了一小步。
- no maintainability findings。

## NPM 包发布记录

不涉及 NPM 包发布。
