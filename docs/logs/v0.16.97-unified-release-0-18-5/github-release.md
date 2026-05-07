## English Version

Stable desktop release aligned to NextClaw `0.18.5`.

Launcher version: `0.0.148`  
Bundle version: `0.18.5`

### Highlights

- Unified npm release batch is now published on the public registry, including `nextclaw@0.18.5` and `@nextclaw/ui@0.12.13`.
- System status recovery after websocket reconnect is corrected, so the desktop UI can recover more predictably after transient connection loss instead of remaining in a stale status view.
- Landing fallback metadata is updated to the new stable desktop line, so GitHub API fallback paths and structured download metadata no longer point to the revoked `v0.18.4-desktop.*` releases.
- Desktop packaging continues to ship the governed update verification contract: installers, update bundles, manifests, and packaged public key material remain aligned with the packaged runtime entrypoint `dist/cli/app/index.js`.

### Validation Summary

- Passed: `pnpm release:check`
- Passed: `pnpm desktop:package:verify`
  - verified packaged manifest signature against the stable update channel
  - verified seed bundle version `0.18.5`
  - verified packaged seed runtime init from `dist/cli/app/index.js`
  - verified macOS arm64 DMG smoke
- Passed: `pnpm -C apps/landing build`

### Notes

- This stable release keeps the governed stable launcher compatibility floor at `0.0.141`.
- The desktop release workflow should publish installers, update bundles, manifests, public key material, and the stable update channel from this tag.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.18.0-desktop.1...v0.18.5-desktop.1

## 中文版

这是与 NextClaw `0.18.5` 对齐的桌面正式稳定版。

Launcher 版本：`0.0.148`  
Bundle 版本：`0.18.5`

### 亮点

- 统一 NPM 发版批次已经发布到官方 registry，包括 `nextclaw@0.18.5` 与 `@nextclaw/ui@0.12.13`。
- 已修复 websocket 重连后的 system status 恢复问题，桌面 UI 在短暂连接中断后能更可预测地恢复状态，而不是停留在过期视图。
- Landing fallback 元数据已切到新的桌面稳定版，不会再继续指向已经撤销的 `v0.18.4-desktop.*` release。
- Desktop 打包链路继续保持受治理的更新验签合同：安装包、update bundle、manifest 与包内公钥材料仍然统一对齐到真实运行时入口 `dist/cli/app/index.js`。

### 验证摘要

- 已通过：`pnpm release:check`
- 已通过：`pnpm desktop:package:verify`
  - 已验证稳定通道 manifest 验签
  - 已验证 seed bundle 版本 `0.18.5`
  - 已验证包内 seed runtime 可从 `dist/cli/app/index.js` 完成 `init`
  - 已验证 macOS arm64 DMG 冒烟
- 已通过：`pnpm -C apps/landing build`

### 说明

- 本次稳定版继续保持 stable launcher compatibility floor 为 `0.0.141`，没有额外抬高桌面稳定通道门槛。
- 这次桌面正式 release 预期会从当前 tag 产出安装包、update bundle、manifest、公钥材料和 stable update channel。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.18.0-desktop.1...v0.18.5-desktop.1
