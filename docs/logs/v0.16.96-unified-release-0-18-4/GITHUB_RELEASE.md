## English Version

Stable desktop release aligned to NextClaw `0.18.4`.

Launcher version: `0.0.147`  
Bundle version: `0.18.4`

### Highlights

- Unified npm release batch is now published on the public registry, including `nextclaw@0.18.4`, `@nextclaw/ui@0.12.12`, `@nextclaw/server@0.12.11`, `@nextclaw/core@0.12.11`, `@nextclaw/ncp@0.5.5`, `@nextclaw/ncp-agent-runtime@0.3.15`, and the related runtime, channel, toolkit, bridge, remote, and compatibility packages in the same batch.
- Native NCP tool results now stay inside an explicit budgeted content-item pipeline, so large screenshot or JSON tool results no longer explode the model context window, and image results can flow into multimodal model input as actual `input_image` observations.
- Desktop packaging is aligned with the current `nextclaw` CLI entrypoint contract. Seed bundle generation, runtime bootstrap, packaged seed verification, and DMG smoke now all run against `dist/cli/app/index.js`, which matches the shipped runtime layout.
- Landing fallback metadata is updated to the new stable desktop line, so GitHub API fallback paths and structured download metadata no longer point to the previous `v0.18.0-desktop.1 / 0.0.143` release.

### Validation Summary

- Passed: `pnpm release:check`
- Passed: `pnpm -C apps/landing build`
- Passed: `pnpm desktop:package:verify`
  - verified packaged manifest signature against the stable update channel
  - verified seed bundle version `0.18.4`
  - verified packaged seed runtime init from `dist/cli/app/index.js`
  - verified macOS arm64 DMG smoke

### Notes

- This stable release keeps the governed stable launcher compatibility floor at `0.0.141`.
- The desktop release workflow should publish installers, update bundles, manifests, public key material, and the stable update channel from this tag.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.18.0-desktop.1...v0.18.4-desktop.2

## 中文版

这是与 NextClaw `0.18.4` 对齐的桌面正式稳定版。

Launcher 版本：`0.0.147`  
Bundle 版本：`0.18.4`

### 亮点

- 统一 NPM 发版批次已经发布到官方 registry，包括 `nextclaw@0.18.4`、`@nextclaw/ui@0.12.12`、`@nextclaw/server@0.12.11`、`@nextclaw/core@0.12.11`、`@nextclaw/ncp@0.5.5`、`@nextclaw/ncp-agent-runtime@0.3.15`，以及同批次的 runtime、channel、toolkit、bridge、remote、compat 等公开包。
- Native NCP 工具结果现在会先经过显式的预算化 content item 治理链路，大截图和大 JSON 工具结果不再直接打爆模型上下文窗口；图片类工具结果也能作为真实 `input_image` 进入多模态模型输入。
- Desktop 打包链路已经和当前 `nextclaw` CLI 入口合同对齐。seed bundle 构建、runtime bootstrap、包内 seed 校验和 DMG smoke 现在都统一指向真实产物 `dist/cli/app/index.js`。
- Landing fallback 元数据已切到新的桌面稳定版，GitHub API fallback 和结构化下载 metadata 不会再继续指向旧的 `v0.18.0-desktop.1 / 0.0.143`。

### 验证摘要

- 已通过：`pnpm release:check`
- 已通过：`pnpm -C apps/landing build`
- 已通过：`pnpm desktop:package:verify`
  - 已验证稳定通道 manifest 验签
  - 已验证 seed bundle 版本 `0.18.4`
  - 已验证包内 seed runtime 可从 `dist/cli/app/index.js` 完成 `init`
  - 已验证 macOS arm64 DMG 冒烟

### 说明

- 本次稳定版继续保持 stable launcher compatibility floor 为 `0.0.141`，没有额外抬高桌面稳定通道门槛。
- 这次桌面正式 release 预期会从当前 tag 产出安装包、update bundle、manifest、公钥材料和 stable update channel。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.18.0-desktop.1...v0.18.4-desktop.2
