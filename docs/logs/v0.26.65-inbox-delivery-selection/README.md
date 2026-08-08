# v0.26.65 AI 收件箱投递选择修复

## 迭代完成说明

本轮修复 AI 已具备 `deliver_to_inbox` 工具、却仍容易把“整理新闻后发给我”误判为微信等外部渠道消息的问题。

根因不是收件箱存储、工具注册或工具执行失败，而是投递方式选择规则没有随新能力一起演进：

- `deliver_to_inbox` 已进入运行时工具目录，AI 可以看到并调用；
- 常驻 `Messaging` 上下文仍把“主动发送”主要引导到 `message`；
- 内置 `cross-channel-messaging` skill 只定义“当前回复 / 外部渠道消息”二选一，并写有不应引入独立通知系统的旧约束；
- 系统缺少“长期内容进收件箱、明确外部渠道才用 `message`”的统一决策规则。

上述结论通过工具 provider、上下文 provider、skill loader 和真实 NCP 会话的端到端链路逐层确认。修复直接更新原有投递选择 owner，没有新增平行 skill 或第二套投递抽象：

- 常驻上下文改为“当前回复 / 收件箱 / 明确外部渠道”三路选择；
- “发给我”“通知我”不再被视为微信或其他渠道的授权；
- 新闻简报、报告、推荐、文章等可稍后阅读的内容，在未指定外部渠道时优先 `deliver_to_inbox`；
- `message` 保留为明确跨会话、跨渠道目标和渠道动作的 owner；
- 工具描述与内置 skill 使用同一规则，避免提示层互相冲突；
- 删除常驻上下文中一条已被更精确规则覆盖的多渠道重复说明，控制非测试生产代码净增长。

## 测试/验证/验收方式

- Kernel 定向测试：`pnpm test -- src/contributions/context-provider/providers/context-provider-contract.provider.test.ts src/tools/inbox-delivery.tools.test.ts`
- Core 定向测试：`pnpm exec vitest run src/features/agent/features/tests/skills.test.ts`
- Service 严格 frontmatter 消费测试：`pnpm --filter @nextclaw/service exec vitest run src/services/marketplace/skills-query.service.test.ts`（3/3 通过）
- Kernel 类型检查：`pnpm tsc`
- Core 类型检查：`pnpm tsc`
- Kernel / Core package lint 与触达文件定向 ESLint
- 当前源码完整构建，并在 `http://127.0.0.1:18971` 启动隔离 `clone-config` 实例；验收完成后已停止该实例
- 真实 NCP 会话一：明确“稍后阅读、不要微信”，观察到 `deliver_to_inbox` tool-call start/result，收件箱落盘《今日 AI 新闻简报》
- 真实 NCP 会话二：只说“把新闻整理成简报，然后发给我”，未指定工具或渠道；观察到工具集合包含 `read_file`、`exec`、`deliver_to_inbox`，不包含 `message`，收件箱落盘《今日科技新闻简报｜2026年8月7日》
- 两条真实会话均使用 `native + minimax/MiniMax-M3`，最终状态为 `run.finished`

## 发布/部署方式

本轮源码改动随当前本地提交纳入版本历史；未执行推送、NPM 发布或线上部署。源码改动需要随下一次统一版本发布进入安装包；不涉及数据库 migration 或远程 API 部署。

已新增 `.changeset/inbox-delivery-selection.md`，`pnpm release:summary -- --json` 已确认可发现该条用户可见修复且无素材合同错误；本修复属于行为选择变化，没有能直接证明工具选择的独立视觉变化，因此不绑定截图。

本地真实功能验收使用独立 clone-config 运行态，不重启、不替换用户当前运行的 NextClaw 实例。完整构建触达了仓库现有 generated payload；由于工作树已包含用户未提交的 `packages/nextclaw/ui-dist` 改动，本轮不执行 `clean:generated`，避免覆盖或清理用户工作。

## 用户/产品视角的验收步骤

1. 在 NextClaw 中要求 AI 收集或整理一份新闻简报、报告、推荐或文章，并只说“发给我”，不要指定微信、飞书等渠道。
2. 等待任务完成，确认 AI 主动调用收件箱投递能力，而不是询问微信账号或调用 `message`。
3. 打开 AI 收件箱，确认出现对应标题、摘要和完整内容。
4. 再要求“发到我的微信”或明确指定其他聊天渠道，确认此时才进入 `message` 路由解析。
5. 普通即时问答仍应直接回复当前会话，不应把短回答都投递进收件箱。

## 可维护性总结汇总

- 复用了已有 `createMessagingContextProvider`、`DeliverToInboxTool` 和 `cross-channel-messaging` skill，没有新增 provider、manager、wrapper 或重复 skill。
- 投递选择从两个互相冲突的提示面收敛为一致的三路规则，owner 更明确，模型不再需要自行猜测“主动发送”含义。
- 删除一条被新规则覆盖的常驻提示；本任务投递选择生产语义净增长为零，当前触达范围的 guard 汇总为 `+8 / -9 / 净增 -1`。
- 定向测试分别锁定常驻上下文、工具描述和内置 skill 实际加载合同；真实模型冒烟覆盖最终选择行为。
- `post-edit-maintainability-guard --non-feature` 为 0 error；仅有 context provider 目录已记录豁免的历史文件数 warning，本次文件数未增长。
- 已使用 `post-edit-maintainability-review` 完成收尾复核；未新增文件角色、运行时分支或抽象层。

## NPM 包发布记录

- `@nextclaw/core@0.15.18`：内置投递 skill 变更，待统一发布。
- `@nextclaw/kernel@0.6.20`：常驻上下文与收件箱工具描述变更，待统一发布。
- `nextclaw@0.28.0`：直接依赖并打包上述能力，需要随同一发布批次升级，待统一发布。
- 本轮未执行 NPM 发布。
