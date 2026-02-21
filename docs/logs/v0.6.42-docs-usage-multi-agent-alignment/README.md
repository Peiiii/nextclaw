# v0.6.42-docs-usage-multi-agent-alignment

## 迭代完成说明（改了什么）

本次迭代聚焦“文档闭环”，补齐了多 Agent 路由能力的用户可用说明：

1. 补齐主使用文档（`docs/USAGE.md`）
- 新增 `Multi-agent routing & session isolation (OpenClaw-aligned)` 章节。
- 明确可配置项：`agents.list`、`bindings`、`session.dmScope`、`session.agentToAgent.maxPingPongTurns`。
- 给出完整 JSON 示例与 CLI `config set --json` 示例。
- 明确内部 AI 的可用能力：可通过 `gateway` 工具管理配置（在用户明确要求时执行）。
- 在 Discord/Telegram 配置示例中补齐 `accountId/dmPolicy/groupPolicy/groupAllowFrom/requireMention/mentionPatterns/groups`。

2. 同步模板文档
- 运行脚本将 `docs/USAGE.md` 同步到 `packages/nextclaw/templates/USAGE.md`，确保初始化模板一致。

3. 补齐缺失架构指南
- 新增 `docs/guides/multi-agent-architecture.md`，系统化描述单 Gateway、多 Agent、bindings、dmScope、mention gate、验收清单。
- 修复 README 中该文档链接“有链接无文件”的问题（通过新增文件落地）。

4. 标注历史报告上下文
- 在 `docs/guides/openclaw-alignment-gap-report.md` 增加说明：旧矩阵为历史基线，最新以 USAGE/架构指南为准。

## 测试 / 验证 / 验收方式

- 本次改动为文档与模板同步，不涉及运行时代码逻辑变更。
- 验证方式：
  - 检查 `docs/USAGE.md` 是否包含新章节与示例。
  - 检查 `packages/nextclaw/templates/USAGE.md` 是否已同步（含 generated header）。
  - 检查 `docs/guides/multi-agent-architecture.md` 可访问且内容完整。
  - 检查 README 链接目标文件是否存在。

### 用户/产品视角验收步骤

1. 打开 `docs/USAGE.md`，确认能直接找到并照抄使用“多 Agent 路由与会话隔离”的配置示例。
2. 让新用户按文档执行一次配置（UI 或 CLI 任一），确认无需口头补充即可理解核心字段含义。
3. 让团队成员阅读 `docs/guides/multi-agent-architecture.md`，确认能理解：
   - 为什么用单 Gateway；
   - 如何做 bindings 分诊；
   - 如何做 dmScope 会话隔离；
   - 如何做 mention gate。
4. 在 README 的 Docs 区点击架构文档链接，确认可正常打开且内容与当前能力一致。

## 发布 / 部署方式

- 本次为文档更新，无需单独 NPM 发布。
- 随代码合并后即生效。
