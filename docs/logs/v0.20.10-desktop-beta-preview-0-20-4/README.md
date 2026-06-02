# v0.20.10 Desktop Beta Preview 0.20.4

## 迭代完成说明

本次在隔离发布环境中发布 NextClaw Desktop beta preview：`v0.20.4-desktop-beta.1`。

发布目标锁定已提交 commit `1b09dffc2cd7e3a19db5b7f7597d9a99f3926ad0`，避免当前主工作区 provider、service-app、UI 和 `ui-dist` 等未完成 WIP 混入发布。

第一次远端 `desktop-release` workflow 中 `desktop-linux-x64` 的 `Smoke Desktop (Linux deb)` 失败，根因是 CI 拉取 `ubuntu:24.04` 时 Docker Hub 请求超时，`docker run` exit code `125`；日志未显示 deb 安装或桌面包启动失败。按 existing release recovery 原则，没有创建新的 beta tag，而是 rerun 既有 workflow/release identity。第二次 workflow 成功，release assets 与 beta update channel 均闭合。

本次还沉淀了发布流程改进：

- `apps/desktop/scripts/smoke-linux-deb.sh` 显式 `docker pull ubuntu:24.04` 并重试，避免隐式 pull 一次失败就终止发布。
- `scripts/release/desktop-release-closure.mjs` 对 `gh` / `curl` 查询 GitHub API 或 public Pages 的 TLS、timeout、DNS、5xx transient 增加重试。
- `desktop-release-contract-guard` skill 增加隔离发布回流、Docker pull transient、closure API transient 的处理规则。

## 测试/验证/验收方式

- `pnpm release:desktop:beta -- --release-worktree --branch master --target 1b09dffc2cd7e3a19db5b7f7597d9a99f3926ad0`：执行，首次远端 workflow 因 Docker Hub transient 失败。
- `gh run rerun 26825765598 --repo Peiiii/nextclaw`：执行，复用 `v0.20.4-desktop-beta.1` release identity。
- `node scripts/release/desktop-beta-preview-closure.mjs --tag v0.20.4-desktop-beta.1 --desktop-version 0.0.201 --runtime-version 0.20.4 --minimum-launcher-version 0.0.143 --run-id 26825765598`：通过。
- closure 结果：workflow `completed/success`，release assets OK，`gh-pages` manifest OK，public Pages manifest OK。
- `bash -n apps/desktop/scripts/smoke-linux-deb.sh`：通过。
- `node --check scripts/release/desktop-release-closure.mjs`：通过。
- `node --check scripts/release/desktop-beta-preview-closure.mjs`：通过。

## 发布/部署方式

发布了 GitHub Desktop beta prerelease：

- tag：`v0.20.4-desktop-beta.1`
- URL：`https://github.com/Peiiii/nextclaw/releases/tag/v0.20.4-desktop-beta.1`
- desktop version：`0.0.201`
- runtime version：`0.20.4`
- beta minimum launcher version：`0.0.143`
- workflow run：`https://github.com/Peiiii/nextclaw/actions/runs/26825765598`

本次发布命令从隔离控制 worktree `/private/tmp/nextclaw-desktop-beta-control-kwTTkw/repo` 启动；发布脚本又创建临时 detached worktree 执行本地 `desktop:package:verify`。主工作区 WIP 未参与构建。

`publish-linux-apt-repo` 对 beta release 正确跳过。

## 用户/产品视角的验收步骤

1. 打开 `https://github.com/Peiiii/nextclaw/releases/tag/v0.20.4-desktop-beta.1`。
2. 下载目标平台 preview artifact。
3. 安装或解压后启动桌面端。
4. 在 beta update channel 下检查更新，应看到 runtime `0.20.4` 的 beta manifest。
5. 已安装旧 beta 的用户检查更新时，public Pages beta manifest 应指向 `latestVersion: 0.20.4`、`minimumLauncherVersion: 0.0.143`。

## 可维护性总结汇总

本次没有修改桌面产品功能代码，主要是发布自动化减坑：

- 将 Docker Hub transient 从一次性隐式失败改为显式 pull retry。
- 将 closure 本地网络瞬断从人工判断改为脚本 retry。
- 将隔离发布后的本地回流责任写入 desktop release skill，避免隔离执行后遗漏 release metadata / logs / skill 改动。

这些改动没有增加新的发布入口，而是在既有 `desktop-release-contract-guard`、Linux deb smoke 和 closure gate 上增强韧性，职责仍集中在桌面发布 owner。

## NPM 包发布记录

不涉及 NPM 包发布。
