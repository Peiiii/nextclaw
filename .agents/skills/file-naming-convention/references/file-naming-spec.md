# File Naming Specification

Goal: keep naming consistent, reduce cognitive load, and improve maintainability.

## 1. Core Rules

- Use `kebab-case` for file names.
- File names must express module responsibility via role suffix.
- Avoid `camelCase`, `PascalCase`, and `snake_case` file names.
- One file should carry one primary role.

## 2. Naming Shape

Preferred:

```txt
<domain>.<role>.ts
<domain>-<subdomain>.<role>.ts
```

Examples:

- `chat.controller.ts`
- `chat-stream.manager.ts`
- `chat-input.store.ts`
- `provider-auth.service.ts`
- `marketplace-plugin.controller.ts`

## 3. Allowed Role Suffixes (Whitelist)

- `.service.ts`: reusable domain business capability.
- `.utils.ts`: stateless utility helpers.
- `.types.ts`: type-only declarations.
- `.test.ts`: test files.
- `.manager.ts`: business orchestration and state-flow coordination.
- `.store.ts`: state container.
- `.repository.ts`: persistence/data access layer.
- `.config.ts`: configuration assembly.
- `.controller.ts`: route/request entry layer, protocol adaptation, input validation.
- `.provider.ts`: provider-facing integration capability.

## 4. Directory-to-Suffix Mapping

- `controllers/` should only contain `*.controller.ts` files.
- `services/` should only contain `*.service.ts` files.
- `providers/` should only contain `*.provider.ts` files.
- `repositories/` should only contain `*.repository.ts` files.
- `stores/` should only contain `*.store.ts` files.
- `types/` should only contain `*.types.ts` files.
- `utils/` should only contain `*.utils.ts` files.
- `hooks/` should contain `use-<domain>.ts` or `use-<domain>.tsx`.
- `hooks/` must stay flat and may not contain nested directories.
- `pages/` should contain `<domain>-page.tsx`.
- `components/` may keep plain kebab-case names, but still require one clear primary responsibility per file.
- `lib/` should contain only module directories; direct files under `lib/` are not allowed.

## 5. Test File Naming

- Unit test: `<domain>.<role>.test.ts`
- Integration test: `<domain>.<role>.int.test.ts`
- End-to-end test: `<domain>.<role>.e2e.test.ts`

Examples:

- `chat.controller.test.ts`
- `chat-stream.manager.int.test.ts`

## 6. Directory and Export Rules

- Prefer feature-first folder organization.
- Non-component/page/hook files should default to whitelist-only secondary suffixes.
- `app.ts`, `main.ts`, `main.tsx`, and `index.ts` are the only default entry-point exceptions.
- `index.ts` should only aggregate exports.
- Avoid weak names like `utils.ts`, `helpers.ts`, `common.ts` in broad shared scope.

## 7. Anti-Patterns

- `ChatController.ts` (not kebab-case)
- `chatController.ts` (not kebab-case)
- `chat_controller.ts` (snake_case)
- `controller.ts` (missing domain context)
- `chat.service.manager.ts` (mixed roles)
- `services/chat-manager.ts` (directory and suffix do not match)
- `hooks/chat-session.ts` (hook directory but not `use-*`)
- `hooks/runtime/use-chat-runtime.ts` (hook directory is nested)
- `lib/date-format.utils.ts` (direct file under `lib/`)
- `pages/chat.tsx` (page directory but not `*-page.tsx`)

## 8. Migration Policy

- New files: must follow this spec immediately.
- Existing files: apply rename when touched.
- Large-scale rename: execute by module batches to reduce conflicts.

## 9. Automated Enforcement

- `pnpm lint:new-code:file-names` blocks new or renamed non-kebab files.
- `pnpm lint:new-code:file-role-boundaries` blocks new or renamed files that miss an approved role suffix or violate directory-to-suffix mapping.
- Touched legacy violations should warn first so migration can stay diff-only and incremental.

## 10. Rename Execution Checklist

1. Build old-to-new filename mapping.
2. Rename with `git mv`.
3. Update imports/exports and barrel files.
4. Run impacted checks (lint/test/typecheck).
5. Verify no duplicate legacy path remains.
