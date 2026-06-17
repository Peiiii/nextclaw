# v0.20.84 NPM Stable 0.21.9

## 迭代完成说明

本次完成 `nextclaw@0.21.9` NPM 正式版全量发布，并同步发布 stable NPM runtime update channel。

发布范围：

- 从 changeset beta pre mode 退出，生成正式版本批次。
- 发布 49 个 NPM 包，`nextclaw@latest` 指向 `0.21.9`，`beta` 保持 `0.21.9-beta.1`。
- 推送 release commit、UI dist 同步 commit、49 个 package tag，并将本地 `master` 与远端 metrics commit 合并后推送到 `origin/master`。
- 触发并完成 GitHub Actions `npm-runtime-update-release` stable workflow，生成并发布 darwin-arm64、darwin-x64、linux-x64、win32-x64 四个平台 runtime bundle。
- 发布 gh-pages stable manifest，并等待公开 GitHub Pages URL 刷新到 `0.21.9`。

相关提交：

- `31601cd08`：修复 Claude 工具结果状态 materialization。
- `8f9fb3702`：`chore: release npm stable 0.21.9`。
- `f20c18648`：`chore: sync nextclaw ui dist for npm stable 0.21.9`。
- `d7d5eaf70`：合并远端 metrics commit 后的 `master` 推送提交。

## 测试/验证/验收方式

发布前验证：

- `pnpm install --frozen-lockfile`
- `npm whoami`：确认发布身份为 `peiiii`，registry 为 `https://registry.npmjs.org/`。
- `pnpm changeset pre exit`
- `pnpm release:auto:prepare`
- `pnpm release:version`
- `pnpm release:report:health`
- `pnpm release:publish`
- `pnpm release:verify:published`：确认 `published 49/49 package versions`。

发布后 registry 验证：

- `npm view nextclaw dist-tags --json`：`latest=0.21.9`，`beta=0.21.9-beta.1`。
- `npm view nextclaw@latest version --json`：`0.21.9`。

Runtime update channel 验证：

- GitHub Actions run：`https://github.com/Peiiii/nextclaw/actions/runs/27707035362`，结论为 `success`。
- GitHub Release `nextclaw@0.21.9` 包含 4 个 runtime zip：
  - `nextclaw-runtime-darwin-arm64-0.21.9.zip`
  - `nextclaw-runtime-darwin-x64-0.21.9.zip`
  - `nextclaw-runtime-linux-x64-0.21.9.zip`
  - `nextclaw-runtime-win32-x64-0.21.9.zip`
- gh-pages stable manifests 均为 `latestVersion=0.21.9`、`hostKind=npm-runtime-bundle`、`minimumLauncherVersion=0.18.11`。
- 公开 Pages stable manifests 最终均刷新为 `latestVersion=0.21.9`，bundle URL 指向 `nextclaw@0.21.9` release assets。

真实安装/升级冒烟：

- 全新安装：`npm install -g nextclaw@latest --prefix /tmp/nextclaw-latest-smoke-*`。
- 全新安装版本：`nextclaw --version` 输出 `0.21.9`。
- 全新安装更新检查：`NEXTCLAW_HOME=<tmp>/home nextclaw update --check --json` 输出 `status=up-to-date`，`currentVersion=0.21.9`。
- 旧正式版升级：`npm install -g nextclaw@0.21.8 --prefix /tmp/nextclaw-upgrade-smoke-*`。
- 旧正式版更新检查：`0.21.8` 检测到 `availableVersion=0.21.9`，`status=update-available`。
- `update --download-only --json` 输出 `downloadedVersion=0.21.9`，`status=downloaded`。
- `update --apply --json` 输出 `currentVersion=0.21.9`，`status=restart-required`。
- 带同一 `NEXTCLAW_HOME` 重新执行 `nextclaw --version` 输出 `0.21.9`；再次 `update --check --json` 输出 `status=up-to-date`。

## 发布/部署方式

NPM 发布方式：

- 在隔离 worktree `/private/tmp/nextbot-npm-stable-release-20260618011120` 创建发布分支 `codex/release-npm-stable-20260618011120`。
- 在隔离 worktree 完成 changeset 版本化、release metadata commit、`pnpm release:publish` 与 UI dist 同步 commit。
- 将发布分支 fast-forward 回主工作区，再合并远端 metrics commit 后推送 `master`。
- 发布 tags 随 `git push origin master --follow-tags` 推送，其中本次 49 个 package tag 指向 `8f9fb3702`。

Runtime update channel 发布方式：

- 通过 `gh workflow run npm-runtime-update-release.yml --repo Peiiii/nextclaw --ref master -f channel=stable -f release_tag=nextclaw@0.21.9` 触发 stable runtime workflow。
- workflow 构建四个平台 signed NPM runtime bundle，上传到 GitHub Release `nextclaw@0.21.9`。
- workflow 将 stable manifests 发布到 `gh-pages` 的 `npm-runtime-updates/stable/`，公开 Pages URL 完成刷新后用于 launcher 更新检查。

