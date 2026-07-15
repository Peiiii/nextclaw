# v0.23.4-provider-model-nested-id

## 迭代完成说明

本批修复 provider 本地模型 ID 在表单、连接测试和运行时网关链路中被误判或截断的问题。OpenRouter、Bedrock gateway 等上游会使用 `vendor/model` 或 `namespace/model` 作为模型 ID；现在可以直接添加、保存、测试并转发 `bedrock/claude-fable-5`。

根因不是单点文案错误，而是三处代码没有统一遵守模型 route 合同：

1. 表单先正确去掉当前 provider 的最外层路由前缀，随后又用 `includes('/')` 把任何剩余斜杠一律判定为“其他 provider 前缀”。
2. AiHubMix/LiteLLM 网关使用 `split('/').slice(-1)`，会把多段本地 ID 截成最后一段。
3. provider 连接测试使用非锚定 `replace` 改写实例前缀，可能误改本地模型 ID 中间的同名片段。

通过全库审计模型 ID 的斜杠校验、路由解析、序列化、连接测试和运行时转发确认了这三处问题。其余解析点只剥离明确的最外层路由，并保留后续完整路径，不需要修改。

修复遵循同一合同：provider 本地模型 ID 是不透明字符串，只有明确命中的最外层 NextClaw provider route 可以被剥离或改写。实现删除了表单错误分支；网关改为只去掉自身已知前缀；连接测试改为只改写字符串开头的实例 route。没有新增 provider 名单、模型猜测、fallback 或平行兼容路径。

## 测试/验证/验收方式

- 修前基线：既有 UI 测试明确断言多段模型 ID 会触发 `providerModelInvalidProviderPrefix`；源码审计同时确认 AiHubMix 网关只保留最后一段、连接测试会非锚定替换实例 ID。
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/settings/utils/__tests__/provider-form-support.utils.test.ts`：6 项通过，覆盖多段 ID 的新增和外层 provider route 序列化。
- `pnpm -C packages/nextclaw-core exec vitest run src/features/llm-providers/providers/litellm.provider.test.ts`：4 项通过，覆盖网关只剥离已知外层前缀并保留 `bedrock/claude-fable-5`。
- `pnpm -C packages/nextclaw-server exec vitest run src/app/router-provider-probe.test.ts`：2 项通过，覆盖连接测试不改写本地模型 ID 中间的 provider 实例名。
- `pnpm -C packages/nextclaw-core tsc`、`pnpm -C packages/nextclaw-server tsc`、`pnpm -C packages/nextclaw-ui tsc --noEmit`：通过。
- `pnpm -C packages/nextclaw-core lint`、`pnpm -C packages/nextclaw-server lint`、`pnpm -C packages/nextclaw-ui lint`：0 error；分别存在 24、9、1 个既有 warning，本次未新增 lint 问题。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`：通过。
- `pnpm check:generated-clean`：被工作区中另一批聊天输入法源码对应的 `packages/nextclaw/ui-dist` hash 变更阻塞；本批未清理、未暂存这些无关生成物，避免覆盖并行工作。
- 可维护性 guard 以 `--non-feature` 检查本批代码：总代码新增 102 行、删除 58 行、净增 44 行；排除测试后新增 8 行、删除 15 行、净减 7 行。补齐红区记录后无阻塞项，保留 4 个未恶化或已记录的历史 warning。
- 构建当前源码并启动独立实例 `http://127.0.0.1:18889/providers`：选择 OpenRouter，点击“添加模型”，输入并添加 `bedrock/claude-fable-5` 后，模型在列表中出现，旧错误提示未出现，保存按钮进入可用状态。未点击保存，没有修改真实 provider 配置；验收后已停止独立实例并清理生成产物。

## 发布/部署方式

本次未执行发布或部署。新增 `.changeset/provider-model-nested-ids.md`，后续随 `@nextclaw/core`、`@nextclaw/server`、`@nextclaw/ui` 统一发布 patch。

涉及本地 server 连接测试路由逻辑，但不涉及数据库、migration 或远程部署。

## 用户/产品视角的验收步骤

1. 打开设置中的“提供商”，选择 OpenRouter 或任一需要多段模型 ID 的 provider。
2. 点击“添加模型”，输入 `bedrock/claude-fable-5`。
3. 点击“添加”，确认模型出现在可用模型列表中，且不再出现“模型 ID 不能使用其他 provider 前缀”。
4. 保存后重新打开该 provider，确认本地模型 ID 仍显示为 `bedrock/claude-fable-5`。
5. 执行连接测试并实际调用该模型时，确认上游收到的仍是完整 `bedrock/claude-fable-5`，而不是最后一段 `claude-fable-5`。

## 可维护性总结汇总

- 正向减债动作为删除和简化：移除了错误校验分支、错误返回状态和调用方 toast 分支，并把非锚定替换收敛为明确的最外层 route 改写；没有新增 provider 名单、fallback 或双路径。
- 三层测试分别锁定表单、网关和连接测试的真实失效边界，没有按 provider 复制测试矩阵；server 测试复用文件内 fixture，避免重复搭建 router host。
- 非测试代码新增 8 行、删除 15 行、净减 7 行，满足非功能改动门槛。
- `provider-form.tsx` 由 567 行降至 563 行，但仍超过 500 行 UI form 预算；这是未被本次放大的历史 warning，后续拆分缝仍是把 section 与状态连接逻辑从表单 shell 中收敛出去。
- `server-config.store.ts` 本次行数不增长，仍是历史红区；`packages/nextclaw-server/src/app` 目录已有预算豁免且文件数未增长。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 复核；no maintainability findings。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：是。
- 说明：删除两处非锚定字符串替换，收敛为同一个只处理已知最外层 route 的前缀改写函数；生产代码行数未增长，模型 ID 合同更明确。
- 下一步拆分缝：按 chat/session/provider 三个域拆分配置构建与默认值归一化。

## NPM 包发布记录

- `@nextclaw/core`：需要 patch，changeset 已添加，当前待统一发布。
- `@nextclaw/server`：需要 patch，changeset 已添加，当前待统一发布。
- `@nextclaw/ui`：需要 patch，changeset 已添加，当前待统一发布。
