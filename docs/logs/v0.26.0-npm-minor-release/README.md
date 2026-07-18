# NextClaw v0.26.0 NPM minor 与桌面正式版发布

## 迭代完成说明

- 将完整公开 workspace 发布批次统一版本化，并把 `nextclaw` 从 `0.25.3` 升级到新的 minor 版本 `0.26.0`。
- 本版本集中交付长会话虚拟时间线、定时任务工作台、AI 回复运行信息、内置 Agent Browser、移动端新任务入口、运行时身份表达和内联结果稳定性改进。
- 已生成中英文产品更新说明、stable 更新提示 JSON 和各公开包 Changelog；发布配图不适用，因为现有候选截图仍显示旧版本号，避免把不准确资产带入正式发布。
- 已将 `0.26.0` runtime bundle 发布到桌面 stable 通道，正式桌面壳版本为 `0.0.227`，发布身份为 `v0.26.0-desktop.1`，兼容性最低版本继续保持 `0.0.141`。

## 测试/验证/验收方式

- 发布前健康检查：已通过 `pnpm release:check:health` 与 `pnpm release:check-readmes`。
- `pnpm release:check -- --reset` 已通过，49 个公开包全部完成依赖闭包检查、构建和 TypeScript 检查；`pnpm docs:i18n:check` 与 `pnpm --filter @nextclaw/docs build` 已通过。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean`、Release Notes JSON 解析和 `git diff --check` 已通过。
- Registry 验证已通过：49 个公开包的精确版本均可从 NPM 读取，`nextclaw` 的 `latest` 已指向 `0.26.0`，其内部依赖均指向本批次新版本。
- stable runtime 验证已通过：darwin-arm64、darwin-x64、linux-x64、win32-x64 四个平台 manifest 均指向 `0.26.0`，并包含正确的中英文发布说明链接。
- 全新安装冒烟已通过：从公开 Registry 安装 `nextclaw@0.26.0` 后，CLI 返回 `0.26.0`，更新公钥与 `ui-dist` 发布载荷均存在。
- 公开更新链路冒烟已通过：从 `nextclaw@0.25.3` 执行 `update --check --json` 可发现 `0.26.0` 且不创建运行时切换指针；手动执行 `update --json` 后返回 `restart-required`，运行时指针与最终 CLI 版本均切换到 `0.26.0`。
- 桌面正式发布 dry-run 已通过，锁定 `v0.26.0-desktop.1`、launcher `0.0.227`、runtime `0.26.0`、minimum launcher `0.0.141` 与目标提交 `dd6e79dff`。
- 隔离桌面 package gate 已通过：生成的 macOS arm64 DMG 为 140.3 MB，seed bundle 为 19.3 MB；更新公钥成功验证 stable manifest 签名，seed runtime 文件数为 262/400，`apps/desktop` lint、TypeScript、build 和 runtime init 均通过。
- 隔离 Electron GUI smoke 已通过：当前启动生成真实 runtime URL，命令面返回 `0.26.0`，`ready-to-show`、`did-finish-load`、核心 API、内置 extensions/channels 与 stable 更新检查均成功，GUI 约 7.1 秒就绪。
- 远端签名密钥 preflight [29652936965](https://github.com/Peiiii/nextclaw/actions/runs/29652936965) 成功；正式桌面 workflow [29652953357](https://github.com/Peiiii/nextclaw/actions/runs/29652953357) 的五个平台构建 job、资产发布、更新通道发布和 Linux APT 发布共 8 个 job 全部成功。
- GitHub Release 共发布 30 个资产；macOS arm64/x64 DMG、Windows x64 installer、Windows x64 portable、Linux x64 AppImage 和 `.deb` 的公网下载 URL 均返回 200。
- `gh-pages` 与公开 Pages 上的 darwin arm64/x64、win32 arm64/x64、linux x64 stable manifest 均返回 `latestVersion=0.26.0`、`minimumLauncherVersion=0.0.141` 和正确的公开更新说明 URL；APT `Packages` 返回 `nextclaw-desktop 0.0.227`。

## 发布/部署方式

- 使用隔离 worktree 生成完整 changeset 批次和版本文件，避免触碰主工作区中的其他工作。
- 已按“发布分支提交与推送 → NPM 全量发布 → 合并本地 `master` 并推送 → stable runtime workflow → 文档部署 → 公网验证”的单一闭环完成发布。
- 发布提交为 `82ca59282`；本地 `master` 已快进到该提交并推送 `origin/master`。
- stable runtime workflow 已成功构建并发布四个平台更新载荷：[GitHub Actions 运行记录](https://github.com/Peiiii/nextclaw/actions/runs/29651220926)。
- GitHub Release 已生成：[nextclaw@0.26.0](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.26.0)。
- 文档部署 workflow 已成功完成：[GitHub Actions 运行记录](https://github.com/Peiiii/nextclaw/actions/runs/29651199783)；[中文发布说明](https://docs.nextclaw.io/zh/notes/2026-07-18-nextclaw-v0-26-0)、[英文发布说明](https://docs.nextclaw.io/en/notes/2026-07-18-nextclaw-v0-26-0) 与 [更新提示 JSON](https://docs.nextclaw.io/release-notes/nextclaw-v0.26.0.json) 均已通过公网读取验证。
- 桌面正式版已发布：[v0.26.0-desktop.1](https://github.com/Peiiii/nextclaw/releases/tag/v0.26.0-desktop.1)；stable desktop update channel、Linux APT 仓库与更新公钥均由同一桌面 workflow 发布并完成公网验证。
- 为避免公开说明仍保留“桌面安装包稍后发布”的旧边界，已更新中英文 0.26.0 页面与结构化 JSON；文档部署 [29652835213](https://github.com/Peiiii/nextclaw/actions/runs/29652835213) 已成功，公网内容包含桌面 `0.0.227` 发布状态。
- 官网 stable 下载 fallback 已通过提交 `8de0b9a9e` 更新到 `v0.26.0-desktop.1 / 0.0.227`，并以本机已登录 Wrangler OAuth 作为明确的人工发布路径部署到 Cloudflare Pages；部署预览为 `https://2d439441.nextclaw-landing.pages.dev`，生产站 `https://nextclaw.io` 已加载包含新 tag/version 且不含旧 tag 的同一构建资产。
- NPM 与桌面 stable 更新检查只负责发现版本，不自动下载或应用；用户仍需要明确触发更新或下载安装包。