不适用项：

- 本次无数据库 migration。
- 本次无后端远程 deploy。
- 本次无独立桌面 installer / DMG 发布；只发布 NPM runtime update channel。

## 用户/产品视角的验收步骤

1. 在干净临时目录全新安装 `nextclaw@latest`。
2. 执行 `nextclaw --version`，预期输出 `0.21.9`。
3. 执行 `nextclaw update --check --json`，预期 stable channel 显示 `up-to-date`。
4. 在另一个临时目录安装 `nextclaw@0.21.8`。
5. 执行 `nextclaw update --check --json`，预期发现 `0.21.9`。
6. 执行 `nextclaw update --download-only --json` 和 `nextclaw update --apply --json`，预期下载并应用 `0.21.9` runtime。
7. 使用同一 `NEXTCLAW_HOME` 重新执行 `nextclaw --version`，预期输出 `0.21.9`。

## 可维护性总结汇总

本次是正式发布闭环，不新增产品源码能力；源码 bugfix 的可维护性总结已记录在 `docs/logs/v0.20.83-claude-tool-result-state/README.md`。

本次发布阶段改动主要是自动生成的 version / changelog / changeset release metadata、`packages/nextclaw/ui-dist` 发布产物同步，以及本迭代记录。发布过程没有引入新的 runtime 兼容分支，没有提升 stable launcher floor，仍保持 `minimumLauncherVersion=0.18.11`。

代码增减报告：

- 发布 metadata commit：122 个文件变化，主要来自 changeset 正式版本化、package version、changelog 和 `.changeset/pre.json`。
- UI dist 同步 commit：45 个文件变化，净增为 0，属于构建产物 hash 同步。
- 本迭代记录：新增文档，不改变运行时代码。

正向减债动作：

- 使用隔离 worktree 完成正式发布，避免主工作区未跟踪 design 文档进入发布提交。
- 发布后清理主工作区 `ui-dist` 本地旧 hash 漂移，保持已推送 release 产物为唯一基准。
- 等待公开 Pages manifest 实际刷新后才做旧版升级 smoke，避免把 gh-pages 源分支状态误判为用户可见状态。

## NPM 包发布记录

本次已发布并验证 49 个包：

- `nextclaw@0.21.9`
- `@nextclaw/agent-chat-ui@0.5.1`
- `@nextclaw/agent-chat@0.2.14`
- `@nextclaw/aigen@0.1.6`
- `@nextclaw/app-runtime@0.8.14`
- `@nextclaw/app-sdk@0.2.14`
- `@nextclaw/browser-connector@0.2.4`
- `@nextclaw/channel-extension-dingtalk@0.1.19`
- `@nextclaw/channel-extension-discord@0.1.19`
- `@nextclaw/channel-extension-email@0.1.19`
- `@nextclaw/channel-extension-feishu@0.1.26`
- `@nextclaw/channel-extension-qq@0.1.23`
- `@nextclaw/channel-extension-slack@0.1.19`
- `@nextclaw/channel-extension-telegram@0.1.19`
- `@nextclaw/channel-extension-wecom@0.1.19`
- `@nextclaw/channel-extension-weixin@0.1.30`
- `@nextclaw/channel-extension-whatsapp@0.1.19`
- `@nextclaw/client-sdk@0.4.4`
- `@nextclaw/companion@0.1.32`
- `@nextclaw/core@0.14.5`
- `@nextclaw/extension-sdk@0.2.15`
- `@nextclaw/feishu-core@0.2.35`
- `@nextclaw/kernel@0.5.1`
- `@nextclaw/mcp@0.2.15`
- `@nextclaw/ncp-agent-runtime-next@0.0.17`
- `@nextclaw/ncp-agent-runtime@0.3.45`
- `@nextclaw/ncp-http-agent-client@0.3.46`
- `@nextclaw/ncp-http-agent-server@0.3.46`
- `@nextclaw/ncp-mcp@0.1.110`
- `@nextclaw/ncp-react-ui@0.2.46`
- `@nextclaw/ncp-react@0.4.54`
- `@nextclaw/ncp-toolkit@0.5.39`
- `@nextclaw/ncp@0.6.4`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.2.14`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.32`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.33`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.1.13`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.2.14`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.2.14`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.56`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.55`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.2.14`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14`
- `@nextclaw/remote@0.2.15`
- `@nextclaw/runtime@0.3.15`
- `@nextclaw/server@0.14.5`
- `@nextclaw/service@0.2.15`
- `@nextclaw/shared@0.3.1`
- `@nextclaw/ui@0.14.1`
