## English Version

Stable desktop release aligned to NextClaw `0.17.11`.

Launcher version: `0.0.140`  
Bundle version: `0.17.11`

### Highlights

- Unified service management across desktop and web, including clearer restart controls and runtime feedback.
- Desktop presence lifecycle v1: closing the window now keeps NextClaw alive in the background, with tray restore, launch-at-login, and explicit Quit semantics.
- Desktop update packaging is hardened for stable delivery: packaged seed recovery, bundled public-key verification, manifest signature checks, and stricter update-contract validation.
- Chat improvements include persisted read state, first-send session routing fixes, and more reliable draft/session sync.
- Provider/runtime polish includes safer default model switching and Hermes learning loop P0 integration.

### Validation Summary

- GitHub Actions `desktop-release` rerun `24401769943` passed.
- Passed: macOS arm64 DMG smoke, macOS x64 DMG smoke, Windows x64 desktop smoke, Linux AppImage smoke, Linux deb smoke.
- Passed: release asset upload, stable update-channel publish, Linux APT fresh install, Linux APT upgrade, and gh-pages APT publish.
- The Linux APT repo now includes `nextclaw-desktop_0.0.140_amd64.deb`.

### Notes

- This stable release closes the final desktop release gap after the initial APT publish missed the nested Linux deb artifact.
- GitHub release assets, stable update channels, landing fallback, and Linux APT distribution are now aligned on the same stable desktop version.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.17.10-desktop-beta.2...v0.17.11-desktop.1

## 中文版

这是与 NextClaw `0.17.11` 对齐的桌面正式稳定版。

Launcher 版本：`0.0.140`  
Bundle 版本：`0.17.11`

### 亮点

- Desktop / Web 的服务管理能力已经统一，运行时重启控制与状态反馈更清晰。
- Desktop presence lifecycle v1 已到位：关窗后台驻留、托盘恢复、登录自启、显式退出语义全部纳入正式版。
- 桌面更新打包链路进一步加固：seed recovery、包内公钥、manifest 验签、更新合同校验都已纳入正式发布链路。
- 对话体验继续收口：已读状态持久化、首次发送路由修复、草稿与会话同步更可靠。
- Provider / runtime 侧继续打磨：默认模型切换更稳，Hermes learning loop P0 也已进入本次稳定版。

### 验证摘要

- GitHub Actions `desktop-release` 补跑 `24401769943` 已全部通过。
- 已通过：macOS arm64 DMG 冒烟、macOS x64 DMG 冒烟、Windows x64 桌面启动冒烟、Linux AppImage 冒烟、Linux deb 冒烟。
- 已通过：release 资产上传、stable update channel 发布、Linux APT 首次安装、Linux APT 升级、gh-pages APT 仓库发布。
- Linux APT 仓库现已确认包含 `nextclaw-desktop_0.0.140_amd64.deb`。

### 说明

- 这次正式版补上了首次 APT 发布漏掉嵌套 Linux deb artifact 的最后缺口。
- GitHub release assets、stable update channels、landing fallback、Linux APT 分发四条发布面现在已经重新完全对齐到同一个稳定桌面版本。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.17.10-desktop-beta.2...v0.17.11-desktop.1
