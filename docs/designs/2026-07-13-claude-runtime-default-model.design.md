# Claude Code Runtime default 模型设计

## 背景

Claude Code 会话当前只展示 NextClaw 已配置模型，Codex 会话则同时提供 `Runtime default`。通用 UI、runtime registry 和 NARP stdio 已支持该选项，Claude runtime entry 未声明能力，且 Claude wrapper 原有配置隔离会阻止直接复用 Claude Code 自身默认配置。

## 现状依据

- `modelSelectionMode=optional` 会让通用会话模型列表同时展示 `Runtime default` 和 NextClaw 模型。
- Runtime-default sentinel 在 NARP client 中会被转换为“无 providerRoute、无 modelId”。
- Claude 显式模型路径通过隔离 `CLAUDE_CONFIG_DIR` 保证 NextClaw provider/model 不被用户全局 Claude 配置覆盖。
- Claude Code CLI 在不传 `model` 时可以使用自己的配置、鉴权与默认模型。

## 核心判断

`Runtime default` 不是 NextClaw 默认模型的别名，而是把模型和鉴权 owner 明确交还 Claude Code。显式选择 NextClaw 模型时，原有 provider route 和配置隔离合同必须保持不变。

## 推荐方案

1. Claude runtime entry 声明 `modelSelectionMode: optional`。
2. Claude NARP wrapper 将“无 providerRoute、无 modelId”识别为用户显式选择 Runtime default。
3. Runtime-default 路径不注入 NextClaw route credential/model、不强制覆盖 `CLAUDE_CONFIG_DIR`，并显式启用 Claude Agent SDK 的 user/project/local setting sources；Claude Code 使用自身运行环境。
4. 显式模型路径继续注入 NextClaw provider route 并使用隔离配置目录。

两条语义由用户选择决定，不允许在请求失败后自动切换，避免鉴权和模型来源不可预测。

## Owner 与数据流

- runtime entry：声明产品可选能力。
- 通用 kernel/UI/NARP client：继续只处理 `optional` 和 sentinel，不感知 Claude。
- Claude NARP wrapper：根据 NARP 上下文选择配置 owner。
- Claude SDK runtime：按 owner 决策构造 Claude Code 执行环境。

## 目录组织

不新增 service、adapter 或 provider 分支。实现只修改现有 Claude wrapper、SDK runtime 类型/环境构造及其定向测试；接入规范更新现有 `claude-code-narp-runtime` skill。

## 兼容与迁移

现有未声明 `modelSelectionMode` 的 entry 保持原行为。安装或修复 skill 会把 Claude entry 更新为 `optional`。显式 NextClaw 模型路径没有行为变化。

## 验收标准

- session-types API 对 Claude 返回 `modelSelectionMode: optional`。
- 模型列表同时包含 `Runtime default` 与 NextClaw 模型。
- Runtime-default 会话返回固定文本 marker，并证明没有 providerRoute/modelId。
- 显式 NextClaw 模型会话仍返回固定文本 marker。
- 两个 Claude runtime package 的测试、tsc、lint 和 build 通过。

## 非目标

- 不改变通用 NARP 协议或 UI 组件。
- 不把任意 provider 自动视为 Claude-compatible。
- 不在失败后从 Runtime default 自动回退到 NextClaw 模型，或反向切换。
