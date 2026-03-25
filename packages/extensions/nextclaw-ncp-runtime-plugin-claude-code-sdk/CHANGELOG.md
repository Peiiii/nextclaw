# @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk

## 0.1.18

### Patch Changes

- Disable the default 30s Claude request timeout for real chat turns so long-running Claude sessions are only stopped by explicit aborts or an explicitly configured `requestTimeoutMs`.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.6

## 0.1.17

### Patch Changes

- Updated dependencies [bb891c2]
  - @nextclaw/core@0.11.0

## 0.1.16

### Patch Changes

- Republish the Claude NCP runtime plugin so npm-installed environments get the open model routing fix, the removed supported-model whitelist, and the stable Claude model selection behavior.

## 0.1.15

### Patch Changes

- Fix Claude NCP runtime model routing by bridging Anthropic Messages to OpenAI-compatible providers, remove the Claude model whitelist concept, and keep the Claude model selector stable when the previously selected model is missing.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.5

## 0.1.14

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-toolkit@0.4.2
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.4

## 0.1.13

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.11

## 0.1.12

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.10

## 0.1.11

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.9

## 0.1.10

### Patch Changes

- Fix Claude marketplace installs so the bundled Claude Agent SDK CLI path still resolves when the package does not export `./package.json`.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.3

## 0.1.9

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.8

## 0.1.8

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.7

## 0.1.7

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.6

## 0.1.6

### Patch Changes

- Fix Claude readiness probing so working Anthropic-compatible routes are not marked unavailable by a probe-only USD budget cap, and improve local first-party plugin loading when running NextClaw from source.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.2

## 0.1.5

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.5

## 0.1.4

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.4

## 0.1.3

### Patch Changes

- Updated dependencies [7e3aa0d]
  - @nextclaw/core@0.9.3

## 0.1.2

### Patch Changes

- Sync the published plugin manifest version with the package version so `nextclaw plugins info` reports the installed Claude runtime plugin version correctly.

## 0.1.1

### Patch Changes

- Bundle the Claude runtime entry so published artifacts include all required local modules and the marketplace plugin can be installed successfully from npm.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.1

## 0.1.0

### Minor Changes

- Add the first Claude-backed NCP runtime and official plugin package so NextClaw can expose Claude sessions through the pluggable runtime registry and marketplace flow.

### Patch Changes

- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.0
