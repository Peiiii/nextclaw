# Skills 教程

Skills 用于给 AI 增加特定任务规则或工作方式。它适合在你已经跑通基本对话后使用。

## 什么时候使用

- 你希望某类任务遵循固定格式
- 你希望 AI 在特定场景下加载额外说明
- 你想复用一套工作方法，而不是每次重新提示

## 基本流程

1. 先完成普通对话。
2. 安装或启用一个 skill。
3. 在相关任务中选择它。
4. 对比启用前后的输出差异。

## Skill 来源

- 项目技能：`<project>/.agents/skills/`
- NextClaw 技能：`<workspace>/skills/`
- 全局 Agent Skill：`~/.agents/skills/`
- 内建技能：随 NextClaw 提供

技能选择器会按来源分组展示。会话绑定项目后，项目自己的 `AGENTS.md` 也会作为项目指令加载。

## 注意

Skill 不是第一次跑通的必要条件。  
先确认模型和会话可用，再引入 skill。

## 相关文档

- [对话与会话](/zh/guide/chat)
- [命令索引](/zh/guide/commands)