## 用户/产品视角的验收步骤

1. 访问 `https://nextclaw.io/en/download/` 或中文下载页，确认下载链接指向 `v0.26.0-desktop.1` 和桌面 `0.0.227`。
2. macOS 用户安装 arm64/x64 DMG，Windows 用户安装 x64 setup 或使用 portable 包，Linux 用户使用 AppImage、`.deb` 或 stable APT 仓库；未签名构建按页面指引完成系统放行。
3. 现有桌面用户启动应用后确认立即检查 stable 更新；发现 `0.26.0` 后由用户手动下载并应用，更新过程不会自动执行。
4. 更新后确认 runtime 为 `0.26.0`，会话、配置和内置技能保持可用；再检查长会话、定时任务工作台、Agent Browser 与 AI 回复运行信息。

## 可维护性总结汇总

- 本次发布只生成版本元数据、Changelog、Release Notes、项目动态索引和发布记录，不新增生产运行链路。
- 全量发布批次继续由 Changesets、release health、统一发布脚本和 stable runtime workflow 作为单一 owner，避免手工逐包发布或平行更新通道。
- 发布提交共变更 124 个文件，新增 2237 行、删除 164 行；生产源码与测试均无新增，maintainability guard 判定为不适用。
- 首次执行统一发布时，48 个依赖包已成功发布，但 `nextclaw` 的发布载荷校验发现 `ui-dist` 过期并拒绝发布。根因是发布检查命中缓存后跳过重建，而此前生成物清理已移除本次发布所需载荷；重新构建 `nextclaw-ui` 与 `nextclaw` 后，再次执行统一发布脚本会安全跳过已发布的 48 个包，并完成 `nextclaw@0.26.0` 发布。
- 机制改进项：统一发布入口应在真正调用 NPM publish 前独立验证并按需重建最终包载荷，不能把缓存中的 release check 成功等同于当前生成物仍然有效。该缺口未影响本次发布结果，但应在后续发布自动化中闭合。
- GitHub Actions 同时提示部分官方 Action 即将从 Node 20 强制迁移到 Node 24；本次未阻塞，后续应升级相关 Action 版本以消除工作流维护风险。
- 桌面发布自动化本身完成了隔离 package gate、远端 secret preflight、五平台矩阵、资产/更新通道/APT 发布与公网 closure，没有出现需要重新打 tag 或人工补资产的缺口。
- 发布前发现公开 0.26.0 说明仍写着“不包含新的桌面安装包”，已在打 tag 前更新中英文页面和结构化 JSON。该判断依赖发布阶段语义，不新增脆弱的关键词脚本；继续由 `desktop-release-contract-guard` 与 `nextclaw-release-notes-automation` 的正式桌面说明审查门负责。
- Release 正文首次提交时，`git diff --cached --check` 已发现 4 处 Markdown 行尾空格，但同一 shell 序列未使用 fail-fast，导致后续提交仍执行；随后改用 `&&` 完成修正提交，并确认桌面 tag 指向修正后的 `dd6e79dff`。后续任何“stage → check → commit → push”组合命令必须保持 fail-fast。
- 官网 stable fallback 只替换既有单一版本 owner 的两行常量，总代码与非测试代码均为新增 2 行、删除 2 行、净增 0；maintainability guard、landing tsc/lint/build 与治理检查通过，没有新增分支、文件、抽象或平行下载路径。
- 官网部署仍依赖开发机 Wrangler OAuth，属于人工发布而非无人值守部署。后续自动化 owner 应是仓库 CI：使用 environment-scoped Cloudflare Pages token、构建一次不可变 landing 产物、在部署后比较 tag/version；本次不在正式发布窗口临时扩张凭据与 workflow 范围。

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
- 桌面发布不新增 NPM 包版本；复用已验证的 `nextclaw@0.26.0` 完整依赖闭包，并发布桌面 launcher `0.0.227`、runtime bundle `0.26.0` 与 tag `v0.26.0-desktop.1`。
- X 账号连通性已验证，但本次没有在未获得明确社交发布授权的情况下直接发帖；可直接使用的草稿已保留：

```text
NextClaw 0.26.0 is out.

Long conversations stay smooth, scheduled tasks now have a real workbench, and each AI reply can show its runtime and token usage. Agent Browser is now built in.

Release notes: https://docs.nextclaw.io/en/notes/2026-07-18-nextclaw-v0-26-0
```
