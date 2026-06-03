# v0.20.7 Provider Model Vision Config

## 迭代完成说明

本次修复存量 provider 配置可能覆盖内置模型能力事实的问题。

根因是运行时和 UI 部分链路在读取 provider `modelConfig` 时，把用户持久化配置当成完整事实源；存量用户的 provider 里可能已经保存了空的 `modelConfig: {}`，于是内置 provider spec 后续新增的 `vision: true` 无法生效。结果是内置支持 vision 的模型会被误判为不支持图片，图片消息被过滤成 omitted 文本。

确认方式：

- 代码证据显示 `LlmProviderManager.prepareMessagesForProvider()` 只读取 route provider 的持久化 `modelConfig`，没有合并内置 provider spec。
- UI 模型目录和 provider 表单也存在同类 `providerConfig.modelConfig ?? spec.modelConfig` 口径，空对象会截断内置能力配置。
- 补充测试复现了 persisted `modelConfig: {}` 时，内置 vision 模型应继续保留图片输入；非 vision 模型仍应过滤图片。

修复方式：

- 运行时 route 合并内置 provider spec `modelConfig` 与用户持久化 `modelConfig`，用户配置后置覆盖。
- UI 模型目录和 provider 表单使用同样的“内置事实 + 用户覆盖”口径。
- 将 UI 中重复的 thinking/modelConfig 归一化实现收敛到 `shared/lib/provider-models`，表单 support 复用该 owner。
- 顺手修正被治理规则拦截的 `provider-form.tsx` 跨目录 parent-relative imports。

同批次继续完善内置 provider/model catalog：

- 将 Qwen 内置默认模型统一按多模态处理，覆盖 `qwen3.7-plus`、`qwen3.7-max` 与保留的 `qwen3.5-27b`。
- 刷新 OpenAI、Anthropic、Moonshot/Kimi、MiniMax、DashScope Coding Plan、OpenRouter、AiHubMix、Zhipu/GLM 等默认模型列表，并补充对应 vision 标记；`glm-5.1` 保持非 vision。
- 新增 Xiaomi MiMo provider，默认模型为 `mimo-v2.5-pro` 与 `mimo-v2.5`，并补齐 `mimo.svg` 图标资源。
- MiMo 默认 API Base 使用小米官方文档中的 OpenAI Compatibility Protocol：`https://api.xiaomimimo.com/v1`。
- 将 runtime provider 文件从 `providers/plugins/` 收敛到 `providers/*.provider.ts`，满足当前 app-l1 结构 contract。
- 将 server provider meta/auth 路由测试从超长 `router.provider-test.test.ts` 拆到 `src/app/tests/` 下的职责文件，降低原大测试文件维护压力。

同批次修复隔离环境 provider 模型列表全空：

- 根因不是隔离环境漏初始化，而是默认配置 schema 的 `providers` 可以为空，内置 provider 与默认模型由 `/api/config/meta` 提供。
- UI provider 表单和模型选择 catalog 此前只读取 `/api/config` 中已持久化的 `provider.models`；隔离环境里未 materialize 的 provider 或 `models: []` 会被误判为无模型。
- 修复为：当持久化模型列表为空时使用 provider meta 的 `defaultModels`；当用户保存过非空模型列表时尊重该列表，不重新加入用户已删除的默认模型。
- 重新构建并复制 `packages/nextclaw/ui-dist`，确保隔离 CLI serve 使用的静态页面包含本次修复。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/llm-provider.manager.test.ts src/utils/model-message-vision.utils.test.ts`：通过，2 个测试文件、4 个用例。
- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/lib/provider-models/index.test.ts`：通过，1 个测试文件、2 个用例。
- `pnpm -C packages/nextclaw-kernel tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-kernel lint`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/shared/lib/provider-models/index.ts src/shared/lib/provider-models/index.test.ts src/shared/components/config/provider-form.tsx src/shared/components/config/provider-form-support.ts`：0 errors；`provider-form.tsx` 仍有既有复杂度与 hook deps warnings。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次触达文件>`：通过，0 errors，3 warnings；统计为 total +184 / -86 / net +98，non-test +46 / -86 / net -40。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

同批次 provider catalog 完善后的追加验证：

