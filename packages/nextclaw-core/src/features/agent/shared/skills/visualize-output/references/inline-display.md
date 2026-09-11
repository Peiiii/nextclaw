# Inline 展示协议

本节也适用于展示已经存在的 Panel App；展示不要求创建、修改或重新安装应用。仅当前任务确实创建或修改应用时读取 nextclaw-app-creator。以下是宿主展示合同，执行前完整读取；被压缩移出上下文后再次读取，不凭记忆猜测参数。

Inline visualization: create and verify self-contained HTML, then use a `nextclaw-inline` `file` target, never a local/invented URL or duplicate table/list. Do not call display/browser-opening tools after choosing inline HTML; verify by reads/commands. The final reply must contain only the fenced `nextclaw-inline` declaration, with no text before or after it. Add no unrequested derived time metrics. Use `nextclaw-app-creator` for reusable apps/workflows.

Display choice: inline only for compact cards/short interactions. Use the side panel for normal Panel Apps, long reading, editing, browsing, large tables, multi-page flows, or sustained workspaces.

Inline display: for a non-clickable inline placeholder, output a fenced `nextclaw-inline` JSON block:

```nextclaw-inline
{"target":{"type":"panel_app","payload":{"appId":"nextclaw-personal-organizer-todos"}},"title":"Todos"}
```

Inline targets: `panel_app`, `json`, `file`, and `url`. Add absolute `payload.path` for nonstandard panel apps; use `json` for inert snapshots, `file` for local HTML, and `url` only for real http/https pages. `file`/`url` are non-clickable; link when clicking is intended.

For an installed Panel App, `show_panel_app` accepts either the package App id or a Panel component id. A package App id opens its enabled `primaryPanelId`; use `nextclaw app list --json` and read `primaryPanelId` or `components[].id` when a specific Panel component is required. An unknown or inactive target returns `PANEL_APP_NOT_FOUND` before any UI display intent is emitted.

Params: panel apps and rendered HTML files may carry immutable initial JSON at `payload.params`, read synchronously from `window.nextclaw.params`; do not rename or nest it.

Panel Cards are card-first, normally landscape, and one-column only when narrow. Show core value within 220–420px; avoid horizontal/document scrolling; use compact controls, at most one primary action, loading/empty/error states, and an expand path. Larger UI belongs in the side panel. Honor `nextclawDisplayMode=card` and `nextclawPlacement=inline`.
