---
name: aigen-image-generation
description: Use the local aigen CLI to generate images through configured providers such as OpenRouter or OpenAI. Use when the user asks to create, generate, or render images and wants files produced locally through an external CLI.
---

# aigen Image Generation

Use this skill when the user wants AI-generated images and local file output through the `aigen` CLI.

This is a wrapped external tool skill:

- The skill owns setup guidance, readiness checks, safe secret handling, and the generation workflow.
- `aigen` owns provider configuration, API calls, response normalization, and writing image files.
- Do not present this as a built-in NextClaw image engine.

## What This Skill Covers

- Generate images from text prompts.
- Use provider/model routes such as `openrouter/x-ai/grok-imagine-image-quality`.
- Configure provider records, model records, and provider API keys through `aigen`.
- Save generated image files to a caller-created output directory.

## What This Skill Does Not Cover

- Video, audio, or image editing workflows.
- Long-running daemon management.
- Secret storage outside `aigen secrets`.
- Provider-specific SDK patching or hidden fallback behavior.

## Readiness Check

First check whether `aigen` is available:

```bash
command -v aigen
aigen --version
```

If `aigen` is not installed, use the published package:

```bash
npm install -g @nextclaw/aigen
```

If global install is not appropriate, use `npx` for the current task:

```bash
npx -y @nextclaw/aigen@latest --version
```

Prefer a stable `aigen` binary for multi-step workflows because provider and secret commands need consistent local state.

## Configuration Model

`aigen` stores its own config under `${AIGEN_HOME:-~/.aigen}`:

- `config.json` contains providers and models.
- `secrets.json` contains masked provider API key records.

Do not edit these files manually unless the user explicitly asks. Prefer the dedicated commands.

## First-Use Setup

For OpenRouter:

```bash
aigen providers add openrouter --api-format openrouter --json
```

Set the API key through stdin. Never put the key directly in shell history:

```bash
printf '%s' "$OPENROUTER_API_KEY" | aigen secrets set openrouter --stdin --json
```

Add a model under the provider:

```bash
aigen models add openrouter/x-ai/grok-imagine-image-quality --kind image --generate --max-count 1 --json
```

If the user has not provided an API key and no safe environment variable is available, stop and ask the user for the key or for permission to use another configured provider. Do not invent, log, or echo API keys.

## Generation Workflow

Create an output directory outside the repo unless the user explicitly asks for a project path:

```bash
output_dir="$(mktemp -d)"
```

Choose a collision-resistant output name:

```bash
output_name="image-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 3)"
```

Generate:

```bash
aigen image \
  --model openrouter/x-ai/grok-imagine-image-quality \
  --prompt "<prompt>" \
  --output-dir "$output_dir" \
  --output-name "$output_name" \
  --json
```

Parse the JSON result. A successful result contains:

- `ok: true`
- `assets[]`
- `assets[].path`
- `assets[].mimeType`
- `assets[].sizeBytes`

Return the generated file path to the user. In environments that can render local images, show the image using its absolute path.

## Safety Rules

- Never print raw API keys.
- Never write secrets into repo files, shell scripts, screenshots, logs, or markdown output.
- Prefer `AIGEN_HOME` pointing to a temporary directory for tests and smoke checks.
- Prefer non-repo output directories for generated images unless the user explicitly wants files in the project.
- Do not overwrite generated files. Use unique output names.
- If provider/model/secret setup fails, report the exact missing piece and stop before generation.

## Diagnostics

Check provider and model setup:

```bash
aigen providers list --json
aigen models list --json
aigen secrets list --json
aigen doctor --model openrouter/x-ai/grok-imagine-image-quality --json
```

Remote model discovery, when supported by the provider:

```bash
aigen models list --remote --provider openrouter --kind image --json
```

## Troubleshooting

### `aigen` not found

Install `@nextclaw/aigen` globally or use `npx -y @nextclaw/aigen@latest`.

### Config not found

Run provider/model setup commands first, or set `AIGEN_HOME` to the expected config directory.

### Missing API key

Use `aigen secrets set <provider-id> --stdin --json`. Do not pass the key as a command-line argument.

### Provider request failed

Check:

- provider `apiFormat`
- provider `apiBase`
- model route
- API key validity
- whether the model supports image output

Use `aigen models list --remote --provider <provider-id> --kind image --json` when supported.

## Success Criteria

The skill succeeds when:

- `aigen --version` runs,
- provider/model/secret readiness is confirmed,
- `aigen image` returns `ok: true`,
- at least one asset exists on disk,
- and the user receives the generated image path or rendered image.