- `pnpm -C packages/nextclaw-runtime tsc`：通过。
- `pnpm -C packages/nextclaw-server tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-runtime exec eslint src/index.ts src/providers/builtin-provider-registry.provider.ts src/providers/builtin-provider-plugins.provider.ts src/providers/builtin.provider.ts src/providers/dashscope-coding-plan.provider.ts src/providers/kimi-coding.provider.ts src/providers/builtin-provider-registry.provider.test.ts`：通过。
- `pnpm -C packages/nextclaw-server exec eslint src/app/router.provider-test.test.ts src/app/tests/provider-meta-catalog.test.ts src/app/tests/minimax-portal-auth-route.test.ts src/app/tests/qwen-portal-auth-route.test.ts src/features/config/providers/server-builtin-provider.provider.ts`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/shared/lib/provider-models/index.test.ts`：通过。
- `pnpm -C packages/nextclaw-server exec vitest run src/app/router.provider-test.test.ts src/app/tests/provider-meta-catalog.test.ts src/app/tests/minimax-portal-auth-route.test.ts src/app/tests/qwen-portal-auth-route.test.ts`：通过，4 个测试文件、15 个用例。
- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/lib/provider-models/index.test.ts`：通过，1 个测试文件、2 个用例。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 errors，5 warnings。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

隔离环境模型列表修复后的追加验证：

- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/lib/provider-models/index.test.ts src/shared/components/config/provider-form-support.test.ts`：通过，2 个测试文件、6 个用例。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/shared/lib/provider-models/index.ts src/shared/lib/provider-models/index.test.ts src/shared/components/config/provider-form-support.ts src/shared/components/config/provider-form-support.test.ts`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `node packages/nextclaw/scripts/copy-ui-dist.mjs`：通过，`packages/nextclaw/ui-dist` 已更新。
- `NEXTCLAW_HOME="$(mktemp -d -t nextclaw-models-smoke.XXXXXX)" pnpm -C packages/nextclaw dev serve --ui-port 18991` 后请求隔离服务：`/api/config` 返回 1 个已 materialize provider 且 `models: []`，`/api/config/meta` 返回 18 个内置 provider 与默认模型，验证了根因是 UI fallback 语义而非初始化步骤缺失。
- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/components/model-config.test.tsx src/shared/lib/provider-models/index.test.ts src/shared/components/config/provider-form-support.test.ts`：通过，3 个测试文件、10 个用例。
- `NEXTCLAW_HOME="$(mktemp -d -t nextclaw-models-ui.XXXXXX)" pnpm -C packages/nextclaw dev serve --ui-port 18992` 后使用 Playwright 打开 `/providers`：默认“已配置”tab 为 0；切到“全部提供商”并打开 `NextClaw Built-in` 后，`Available Models` 显示 `dashscope/qwen3.7-plus`、`dashscope/qwen3.7-max`、`dashscope/qwen3.5-27b`。

## 发布/部署方式

未执行发布、部署或 NPM publish。本次只完成源码修复、本地类型检查、定向测试、lint 与治理验证。

## 用户/产品视角的验收步骤

1. 使用已有 provider 配置，且该 provider 持久化配置中存在空的 `modelConfig: {}`。
2. 选择内置 spec 标记为 `vision: true` 的模型发送图片消息。
3. 预期图片输入保留并传给模型，不再因为存量空配置被误判为非 vision。
4. 选择未标记 vision 的模型发送图片消息。
5. 预期图片仍被过滤为 omitted 文本，避免把图片发给不支持 vision 的模型。
6. 打开 provider 配置页，确认 Xiaomi MiMo 出现在内置 provider 列表，且显示 MiMo 图标。
7. 查看模型选择列表，确认 Qwen 默认模型均带 vision 能力，OpenAI 仅保留 5.4/5.5 系列，Anthropic 保留 4.6/4.7/4.8 系列，Zhipu/GLM 出现 `glm-5.1` 但不标记 vision。
8. 使用空 `NEXTCLAW_HOME` 启动隔离 CLI serve，打开 provider 配置页，确认未配置的内置 provider 仍显示其 `defaultModels`，而不是空列表。
9. 为某个 provider 保存非空自定义模型列表后刷新，确认 UI 尊重该列表，不自动复活用户已删除的默认模型。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 做收尾复核。

本次是非功能兼容性修复，非测试代码净增为 -40，满足非功能改动净增门槛。正向减债动作是收敛 UI 中重复的 thinking/modelConfig 归一化逻辑到 `shared/lib/provider-models`，并修正触达文件的 import 结构漂移。

剩余债务：

- `provider-form.tsx` 仍是超预算大组件，本次保持 delta 为 0，后续应继续拆分 hooks、sections 和表单状态 owner。
- `provider-form.tsx` 仍有既有 `providerAuthMethods` hook deps warnings，本次未扩展该问题范围。
- `builtin.provider.ts` 已接近文件预算，后续如继续扩展 provider catalog，应拆出 provider family 分组或数据配置 owner。
- `packages/nextclaw-server/src/app` 顶层仍是历史超预算目录；本次通过把 provider meta/auth 测试迁到 `src/app/tests/` 避免继续放大顶层文件压力。

## NPM 包发布记录

不涉及 NPM 包发布。
