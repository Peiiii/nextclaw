# NextClaw 0.28.0 AI 收件箱稳定版发布

## 迭代完成说明

- 发布 NextClaw `0.28.0` 稳定 minor 版本，把“后台结果不会丢”和“AI 可以主动送达内容”合并为一条完整用户链路。
- 非当前会话完成后会显示轻量右上角通知；通知摘要清洗 Markdown 展示标记，点击可回到原会话。
- 新增持久化 AI 收件箱，支持 Markdown 与安全静态 HTML、未读 / 已读、归档、删除、历史管理和“继续聊”；关闭阅读弹窗只停止自动弹出，不会擅自标记已读。
- 收件箱无可操作未读项时默认展示全部，避免已有历史内容却落入空白未读页。
- 版本说明使用真实产品截图：后台完成通知、Markdown 主动送达、HTML“每日 AI 与科技简报”和收件箱管理页均有中英文资产；changeset 作为需求 owner，`release:summary` 自动聚合并校验配图证据。
- 发布批次包含 26 个 NPM 包，registry 验证为 `26/26`；顶层 `nextclaw@0.28.0` 已成为 `latest`。

## 测试/验证/验收方式

- 功能定向测试覆盖通知、Inbox Kernel / Store / Tool / Context、Server API、Client SDK、UI 自动呈现、筛选规则、Markdown、HTML sandbox / CSP 与 iframe 生命周期；相关测试全部通过。
- `@nextclaw/shared`、Kernel、Server、Client SDK、UI TypeScript 检查通过；相关 ESLint、生产构建、文档站构建与 landing 构建通过。
- `pnpm docs:i18n:check` 验证 95 个中英文镜像页面；截图配置与 release summary 共 7 项测试通过。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与最终 `pnpm check:generated-clean` 通过。
- `pnpm release:publish` 在干净隔离 worktree 中完成；registry 传播重试后确认全部 26 个版本可读取，`nextclaw@latest` 为 `0.28.0`。
- 文档部署 workflow `31032716842` 的 build、全球 Cloudflare Pages、国内 OSS/CDN 与双域名 verify 全部成功；四个中英文指南 / 版本说明页面以及代表性 PNG 资源均返回 HTTP `200`。
- stable runtime workflow `31032968267` 完成 macOS arm64/x64、Linux x64、Windows x64 四个平台签名包、Release assets、gh-pages 和公共 stable manifest；仓库发布入口的最终 manifest 验证通过。
- 在 `/tmp/nextclaw-0280-smoke.ElpN6n` 从 registry 隔离安装 `nextclaw@0.28.0`，真实二进制报告 `0.28.0`；全新 `NEXTCLAW_HOME` 执行 `update --check` 返回 stable runtime 已是最新 `0.28.0`。

## 发布/部署方式

