# Product Screenshot Automation

## Goal

Automate product screenshots used by website and GitHub assets, replacing manual capture.

## Local Usage

1. Install dependencies:

```bash
pnpm install
pnpm exec playwright install chromium
```

2. Refresh screenshots:

```bash
pnpm screenshots:refresh
```

## Outputs

The command updates both screenshot locations in one run:

- `images/screenshots/*`
- `apps/landing/public/nextclaw-chat-page-*.png`
- `apps/landing/public/nextclaw-providers-page-*.png`
- `apps/landing/public/nextclaw-channels-page-*.png`

## CI Automation

Workflow: `.github/workflows/product-screenshots.yml`

- Trigger: `workflow_dispatch` and weekly schedule.
- Action: run `pnpm screenshots:refresh`.
- Result: auto-create PR if screenshot assets changed.

## Acceptance

After running refresh:

1. `git status` should only show screenshot asset updates (unless UI changed).
2. Key files should be regenerated:
   - `images/screenshots/nextclaw-chat-page-en.png`
   - `images/screenshots/nextclaw-providers-page-en.png`
   - `images/screenshots/nextclaw-channels-page-en.png`
3. Landing public mirrors should stay in sync with screenshot source set.
