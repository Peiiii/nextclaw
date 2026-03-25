# @nextclaw/nextclaw-ncp-runtime-claude-code-sdk

## 0.1.6

### Patch Changes

- Disable the default 30s Claude request timeout for real chat turns so long-running Claude sessions are only stopped by explicit aborts or an explicitly configured `requestTimeoutMs`.

## 0.1.5

### Patch Changes

- Fix Claude NCP runtime model routing by bridging Anthropic Messages to OpenAI-compatible providers, remove the Claude model whitelist concept, and keep the Claude model selector stable when the previously selected model is missing.

## 0.1.4

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/ncp@0.3.2

## 0.1.3

### Patch Changes

- Fix Claude marketplace installs so the bundled Claude Agent SDK CLI path still resolves when the package does not export `./package.json`.

## 0.1.2

### Patch Changes

- Fix Claude readiness probing so working Anthropic-compatible routes are not marked unavailable by a probe-only USD budget cap, and improve local first-party plugin loading when running NextClaw from source.

## 0.1.1

### Patch Changes

- Bundle the Claude runtime entry so published artifacts include all required local modules and the marketplace plugin can be installed successfully from npm.

## 0.1.0

### Minor Changes

- Add the first Claude-backed NCP runtime and official plugin package so NextClaw can expose Claude sessions through the pluggable runtime registry and marketplace flow.
