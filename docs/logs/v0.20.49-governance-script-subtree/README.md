# v0.20.49 Governance Script Subtree

## 背景

`scripts/governance` 原先直接混放 diff gate、报告、baseline、共享 helper、维护性与拓扑脚本，并通过 README 记录目录预算豁免。本轮将该豁免取消，改为真实分层。

## 改动

- 将治理脚本按 `checks`、`shared`、`backlog`、`maintainability`、`reports`、`topology` 分层，`checks` 内继续拆成 `naming`、`owners`、`boundaries`、`structure`。
- 更新 `package.json`、ESLint config、maintainability console 动态 import、active skills、active governance docs 与计划文档中的脚本路径。
- 修复 topology JSON 读取先尝试标准 JSON，再 fallback JSONC 兼容，避免 package exports 通配路径被注释剥离误伤。
- 将三份已触达的 `docs/plans/*-plan.md` 改为当前要求的 `.plan.md` 命名。

## 验证

- `node --test scripts/governance/checks/naming/*.test.mjs scripts/governance/checks/owners/*.test.mjs scripts/governance/checks/boundaries/*.test.mjs scripts/governance/checks/structure/*.test.mjs scripts/governance/shared/*.test.mjs scripts/governance/backlog/*.test.mjs scripts/governance/maintainability/*.test.mjs scripts/governance/module-structure/*.test.mjs scripts/governance/eslint-rules/*.test.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm lint:new-code:flat-directories -- -- scripts/governance`
- `pnpm lint:maintainability:report`
- `pnpm report:topology`
- `pnpm --filter maintainability-console tsc`

## 维护性

`scripts/governance` 顶层只保留 README；`scripts/governance/checks` 顶层只保留总入口与 diff support。维护性报告中 `scripts/governance/checks` 已不再出现在 directory budget hotspots。

## 发布记录

无需 changeset。本轮只调整仓库内部治理脚本、文档路径和验证入口，不改变 NPM 包对外运行合同。

## 复盘

这类目录治理不能只移动文件，必须同步检查调用方硬编码路径、脚本相对 import、package scripts、active skill 文档和报告入口。后续触达治理脚本时应继续按职责子树新增或移动，不再恢复根目录平铺。