- 发布提交为 `9722a25234158b5a035f42865d3e59688566fd2f`；本地 `master` 先快进到该提交，再推送 `origin/master` 与精确审计过的 26 个版本 tags。
- NPM 使用仓库 Changesets 标准流程版本化和发布；GitHub Release 为 [NextClaw v0.28.0](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.28.0)，stable/latest、非 draft、非 prerelease。
- 文档站通过 [Docs Deploy workflow 31032716842](https://github.com/Peiiii/nextclaw/actions/runs/31032716842) 部署；公开指南与版本说明见文末验收入口。
- NPM runtime stable 通道通过 [workflow 31032968267](https://github.com/Peiiii/nextclaw/actions/runs/31032968267) 发布，manifest 的 release notes URL 指向本次英文公开说明。
- 不涉及数据库 migration、线上后端服务部署或新的 Desktop launcher / installer；现有桌面壳会通过 stable runtime 通道获得 `0.28.0`。
- 社交传播只准备候选文案，未在未获授权时发布：`后台工作终于会回来找你。NextClaw 0.28.0 带来会话完成通知与 AI 收件箱，支持 Markdown、静态 HTML 和继续聊。`

## 用户/产品视角的验收步骤

1. 在会话 A 发起耗时任务后切到会话 B，确认 A 完成时右上角出现标题与干净摘要；点击后回到 A。
2. 让 Agent 调用 `deliver_to_inbox` 投递 Markdown 或静态 HTML，确认界面打开时出现单一阅读窗，多条内容在同一窗口切换。
3. 关闭阅读窗但不标记已读，确认它不再自动弹出，同时继续以未读状态留在收件箱。
4. 在无未读内容时打开收件箱，确认默认展示全部历史；检查归档、恢复、删除和显式筛选保持。
5. 打开 HTML“每日 AI 与科技简报”，确认正文留白与圆角保留、没有额外黑色边框，脚本、远程资源与导航能力被隔离。
6. 点击“继续聊”，确认创建或复用关联会话，Agent 能感知送达报告上下文。
7. 打开 [中文场景指南](https://docs.nextclaw.io/zh/guide/background-results)、[English guide](https://docs.nextclaw.io/en/guide/background-results)、[中文版本说明](https://docs.nextclaw.io/zh/notes/2026-08-06-nextclaw-v0-28-0) 与 [English release notes](https://docs.nextclaw.io/en/notes/2026-08-06-nextclaw-v0-28-0)，确认正文和真实截图可见。

## 可维护性总结汇总

- 功能代码增长属于明确的新增用户能力，状态和持久化归 Kernel owner，HTTP / SDK / UI 只消费单一合同；通知复用全局 Sonner Portal，没有增加第二套通知容器或历史 store。
- HTML 安全边界集中在单一正文 renderer，原始内容仍只有一个事实来源；React iframe 类型与 key 保持稳定，没有用重挂载掩盖状态问题。
- 发布截图继续以 changeset 为需求 owner，没有新增平行 release-note manifest；版本化前会自动阻断缺图、错语言或不存在的资源。
- 本次发布收尾只更新版本元数据、changelog 与迭代记录，没有新增生产语义代码；功能批次的精确代码增减与两项既有截图入口 warning 已分别记录在 v0.26.43 和 v0.26.45。
- 干净 worktree 首次发布前发现未变化的 `@nextclaw/ncp` 与 `@nextclaw/ncp-agent-runtime-next` 缺少 dist，补构建后利用发布 checkpoint 完成 26 个包且没有重复 publish。后续应把这类发布期前置产物纳入统一 build closure；本轮没有在已发布途中扩张发布脚本。

## 红区触达与减债记录

- 发布提交、版本 tags 和 closure 文档均在隔离发布工作树与本地主干间显式回流；没有绕过本地 `master` 直接发布分叉。
- 主工作树中并行的 Codex 图片附件转发改动、changeset、测试与迭代记录全部保持未暂存状态，本轮没有覆盖、stash、重置或提交这些用户改动。
- 正向减债是把需求截图、双语版本说明、结构化 JSON、GitHub Release、Docs 与 runtime manifest 串成可验证的单一发布证据链。

## NPM 包发布记录

- 顶层产品：`nextclaw@0.28.0`。
- 核心合同：`@nextclaw/shared@0.4.17`、`@nextclaw/kernel@0.6.20`、`@nextclaw/server@0.15.20`、`@nextclaw/client-sdk@0.5.20`、`@nextclaw/ui@0.15.21`。
- 直接与依赖传播包：`@nextclaw/companion@0.2.20`、`@nextclaw/core@0.15.18`、`@nextclaw/extension-sdk@0.3.17`、`@nextclaw/mcp@0.3.18`、`@nextclaw/ncp-mcp@0.2.18`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.19`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.19`、`@nextclaw/remote@0.3.20`、`@nextclaw/runtime@0.4.18`、`@nextclaw/service@0.3.20`。
- Channel extensions：DingTalk、Discord、Email、Feishu、Slack、Telegram、WeCom、Weixin、WhatsApp 均为 `0.2.18`，QQ 为 `0.2.17`。
- 全部 26 个版本 tags 已推送，registry 验证为 `26/26`，`nextclaw@latest` 为 `0.28.0`；GitHub Release 资产与 stable runtime public manifests 已验证。
