# NextClaw v0.26.0 NPM minor 发布

## 迭代完成说明

- 将完整公开 workspace 发布批次统一版本化，并把 `nextclaw` 从 `0.25.3` 升级到新的 minor 版本 `0.26.0`。
- 本版本集中交付长会话虚拟时间线、定时任务工作台、AI 回复运行信息、内置 Agent Browser、移动端新任务入口、运行时身份表达和内联结果稳定性改进。
- 已生成中英文产品更新说明、stable 更新提示 JSON 和各公开包 Changelog；发布配图不适用，因为现有候选截图仍显示旧版本号，避免把不准确资产带入正式发布。

## 测试/验证/验收方式

- 发布前健康检查：已通过 `pnpm release:check:health` 与 `pnpm release:check-readmes`。
- `pnpm release:check -- --reset` 已通过，49 个公开包全部完成依赖闭包检查、构建和 TypeScript 检查；`pnpm docs:i18n:check` 与 `pnpm --filter @nextclaw/docs build` 已通过。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean`、Release Notes JSON 解析和 `git diff --check` 已通过。
- Registry 验证已通过：49 个公开包的精确版本均可从 NPM 读取，`nextclaw` 的 `latest` 已指向 `0.26.0`，其内部依赖均指向本批次新版本。
- stable runtime 验证已通过：darwin-arm64、darwin-x64、linux-x64、win32-x64 四个平台 manifest 均指向 `0.26.0`，并包含正确的中英文发布说明链接。
- 全新安装冒烟已通过：从公开 Registry 安装 `nextclaw@0.26.0` 后，CLI 返回 `0.26.0`，更新公钥与 `ui-dist` 发布载荷均存在。
- 公开更新链路冒烟已通过：从 `nextclaw@0.25.3` 执行 `update --check --json` 可发现 `0.26.0` 且不创建运行时切换指针；手动执行 `update --json` 后返回 `restart-required`，运行时指针与最终 CLI 版本均切换到 `0.26.0`。

## 发布/部署方式

- 使用隔离 worktree 生成完整 changeset 批次和版本文件，避免触碰主工作区中的其他工作。
- 已按“发布分支提交与推送 → NPM 全量发布 → 合并本地 `master` 并推送 → stable runtime workflow → 文档部署 → 公网验证”的单一闭环完成发布。
- 发布提交为 `82ca59282`；本地 `master` 已快进到该提交并推送 `origin/master`。
- stable runtime workflow 已成功构建并发布四个平台更新载荷：[GitHub Actions 运行记录](https://github.com/Peiiii/nextclaw/actions/runs/29651220926)。
- GitHub Release 已生成：[nextclaw@0.26.0](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.26.0)。
- 文档部署 workflow 已成功完成：[GitHub Actions 运行记录](https://github.com/Peiiii/nextclaw/actions/runs/29651199783)；[中文发布说明](https://docs.nextclaw.io/zh/notes/2026-07-18-nextclaw-v0-26-0)、[英文发布说明](https://docs.nextclaw.io/en/notes/2026-07-18-nextclaw-v0-26-0) 与 [更新提示 JSON](https://docs.nextclaw.io/release-notes/nextclaw-v0.26.0.json) 均已通过公网读取验证。
- NPM stable runtime 更新只负责发现和手动应用更新，不自动下载或应用；本批次不发布新的桌面安装包。

## 用户/产品视角的验收步骤

1. 在现有 `nextclaw@0.25.3` 安装中重启应用，确认立即发现 `0.26.0`，且不会自动下载或应用。
2. 手动下载并应用更新，确认运行版本切换到 `0.26.0`，会话、配置和内置技能保持可用。
3. 在长会话中向上加载历史消息，检查阅读位置；打开定时任务工作台，检查创建、搜索、筛选和任务会话跳转。
4. 检查 AI 回复的运行时、模型与 token 信息，并在移动端从聊天标题栏创建新任务。

## 可维护性总结汇总

- 本次发布只生成版本元数据、Changelog、Release Notes、项目动态索引和发布记录，不新增生产运行链路。
- 全量发布批次继续由 Changesets、release health、统一发布脚本和 stable runtime workflow 作为单一 owner，避免手工逐包发布或平行更新通道。
- 发布提交共变更 124 个文件，新增 2237 行、删除 164 行；生产源码与测试均无新增，maintainability guard 判定为不适用。
- 首次执行统一发布时，48 个依赖包已成功发布，但 `nextclaw` 的发布载荷校验发现 `ui-dist` 过期并拒绝发布。根因是发布检查命中缓存后跳过重建，而此前生成物清理已移除本次发布所需载荷；重新构建 `nextclaw-ui` 与 `nextclaw` 后，再次执行统一发布脚本会安全跳过已发布的 48 个包，并完成 `nextclaw@0.26.0` 发布。
- 机制改进项：统一发布入口应在真正调用 NPM publish 前独立验证并按需重建最终包载荷，不能把缓存中的 release check 成功等同于当前生成物仍然有效。该缺口未影响本次发布结果，但应在后续发布自动化中闭合。
- GitHub Actions 同时提示部分官方 Action 即将从 Node 20 强制迁移到 Node 24；本次未阻塞，后续应升级相关 Action 版本以消除工作流维护风险。

## NPM 包发布记录

- 主包：`nextclaw@0.26.0`，dist-tag `latest`；NPM Registry 与完整依赖闭包已验证。
- 完整公开批次共 49 个包：

```text
@nextclaw/companion@0.2.11
@nextclaw/aigen@0.2.5
@nextclaw/browser-connector@0.3.5
@nextclaw/channel-extension-dingtalk@0.2.9
@nextclaw/channel-extension-discord@0.2.9
@nextclaw/channel-extension-email@0.2.9
@nextclaw/channel-extension-feishu@0.2.9
@nextclaw/channel-extension-qq@0.2.8
@nextclaw/channel-extension-slack@0.2.9
@nextclaw/channel-extension-telegram@0.2.9
@nextclaw/channel-extension-wecom@0.2.9
@nextclaw/channel-extension-weixin@0.2.9
@nextclaw/channel-extension-whatsapp@0.2.9
@nextclaw/feishu-core@0.3.5
@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.8
@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.8
@nextclaw/nextclaw-narp-runtime-opencode@0.2.10
@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.8
@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.7
@nextclaw/ncp-agent-runtime-next@0.1.7
@nextclaw/ncp-agent-runtime@0.4.7
@nextclaw/ncp-http-agent-client@0.4.7
@nextclaw/ncp-http-agent-server@0.4.7
@nextclaw/ncp-mcp@0.2.9
@nextclaw/ncp-react-ui@0.3.7
@nextclaw/ncp-react@0.5.9
@nextclaw/ncp-toolkit@0.6.8
@nextclaw/ncp@0.7.7
@nextclaw/agent-chat-ui@0.6.11
@nextclaw/agent-chat@0.3.5
@nextclaw/app-runtime@0.9.5
@nextclaw/app-sdk@0.3.5
@nextclaw/client-sdk@0.5.11
@nextclaw/core@0.15.9
@nextclaw/extension-sdk@0.3.8
@nextclaw/nextclaw-hermes-acp-bridge@0.3.7
@nextclaw/kernel@0.6.11
@nextclaw/mcp@0.3.9
@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.8
@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.7
@nextclaw/nextclaw-ncp-runtime-http-client@0.3.7
@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.10
@nextclaw/remote@0.3.11
@nextclaw/runtime@0.4.9
@nextclaw/server@0.15.11
@nextclaw/service@0.3.11
@nextclaw/shared@0.4.8
@nextclaw/ui@0.15.11
nextclaw@0.26.0
```

- 49 个包对应的 Git tag 已推送，GitHub Release、stable runtime workflow 与文档部署均已完成。
- X 账号连通性已验证，但本次没有在未获得明确社交发布授权的情况下直接发帖；可直接使用的草稿已保留：

```text
NextClaw 0.26.0 is out.

Long conversations stay smooth, scheduled tasks now have a real workbench, and each AI reply can show its runtime and token usage. Agent Browser is now built in.

Release notes: https://docs.nextclaw.io/en/notes/2026-07-18-nextclaw-v0-26-0
```
