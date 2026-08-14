# NextClaw Desktop Stable 0.37.0 发布记录

## 迭代完成说明

本批次从 `master` 提交 `b58c97cffb5fa5fba61e514688ee2bd1b1e81846` 发布 NextClaw Desktop stable。桌面壳版本为 `0.0.252`，内置 runtime 为已经公开验证的 `nextclaw@0.37.0`，最低 launcher 版本保持 `0.0.141`。正式 tag 为 `v0.37.0-desktop.1`，最终状态为 `DESKTOP_READY`。

发布前门禁发现 `0.37.0` 缺少 stable minor 必需的中英文产品更新说明和结构化 JSON，因此先由提交 `b58c97cff` 补齐双语页面、索引与 `apps/docs/public/release-notes/nextclaw-v0.37.0.json`。桌面发布完成后，官网动态获取 GitHub Release 的主链已经能识别新版本，但 GitHub API 不可用时的静态下载 fallback 仍停留在 `v0.29.0-desktop.1 / 0.0.240`；提交 `3cbfff112` 将该失败边界精确同步到本次 `v0.37.0-desktop.1 / 0.0.252`，没有新增第二套下载路径。

首次 GitHub Release 正文错误地直接使用英文 docs 源文件，同时 asset workflow 的 `generate_release_notes` 又追加了与产品发布无关的 commit/PR 列表。补救批次将线上正文改为中文在前、英文在后的 GitHub 专用 Markdown，并把这一要求收敛为 stable 发布入口的 fail-closed 校验；workflow 不再二次生成正文。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm release:desktop:stable -- --notes-file apps/docs/en/notes/2026-08-15-nextclaw-v0-37-0.md`
  - 隔离 worktree 本地 package verify 通过。
  - Desktop lint 与 TypeScript 检查通过。
  - macOS arm64 DMG 构建、manifest 验签、seed runtime `0.37.0`、CLI init、GUI 启动、HTTP health 和命令面冒烟通过。
  - 本地 DMG：`NextClaw Desktop-0.0.252-arm64.dmg`，大小约 141.9 MB。
- GitHub signing-secret preflight：workflow `31819012738`，结论 `success`。
- Desktop release workflow：`31819037246`，8/8 jobs `success`；macOS arm64/x64、Windows arm64/x64、Linux x64 构建与平台冒烟全部通过。
- 公开 stable manifest：`latestVersion=0.37.0`、`minimumLauncherVersion=0.0.141`，`releaseNotesUrl=https://docs.nextclaw.io/en/notes/2026-08-15-nextclaw-v0-37-0`。
- 公开 APT Packages：`nextclaw-desktop` 为 `0.0.252`，fresh install 与 upgrade 冒烟通过。
- Landing fallback：`pnpm -C apps/landing tsc`、目标文件 ESLint、`pnpm -C apps/landing build` 和 diff-only maintainability 检查通过；构建产物包含新 tag/version，旧 fallback 不再存在。
- Cloudflare Pages：部署 `https://b17df89b.nextclaw-landing.pages.dev` 与正式域名 `https://nextclaw.io/en/download/` 加载同一 `main-CsE7g_PN.js`，均包含 `v0.37.0-desktop.1 / 0.0.252`。
- GitHub Release 正文补救：8 个定向测试覆盖双语顺序、frontmatter、相对链接、自动生成噪音和 workflow 配置；ESLint、skill progressive-loading、new-code governance 与 governance backlog ratchet 均通过。
- 真实失败路径：把原英文 docs 文件传给 stable dry-run 会在远端动作前报错 `GitHub release notes must not include documentation YAML frontmatter.`。
- 线上正文复读确认包含 `## 中文` 与 `## English`、双语绝对文档链接，且不再包含 `What's Changed` 或 `Full Changelog`。

## 发布/部署方式

- GitHub Release：`https://github.com/Peiiii/nextclaw/releases/tag/v0.37.0-desktop.1`。
- Release 名称：`NextClaw Desktop 0.0.252`。
- 主要用户产物：macOS arm64/x64 DMG、Windows x64 installer、Windows x64/arm64 portable ZIP、Linux x64 AppImage 与 amd64 deb。
- 更新产物：五个平台的 runtime bundle、stable manifest、Electron update metadata 与 `update-bundle-public.pem`。
- 更新渠道：`gh-pages/desktop-updates/stable` 已发布并完成公网传播验证。
- Linux APT：`gh-pages/apt` 已发布 `0.0.252` 并完成公网 Packages 验证。
- 官网：从隔离 worktree 执行 `pnpm deploy:landing`，Cloudflare Pages production 分支完成部署，正式下载页已复验。
- 不包含：NPM publish、runtime channel 重发、桌面 Beta、X 或其它社交发布。

## 用户/产品视角的验收步骤

1. 打开 `https://nextclaw.io/zh/download/` 或 `https://nextclaw.io/en/download/`，确认版本显示为 `0.0.252`，Release 为 `v0.37.0-desktop.1`。
2. 在 macOS Apple Silicon、macOS Intel、Windows x64 或 Linux x64 对应入口下载产物，确认链接指向本次 GitHub Release。
3. 安装并启动桌面端，确认内置 runtime 为 `0.37.0`，主界面与 `/api/health` 可用。
4. 已安装 stable 用户检查更新时，应看到 runtime `0.37.0`，更新说明链接应指向本次 0.37.0 产品笔记。
5. Linux APT 用户更新后运行 `nextclaw --version`，应返回 `0.37.0`；安装包版本应为 `0.0.252`。

## 可维护性总结汇总

- 发布复用仓库唯一的 `release:desktop:stable` 自动化入口，没有手工拼接 tag、assets 或 manifest。
- Stable desktop 只消费已发布并验证的 `nextclaw@0.37.0`，没有把工作区未发布源码静默混入 installer，也没有执行 NPM publish。
- 官网继续以 GitHub Releases API 为动态事实源；静态 fallback 只承载 API 失败时的可观察降级，且与本次正式版精确一致。
- 下载 fallback 仅替换两个既有常量，净增 0；diff-only maintainability 检查 0 error、0 warning，没有新增 wrapper、状态 owner 或目录扩张。
- 发布在隔离 worktree 中执行并精确回流 `origin/master`，主工作区并行任务的未提交改动未被覆盖或混入。

## NPM 包发布记录

不涉及新的 NPM 包发布。桌面端消费已经发布并通过 registry、冷安装和运行身份验证的 `nextclaw@0.37.0`；本批次没有执行任何 NPM publish 命令，也没有修改 dist-tag。
