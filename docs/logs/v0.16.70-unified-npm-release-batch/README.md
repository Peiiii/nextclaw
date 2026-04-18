# v0.16.70-unified-npm-release-batch

## 迭代完成说明（改了什么）

- 本次完成了一轮新的统一 NPM 发布批次，把 `2026-04-17` 上一次统一发版之后继续合入、但尚未进入 npm registry 的公开包漂移统一收口。
- 实际完成发布并通过 registry 校验的公开包共 `37` 个，主链包版本推进为：
  - `nextclaw@0.18.1`
  - `@nextclaw/ui@0.12.10`
  - `@nextclaw/core@0.12.9`
  - `@nextclaw/server@0.12.9`
- 本次也把此前在历史迭代中明确标记为“待统一发布”的 CLI 能力一起正式带出：
  - [`v0.16.67-linux-cli-systemd-autostart`](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.67-linux-cli-systemd-autostart/README.md) 中记录的 Linux systemd 自启动命令
  - [`v0.16.69-cli-host-autostart-cross-platform`](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.69-cli-host-autostart-cross-platform/README.md) 中记录的跨平台宿主自启动能力
- 发布过程中首轮 `pnpm release:publish` 曾被一个真实的类型错误阻塞：
  - 根因：[`packages/nextclaw/src/cli/commands/ncp/ui-ncp-runtime-entry-resolver.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/ui-ncp-runtime-entry-resolver.ts) 中 `resolveBuiltinRuntimePresentation()` 用宽泛 `string` 去索引 `BUILTIN_RUNTIME_PRESENTATION` 字面量对象，在 `nextclaw` 的严格 `tsc` 中触发 `TS7053`
  - 根因确认方式：第一次正式执行 `pnpm release:publish` 时，发布链在 `nextclaw tsc` 阶段稳定复现该错误，报错位置直接落在上述文件第 `57` 行附近
  - 本次修复为何命中根因：修复不是绕过 `tsc`、放宽编译配置或加 `any`，而是增加 `BuiltinRuntimePresentationKey` 并在索引前做 `in` 守卫，把“索引 key 过宽”这个根因在源头收窄，因此既保留原行为，又消除了发布阻塞
- `changeset publish` 对两类包做了预期内跳过：
  - `@nextclaw/agent-chat@0.1.10`
  - `@nextclaw/feishu-core@0.2.6`
  - 原因：这两个包当前版本已在线上存在，本轮没有新版本需要发布

## 测试/验证/验收方式

- 已执行自动发布批次生成：
  - `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:auto:prepare`
  - 结果：成功生成本轮 release changeset
- 已执行版本推进：
  - `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:version`
  - 结果：成功更新目标包版本、内部依赖与 `CHANGELOG.md`
- 首轮统一发布失败复现：
  - `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
  - 结果：在 `nextclaw tsc` 阶段稳定命中 `TS7053`
- 根因修复后的定向验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - 结果：通过
- 重新执行统一发布：
  - `npm_config_cache=$(mktemp -d /tmp/nextclaw-npm-cache.XXXXXX) PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
  - 结果：`changeset publish` 成功发布 `37` 个公开包，`release:verify:published` 输出 `published 37/37 package versions`
- 线上版本抽样核验：
  - `npm view nextclaw version` -> `0.18.1`
  - `npm view @nextclaw/ui version` -> `0.12.10`
  - `npm view @nextclaw/core version` -> `0.12.9`
  - `npm view @nextclaw/server version` -> `0.12.9`

## 发布/部署方式

- 本次交付属于 NPM 统一发版闭环，不涉及数据库 migration，也不涉及 Cloudflare Pages / Worker / 桌面安装包的单独部署
- 本次实际使用的发布顺序：
  1. `pnpm release:auto:prepare`
  2. `pnpm release:version`
  3. 首轮 `pnpm release:publish` 暴露真实 `tsc` 阻塞
  4. 修复 `ui-ncp-runtime-entry-resolver.ts` 类型边界
  5. `pnpm -C packages/nextclaw tsc`
  6. 重新执行 `pnpm release:publish`
- 当前状态：
  - npm 发布：已完成
  - registry 校验：已完成
  - git tags：已完成
  - release commit：待本次收尾提交

## 用户/产品视角的验收步骤

1. 执行 `npm view nextclaw version`，确认线上版本为 `0.18.1`
2. 执行 `npm view @nextclaw/ui version`、`npm view @nextclaw/core version`、`npm view @nextclaw/server version`，确认分别为 `0.12.10`、`0.12.9`、`0.12.9`
3. 在一个非仓库临时目录执行 `npm exec nextclaw@0.18.1 -- --help`，确认 CLI 可以正常拉取并启动
4. 安装或升级到 `nextclaw@0.18.1` 后执行 `nextclaw service autostart --help`，确认本轮统一发布带出的宿主自启动命令已经对外可用
5. 如业务侧依赖 NCP / runtime / channel 包，升级到本轮新版本后执行各自最小集成验证，确认 registry 已可解析对应版本

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次为发包解阻只做了一处最小必要类型收窄，没有增加新的发布脚本、兼容分支或临时绕过逻辑
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：未做到净删除，但本次净增长主要来自版本号、`CHANGELOG.md` 与 `ui-dist`/桌面更新元数据同步，不是新增业务主干复杂度
- 代码增减报告：
  - 新增：2286 行
  - 删除：607 行
  - 净增：+1679 行
- 非测试代码增减报告：
  - 新增：2257 行
  - 删除：607 行
  - 净增：+1650 行
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。真正新增的逻辑修复只收敛在 `ui-ncp-runtime-entry-resolver.ts` 一处类型边界，没有把发布阻塞外溢成新的 helper 层或绕过开关
- 目录结构与文件组织是否满足当前项目治理要求：是。本次新增留痕仅落在 [`docs/logs/v0.16.70-unified-npm-release-batch/README.md`](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.70-unified-npm-release-batch/README.md)，其它变化集中在既有包目录的版本与 changelog 收口
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。本次按独立复核判断，发布阻塞修复没有新增可见的维护性问题
- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 可维护性总结：
  - no maintainability findings
  - 这次发布批次的代码增长几乎全部来自 release 元数据同步；真正为解阻新增的功能逻辑只有一处类型收窄，已经达到最小必要修复点
  - 保留债务主要还是公开包统一发版天然带来的 changelog / 版本文件膨胀，以及 `nextclaw` 自带 `ui-dist` 刷新造成的大量产物 diff；下一步值得继续治理的是如何进一步压缩发布元信息体积，而不是在功能代码层再补额外抽象
- 长期目标对齐 / 可维护性推进：本次顺着“让 NextClaw 作为统一入口的可分发状态与仓库真实状态保持一致、更少 surprise failure”的方向推进了一小步。它没有新增一套发布体系，而是继续复用仓库既有统一发布主链，并把一次真实 `tsc` 阻塞收口成清晰、可预测的类型边界修复

## NPM 包发布记录

- 本次是否需要发包：需要
- 需要发布的包及当前状态：
  - `@nextclaw/agent-chat-ui`：已发布 `0.3.7`
  - `@nextclaw/channel-plugin-dingtalk`：已发布 `0.2.40`
  - `@nextclaw/channel-plugin-discord`：已发布 `0.2.40`
  - `@nextclaw/channel-plugin-email`：已发布 `0.2.40`
  - `@nextclaw/channel-plugin-feishu`：已发布 `0.2.26`
  - `@nextclaw/channel-plugin-mochat`：已发布 `0.2.40`
  - `@nextclaw/channel-plugin-qq`：已发布 `0.2.40`
  - `@nextclaw/channel-plugin-slack`：已发布 `0.2.40`
  - `@nextclaw/channel-plugin-telegram`：已发布 `0.2.40`
  - `@nextclaw/channel-plugin-wecom`：已发布 `0.2.40`
  - `@nextclaw/channel-plugin-weixin`：已发布 `0.1.34`
  - `@nextclaw/channel-plugin-whatsapp`：已发布 `0.2.40`
  - `@nextclaw/channel-runtime`：已发布 `0.4.26`
  - `@nextclaw/core`：已发布 `0.12.9`
  - `@nextclaw/mcp`：已发布 `0.1.74`
  - `@nextclaw/ncp`：已发布 `0.5.3`
  - `@nextclaw/ncp-agent-runtime`：已发布 `0.3.13`
  - `@nextclaw/ncp-http-agent-client`：已发布 `0.3.15`
  - `@nextclaw/ncp-http-agent-server`：已发布 `0.3.15`
  - `@nextclaw/ncp-mcp`：已发布 `0.1.76`
  - `@nextclaw/ncp-react`：已发布 `0.4.23`
  - `@nextclaw/ncp-react-ui`：已发布 `0.2.15`
  - `@nextclaw/ncp-toolkit`：已发布 `0.5.8`
  - `@nextclaw/nextclaw-hermes-acp-bridge`：已发布 `0.1.2`
  - `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http`：已发布 `0.1.2`
  - `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`：已发布 `0.1.23`
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：已发布 `0.1.20`
  - `@nextclaw/nextclaw-ncp-runtime-http-client`：已发布 `0.1.2`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`：已发布 `0.1.53`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`：已发布 `0.1.53`
  - `@nextclaw/nextclaw-ncp-runtime-stdio-client`：已发布 `0.1.3`
  - `@nextclaw/openclaw-compat`：已发布 `1.0.9`
  - `@nextclaw/remote`：已发布 `0.1.86`
  - `@nextclaw/runtime`：已发布 `0.2.41`
  - `@nextclaw/server`：已发布 `0.12.9`
  - `@nextclaw/ui`：已发布 `0.12.10`
  - `nextclaw`：已发布 `0.18.1`
- 本次无需发布、且被 `changeset publish` 正常跳过的包：
  - `@nextclaw/agent-chat`：当前版本 `0.1.10` 已在线上，无新版本
  - `@nextclaw/feishu-core`：当前版本 `0.2.6` 已在线上，无新版本
- 未发布原因：不适用，本次目标包均已发布完成
- 后续补发/统一发布说明：不适用，本批次已完成统一发布闭环
- 当前已知阻塞或触发条件：无
