# Marketplace Skills Dual-Domain CLI Design

## 背景

当前 `NextClaw` 的 skill CLI 只覆盖：

- `nextclaw skills install <slug>`
- `nextclaw skills publish <dir>`
- `nextclaw skills update <dir>`

这导致 AI 在 self-management 场景下只能“已知 slug 后安装”，但无法通过正式 CLI 区分并查询：

1. 本地已经安装、当前可直接使用的 skill
2. marketplace 中尚未安装、仅可发现和比较的 skill

这与产品愿景里的“自感知 + 自治”存在直接缺口。AI 若不能稳定回答“我现在有什么”与“外面还有什么”，就无法可靠地自管理 skill 生态。

## 问题定义

这里有两个不同领域，必须在命令模型里显式拆开：

- 已安装域：回答“当前实例已经具备哪些 skill”
- Marketplace 域：回答“远端目录里有哪些 skill 值得发现、查看、推荐、安装”

如果继续复用模糊的 `nextclaw skills list`，AI 和用户都会混淆“本地状态”与“远端目录”。因此本次不做模糊聚合，而是采用双域模型。

## 方案比较

### 方案 A：继续扩展 `nextclaw skills *`

示例：

- `nextclaw skills list`
- `nextclaw skills search`
- `nextclaw skills info`

优点：

- 入口少
- 改动直觉上最小

缺点：

- `skills` 既可能表示本地，也可能表示 marketplace，语义会持续漂移
- AI 难以仅凭命令名判断域边界

### 方案 B：双域模型

示例：

- `nextclaw skills installed`
- `nextclaw skills info <selector>`
- `nextclaw marketplace skills search`
- `nextclaw marketplace skills info <slug>`
- `nextclaw marketplace skills recommend`
- `nextclaw marketplace skills install <slug>`

优点：

- 本地状态与远端目录边界清晰
- AI 自管理时可直接映射为“先看 installed，再看 marketplace”
- 后续可平滑扩展到 `plugins` / `mcp`

缺点：

- 命令面稍多

### 结论

采用方案 B，并保留现有 `nextclaw skills install <slug>` 作为兼容入口，但在文档与 self-management guide 中把 `nextclaw marketplace skills install <slug>` 设为更清晰的推荐路径。

## 命令设计

### 已安装域

- `nextclaw skills installed [--workdir <dir>] [--scope <all|builtin|project|workspace>] [--query <text>] [--json]`
- `nextclaw skills info <selector> [--workdir <dir>] [--json]`

说明：

- `installed` 只看本地已解析到的 skill
- `info` 默认读取本地 skill 详情，支持按 `name` 或 `ref` 查找

### Marketplace 域

- `nextclaw marketplace skills search [--query <text>] [--tag <tag>] [--sort <relevance|updated>] [--page <n>] [--page-size <n>] [--api-base <url>] [--json]`
- `nextclaw marketplace skills info <slug> [--api-base <url>] [--json]`
- `nextclaw marketplace skills recommend [--scene <scene>] [--limit <n>] [--api-base <url>] [--json]`
- `nextclaw marketplace skills install <slug> [--api-base <url>] [--workdir <dir>] [--dir <dir>] [--force]`

说明：

- `search` 只走远端 marketplace catalog
- `info` 组合远端 item metadata 与 content
- `recommend` 返回远端推荐视图
- `install` 语义上属于 marketplace 域，但内部复用现有安装实现

## 数据契约

### 已安装域 JSON

`installed` 返回：

- `workspace`
- `total`
- `skills[]`

单项至少包含：

- `ref`
- `name`
- `path`
- `scope`
- `source`
- `summary`
- `description`
- `tags`
- `always`

`info` 在此基础上增加：

- `raw`
- `bodyRaw`
- `metadata`

### Marketplace 域 JSON

- `search` 返回 marketplace list 结果，并补 `apiBaseUrl`
- `info` 返回：
  - `apiBaseUrl`
  - `item`
  - `content`
- `recommend` 返回 recommendation 结果，并补 `apiBaseUrl`

## 实现边界

本次只补齐 **skill** 的双域 CLI，不顺手把 `plugin` / `mcp` 一起抽成总框架，避免一次性扩 scope。

本次必须同步更新：

- CLI 命令注册
- CLI 自管理运行时入口
- `docs/USAGE.md`
- `packages/nextclaw/resources/USAGE.md`
- `packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md`
- 相关测试

## 验证

最小充分验证包含：

1. 单元测试：
   - 本地 installed / info
   - marketplace search / info / recommend
2. CLI 冒烟：
   - `nextclaw skills installed --json`
   - `nextclaw marketplace skills search --json`
3. 治理校验：
   - `pnpm lint:maintainability:guard`
   - 受影响包测试 / lint / tsc 最小集

## 长期演进

若后续验证该双域模型稳定，可继续把同一模式扩展到：

- `nextclaw marketplace plugins *`
- `nextclaw marketplace mcp *`

届时 `marketplace` 可作为统一远端生态入口，而 `skills / plugins / mcp` 各自保留本地已安装与运行态管理入口。
