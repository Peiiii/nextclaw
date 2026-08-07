# NextClaw 0.28.1 稳定版发布

## 迭代完成说明

- 本次迭代负责把已提交的用户可见 changeset 聚合为新的稳定 NPM patch 版本。
- 主要用户结果是全新安装可以直接使用 OpenCode Zen 免费试用模型，无需先填写 API Key；同时纳入聊天输入、侧栏导航、活动预览和并发消息显示改进。
- 发布从提交 `43b0e1d0727adb6c51bf56f9d3407cbf2091b3e5` 创建隔离 worktree，主工作区中的未提交改动不进入发布。

## 测试/验证/验收方式

- 已完成 Changesets 版本化；统一依赖闭包为 29 个公开 NPM 包，顶层版本为 `nextclaw@0.28.1`。
- `pnpm release:check:strict -- --reset` 已通过。严格门禁首次运行发现根级 build/lint/tsc 聚合漏掉 `@nextclaw/ncp-agent-runtime-next`，已补回唯一根级校验链路并重新通过。
- `CI=1 pnpm -r --workspace-concurrency=4 --no-bail --if-present test` 已通过，覆盖 36 个带测试的 workspace；其中 Kernel 为 51 个文件 / 242 个测试，UI 为 188 个文件 / 864 个测试，Service 为 48 个文件 / 174 个测试，NextClaw 包为 4 个文件 / 8 个测试。
- Aigen、Agent Chat UI、HTTP runtime client、MCP、OpenCode NARP、Service、Kernel、UI 八个本次触达关键包的 TypeScript 与 lint 已通过；仅保留历史 warning，没有 error。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、post-edit maintainability guard 和 `git diff --check` 已通过。maintainability guard 为 0 error；剩余 warning 均为既有大文件或接近预算提示。
- 完成发布准备后还将执行 package tarball 内容验证、registry 查询与独立临时目录真实安装检查。
- 发布后验证 NPM registry 版本与 `latest` dist-tag，并从隔离目录安装 `nextclaw@0.28.1` 验证 CLI、默认配置和无密钥聊天路径。
- stable runtime channel 验证包含 check、download、apply、新进程版本与公开 manifest。

## 发布/部署方式

- 使用仓库统一 Changesets 发布流程，不从包目录直接执行 raw `npm publish`。
- NPM 发布后推送审计过的 source commit、package tags，并创建 GitHub Release。
- 通过仓库 stable runtime update owner 发布签名更新包；本批不涉及数据库 migration、后端部署或 Desktop 安装包发布。

## 用户/产品视角的验收步骤

1. 在隔离目录安装 `nextclaw@latest`。
2. 使用新的 `NEXTCLAW_HOME` 启动 NextClaw。
3. 确认默认模型为 `opencode/big-pickle`，OpenCode Zen 显示为就绪且无需 API Key。
4. 直接发送消息并收到回复。
5. 从旧稳定版执行 `nextclaw update --check`、download 和 apply，确认切换到 `0.28.1`。

## 可维护性总结汇总

- 本次发布收尾没有新增产品运行链路或平行发布入口；根级 build/lint/tsc 继续作为 workspace 验证的唯一 owner，仅补齐此前漏检的 NCP agent runtime 包。
- HTTP runtime 定向测试从包根移动到允许的 `src/services/` 角色目录，并通过包公共入口自引用验证发布合同；该 package 继续维持单一 L1 feature root，没有新增 feature 层、barrel 或 shared 目录。
- stale 测试已按当前公开合同更新：覆盖消息回复格式、raw activity tool name、inbox session、messaging provider、QueryClient、`createSession` 对象参数、侧栏与 i18n 文案等真实行为，不通过放宽生产合同掩盖失败。
- cron dev 测试曾通过公开 OpenCode Zen 网关观察到无密钥任务成功；日常测试随后收敛到本地 OpenAI-compatible mock server，避免把公共网络波动引入常规测试门禁。发布后仍单独执行真实公共网关 fresh-install 冒烟。
- 功能源码的 owner、删减结果与维护性检查记录继续以 `docs/logs/v0.26.47-opencode-zen-free-models/README.md` 为准。
- 当前 diff 统计为新增 811 行、删除 651 行；非测试文件新增 241 行、删除 234 行，净增 7 行来自明确的 workspace 校验链路和发布元数据。作为包含开箱即用免费模型的新增用户能力，本次不适用“非功能改动净增必须小于等于 0”的门槛；正向减债包括补齐漏检包、移除包根测试违例、将侧栏测试从 899 行降至 893 行。
- 发布收尾继续执行生成物、package artifact、registry、branch closure 与两个 worktree 状态检查。

## NPM 包发布记录

- 目标顶层版本：`nextclaw@0.28.1`，dist-tag 为 `latest`。
- Changesets 计算出 29 个公开 NPM 包的 patch 依赖闭包：`nextclaw@0.28.1`、`@nextclaw/core@0.15.19`、`@nextclaw/kernel@0.6.21`、`@nextclaw/runtime@0.4.19`、`@nextclaw/server@0.15.21`、`@nextclaw/service@0.3.21`、`@nextclaw/ui@0.15.22`、`@nextclaw/shared@0.4.18`、`@nextclaw/agent-chat-ui@0.6.20`、`@nextclaw/ncp-toolkit@0.6.17`、`@nextclaw/ncp-react@0.5.19`、`@nextclaw/ncp-mcp@0.2.19`、`@nextclaw/client-sdk@0.5.21`、`@nextclaw/extension-sdk@0.3.18`、`@nextclaw/mcp@0.3.19`、`@nextclaw/remote@0.3.21`、`@nextclaw/companion@0.2.21`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.20`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.20`、DingTalk/Discord/Email/Feishu/Slack/Telegram/WeCom/Weixin/WhatsApp channel extension `0.2.19`，以及 QQ channel extension `0.2.18`。
- `@nextclaw/desktop@0.0.238` 仅随依赖传播更新私有 workspace 元数据，不发布到 NPM，也不代表本次发布 Desktop 安装包。
- 当前状态：版本化、全量测试、关键包 TypeScript/lint、governance 与可维护性门禁已完成；待最终发布门禁、NPM 发布与 registry / fresh-install 验证。
- stable runtime update channel、GitHub Release、公开 manifest 与产品更新笔记 URL 均属于本次发布闭环。
