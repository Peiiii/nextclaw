# NextClaw 0.57.1 NPM 与稳定 Runtime 发布

## 迭代完成说明

- 2026-09-24 从冻结的 `79df47f11410f519e62bb6b56b11bb019380b3ff` 运行 `release.yml target=product`，发布提交为 `6b274f4e4f0b35c26c74829aadc83de166dbc0cb`，标签为 `nextclaw@0.57.1`。34 个公开 NPM 包发布成功，Desktop 不在本次范围。
- [发布工作流](https://github.com/Peiiii/nextclaw/actions/runs/36009870452) 成功，四个平台的稳定 Runtime bundle 和 manifest 已公开；远程 `master` 包含发布提交。
- 发布后闭合检查误报的根因：检查器把发布标签作为目标分支祖先时的后续提交也当成发布遗漏。通过 merge-base 与 release 提交相等的判定确认；修正后将后续改动作为信息报告，真实分叉仍失败。回归测试和实际标签复验通过。

### 耗时与自动化

- 首次 dispatch 14:02:19 UTC，工作流完成 14:27:07 UTC，总计 24 分 48 秒。`NPM_READY` 于约 14:13:47 UTC，距 dispatch 11 分 28 秒，`<60s` 目标未达成。
- 最慢的顶层后续阶段是 Node 跨平台兼容矩阵，约 9 分 26 秒；NPM job 为 10 分 36 秒，其中发布与 Git 闭合 step 约 9 分 58 秒。应由发布工作流 owner 进一步分析这两个阶段的耗时，不能据汇总时长臆断单一内部瓶颈。
- Runtime promotion step 为 87 秒，满足 `<120s` 目标；其后真实升级验证为 86 秒。`AUTOMATION_INTERVENTIONS: 0`，发布 workflow 无人工恢复或重复发布。

## 测试/验证/验收方式

- `pnpm release:product:stable -- --dry-run`、README 同步/健康检查在发布前通过；发布 workflow 中 NPM、16 个受支持的 Node/平台兼容 cell、不受支持 Node guard、Runtime promotion 与旧稳定版升级验证均成功。
- `npm view nextclaw@0.57.1 version dist-tags --json` 显示版本与 `latest` 均为 `0.57.1`。四个公开 stable manifest 均显示 `latestVersion=0.57.1`、`minimumLauncherVersion=0.18.11` 和 `hostKind=npm-runtime-bundle`。
- 发布闭合修复通过 `node --test scripts/release/check-release-branch-closure.test.mjs`、实际标签闭合检查、`pnpm check:skill-progressive-loading`、`git diff --check` 和 diff-only maintainability 检查。

## 发布/部署方式

- 入口为 GitHub Actions `release.yml` 的 `target=product`，冻结 `expected_head` 为上述 SHA；[GitHub Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.57.1) 含 darwin-arm64、darwin-x64、linux-x64、win32-x64 四个 bundle。
- 远程主干已闭合。本地主工作区存在其它任务的活跃 WIP，`release:reconcile:mainline` 返回 `LOCAL_WORKTREE_RETRYING`，由现有单例 retry worker 处理；未覆盖、stash、rebase 或 reset 这些改动。

## 用户/产品视角的验收步骤

1. 运行 `npm view nextclaw version dist-tags --json`，确认 `latest` 为 `0.57.1`；在独立环境安装 `nextclaw@0.57.1`。
2. 在对应系统打开 [稳定 Runtime Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.57.1)，确认 bundle 可用；通过应用稳定更新通道检查 `0.57.1`。工作流已执行从上一稳定版升级验证。

## 可维护性总结汇总

- 发布复用既有 single-owner 工作流与稳定更新通道，没有新建平行发布路径。闭合修复在原检查器内增加祖先关系判定，测试覆盖后续主干提交及真实分叉；文件组织 preflight、diff-only maintainability 均通过，无 findings。
- 无用户可见新功能源代码修改；本次脚本修正只改变发布检查语义。NPM 耗时目标未达成，留作工作流性能改进事项。

## NPM 包发布记录

- 本次需要并已发布的 34 个公开包：`nextclaw@0.57.1`、`@nextclaw/companion@0.2.68`、`@nextclaw/channel-extension-dingtalk@0.2.53`、`@nextclaw/channel-extension-discord@0.2.53`、`@nextclaw/channel-extension-email@0.2.53`、`@nextclaw/channel-extension-feishu@0.2.41`、`@nextclaw/channel-extension-qq@0.2.39`、`@nextclaw/channel-extension-slack@0.2.53`、`@nextclaw/channel-extension-telegram@0.2.53`、`@nextclaw/channel-extension-wecom@0.2.53`、`@nextclaw/channel-extension-weixin@0.2.41`、`@nextclaw/channel-extension-whatsapp@0.2.53`、`@nextclaw/desktop-extension-wechat@0.2.10`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.54`、`@nextclaw/ncp-http-agent-client@0.4.26`、`@nextclaw/ncp-mcp@0.2.54`、`@nextclaw/agent-chat-ui@0.12.2`、`@nextclaw/app-runtime@0.16.10`、`@nextclaw/client-sdk@0.12.11`、`@nextclaw/collaboration@0.1.5`、`@nextclaw/core@0.18.4`、`@nextclaw/extension-sdk@0.5.10`、`@nextclaw/harness@0.2.25`、`@nextclaw/kernel@0.18.5`、`@nextclaw/mcp@0.3.54`、`@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.29`、`@nextclaw/nextclaw-ncp-runtime-http-client@0.3.26`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.54`、`@nextclaw/remote@0.3.68`、`@nextclaw/runtime@0.4.53`、`@nextclaw/server@0.23.11`、`@nextclaw/service@0.7.5`、`@nextclaw/shared@0.8.3`、`@nextclaw/ui@0.27.1`。
- Registry 主包和工作流批次检查通过；无待统一发布包。此次 Runtime 与 NPM 均已闭合，Desktop 未请求。
