---
name: file-naming-convention
description: Enforce Angular/NestJS-style file naming (kebab-case plus role suffixes like controller/manager/store/service). Use when users ask for naming conventions, file renames, modular refactors, or naming governance in TypeScript/JavaScript repositories.
---

# File Naming Convention

## Overview

Use this skill to standardize repository file names with kebab-case, explicit role suffixes, and directory-to-suffix alignment, then execute safe rename/refactor steps with minimal churn.

## When To Use

Trigger this skill when requests include any of these intents:

- Define or refine file naming standards.
- Rename files to `kebab-case`.
- Introduce role-based suffixes such as `.controller.ts`, `.manager.ts`, `.store.ts`.
- Refactor large modules and align new files with consistent naming.
- Audit naming anti-patterns and produce a migration checklist.

## Workflow

1. Confirm scope: whole repo, one package, or one module.
2. Classify each target file by single primary role (controller, manager, service, etc.).
3. Generate target names with this shape: `<domain>.<role>.ts` or `<domain>-<subdomain>.<role>.ts`.
4. Verify the containing directory matches the role suffix (for example `services/*.service.ts`, `controllers/*.controller.ts`).
5. Apply renames safely (prefer `git mv`) and update imports/exports/barrels.
6. Run minimal validation for affected modules (type check, tests, or lint as applicable).
7. Report changes with a compact mapping: old name -> new name.

For this repository specifically:

- `pnpm lint:new-code:file-names` blocks touched non-kebab source/script/test files, not only new names.
- `pnpm lint:new-code:doc-file-names` blocks touched governed docs with non-kebab names, and requires `docs/designs` / `docs/plans` files to carry a `YYYY-MM-DD-` date prefix.
- `pnpm lint:new-code:directory-names` blocks touched files whose parent directory chain is not governed.
- `pnpm lint:new-code:file-role-boundaries` blocks touched non-component/page/hook files that do not use an approved secondary suffix, and also blocks directory-to-suffix mismatches such as `services/foo-manager.ts`.
- For Git renames that only move existing legacy role-boundary debt without changing the violation kind, the role-boundary check does not force an unrelated rename during the structural move.
- Generated VitePress data under `apps/docs/.vitepress/data/` is exempt from role-suffix enforcement; the generator owner and generated file naming are validated by the docs build path instead.
- `pnpm report:file-naming` prints the current legacy non-kebab backlog for gradual migration.

## Decision Rules

- Always use lowercase kebab-case for domain/subdomain segments.
- Keep one file, one primary role.
- `.service.ts` 只允许用于内部声明了 `class` 的服务 owner；没有 class 的纯函数、映射、解析、装配或导出聚合不得命名为 `.service.ts`，应改用 `.utils.ts`、`.manager.ts`、`.controller.ts` 或其它真实角色。
- 不得为了通过 `.service.ts` 命名治理而新增空心 class；如果 class 只代理其它 owner、没有真实状态/生命周期/流程所有权，说明文件角色应改名，而不是把假 owner 塞进文件。
- Use whitelist-only suffixes for this repository:
  - `.service.ts`, `.utils.ts`, `.types.ts`, `.test.ts`
  - `.manager.ts`, `.store.ts`, `.repository.ts`, `.config.ts`
  - `.controller.ts`, `.provider.ts`, `.tools.ts`
- Directory and suffix must match when these directories are used:
  - `controllers/` -> `*.controller.ts`
  - `services/` -> `*.service.ts`
  - `providers/` -> `*.provider.ts`
  - `repositories/` -> `*.repository.ts`
  - `stores/` -> `*.store.ts`
  - `tools/` -> `*.tools.ts`，仅用于 agent-facing tools；不要把它当作 `utils/` 或通用工具函数目录
  - `types/` -> `*.types.ts`
  - `utils/` -> `*.utils.ts`
- React hook 模块例外：凡文件主职责是导出可复用 React hook，必须放在 `hooks/` 目录下，并命名为 `use-<domain>.ts` 或 `use-<domain>.tsx`；此类文件不使用 `.service.ts` 等角色后缀。
- `hooks/` 必须保持平铺：目录下禁止再出现任何子目录，只允许直接 hook 文件；需要分类时，应拆到不同业务边界各自的 `hooks/` 目录，而不是写成 `hooks/<subtree>/...`。
- `lib/` 必须保持模块容器边界：目录下只能出现模块目录，不能直接放文件；共享能力应先落到 `lib/<module>/`，再由该模块目录自己的 `index.ts` / `index.tsx` 暴露公共出口。
- 页面模块例外：`pages/` 目录下文件必须命名为 `<domain>-page.tsx`；`index.ts` 仅可作为页面导出聚合。
- 组件模块例外：`components/` 目录下可使用 kebab-case 文件名，不强制二级角色后缀，但仍要求一文件一主职责。
- `app.ts`、`main.ts(x)` 与 `index.ts` 是少量明确例外：分别只用于应用入口或导出聚合，不能承载模糊业务逻辑。
- Do not use vague names like `controller.ts`, `common.ts`, `helpers.ts` at broad scope.
- Do not mix multi-role suffixes in one file name (for example `chat.service.manager.ts`).
- `index.ts` is only for export aggregation; no business logic.

## Reference

For the full suffix catalog, testing filename rules, anti-patterns, and migration policy, read:

- [references/file-naming-spec.md](references/file-naming-spec.md)
