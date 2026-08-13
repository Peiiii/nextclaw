# Desktop 发布自动化

## Beta

使用 `pnpm release:desktop:beta`。同一上下文已有等价本地 gate 才允许 `--skip-local-verify`；默认隔离 worktree。发布后用 closure script 验证 workflow、assets、gh-pages 和 public beta manifest，传播延迟不创建新 tag。

## Stable

使用 `pnpm release:desktop:stable`。必须先证明目标 runtime identity 已经作为 stable NPM/runtime 发布且 release target 没有静默混入后续 package 源码，再闭合 clean/non-behind、签名 secret preflight、本地 package verify、GitHub release、workflow、assets、stable manifest 和 APT。正式发布优先 `--notes-file`；没有结构化 release notes JSON 或显式恢复 URL 时 fail closed。该入口不调用任何 NPM publish 命令。

## 完成门

- workflow overall success，矩阵与 publish jobs 全部成功；
- installer、portable、bundle、manifest、public key 等 assets 完整；
- `gh-pages` 与公开 manifest 版本、floor、releaseNotesUrl 一致；
- stable 的官网链接只在 release 与公开 channel 验证后更新；
- shipped bits 改变时 launcher/runtime identity 与 asset/manifest 同步变化；
- 隔离发布结果回流本地 master，活跃 WIP 保留。
- standalone desktop 完成后报告 `DESKTOP_READY`；全平台编排在此后由 Delivery 汇总 `ALL_PLATFORMS_READY`。

网络/TLS、Pages 传播、Docker pull 或 upload stalled 先按恢复 reference 分类，不盲目改代码或创建新版本。
