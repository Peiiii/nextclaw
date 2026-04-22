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
- `pnpm lint:new-code:directory-names` blocks touched files whose parent directory chain is not governed.
- `pnpm lint:new-code:file-role-boundaries` blocks touched non-component/page/hook files that do not use an approved secondary suffix, and also blocks directory-to-suffix mismatches such as `services/foo-manager.ts`.
- `pnpm report:file-naming` prints the current legacy non-kebab backlog for gradual migration.

## Decision Rules

- Always use lowercase kebab-case for domain/subdomain segments.
- Keep one file, one primary role.
- Use whitelist-only suffixes for this repository:
  - `.service.ts`, `.utils.ts`, `.types.ts`, `.test.ts`
  - `.manager.ts`, `.store.ts`, `.repository.ts`, `.config.ts`
  - `.controller.ts`, `.provider.ts`
- Directory and suffix must match when these directories are used:
  - `controllers/` -> `*.controller.ts`
  - `services/` -> `*.service.ts`
  - `providers/` -> `*.provider.ts`
  - `repositories/` -> `*.repository.ts`
  - `stores/` -> `*.store.ts`
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
