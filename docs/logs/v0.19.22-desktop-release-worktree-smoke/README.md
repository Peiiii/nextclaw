# v0.19.22 Desktop Release Worktree Smoke

## 迭代完成说明

本次完成桌面端 beta preview 发布自动化的并行工作区隔离与 Windows smoke 稳定性修复。

- 根因：beta preview 发布过程中，Windows x64 smoke 已经启动真实窗口并输出 `titlebar-hit-test`，但 ready 判定只识别带 URL 的 `did-finish-load` 日志；当前桌面主进程日志实际输出为 `[window:1] did-finish-load`，导致 smoke 在进入拖拽探针前误判 `windowReady=False`。
- 如何确认：查看 `v0.19.28-desktop-beta.4` 的 Windows x64 workflow step log，确认 API ready 为 true、窗口日志和 `titlebar-hit-test` 均已出现，但 smoke 抛出 `Desktop real app not ready within 20s ... windowReady=False`。
- 修复方式：Windows smoke 现在兼容无 URL 的窗口加载日志，并在拖拽兜底判断中同时读取 `main.log` 与 `app-stdout.log` 的 renderer hit-test 证据。
- 发布隔离：`pnpm release:desktop:beta` / `pnpm release:desktop:stable` 默认在临时 detached git worktree 里执行本地包验证，并新增显式 `--release-worktree` 选项；`--no-release-worktree` 保留为调试模式且要求 tracked worktree 干净。

## 测试/验证/验收方式

- `node --check scripts/release/release-desktop.mjs`
- `pnpm exec eslint scripts/release/release-desktop.mjs`
- `git diff --cached --check`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths apps/desktop/scripts/smoke-windows-desktop.ps1 scripts/release/release-desktop.mjs`
- `pnpm lint:new-code:governance -- --staged`
- `pnpm check:governance-backlog-ratchet`
- `node scripts/release/release-desktop.mjs --channel beta --release-worktree --dry-run`
- `pnpm release:desktop:beta -- --release-worktree`

本机没有 `pwsh`，PowerShell 语法解析未在本地执行；Windows smoke 已通过 GitHub Actions 的真实 Windows x64 / arm64 job 验证。

## 发布/部署方式

- GitHub release: `v0.19.28-desktop-beta.5`
- Release workflow: `desktop-release` run `26351512326`
- 结果：workflow 全绿，release assets 验证通过，`gh-pages` beta manifest 验证到 `0.19.28`，public GitHub Pages beta manifest 最终传播到 `0.19.28`。
- Linux APT：beta preview 不发布 stable APT repo，本次 workflow 中 `publish-linux-apt-repo` 为 skipped，符合预期。

## 用户/产品视角的验收步骤

1. 下载 `v0.19.28-desktop-beta.5` 的 Windows 安装包或 portable 包。
2. 启动桌面端，确认窗口可以缩小到预期范围。
3. 在 Windows 顶部标题栏主空白区域拖拽窗口，确认窗口随鼠标移动。
4. 点击右上角最小化、最大化/还原、关闭按钮，确认窗口控制按钮仍可点击，最大化/还原图标能随状态变化。

## 可维护性总结汇总

- 本次主要是发布脚本和 smoke 脚本修复，没有新增用户功能面。
- 临时 worktree 选项把发布目标从当前脏工作区中隔离出来，减少并行开发污染发布的风险。
- Windows smoke 的 ready 判定收敛到真实日志合同，避免用过时日志格式制造假失败。
- Maintainability guard 对 `scripts/release/release-desktop.mjs` 给出接近 500 行预算的 warning；本次只增加 4 行 CLI 显式选项，后续若继续扩展 release 脚本，应拆分参数解析/工作区策略/发布闭环职责。

## NPM 包发布记录

不涉及 NPM 包发布。
