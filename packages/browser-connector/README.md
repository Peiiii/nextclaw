# @nextclaw/browser-connector

Local Chrome control connector for AI agents.

`browser-connector` lets an agent inspect and operate the user's current Chrome tabs through a Chrome Extension, Chrome Native Messaging Host, and a local CLI. It is designed for agent workflows that need the user's existing Chrome profile, open tabs, and login state without starting a separate Playwright browser.

## Install

```bash
npm install -g @nextclaw/browser-connector
```

## First-Time Setup

Run one setup command:

```bash
browser-connector setup chrome --open --json
```

If `ready` is `false`, follow the returned `nextSteps`. Usually Chrome opens `chrome://extensions` and the command returns the extension directory to load as an unpacked extension.

After loading or reloading the extension, run:

```bash
browser-connector setup chrome --json
```

You are ready when the output contains:

```json
{
  "ready": true
}
```

After future CLI or extension updates, ask the connected unpacked extension to
reload itself:

```bash
browser-connector extension reload --reason "refresh extension after update" --json
```

If the installed extension is too old to support self-reload, reload it once in
`chrome://extensions`, then rerun setup.

## Basic Workflow

List current Chrome tabs:

```bash
browser-connector tabs list --json
```

Open a temporary page without interrupting the user's active tab:

```bash
browser-connector tabs open "https://example.com/" --reason "read a reference page" --json
```

Open and switch to a page only when the user asked to view it:

```bash
browser-connector tabs open "https://example.com/" --reason "show this page to the user" --foreground --json
```

Claim a tab before reading or operating it:

```bash
browser-connector tabs claim "<tabRef>" --reason "inspect this page" --json
```

Read a bounded DOM snapshot:

```bash
browser-connector page snapshot --lease "<leaseId>" --json
```

Find interactive candidates by visible text, label, or placeholder:

```bash
browser-connector page locate --lease "<leaseId>" --text "Create" --json
```

Read ref-addressable interactive candidates when a page has repeated labels or
button-like custom elements:

```bash
browser-connector page snapshot --lease "<leaseId>" --interactive --json
```

Inspect a candidate before acting:

```bash
browser-connector page inspect --lease "<leaseId>" --ref "i2" --json
```

Fill editable fields with verified post-input state:

```bash
browser-connector page fill --lease "<leaseId>" --selector "textarea[data-testid=\"lyrics-textarea\"]" --text "lyrics" --reason "fill lyrics" --json
```

For editor-like fields that ignore direct value assignment, use the explicit
paste input mode and verify the returned evidence:

```bash
browser-connector page fill --lease "<leaseId>" --selector ".editor" --mode paste --text "long text" --reason "fill rich editor" --json
```

When replacing existing content in a complex editor, verify the old text is no
longer visible before submitting.

Read field evidence from `action.element` or `action.after` for actions, and
from `inspect.element` for inspections.

Click either by CSS selector or by an interactive ref:

```bash
browser-connector page click --lease "<leaseId>" --ref "i2" --reason "click the selected create button" --json
```

Wait for URL, load state, or an element when an action changes the page:

```bash
browser-connector page wait-url --lease "<leaseId>" --url "create" --reason "wait for create page" --json
browser-connector page wait-load --lease "<leaseId>" --reason "wait for page load" --json
browser-connector page wait-element --lease "<leaseId>" --text "Done" --reason "wait for completion" --json
```

Capture a screenshot:

```bash
browser-connector page screenshot --lease "<leaseId>" --output /tmp/browser-page.png --json
browser-connector page screenshot --lease "<leaseId>" --full-page --output /tmp/browser-full-page.png --json
```

Release the lease when done:

```bash
browser-connector tabs finalize --lease "<leaseId>" --json
```

## Safety

- New tabs open in the background by default so AI evaluation does not interrupt the user's current Chrome work.
- `--foreground` is explicit opt-in.
- Non-web URLs are rejected by `tabs open`.
- Dangerous key presses require explicit confirmation.
- The connector does not read cookies, localStorage, sessionStorage, passwords, browser history, or Chrome extension private storage.
- Page text is treated as untrusted browser content.

## Uninstall

```bash
browser-connector uninstall chrome --json
```
