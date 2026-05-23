# v0.19.20 Desktop Release Command Automation

## 迭代完成说明

- 新增桌面端发布命令入口：
  - `pnpm release:desktop:beta`
  - `pnpm release:desktop:stable`
- 新增脚本 owner：
  - `scripts/release/release-desktop.mjs`：负责发布前身份解析、clean worktree、branch 同步检查、local package verify、GitHub release 创建。
  - `scripts/release/desktop-release-closure.mjs`：负责发布后等待 `desktop-release` workflow、检查 release assets、`gh-pages` manifest、公网 manifest，以及 stable APT repo。
- 更新 `/release-desktop-beta` 与新增 `/release-desktop-stable` 命令索引，并把对应规则沉淀到 `desktop-release-contract-guard` skill。

## 测试/验证/验收方式

- `node --check scripts/release/release-desktop.mjs && node --check scripts/release/desktop-release-closure.mjs`：通过。
- `pnpm exec eslint scripts/release/release-desktop.mjs scripts/release/desktop-release-closure.mjs`：通过。
- `pnpm release:desktop:beta -- --help`：通过。
- `pnpm release:desktop:stable -- --help`：通过。
- `pnpm release:desktop:beta -- --dry-run`：通过，计算出 `v0.19.27-desktop-beta.1 / 0.0.190 / 0.19.27 / floor 0.0.143`。
- `pnpm release:desktop:stable -- --dry-run`：通过，计算出 `v0.19.27-desktop.1 / 0.0.190 / 0.19.27 / floor 0.0.141`。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过。

## 发布/部署方式

- 本次只落发布自动化命令，没有实际创建 desktop beta preview 或 stable release。

## 用户/产品视角的验收步骤

- 发布 beta preview：
  - 运行 `pnpm release:desktop:beta`。
  - 脚本应先跑本地 desktop package verify，再创建 prerelease，等待 workflow 成功，并确认 beta release assets、`gh-pages` beta manifest、公网 beta manifest。
- 发布正式版：
  - 运行 `pnpm release:desktop:stable -- --notes-file <release-notes.md>`。
  - 脚本应创建正式 release，等待 workflow 成功，并确认 stable release assets、`gh-pages` stable manifest、公网 stable manifest、stable APT repo。

## 可维护性总结汇总

- 使用单一 `release-desktop.mjs` 作为命令入口，beta/stable 通过 channel 参数分流，避免双实现。
- 将发布后闭环验收拆到 `desktop-release-closure.mjs`，避免单文件超过维护性预算。
- 保留旧的 `desktop-beta-preview-closure.mjs` 作为兼容的 post-release 专用验收脚本；新的命令入口用于完整端到端发布。
- `post-edit-maintainability-review` 已执行：本次是新增发布自动化能力，代码净增合理；脚本拆分后无维护性 findings。

## NPM 包发布记录

不涉及 NPM 包发布。
