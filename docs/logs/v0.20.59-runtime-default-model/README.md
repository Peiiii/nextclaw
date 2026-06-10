# v0.20.59 Runtime Default Model

## 迭代完成说明

支持 NARP runtime 使用外部 agent runtime 自己的默认模型，而不是始终由 NextClaw 注入模型。

根因是当前 NARP host 会按 session metadata、runtime entry `config.model` 或 `agents.defaults.model` 构造 `providerRoute`，并通过 ACP `unstable_setSessionModel` 传给外部 runtime；Codex wrapper 收到 route 后也会把模型写入 Codex SDK thread options。即使清掉会话模型偏好，链路仍会回落到 NextClaw 默认模型，无法表达“让 Codex 自己决定默认模型”。

本次修复新增共享 runtime 默认模型 sentinel 和 `modelSelectionMode` runtime entry 语义：

- 默认 `nextclaw`：保持现有行为。
- `runtime-default`：不构造 provider route，不调用 session model 切换，让外部 runtime 使用自身默认模型。
- `optional`：UI 同时提供“运行时默认”和普通模型选项；选择“运行时默认”时不持久化模型覆盖。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- ncp-chat-page.test.ts`
- `pnpm -C packages/nextclaw-kernel test -- builtin-narp-runtime-provider.service.test.ts`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk test -- codex-narp-runtime-wrapper.service.test.ts`
- `pnpm -C packages/nextclaw-shared tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk tsc`
- `pnpm -C packages/nextclaw-shared lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <touched files>`

定向测试覆盖：

- UI 在 `runtime-default` 模式下只显示运行时默认模型。
- UI 在 `optional` 模式下同时显示运行时默认模型和 supported model。
- Kernel 在 `runtime-default` 模式下不生成 provider route。
- Kernel 在 `optional` 模式下收到 runtime 默认 sentinel 时不生成 provider route。
- Codex wrapper 在没有 route 和 session model 时不传 `model` / `threadOptions.model`。

## 发布/部署方式

本次未执行部署或发布。

## 用户/产品视角的验收步骤

配置 NARP runtime entry：

```json
{
  "type": "narp-stdio",
  "config": {
    "command": "codex-narp",
    "modelSelectionMode": "optional"
  }
}
```

进入 chat，选择该 runtime 后，模型下拉应出现“运行时默认”。选择它发送消息时，NextClaw 不应把当前 UI 模型或全局默认模型传给 Codex；Codex 应使用自身配置里的默认模型。

若配置为 `"modelSelectionMode": "runtime-default"`，模型下拉只保留“运行时默认”，该 runtime 的所有会话都不由 NextClaw 覆盖模型。

## 可维护性总结汇总

本次通过共享 sentinel 和 runtime entry 模式字段承载语义，避免在 kernel、UI 或 Codex wrapper 中硬编码 `codex` 特判。默认模式保持旧行为，新增能力只在 runtime entry 显式声明后生效。

维护性 guard 无错误；保留两个既有 warning：chat input container 接近文件预算、`shared/lib/api` 根目录已有历史例外。`post-edit-maintainability-review` 已使用；本次是新增用户能力，非测试生产代码净增用于承载新合同、UI 表达、发送清空和 provider route 跳过逻辑。

## NPM 包发布记录

涉及 `@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui`，已添加 patch changeset：`.changeset/runtime-default-model.md`。当前未发布，待统一发布。
