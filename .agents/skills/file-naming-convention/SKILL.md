---
name: file-naming-convention
description: Enforce Angular/NestJS-style file naming (kebab-case plus role suffixes like controller/manager/store/service). Use when users ask for naming conventions, file renames, modular refactors, or naming governance in TypeScript/JavaScript repositories.
---

# File Naming Convention

## Overview

Use this skill to standardize repository file names with kebab-case and explicit role suffixes, then execute safe rename/refactor steps with minimal churn.

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
4. Apply renames safely (prefer `git mv`) and update imports/exports/barrels.
5. Run minimal validation for affected modules (type check, tests, or lint as applicable).
6. Report changes with a compact mapping: old name -> new name.

For this repository specifically:

- `pnpm lint:new-code:file-names` blocks new or renamed non-kebab source/script/test files.
- `pnpm report:file-naming` prints the current legacy non-kebab backlog for gradual migration.

## Decision Rules

- Always use lowercase kebab-case for domain/subdomain segments.
- Keep one file, one primary role.
- Use whitelist-only suffixes for this repository:
  - `.service.ts`, `.utils.ts`, `.types.ts`, `.test.ts`
  - `.manager.ts`, `.store.ts`, `.repository.ts`, `.config.ts`
  - `.controller.ts`, `.provider.ts`
- React hook 模块例外：凡文件主职责是导出可复用 React hook，必须放在 `hooks/` 目录下，并命名为 `use-<domain>.ts` 或 `use-<domain>.tsx`；此类文件不使用 `.service.ts` 等角色后缀。
- Do not use vague names like `controller.ts`, `common.ts`, `helpers.ts` at broad scope.
- Do not mix multi-role suffixes in one file name (for example `chat.service.manager.ts`).
- `index.ts` is only for export aggregation; no business logic.

## Reference

For the full suffix catalog, testing filename rules, anti-patterns, and migration policy, read:

- [references/file-naming-spec.md](references/file-naming-spec.md)
