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

## 3. Role Suffix Catalog

- `.controller.ts`: route/request entry layer, protocol adaptation, input validation.
- `.manager.ts`: business orchestration and state-flow coordination.
- `.store.ts`: state container.
- `.service.ts`: reusable domain business capability.
- `.repository.ts`: persistence/data access layer.
- `.adapter.ts`: third-party system adaptation.
- `.gateway.ts`: process/network gateway.
- `.middleware.ts`: middleware.
- `.guard.ts`: permission/precondition guard.
- `.interceptor.ts`: interception logic.
- `.factory.ts`: factory builder.
- `.schema.ts`: schema/validation definition.
- `.types.ts`: type-only declarations.
- `.constants.ts`: constants.
- `.utils.ts`: stateless utility helpers.
- `.mapper.ts`: data structure mapping/transformation.
- `.config.ts`: configuration assembly.

## 4. Test File Naming

- Unit test: `<domain>.<role>.test.ts`
- Integration test: `<domain>.<role>.int.test.ts`
- End-to-end test: `<domain>.<role>.e2e.test.ts`

Examples:

- `chat.controller.test.ts`
- `chat-stream.manager.int.test.ts`

## 5. Directory and Export Rules

- Prefer feature-first folder organization.
- `index.ts` should only aggregate exports.
- Avoid weak names like `utils.ts`, `helpers.ts`, `common.ts` in broad shared scope.

## 6. Anti-Patterns

- `ChatController.ts` (not kebab-case)
- `chatController.ts` (not kebab-case)
- `chat_controller.ts` (snake_case)
- `controller.ts` (missing domain context)
- `chat.service.manager.ts` (mixed roles)

## 7. Migration Policy

- New files: must follow this spec immediately.
- Existing files: apply rename when touched.
- Large-scale rename: execute by module batches to reduce conflicts.

## 8. Rename Execution Checklist

1. Build old-to-new filename mapping.
2. Rename with `git mv`.
3. Update imports/exports and barrel files.
4. Run impacted checks (lint/test/typecheck).
5. Verify no duplicate legacy path remains.
