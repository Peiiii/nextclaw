# Claude Code / Codex / Hermes 集成

这页解决一个很具体的问题：

**你已经装好 NextClaw，想把 `Claude Code`、`Codex` 或 `Hermes` 接进来，到底该怎么选、怎么在界面里启用、怎么确认真的可用。**

## 先看结论

- 想要 `Claude Code` 风格工作流：去 `Marketplace -> Plugins` 安装 `NextClaw Claude NCP Runtime`
- 想要 `Codex` 风格工作流：去 `Marketplace -> Plugins` 安装 `NextClaw Codex NCP Runtime`
- 想要 `Hermes`：去 `Marketplace -> Skills` 安装 `Hermes Runtime`，然后在聊天里使用这个 skill

## 30 秒选型

| 集成 | 更适合谁 | 在 NextClaw 里的形态 | 难度 |
| --- | --- | --- | --- |
| Claude Code | 想用 Claude 风格 agent/runtime 的用户 | 新增 `Claude` 会话类型 | 中 |
| Codex | 想用 Codex 风格 coding/runtime 的用户 | 新增 `Codex` 会话类型 | 中 |
| Hermes | 想让 NextClaw 帮你接入 Hermes 的用户 | 通过 skill 引导接入与验证 | 中 |

## 共同前置

无论你接哪一种，建议都先做这 2 步：

1. 打开 NextClaw UI
2. 在 `Providers` 里先配好一个可用 provider，并至少测试通过一次

建议原因很简单：

- `Claude` 和 `Codex` 默认都可以复用 NextClaw 当前 provider / model
- `Hermes` 在 NextClaw 里也会尽量沿用统一的 provider / model 路线，而不是让你维护第二套配置

如果你还没走完这一步，先看：

- [安装后第一步：先选接入方式（Qwen Portal 或 API Key）](/zh/guide/tutorials/provider-options)

## 路线 A：接入 Claude Code

这是最适合“我想在 NextClaw 里使用 Claude 风格会话类型，而且全程尽量不碰命令行”的路径。

### 怎么装

优先推荐 UI：

1. 打开 `Marketplace -> Plugins`
2. 搜索 `Claude`
3. 安装 `NextClaw Claude NCP Runtime`
4. 安装后确认插件处于启用状态

### 怎么用

1. 打开聊天或新建会话
2. 在会话类型里确认已经出现 `Claude`
3. 选择一个当前可用的 Claude-compatible 模型
4. 发送一条最小验证消息：

```text
请只回复：CLAUDE-OK
```

### 通过标准

满足下面 3 条即可视为成功：

- 会话类型里能看到 `Claude`
- 该类型处于可用状态，而不是长期 `not ready`
- 返回 `CLAUDE-OK` 或语义等价的简短回复

### 如果没通过，优先看什么

- 看不到 `Claude`：通常是插件还没安装或没启用
- 看得到但不可用：通常是当前 provider / model 还没走通 Claude-compatible 路线
- 普通用户先不要碰高级配置，先把当前 provider 测试通过，再回来重试

## 路线 B：接入 Codex

这是最适合“我想在 NextClaw 里使用 Codex 风格 coding/runtime，而且全程尽量不碰命令行”的路径。

### 怎么装

优先推荐 UI：

1. 打开 `Marketplace -> Plugins`
2. 搜索 `Codex`
3. 安装 `NextClaw Codex NCP Runtime`
4. 安装后确认插件处于启用状态

### 怎么用

1. 打开聊天或新建会话
2. 在会话类型里确认已经出现 `Codex`
3. 选择一个当前可用模型
4. 先做一次最小验证：

```text
请只回复：CODEX-OK
```

如果这一步通过，再去验证更符合你场景的任务，例如代码解释、目录梳理、文件修改建议等。

### 通过标准

- 会话类型里能看到 `Codex`
- 能正常开始一次对话
- 返回 `CODEX-OK` 或语义等价的简短回复

### 普通用户建议

第一次接入 `Codex` 时，先不要改高级选项。

先做到这件事就够了：

- 插件装好
- `Codex` 会话类型出现
- 能回出一条最小验证消息

## 路线 C：接入 Hermes

`Hermes` 这条路，面向普通用户时不应该让你自己写 runtime 配置。

正确思路是：

- 通过 `Marketplace -> Skills` 安装 `Hermes Runtime`
- 回到聊天页，在输入框下方点 `Skills`
- 勾选 `Hermes Runtime`
- 直接让 NextClaw 帮你做 Hermes 接入和验证

### 怎么装

1. 打开 `Marketplace -> Skills`
2. 搜索 `Hermes Runtime`
3. 点击 `Install`

### 怎么用

1. 回到聊天页
2. 点击输入框下方的 `Skills`
3. 勾选 `Hermes Runtime`
4. 发送类似下面的请求：

```text
帮我接入 Hermes，并检查是否已经可以正常使用。
```

### 通过标准

- skill 能正常被选中
- NextClaw 能开始帮你执行 Hermes 接入流程
- 如果环境已经满足，最终能完成一次真实可见的 Hermes 验证
- 如果环境还没满足，也应该直接告诉你缺了什么，而不是要求你自己去手写 runtime 配置

## 推荐的验收顺序

第一次接入这三条线时，建议统一按这个顺序做：

1. 先确认 provider 测试通过
2. 再通过 UI 安装对应插件或 skill
3. 再做一次最小验证
4. 最后再开始跑真实任务

这样排错会快很多，因为你能立刻知道问题出在：

- provider
- 插件 / skill 是否安装成功
- 还是具体任务本身

## 相关文档

- [模型选型](/zh/guide/model-selection)
- [Skills 教程](/zh/guide/tutorials/skills)
- [教程总览](/zh/guide/tutorials)
