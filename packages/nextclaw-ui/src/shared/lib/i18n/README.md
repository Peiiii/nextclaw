# i18n owner

This module owns the NextClaw UI language runtime and locale catalogs.

## 文案维护方式

- User-visible labels live in `locales/<locale>/*.json`.
- `index.ts` only owns catalog assembly, formatting helpers, and the stable `t(key)` API.
- Keep current flat keys when moving existing labels; semantic nested keys can migrate by domain during future feature work.
- When adding or editing copy, update both `zh-CN` and `en-US`.

## 验证

Run:

```bash
node scripts/smoke/i18n/nextclaw-ui-i18n-check.mjs
```

The check verifies that both locales have the same JSON files, the same message keys, and matching `{placeholder}` names.
