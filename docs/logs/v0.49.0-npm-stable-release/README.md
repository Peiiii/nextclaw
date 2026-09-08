# NextClaw 0.49.0 NPM 正式发布

## 迭代完成说明

- 2026-09-08 从冻结的远程 `master` 提交 `d5c90ccbc228f010d1867185a51b22c006de1fb4` 单次 dispatch GitHub Actions `release.yml target=npm`，发布 `nextclaw@0.49.0` 及 workspace 依赖闭包；NPM `latest` 已指向 `0.49.0`。
- 正式发布沿用已经验收的 `npm-production` environment / `NPM_TOKEN` 生产路径。对应 parent run 为 [34245612525](https://github.com/Peiiii/nextclaw/actions/runs/34245612525)，最终结论为 `success`。
- 首次执行只有 Windows x64 / Node 20.19.0 的公网 `npm install nextclaw@0.49.0` 在 300 秒边界触发 `ETIMEDOUT`；同平台 Node 22/24/26、其他平台和核心 publish 均已成功，确认不是 package identity 或平台实现错误。
- 恢复只对同一 run 执行 failed-only rerun，复用既有 `0.49.0` identity，没有重复 publish。Windows x64 / Node 20.19.0 随后在 3 分 24 秒内成功，说明修复动作针对缺失的瞬时安装证据，而不是通过新版本或新 tag 掩盖症状。
- release commit 为 `6fb6913eda7ad2366a4e2a30e07f36fe2e451f05`，`nextclaw@0.49.0` 和同批 package tags 均指向该提交；`origin/master` 已闭合到同一提交。

## 测试/验证/验收方式

- exact-commit prepare run [34242966636](https://github.com/Peiiii/nextclaw/actions/runs/34242966636) 成功生成 `d5c90ccb` 对应的不可变 NPM tree、tarballs 与四平台 Runtime 预制物；NPM-only 发布只消费 NPM 预制物。
- Parent run 的 `publish stable NPM batch` job 成功，完成 registry version/integrity/latest 校验、精确公网 tarball payload 审计、release commit/tag 与远程主线闭合。
- 已发布安装矩阵通过：Linux x64、macOS arm64/x64、Windows x64；Node 20.19.0、22.19.0、24、26；不支持 Node 版本的明确失败 guard 也通过。
- Registry 回读确认 `nextclaw@0.49.0`、`latest=0.49.0`，tarball 为 `https://registry.npmjs.org/nextclaw/-/nextclaw-0.49.0.tgz`，integrity 为 `sha512-EXN1QdPMXfE8iLonbhOIrixbtX5GzfJdN71bbP1YjkeONMjg+Rzn1yR62kdBaRZCjZQNMp2meLxYAstO+LJL9Q==`。
- `pnpm release:check:branch-closure -- --target origin/master --release nextclaw@0.49.0` 通过，目标分支与 release tag 之间没有缺失的源码、版本记录或生成产物。

### 发布耗时

- Parent 首次 dispatch：15:34:22Z；`publish stable NPM batch`：15:35:04Z–15:41:36Z，NPM_READY 核心窗口 6 分 32 秒，超过 `<60s` 目标，`time budget: missed`。
- Parent 最终成功：15:52:52Z；包含失败识别与 failed-only 恢复的总闭环耗时 18 分 30 秒。
- 最慢顶层核心阶段为 `publish stable NPM batch`（6 分 32 秒）；最慢异常单元为首次 Windows x64 / Node 20.19.0 安装（5 分 38 秒，最终超时）。后续应由兼容性 cell owner 为公网安装增加有界自动重试或更可靠的超时诊断，避免 Agent 手工触发 failed-only 恢复。
- `AUTOMATION_INTERVENTIONS: 1`：首次 Windows/Node 20 安装超时后，由发布 Agent 对同一 run 执行一次 failed-only rerun；没有重发 NPM identity。

## 发布/部署方式

- 唯一入口：`.github/workflows/release.yml`，参数 `target=npm`，source SHA `d5c90ccbc228f010d1867185a51b22c006de1fb4`。
- 授权范围仅包括 stable NPM `latest`、registry/安装验证和必要 Git 闭合；stable Runtime channel、Desktop、文档站、官网和 X 均未发布。
- 远程完成后运行 `pnpm release:reconcile:mainline`。远程 `master` 已同步；本地主工作区存在其它任务的活跃 WIP，因此协调器返回 `LOCAL_WORKTREE_RETRYING` 并由单例 worker 自动接管，没有 stash、rebase、reset 或覆盖用户改动。

## 用户/产品视角的验收步骤

1. 在空目录和独立 NPM cache 中安装 `nextclaw@0.49.0`，确认安装来源是公开 registry 而不是 workspace link。
2. 读取已安装包的 `package.json`，确认版本为 `0.49.0`；在受支持的 Node 20.19.0、22.19.0、24 或 26 环境启动 launcher/app entry，并确认 SQLite 初始化正常。
3. 执行 `npm view nextclaw version dist-tags --json`，确认 `version` 与 `latest` 都为 `0.49.0`。

## 可维护性总结汇总

- 本次发布复用现有 single-owner GitHub Actions、预制 artifact、strict checkpoint、registry 校验和 failed-only recovery，没有新增发布脚本、wrapper、adapter 或平行状态机。
- 本任务没有修改产品源码；diff-only maintainability guard 不适用于纯发布记录。文件组织通过 planned-path preflight，新增记录位于既有 `docs/logs/v<semver>-<slug>/README.md` owner 下。
- 发布恢复保持 identity、tag 和成功 job 不变，只补齐唯一失败 cell，避免分支、版本与不可变 package 膨胀。

## NPM 包发布记录

- 需要发布：本批包含向后兼容的新 CLI 与聊天语音输入能力，`nextclaw` 按 minor 从 `0.48.3` 升至 `0.49.0`。
- 已发布且 tags/registry 验证闭合：`nextclaw@0.49.0`、`@nextclaw/ui@0.25.0`、`@nextclaw/agent-chat-ui@0.8.0`、`@nextclaw/core@0.17.19`、`@nextclaw/kernel@0.16.1`、`@nextclaw/ncp-agent-runtime@0.4.23`、`@nextclaw/ncp-agent-runtime-next@0.1.25`、`@nextclaw/ncp-toolkit@0.6.24`、`@nextclaw/ncp-react@0.5.27`、`@nextclaw/ncp-mcp@0.2.46`、`@nextclaw/mcp@0.3.46`、`@nextclaw/harness@0.2.15`、`@nextclaw/client-sdk@0.12.1`、`@nextclaw/companion@0.2.58`、`@nextclaw/runtime@0.4.45`、`@nextclaw/server@0.23.1`、`@nextclaw/service@0.6.4`、`@nextclaw/remote@0.3.58`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.46`、`@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.25`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.46`、`@nextclaw/channel-extension-dingtalk@0.2.45`、`@nextclaw/channel-extension-discord@0.2.45`、`@nextclaw/channel-extension-email@0.2.45`、`@nextclaw/channel-extension-feishu@0.2.34`、`@nextclaw/channel-extension-slack@0.2.45`、`@nextclaw/channel-extension-telegram@0.2.45`、`@nextclaw/channel-extension-wecom@0.2.45`、`@nextclaw/channel-extension-weixin@0.2.34`、`@nextclaw/channel-extension-whatsapp@0.2.45`。
- 外部 blocker：无。Runtime、Desktop 与公开内容为本次 NPM-only 授权的明确非目标，不标记为发布失败。
