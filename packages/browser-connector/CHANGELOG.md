# @nextclaw/browser-connector

## Unreleased

### Minor Changes

- Add Codex-parity browser action primitives: `page inspect`, `page fill`, post-action element state evidence, URL/load/element waits, page logs, checkbox/select actions, full-page/clip screenshots, and guarded tab closing.
- Add explicit `page fill --mode paste` for editor-like text fields, with `inputMode` and page text match evidence in action results.
- Fix synthesized page clicks so a single `page click` produces one click event instead of also invoking `element.click()`.

## 0.1.2

### Patch Changes

- Add `browser-connector extension reload` so agents can ask the connected Chrome extension to reload itself after local or package updates.

## 0.1.1

### Patch Changes

- Add structured interactive element discovery with `page locate`, `page snapshot --interactive`, and `page click --ref` so agents can operate complex pages without guessing CSS selectors.

## 0.1.0

### Minor Changes

- Initial release of the `browser-connector` CLI with Chrome setup, Native Messaging Host registration, tab lease commands, page snapshot/screenshot/action commands, default-background tab opening, and Browser Control marketplace skill guidance.
