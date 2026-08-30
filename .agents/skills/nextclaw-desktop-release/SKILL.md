---
name: nextclaw-desktop-release
description: NextClaw Desktop 构建、发布、恢复与运行冒烟流程 owner。
---

# NextClaw Desktop Release

## 入口

按当前场景只读取一项：

- 打包、public key、launcher floor、产物形状：[打包合同](references/packaging-contract.md)。
- 发布、GitHub assets、update channel、Pages/APT：[发布自动化](references/release-automation.md)。
- Electron runtime、GUI/API、Windows installer、真实 profile 冒烟：[运行冒烟](references/runtime-smoke.md)。
- 已有 tag/run、部分发布、网络/Pages/CI 失败：[发布恢复](references/release-recovery.md)。
- 无签名 macOS/Windows 交付：[Unsigned handoff](references/unsigned-handoff.md)。

不要一次读取全部 reference；失败分类改变后再切换分支。

## 永久合同

- 发布 channel 必须显式确认；不得因“发布”、失败恢复、Draft 或版本后缀自行选择 beta。仅用户明确要求 beta/preview，或任务已在 beta 链路，才可运行 `release:desktop:beta`。
- `v<runtime>-desktop.<n>` 是 stable 构建序号，非 beta/prerelease；`-desktop-beta.<n>` 才是 beta。stable Release 必须 `isPrerelease=false`；Draft/recovery 沿用既有 channel 与 release identity。
- 原始 electron-builder 输出不是可发布产物；安装包必须包含更新验签 public key，并能验证目标 manifest。
- 以 Electron 内置 Node 为发布运行时事实，不能用开发机 ambient Node 代替。
- `minimumLauncherVersion` 来自 `apps/desktop/desktop-launcher-compatibility.json`，只有真实 launcher 合同破坏才提高。
- tag/release 只是触发；workflow、assets、channel、release notes URL、适用 Pages/APT 全闭合才完成。
- 隔离 worktree 发布仍须安全回流本地目标分支，不覆盖活跃 WIP。
- Desktop 不授权 NPM publish；stable 只消费已验证的 `nextclaw` stable identity。存在未发布 runtime 语义时停止，转入常规 stable/全平台发布。
- `/发布NextClaw桌面版` 成功报告 `DESKTOP_READY`；全平台只在 `NEXTCLAW_STABLE_READY` 后进入本 owner，desktop 失败不得重发 NPM/runtime。
- `/发布NextClaw全平台版` 由 GitHub `release.yml target=all` 调用；AI/Delivery 仅触发、监控父 workflow。Standalone Desktop 仅用于窄发布/恢复。
- `DESKTOP_READY`、`ALL_PLATFORMS_READY` 只关闭子目标；active contract 下向 lifecycle 返回 stable ID 的 `acceptance_updates`、`parent_status`，版本/tag/artifact 不能完成 parent-goal。

## 默认入口

- 本地包合同：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
- 人工可点击交付：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:handoff:verify`
- Beta：`pnpm release:desktop:beta`
- Stable：`pnpm release:desktop:stable`

最终报告精确 artifact、launcher/runtime 版本、workflow/release URL、public manifest 状态和未闭合项。
