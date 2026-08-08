---
name: desktop-release-contract-guard
description: 当构建、验证或发布 NextClaw desktop installer、DMG、update bundle/manifest，或执行 desktop beta/stable 发布时使用；先选择打包、发布、运行冒烟、恢复或 unsigned handoff 一个分支。
---

# Desktop Release Contract Guard

## 入口

只读取当前分支：

- 本地打包、public key、launcher floor、产物形状：读取 [打包合同](references/packaging-contract.md)。
- `release:desktop:beta/stable`、GitHub assets、update channel、Pages/APT：读取 [发布自动化](references/release-automation.md)。
- Electron runtime、GUI/API、Windows installer、真实 profile 冒烟：读取 [运行冒烟](references/runtime-smoke.md)。
- 已有 tag/run、部分发布、网络/Pages/CI 失败恢复：读取 [发布恢复](references/release-recovery.md)。
- 无签名 macOS/Windows 本地交付和用户打开指导：读取 [Unsigned handoff](references/unsigned-handoff.md)。

不要一次读取全部 reference；失败分类改变后再切换分支。

## 永久合同

- 原始 electron-builder 输出不是可发布产物；安装包必须包含更新验签 public key，并能验证目标 manifest。
- 以 Electron 内置 Node 为发布运行时事实，不能用开发机 ambient Node 代替。
- `minimumLauncherVersion` 来自 `apps/desktop/desktop-launcher-compatibility.json`，只有真实 launcher 合同破坏才提高。
- tag/release 创建只是触发，不是完成；workflow、assets、update channel、release notes URL 和适用的 Pages/APT 全部闭合后才完成。
- 发布从隔离 worktree 执行时，发布 commit、tag、版本和记录仍须安全回流本地目标分支，不覆盖活跃 WIP。

## 默认入口

- 本地包合同：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
- 人工可点击交付：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:handoff:verify`
- Beta：`pnpm release:desktop:beta`
- Stable：`pnpm release:desktop:stable`

最终报告精确 artifact、launcher/runtime 版本、workflow/release URL、public manifest 状态和未闭合项。
