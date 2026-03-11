---
name: unsigned-desktop-release-playbook
description: Reusable playbook for shipping unsigned desktop builds on macOS and Windows with clear user-opening guidance, integrity checks, and GitHub pre-release notes.
---

# Unsigned Desktop Release Playbook

## Overview
Use this skill when you must distribute desktop binaries without code-signing certificates, while keeping packaging integrity verifiable and onboarding steps beginner-friendly.

## When to Use
- macOS and/or Windows desktop release is required, but signing credentials are unavailable.
- Users report macOS "app is damaged" or cannot find "Open Anyway".
- You need a repeatable GitHub release checklist for unsigned binaries.

## Core Principle
- Differentiate **corrupted package** vs **unsigned package**:
  - Corrupted package: `codesign --verify --deep --strict` fails. Must be fixed in build pipeline.
  - Unsigned package: `codesign --verify` can pass, but `spctl --assess` rejects. This is expected without certificate/notarization.

## Packaging Validation Workflow
1. Download release asset from GitHub.
2. Mount DMG and check app integrity:
   - `codesign --verify --deep --strict --verbose=2 "<App>.app"`
3. Check Gatekeeper assessment:
   - `spctl --assess --type execute --verbose=4 "<App>.app"`
4. For Windows unpacked zip, confirm executable exists:
   - `unzip -l "<zip>" | rg -n "\\.exe$"`

## Beginner User Guide Template

### macOS
1. Open `.dmg`, drag app to `Applications`.
2. Double-click app once from `Applications`.
3. If blocked, click `Done` in the popup first.
4. Go to `System Settings -> Privacy & Security`, scroll to bottom, click `Open Anyway`.
5. Open app again.
6. If still marked damaged, run:
```bash
xattr -cr "/Applications/<App Name>.app"
```

### Windows
1. Unzip package.
2. Double-click `<App Name>.exe`.
3. If SmartScreen appears, click `More info -> Run anyway`.

## GitHub Release Checklist
1. Use `beta` naming convention if channel is beta.
2. Mark release as `pre-release`.
3. Keep release notes in two full language blocks if bilingual is required:
   - `English Version` first.
   - `中文版` second.
4. Include:
   - User-facing changes
   - Upgrade impact (unsigned behavior)
   - Beginner open/install steps
   - Validation summary (CI run id + local verification)

## Common Pitfalls
- Removing quarantine in CI smoke test can hide real download-path behavior.
- Telling users only "right click -> open" is often insufficient for beginners.
- Omitting "click Done first, then Open Anyway in Privacy & Security" causes high support churn.
