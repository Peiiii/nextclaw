---
name: publish-to-nextclaw-marketplace
description: Use when the user wants to publish or update a local skill in the NextClaw marketplace, especially when they need clear guidance for version readiness, platform login, username setup, scoped package naming, and post-publish verification.
---

# Publish To NextClaw Marketplace

## Overview

Use this skill when the user wants to publish a local skill to the NextClaw marketplace or update an existing listing.

This skill owns the full publishing loop:

- check that the local `nextclaw` version is new enough,
- verify platform identity and username readiness,
- choose the correct package scope,
- run `publish` or `update`,
- then verify the listing and install path.

Do not pretend the account is ready when it is not.
If the user is logged in but still has no platform username, stop and ask them to set it first.

## Hard Requirement

This workflow requires **NextClaw `v0.17.6` or later**.

Why:

- `v0.17.6+` is the baseline that supports scoped marketplace package names such as `@nextclaw/my-skill` and `@alice/my-skill`.
- It also supports the clearer `--scope` and `--package-name` publish parameters.
- Personal publishing now depends on the platform `username` model added in the same release line.

Always verify first:

```bash
nextclaw --version
```

If the version is lower than `0.17.6`, do not continue with a fallback flow.
Tell the user to upgrade NextClaw first.

## Marketplace Identity Model

Treat these fields differently:

- `slug`: the local skill directory name and the skill name segment
- `package name`: the canonical marketplace identifier, shaped like `@scope/skill-name`

Publishing scopes:

- official scope: `@nextclaw/<skill-name>`
- personal scope: `@<username>/<skill-name>`

Rules:

- `@nextclaw/*` publishing requires admin permission or `NEXTCLAW_MARKETPLACE_ADMIN_TOKEN`
- personal publishing requires an active platform login
- personal publishing also requires a platform username
- the personal scope must exactly match the current username

Do not blur official and personal publishing together.

## Readiness Checklist

Before publishing, check these in order.

### 1. CLI version

```bash
nextclaw --version
```

Must be `0.17.6` or later.

### 2. Platform login

For normal user publishing, log in first:

```bash
nextclaw login --api-base https://ai-gateway-api.nextclaw.io/v1
```

For official `@nextclaw/*` publishing, an admin token may also be used through:

```bash
NEXTCLAW_MARKETPLACE_ADMIN_TOKEN=...
```

### 3. Platform username

If the user wants personal publishing, make sure the platform account already has a username.

Important:

- login alone is not enough
- the username must already exist on the NextClaw platform account
- the canonical web page is `https://platform.nextclaw.io/account`
- the CLI fallback is `nextclaw account set-username <username>`
- if it is missing, direct the user to one of those two concrete paths before publishing

### 4. Local skill files

The local skill directory should contain at least:

- `SKILL.md`
- `marketplace.json`

The marketplace metadata should be complete and explicit.
At minimum, verify:

- `slug`
- `name`
- `summary`
- `summaryI18n.en`
- `summaryI18n.zh`
- `description`
- `descriptionI18n.en`
- `descriptionI18n.zh`
- `author`
- `tags`

Do not publish with half-complete bilingual metadata.

## Publish Flow

Use the official marketplace API domain:

```text
https://marketplace-api.nextclaw.io
```

Do not use a `workers.dev` endpoint as the default public publishing target.

### Publish a new personal skill

```bash
nextclaw skills publish ./my-skill \
  --meta ./my-skill/marketplace.json \
  --scope alice \
  --api-base https://marketplace-api.nextclaw.io
```

Equivalent explicit package name form:

```bash
nextclaw skills publish ./my-skill \
  --meta ./my-skill/marketplace.json \
  --package-name @alice/my-skill \
  --api-base https://marketplace-api.nextclaw.io
```

### Publish an official NextClaw skill

```bash
nextclaw skills publish ./my-skill \
  --meta ./my-skill/marketplace.json \
  --scope nextclaw \
  --api-base https://marketplace-api.nextclaw.io
```

Only do this when admin permission is actually present.

### Update an existing skill

```bash
nextclaw skills update ./my-skill \
  --meta ./my-skill/marketplace.json \
  --package-name @alice/my-skill \
  --api-base https://marketplace-api.nextclaw.io
```

Default decision rule:

- if the marketplace item does not exist yet, use `publish`
- if it already exists, use `update`

## Post-Publish Verification

After publishing, verify the remote item directly.

Example:

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/%40alice%2Fmy-skill
```

Check for:

- HTTP `200`
- correct canonical `packageName`
- expected `slug`
- complete bilingual summary and description
- install kind is marketplace

Then do an install smoke in a temporary directory outside the repo or target workspace:

```bash
tmp_dir="$(mktemp -d)"
nextclaw skills install @alice/my-skill --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"
find "$tmp_dir" -maxdepth 3 -type f | sort
rm -rf "$tmp_dir"
```

The point is to verify real installability without polluting the current repo.

## Failure Modes

### Version too old

- Symptom: scoped publish flags or username-aware flow are missing
- Action: upgrade to NextClaw `v0.17.6` or later

### Not logged in

- Symptom: publish rejects because there is no active platform identity
- Action: run `nextclaw login --api-base https://ai-gateway-api.nextclaw.io/v1`

### Username missing

- Symptom: personal publish fails because the platform account has no username
- Action: open `https://platform.nextclaw.io/account` or run `nextclaw account set-username <username>`, then retry

### Scope mismatch

- Symptom: publish rejects `@scope/name` because the scope does not match the current username
- Action: publish under `@<your-username>/<skill-name>` instead

### Insufficient permission for `@nextclaw/*`

- Symptom: official scope publishing is rejected
- Action: use an admin account or `NEXTCLAW_MARKETPLACE_ADMIN_TOKEN`, otherwise switch to personal scope

## Success Criteria

This skill is working correctly when:

- it refuses to continue on `nextclaw < 0.17.6`
- it distinguishes official and personal scope correctly
- it does not treat login as a substitute for username readiness
- it publishes or updates through `marketplace-api.nextclaw.io`
- it verifies the remote item and install path after upload
