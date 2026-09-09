# NextClaw 0.49.0 全平台正式发布

## 迭代完成说明

- 2026-09-08 从冻结的远程 `master` 提交 `d5c90ccbc228f010d1867185a51b22c006de1fb4` 单次 dispatch GitHub Actions `release.yml target=npm`，发布 `nextclaw@0.49.0` 及 workspace 依赖闭包；NPM `latest` 已指向 `0.49.0`。
- 正式发布沿用已经验收的 `npm-production` environment / `NPM_TOKEN` 生产路径。对应 parent run 为 [34245612525](https://github.com/Peiiii/nextclaw/actions/runs/34245612525)，最终结论为 `success`。
- 首次执行只有 Windows x64 / Node 20.19.0 的公网 `npm install nextclaw@0.49.0` 在 300 秒边界触发 `ETIMEDOUT`；同平台 Node 22/24/26、其他平台和核心 publish 均已成功，确认不是 package identity 或平台实现错误。
- 恢复只对同一 run 执行 failed-only rerun，复用既有 `0.49.0` identity，没有重复 publish。Windows x64 / Node 20.19.0 随后在 3 分 24 秒内成功，说明修复动作针对缺失的瞬时安装证据，而不是通过新版本或新 tag 掩盖症状。
- release commit 为 `6fb6913eda7ad2366a4e2a30e07f36fe2e451f05`，`nextclaw@0.49.0` 和同批 package tags 均指向该提交；`origin/master` 已闭合到同一提交。
- 2026-09-09 在不重发 NPM 的前提下补齐全平台发布：中英文说明与结构化数据先提交到 `a6804bd40059dd7df725408b886fbfd3f6011e1b`，随后复用既有 `0.49.0` identity 发布 stable Runtime、Desktop `0.0.284`、GitHub Releases、更新通道与 Linux APT。
- 全平台 parent run [34251139107](https://github.com/Peiiii/nextclaw/actions/runs/34251139107) 正确识别 recovery 并跳过 NPM publish，但其精确 checkout 在创建 Desktop Draft 前落后并发推进的 `origin/master` 两个提交，被安全门拒绝。该失败发生在 Runtime/Desktop 启动前，没有产生重复 package、tag 或公开 Desktop Release。
- Runtime 首次 promotion run [34252092840](https://github.com/Peiiii/nextclaw/actions/runs/34252092840) 复用了内容补齐前生成的预构建物，公开 manifest 仍指向 GitHub Release；closure 因 `releaseNotesUrl` 不一致失败。恢复使用同一 `nextclaw@0.49.0` identity 冷重建签名 Runtime 投影，run [34252378440](https://github.com/Peiiii/nextclaw/actions/runs/34252378440) 成功，没有发布新 NPM 版本或新 tag。
- Desktop preflight [34254217607](https://github.com/Peiiii/nextclaw/actions/runs/34254217607) 与生产 run [34254265052](https://github.com/Peiiii/nextclaw/actions/runs/34254265052) 成功；`v0.49.0-desktop.1` 精确指向 NPM release commit `6fb6913e`，五平台构建/冒烟、Draft-first 公开、stable update channel 与 APT 全部闭合。

## 测试/验证/验收方式

- exact-commit prepare run [34242966636](https://github.com/Peiiii/nextclaw/actions/runs/34242966636) 成功生成 `d5c90ccb` 对应的不可变 NPM tree、tarballs 与四平台 Runtime 预制物；NPM-only 发布只消费 NPM 预制物。
- Parent run 的 `publish stable NPM batch` job 成功，完成 registry version/integrity/latest 校验、精确公网 tarball payload 审计、release commit/tag 与远程主线闭合。
- 已发布安装矩阵通过：Linux x64、macOS arm64/x64、Windows x64；Node 20.19.0、22.19.0、24、26；不支持 Node 版本的明确失败 guard 也通过。
- Registry 回读确认 `nextclaw@0.49.0`、`latest=0.49.0`，tarball 为 `https://registry.npmjs.org/nextclaw/-/nextclaw-0.49.0.tgz`，integrity 为 `sha512-EXN1QdPMXfE8iLonbhOIrixbtX5GzfJdN71bbP1YjkeONMjg+Rzn1yR62kdBaRZCjZQNMp2meLxYAstO+LJL9Q==`。
- `pnpm release:check:branch-closure -- --target origin/master --release nextclaw@0.49.0` 通过，目标分支与 release tag 之间没有缺失的源码、版本记录或生成产物。
- Docs Deploy [34250976541](https://github.com/Peiiii/nextclaw/actions/runs/34250976541) 成功；[中文说明](https://docs.nextclaw.io/zh/notes/2026-09-09-nextclaw-v0-49-0) 与 [English notes](https://docs.nextclaw.io/en/notes/2026-09-09-nextclaw-v0-49-0) 均返回 200。
- Runtime recovery 四平台 build、签名、上传与 Pages deploy 全部成功；公开 manifest 反查为 `latestVersion=0.49.0`、`minimumLauncherVersion=0.18.11`、`hostKind=npm-runtime-bundle`，并指向 0.49.0 英文说明。
- Desktop workflow 11/11 jobs 成功，五平台安装/启动冒烟通过；公开 Release 最终包含 31 个资产（30 个 Desktop 合同资产及 APT Pages 专用包），公开 manifest 为 `latestVersion=0.49.0`、`minimumLauncherVersion=0.0.141`，stable APT candidate 为 `0.0.284`。

### 发布耗时

- Parent 首次 dispatch：15:34:22Z；`publish stable NPM batch`：15:35:04Z–15:41:36Z，NPM_READY 核心窗口 6 分 32 秒，超过 `<60s` 目标，`time budget: missed`。
- Parent 最终成功：15:52:52Z；包含失败识别与 failed-only 恢复的总闭环耗时 18 分 30 秒。
- 最慢顶层核心阶段为 `publish stable NPM batch`（6 分 32 秒）；最慢异常单元为首次 Windows x64 / Node 20.19.0 安装（5 分 38 秒，最终超时）。后续应由兼容性 cell owner 为公网安装增加有界自动重试或更可靠的超时诊断，避免 Agent 手工触发 failed-only 恢复。
- `AUTOMATION_INTERVENTIONS: 1`：首次 Windows/Node 20 安装超时后，由发布 Agent 对同一 run 执行一次 failed-only rerun；没有重发 NPM identity。
- 全平台补齐阶段 `AUTOMATION_INTERVENTIONS: 2`：一次从落后主线的 parent run 转入同 identity 的 Runtime/Desktop recovery；一次因旧预构建 manifest 缺少新文档 URL 而冷重建同 identity 的签名 Runtime 投影。整个 `0.49.0` 发布周期累计 3 次人工恢复，均未重发 NPM package 或创建替代版本。
- Desktop 生产 workflow 总 wall time 为 24 分 44 秒；最慢 job 为 macOS x64（15 分 43 秒），最慢 step 为 macOS build（8 分 30 秒）。

## 发布/部署方式

- NPM 首次入口：`.github/workflows/release.yml target=npm`，source SHA `d5c90ccbc228f010d1867185a51b22c006de1fb4`；全平台补齐入口：同 workflow 的 `target=all` recovery，source SHA `a6804bd40059dd7df725408b886fbfd3f6011e1b`。
- Runtime Release：[NextClaw v0.49.0](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.49.0)；Desktop Release：[NextClaw Desktop 0.0.284](https://github.com/Peiiii/nextclaw/releases/tag/v0.49.0-desktop.1)。两个 tag 均精确指向 `6fb6913eda7ad2366a4e2a30e07f36fe2e451f05`。
- 官网定位、下载流程与定价未变化，因此 website surface 判定为不需要修改。Stable minor X 短帖按长期授权尝试发布，但 X 返回自动化保护错误 226；账号时间线回读确认没有落帖，未盲目重试。待外部限制解除时只使用既有文案和图片补发。
- 远程完成后运行 `pnpm release:reconcile:mainline`。远程 `master` 已同步；本地主工作区存在其它任务的活跃 WIP，因此协调器返回 `LOCAL_WORKTREE_RETRYING` 并由单例 worker 自动接管，没有 stash、rebase、reset 或覆盖用户改动。

## 用户/产品视角的验收步骤

1. 在空目录和独立 NPM cache 中安装 `nextclaw@0.49.0`，确认安装来源是公开 registry 而不是 workspace link。
2. 读取已安装包的 `package.json`，确认版本为 `0.49.0`；在受支持的 Node 20.19.0、22.19.0、24 或 26 环境启动 launcher/app entry，并确认 SQLite 初始化正常。
3. 执行 `npm view nextclaw version dist-tags --json`，确认 `version` 与 `latest` 都为 `0.49.0`。
4. 打开 Runtime Release，确认四个平台 bundle 可下载；读取 stable Runtime manifest，确认版本、launcher floor、host kind 和 release notes URL 一致。
5. 打开 Desktop Release，按系统下载 macOS DMG/ZIP、Windows installer/portable 或 Linux AppImage/DEB；应用内检查 stable 更新，确认 Runtime `0.49.0`、Desktop `0.0.284`。
6. Linux 用户通过 stable APT 仓库执行全新安装或升级，确认 candidate/installed 版本为 `0.0.284`。

## 可维护性总结汇总

- 本次发布复用现有 single-owner GitHub Actions、预制 artifact、strict checkpoint、registry 校验和 failed-only recovery，没有新增发布脚本、wrapper、adapter 或平行状态机。
- 本任务没有修改产品源码；diff-only maintainability guard 不适用于纯发布记录。文件组织通过 planned-path preflight，新增记录位于既有 `docs/logs/v<semver>-<slug>/README.md` owner 下。
- 发布恢复保持 identity、tag 和成功 job 不变，只补齐唯一失败 cell，避免分支、版本与不可变 package 膨胀。
- 本轮暴露两个流程缺口：精确 SHA 的 parent checkout 会被并发主线推进误判为不可发布；内容后补时旧 Runtime 预构建物不会自动获得结构化说明 URL。恢复严格复用既有 identity，但这两个缺口应在后续流程改造中由自动化 owner 消除，避免再次需要人工切换 recovery。

## NPM 包发布记录

- 需要发布：本批包含向后兼容的新 CLI 与聊天语音输入能力，`nextclaw` 按 minor 从 `0.48.3` 升至 `0.49.0`。
- 已发布且 tags/registry 验证闭合：`nextclaw@0.49.0`、`@nextclaw/ui@0.25.0`、`@nextclaw/agent-chat-ui@0.8.0`、`@nextclaw/core@0.17.19`、`@nextclaw/kernel@0.16.1`、`@nextclaw/ncp-agent-runtime@0.4.23`、`@nextclaw/ncp-agent-runtime-next@0.1.25`、`@nextclaw/ncp-toolkit@0.6.24`、`@nextclaw/ncp-react@0.5.27`、`@nextclaw/ncp-mcp@0.2.46`、`@nextclaw/mcp@0.3.46`、`@nextclaw/harness@0.2.15`、`@nextclaw/client-sdk@0.12.1`、`@nextclaw/companion@0.2.58`、`@nextclaw/runtime@0.4.45`、`@nextclaw/server@0.23.1`、`@nextclaw/service@0.6.4`、`@nextclaw/remote@0.3.58`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.46`、`@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.25`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.46`、`@nextclaw/channel-extension-dingtalk@0.2.45`、`@nextclaw/channel-extension-discord@0.2.45`、`@nextclaw/channel-extension-email@0.2.45`、`@nextclaw/channel-extension-feishu@0.2.34`、`@nextclaw/channel-extension-slack@0.2.45`、`@nextclaw/channel-extension-telegram@0.2.45`、`@nextclaw/channel-extension-wecom@0.2.45`、`@nextclaw/channel-extension-weixin@0.2.34`、`@nextclaw/channel-extension-whatsapp@0.2.45`。
- NPM 包已发布且未重复发布；Runtime、Desktop、文档、GitHub Releases、stable update channel 与 APT 已闭合。
- 外部 blocker：X 对自动化写入返回错误 226，时间线确认未落帖；不影响软件交付状态，但 stable minor 社交传播仍待平台解除限制后补齐。
