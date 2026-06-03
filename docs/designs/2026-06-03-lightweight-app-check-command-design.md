# 2026-06-03 轻量应用自检命令方案

## 背景

NextClaw 的 Panel App 和 Service App 是轻量生态扩展能力。它们的价值在于让用户和 AI 以很低成本创建可抛弃、可维护的小应用。但当前 AI 创建应用后，常见错误只有在用户打开或调用时才暴露，例如：

- `panel-app.json` 或 `service-app.json` JSON 格式错误；
- Panel App 忘记声明 `agent:generateObject` 或 Service Action allowlist；
- Service App action key、Panel App action id 写错；
- 入口 HTML、CSS、JS 或图标资源路径不存在；
- Service App command 指向的脚本不存在或语法错误；
- 旧的 HTML meta manifest 与目录式 `panel-app.json` 混用。

这会让“AI 帮你创建应用”变成“AI 创建一堆需要用户试错的半成品”。这不符合 NextClaw 的产品愿景：个人操作层必须具备基本自感知和可交付可靠性，而不是把失败留给用户发现。

## 目标

第一版目标是提供一个轻量、解耦、快速的开发自检工具，让 AI 在创建或修改应用后能立刻知道“这个应用是否至少满足可加载、可声明、可调用的基础合同”。

命令形态：

```bash
nextclaw app check <app-dir>
nextclaw app check <app-dir> --json
```

成功标准：

- 能检查目录式 Panel App 和 Service App；
- 能覆盖最常见、最容易由 AI 写错的静态合同；
- 失败时返回非零退出码；
- 输出可读诊断和 `--json` 机器可读诊断；
- 内置 app creator skill 必须要求 AI 在交付前运行该命令。

## 非目标

第一版明确不做：

- 不新增 kernel manager；
- 不新增 server API；
- 不管理应用健康状态；
- 不在应用列表里自动刷新状态；
- 不启动完整 NextClaw 运行时；
- 不自动调用用户 Service Action；
- 不做持续 watcher；
- 不做自动修复。

这是一次性诊断工具，不是运行时 owner。

## 方案对比

### 方案 A：只增强 skill checklist

优点是零代码成本。缺点是 AI 仍然容易漏检查，也没有机器可验证信号。单独使用不可靠。

### 方案 B：CLI 静态自检命令

在 `nextclaw` CLI 中增加 `app check <app-dir>`，直接读取目标目录并检查 manifest、入口和资源路径。

优点：

- 轻量；
- 不依赖 kernel / server；
- 可以被 AI、用户、CI 和未来 marketplace 发布流程复用；
- 能用非零退出码形成交付门禁。

缺点：

- 第一版不能证明 Service App 真实 MCP handshake 成功；
- 不能证明 Panel App 的运行时交互一定正确。

### 方案 C：CLI 可选运行时检查

未来在方案 B 基础上增加 `--runtime`，在 NextClaw 正在运行时调用现有 API 验证 panel content、assets 和 service action discovery。

优点是更贴近真实链路。缺点是依赖本地服务状态，第一版会变重。

### 推荐

先落地 **方案 B**，并为未来保留 `--runtime` 的扩展位置。第一版只做静态和轻量语法检查，解决最高频失败点。

## 检查范围

### 通用检查

- 目标路径存在；
- 目标路径是目录；
- 目录中必须存在 `panel-app.json` 或 `service-app.json`；
- 同一目录同时包含两个 manifest 时提示错误，避免概念混合。

### Panel App 检查

- 目录名必须以 `.panel` 结尾；
- `panel-app.json` 必须是合法 JSON object；
- `id` 若存在，必须是 kebab-case，并等于目录名去掉 `.panel`；
- `title` 必填；
- `entry` 必填，必须指向目录内存在的 HTML 文件；
- `description` 和 `icon` 缺失给 warning；
- `icon` 若是相对路径，必须存在；
- `capabilities` 必须是字符串数组，且只允许 `agent:send`、`agent:generateObject`；
- 常见错误 `agent.send`、`agent.generateObject` 给明确修复建议；
- `actions` 必须是字符串数组，每个 action id 使用 `<service-app-id>.<tool-name>`；
- 若能从 workspace 推断到 sibling `service-apps/`，检查 declared action 是否存在于对应 `service-app.json.actions`；
- 入口 HTML 不能再使用 `nextclaw-panel-actions` 或 `nextclaw-panel-capabilities` meta；
- 入口 HTML 中的相对 CSS、JS、图片资源必须存在；
- 若代码中出现 `window.nextclaw.agent.generateObject` / `send`，manifest 必须声明对应 capability；
- 若代码中出现 `serviceActions.invoke("...")`，manifest 必须声明对应 action。

