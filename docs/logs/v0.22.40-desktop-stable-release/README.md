# v0.22.40 desktop stable release

## 迭代完成说明

本轮在 `nextclaw@0.22.4` NPM 正式版发布后，完成桌面端 stable 发布闭环。桌面壳版本为 `0.0.220`，runtime bundle 版本为 `0.22.4`，最低 launcher 版本为 `0.0.141`。

最终成功的桌面端正式版 tag 为 `v0.22.4-desktop.1`，GitHub Actions run 为 `29273593157`，GitHub Release 地址为 `https://github.com/Peiiii/nextclaw/releases/tag/v0.22.4-desktop.1`。本轮同时刷新桌面内置 seed bundle，使安装包自带 runtime 与 npm registry 上的 `nextclaw@0.22.4` 对齐。

## 测试/验证/验收方式

- 本地执行 `pnpm desktop:package:verify`，覆盖 macOS arm64 DMG 构建、seed runtime `0.22.4` 校验、native runtime dependencies 校验、runtime init、GUI smoke、health check 和 stable update check。
- macOS 本地 GUI smoke 成功启动 runtime，health check 通过，窗口完成 `ready-to-show` 与 `did-finish-load`，update snapshot 返回 `up-to-date`。
- `GITHUB_TOKEN=$(gh auth token) pnpm run assets:refresh-star-history` 和 `node --check scripts/docs/visual-assets/refresh-star-history-chart.mjs` 通过，README 星标图静态资产可重复生成。
- GitHub Actions run `29273593157` 的 `desktop-darwin-arm64`、`desktop-darwin-x64`、`desktop-win32-x64`、`desktop-win32-arm64`、`desktop-linux-x64`、`publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 全部成功。
- 公开 Pages stable manifest 验证 `latestVersion=0.22.4`、`minimumLauncherVersion=0.0.141`，`releaseNotesUrl` 指向用户可读 docs 更新笔记 `https://docs.nextclaw.io/en/notes/2026-07-14-nextclaw-v0-22-4`。
- 公开 APT stable 仓库验证 `nextclaw-desktop` 版本为 `0.0.220`。
- 官网执行 `pnpm --filter @nextclaw/landing tsc`、`pnpm --filter @nextclaw/landing build` 与 `pnpm deploy:landing`，部署后验证生产 bundle 包含 `v0.22.4-desktop.1` 和 `0.0.220`，不再包含旧 fallback `v0.22.3-desktop.8`。
- 发布后复查发现 `nextclaw-v0.22.4` 的 docs 结构化 release notes 缺失，且 desktop update manifest 的 `releaseNotesUrl` 由 workflow 固定写成 GitHub Release。已补齐中英文产品更新笔记与 JSON，并将 workflow 改为优先使用 docs release notes URL；当前正式 tag 使用显式 docs URL 重跑 update channel 发布。
- 同版本重跑 `v0.22.4-desktop.1` 时，APT upgrade smoke 因旧仓库与新仓库 candidate 都是 `0.0.220` 而失败；已将 APT smoke 调整为支持同版本 republish，仅在 candidate 缺失或安装版本不匹配时失败。
- 机制根因复盘：`desktop-release-contract-guard` 和 `nextclaw-release-notes-automation` 已有 release notes / `releaseNotesUrl` 合同，但该合同只停留在人工 checklist；`release:desktop:stable` 未在发布前检查目标 commit 是否包含 `apps/docs/public/release-notes/nextclaw-v<runtimeVersion>.json`，`desktop-release` workflow 也会在 stable 缺失 docs JSON 时静默 fallback 到 GitHub Release URL，closure gate 只校验版本与最低 launcher，未校验 `releaseNotesUrl`。本轮已把 stable 缺 docs JSON 改为脚本和 workflow 的失败条件，并让 closure gate 校验 manifest 中的 `releaseNotesUrl` 等于预期用户更新笔记 URL。
- Line-growth exemption：本次机制修复属于非功能改动，发布脚本净增来自新增 `desktop-release-notes.mjs` owner、stable metadata fail-closed 检查、workflow stable 缺 metadata hard-fail 以及 closure URL 校验。已先将新增逻辑从 `release-desktop.mjs` 拆出，避免主编排文件越过 500 行预算；剩余非测试净增 `+79` 行是可执行发布门禁所需。更近范围已检查：无法删除 `--release-notes-url` recovery 参数、目标 commit JSON 读取、manifest URL 断言或 workflow stable hard-fail；继续压缩会把合同重新藏回内联脚本或削弱错误信息，因此本轮记录必要增长豁免。

## 发布/部署方式

- NPM 正式版：`nextclaw@0.22.4` 已发布到 npm registry。
- 桌面端正式版：执行 `pnpm release:desktop:stable -- --branch master --tag v0.22.4-desktop.1 --notes-file docs/logs/v0.22.40-desktop-stable-release/github-release.md --skip-local-verify`。
- 官网：执行 `pnpm deploy:landing`，Cloudflare Pages 部署地址为 `https://8c990c23.nextclaw-landing.pages.dev`，生产域名为 `https://nextclaw.io`。

## 用户/产品视角的验收步骤

- 用户访问 `https://nextclaw.io/en/download/` 或 `https://nextclaw.io/zh/download/` 时，默认下载 fallback 指向 `v0.22.4-desktop.1`。
- 桌面端 stable update manifest 指向 runtime bundle `0.22.4`，`releaseNotesUrl` 指向 docs 更新笔记，旧 runtime `0.22.3` 通过真实 updater 验签路径会得到 `bundle-update -> 0.22.4`。
- Linux 用户通过 APT stable 仓库安装时获得 `nextclaw-desktop` 版本 `0.0.220`。
- macOS、Windows、Linux release assets 均在 GitHub Release 中可见；Linux AppImage smoke 与 APT fresh install / upgrade smoke 在 CI 通过。

## 可维护性总结汇总

- 本轮桌面 seed bundle 刷新是发布源状态对齐，不新增平行打包链路。
- 星标图刷新进入既有视觉资产 owner 和每周 workflow，不让 README 依赖第三方实时接口，也不把 token 写入资产或日志。
- 桌面 release 仍使用现有 `release:desktop:stable` 编排，本地 package verify 通过后远端 Actions 负责跨平台构建、资产发布、update manifest 和 APT stable 仓库。
- 发布机制已收敛：stable release notes 不再只靠人工记忆，发布脚本读取目标 commit 的结构化 docs JSON，workflow 缺 metadata 时失败，closure gate 校验公开 manifest URL，避免“版本已发布但更新提示元数据降级”的同类问题重复发生。
- 可维护性 guard 结果：`--non-feature` 模式下报告非测试净增 `+79` 行；已用 `--no-fail` 生成豁免材料并在本节记录。`release-desktop.mjs` 当前 495 行，接近 500 行预算但未越界；新增 release notes 解析逻辑已拆入 `scripts/release/desktop-release-notes.mjs`，下一步若继续扩展 desktop release 编排，应优先继续拆分 release plan / release metadata owner。

## NPM 包发布记录

- 已发布：`nextclaw@0.22.4`。
- 桌面端使用已经发布的 `nextclaw@0.22.4` 作为 runtime bundle。
- 同批次 public workspace 包已完成 registry 验证；真实安装冒烟确认 CLI version 与 update check 正常。
