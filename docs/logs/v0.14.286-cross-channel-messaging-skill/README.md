# 迭代完成说明

本次新增了 NextClaw 内置 AI skill：[cross-channel-messaging](../../../packages/nextclaw-core/src/agent/skills/cross-channel-messaging/SKILL.md)。

这个 skill 不是新的产品抽象，也不是 marketplace skill。它位于 `packages/nextclaw-core/src/agent/skills`，属于 NextClaw 源码内置 skill；运行时会由工作区初始化逻辑 seed 到工作区 `skills/`。它的作用是把现有消息原子能力整理成一套 AI 可执行的判断规则，让 AI 在需要“通知我”“发到另一个渠道”“干完活后主动发消息”这类场景时，知道应该优先选择普通回复、`sessions_send` 还是 `message`，并在 route、channel、chatId、accountId 不明确时停止猜测并补问。

# 测试/验证/验收方式

本次仅新增内置 skill 与迭代记录，未触达构建、类型检查或运行时代码，因此 `build`、`lint`、`tsc` 不适用。

建议最小验证方式：

- 检查 builtin skill 文件存在并可读取：`sed -n '1,220p' packages/nextclaw-core/src/agent/skills/cross-channel-messaging/SKILL.md`
- 检查迭代目录命名合法：`ls docs/logs | sort -V | tail`
- 人工审阅 skill 内容，确认包含三类原语选择：
  - 当前会话正常回复
  - `sessions_send`
  - `message`

# 发布/部署方式

该改动属于仓库内置 skill 内容更新，无独立部署动作。

若随产品版本一起发布，按项目既有发布流程发布包含该 builtin skill 的 NextClaw 版本即可；skill 本身不需要额外安装，也不需要新增 marketplace 发布流程。

# 用户/产品视角的验收步骤

1. 启动一个新的 NextClaw AI 会话。
2. 给 AI 一个任务，并明确提出“做完后通过微信通知我”或“把结果发到另一个渠道”。
3. 观察 AI 是否优先复用已有 session route；若缺少 route/account 信息，是否只追问最小必要字段，而不是瞎猜。
4. 当明确给出目标 session 或明确的 `channel + chatId + accountId` 后，观察 AI 是否使用现有消息能力完成发送，而不是把需求误解成当前会话内普通回复。