### Service App 检查

- `service-app.json` 必须是合法 JSON object；
- `id` 必填，必须是 kebab-case，并等于目录名；
- `title` 必填；
- `protocol` 缺省视为 `mcp`，显式值只能是 `mcp`；
- `command` 必填；
- `args` 必须是字符串数组；
- 如果 `command` 是 `node`，第一个非 option arg 指向的脚本必须存在；
- Node 脚本使用 `node --check` 做语法检查，不启动服务；
- `actions` 必须是非空 object；
- 每个 action 必须声明 `risk`，可用值为 `read`、`write`、`external`、`dangerous`；
- action key 不应重复包含 service id 前缀，例如 `workspace-files.workspace-files.list`。

## 输出模型

诊断项使用统一结构：

```ts
type AppCheckSeverity = "error" | "warning";

type AppCheckIssue = {
  severity: AppCheckSeverity;
  code: string;
  message: string;
  fixHint?: string;
};
```

`--json` 输出：

```json
{
  "ok": false,
  "kind": "panel",
  "target": "/path/to/app",
  "issues": [
    {
      "severity": "error",
      "code": "panel.capability.invalid",
      "message": "Invalid capability: agent.generateObject",
      "fixHint": "Use agent:generateObject in panel-app.json capabilities."
    }
  ]
}
```

人类可读输出：

```text
NextClaw app check failed: /path/to/app

Errors:
- [panel.capability.invalid] Invalid capability: agent.generateObject
  Fix: Use agent:generateObject in panel-app.json capabilities.

Warnings:
- [panel.icon.missing] panel-app.json icon is recommended.
```

## 代码落点

- `packages/nextclaw/src/cli/app/controllers/app-check-command.controller.ts`
  - CLI 参数、输出格式和退出码 owner。
- `packages/nextclaw/src/cli/app/services/app-check.service.ts`
  - 一次性 App 检查总流程 owner。
- `packages/nextclaw/src/cli/app/services/panel-app-check.service.ts`
  - Panel App 静态合同检查 owner。
- `packages/nextclaw/src/cli/app/services/service-app-check.service.ts`
  - Service App 静态合同检查 owner。
- `packages/nextclaw/src/cli/app/types/app-check.types.ts`
  - 诊断报告公共类型。
- `packages/nextclaw/src/cli/app/utils/app-check.utils.ts`
  - 无状态解析、路径和格式校验小工具。
- `packages/nextclaw/src/cli/app/index.ts`
  - 注册 `app check <app-dir>` 命令。
- `packages/nextclaw/src/cli/app/app-check-command.utils.test.ts`
  - 定向覆盖 panel / service 成功与高频失败。
- `packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-app-creator/SKILL.md`
  - 增加交付前必须运行 `nextclaw app check`。
- `packages/nextclaw-core/src/features/agent/shared/skills/panel-app-creator/SKILL.md`
  - Panel App 创建后必须运行自检。
- `packages/nextclaw-core/src/features/agent/shared/skills/service-app-creator/SKILL.md`
  - Service App 创建后必须运行自检。

## 验收

- `nextclaw app check` 对合法 Panel App 返回 0；
- 缺少 capability / action 声明时返回非 0；
- `--json` 输出稳定结构；
- Service App 脚本路径缺失或语法错误时返回非 0；
- skills 明确要求 AI 交付前运行该命令；
- `pnpm --filter nextclaw test` 覆盖新检查器；
- `pnpm --filter nextclaw tsc` 覆盖 CLI 类型边界。
