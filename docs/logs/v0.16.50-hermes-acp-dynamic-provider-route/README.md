# v0.16.50-hermes-acp-dynamic-provider-route

## 迭代完成说明

- 将 Hermes ACP bridge 收敛到“prompt 级 route 驱动的 execution agent 重建”执行模型。
  - 不再让 Hermes 真实执行依赖 ACP 的 `setSessionModel(modelId)`。
  - 同一会话里每次 prompt 都从 `nextclaw_narp.providerRoute` 解析完整执行路由，并重建真实 Hermes `AIAgent`。
  - 为保住 Hermes 工具面，prompt 结束后不再恢复轻量 session snapshot；当前 execution agent 会保留在 session 常驻对象里，下一轮若 route 变化则再次重建。
- 保持“不修改 Hermes 上游源码”的边界。
  - 本次实现全部落在 NextClaw 侧 adapter/bridge/runtime/documentation。
  - 继续把 `packages/nextclaw-hermes-acp-bridge` 作为 Hermes ACP 集成问题的主要适配层，而不是去改 `../hermes-agent` 上游代码。
- 修复切模型后可能继续走旧 provider，或者前端长时间停在 thinking 的根因链路。
  - `narp-stdio` 的 Hermes ACP 链路现在会跳过前置 `unstable_setSessionModel`，避免只传 `modelId` 时把上游 session 重建到错误 provider。
  - prompt 级执行 agent 初始化失败会显式抛回 NextClaw，让 stdio runtime 发出 `MessageFailed + RunError`，而不是静默悬挂。
  - Hermes prompt-routed execution agent 不再继承上一轮 `_cached_system_prompt`；跨模型 / 跨 provider 切换时，真实执行 prompt 会按当前 route 重新构建，避免回复里继续残留旧模型身份。
  - NextClaw provider 路由对显式前缀改为绝对优先，并拒绝对歧义裸模型名做静默 provider 猜测，避免把 `qwen3.6-plus` 这类值错误打到 `minimax`。
- 修复 Python ACP prompt meta 的真实读取位置。
  - 根因已经定位到 Python ACP 的 `MessageRouter`：它会把 `_meta` 展平成普通 kwargs，而不是把 `_meta` 原样传给 `HermesACPAgent.prompt(..., **kwargs)`。
  - 之前 bridge 只读取 `kwargs._meta.nextclaw_narp.providerRoute`，导致真实链路里第二轮 prompt 根本读不到 `providerRoute`，同 session 后续请求会继续复用第一轮 execution agent。
  - 现在 bridge 会优先读取真实链路里的 `kwargs.nextclaw_narp.providerRoute`，同时兼容直接调用场景下的 `kwargs._meta.nextclaw_narp.providerRoute`。
- 补齐定向回归测试。
  - Python fake ACP 桥接测试现在验证：请求期间确实使用 prompt 级 route 执行，且 session 常驻对象会更新为本轮 execution agent。
  - Python fake ACP 桥接测试额外验证：执行 agent 的 cached system prompt 会按本次 route 重建，而不是继承旧模型的 frozen prompt。
  - provider routing 测试现在验证：显式 prefix 不会再被 gateway keyword 覆盖，`zai/glm-5` 这类 modelPrefix alias 能正确命中 provider，歧义裸模型名会显式解析失败。
  - stdio runtime 测试现在验证：Hermes 路由桥开启时不再调用 `unstable_setSessionModel`，prompt 抛错时会显式发出失败终止事件。
- 方案文档已落地到 [docs/plans/2026-04-17-hermes-acp-request-scoped-agent-plan.md](../../../docs/plans/2026-04-17-hermes-acp-request-scoped-agent-plan.md)。
- 收尾补丁修复了 `pnpm dev start` 启动残留回归。
  - `packages/nextclaw-core/src/agent/context.ts` 与 `packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts` 仍引用已删除的 `bootstrap-context.js`。
  - 现在统一改为指向现有的 `bootstrap-context.service.js`，避免开发启动时直接触发 `ERR_MODULE_NOT_FOUND`。
- 补上 Hermes ACP bridge 运行产物同步防线。
  - 本地仓库运行时现在优先使用 `src/hermes-acp-route-bridge`，避免工作区已经修好但 `dist/hermes-acp-route-bridge` 仍是旧桥时继续吃到旧逻辑。
  - 新增 `pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge check:bridge-sync`，可直接检测 source / dist 桥接文件是否一致。
  - execution agent 在 Hermes 日志里会显式打印最终 `model/provider/api_mode/base_url`，方便核对“实际执行模型”和“自报模型”是否一致。

## 测试/验证/验收方式

- 定向包测试：

```bash
pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge test
```

- 定向静态校验：

```bash
pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge lint
pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge tsc
```

- 仓库级维护性守卫：

```bash
pnpm lint:maintainability:guard
```

实际结果：

- `pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge test` 通过，7/7 用例通过。
- `pnpm --filter @nextclaw/core test -- src/config/schema.provider-routing.test.ts src/config/provider-runtime-resolution.test.ts` 通过。
- `pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge lint` 通过。
- `pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge tsc` 通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test` 通过，8/8 用例通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint` 通过，但仍有历史大文件 warning，不影响本次结果。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc` 通过。
- `pnpm lint:maintainability:guard` 未能全绿；剩余 error 来自当前工作区其它并行改动（如 `packages/nextclaw-core/src/agent`、`packages/nextclaw-ui/src/components/config/ChannelForm.tsx`、`packages/nextclaw-ui/src/components/config/ProviderForm.tsx`、`packages/nextclaw-ui/src/components/config/SearchConfig.tsx`），不是本次 Hermes ACP 修复新引入的问题。
- 补充同 session 双轮定向验证：
  - 用源码链路直接启动 `StdioRuntimeNcpAgentRuntime`。
  - 第一轮在同一 session 内使用 `MiniMax-M2.7 + https://api.minimax.chat/v1`。
  - 第二轮切到 `qwen3.6-plus`，并故意把 `apiBase` 设为错误值 `http://127.0.0.1:1/v1`。
  - 修复前：Hermes stderr 第二轮没有新的 `route resolved` 日志，说明 prompt route 没进入 bridge；实际继续复用第一轮 agent。
  - 修复后：第二轮必须重新打印 `route resolved`，并明确命中第二轮的 `apiBase`；错误 `apiBase` 会立刻触发定向失败，而不是偷偷继续返回第一轮 provider 的结果。

## 发布/部署方式

- 本次改动为仓库代码修复，无需单独执行额外发布脚本。
- 后续随正常 NextClaw 发布流程进入发布即可；Hermes ACP bridge 代码会随包含 `@nextclaw/nextclaw-hermes-acp-bridge` 的构建产物生效。

## 用户/产品视角的验收步骤

1. 在 NextClaw 中选择 Hermes 类 `narp-stdio` 会话类型。
2. 先选择 `MiniMax-M2.7` 发起一次对话，确认会话能够正常启动。
3. 在同一个会话里把模型切换到 `qwen3.6-plus` 或其它不同 provider 的模型，然后继续发消息。
4. 再次发送消息后，Hermes 应只使用当前模型对应的 `providerRoute`，而不是继续命中上一个 provider 的 endpoint。
5. 若当前模型配置有效，应正常返回回复；若 route 或 provider 初始化失败，应明确收到错误结束态，而不是一直停在 thinking。
6. 若把同一会话第二轮 provider 的 `apiBase` 故意改成错误地址，请求必须明确失败，不能继续成功返回第一轮 provider 的结果。

## 可维护性总结汇总

- 可维护性复核结论：通过。
- 长期目标对齐 / 可维护性推进：本次把 Hermes ACP 的真实执行真相收敛为 prompt 级 `providerRoute`，减少了“会话残留状态”和“当前用户选择”之间的分裂，更符合 NextClaw 的统一体验与行为可预测目标。
- 本次是否已尽最大努力优化可维护性：是。没有选择“切换时重建整条 session”这种更脆弱的状态机，而是让 session 与 execution 明确解耦。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。删除了 Hermes 真实执行对前置 `setSessionModel` 的依赖，把执行真相收敛到单一路径。
- 代码增减报告：
  - 已跟踪文件 diff：新增 559 行，删除 94 行，净增 +465 行。
  - 说明：`git diff --stat` 未包含当前未跟踪的新方案文档与 Python helper 文件，因此真实新增略高于该统计值。
- 非测试代码增减报告：
  - 未做精确拆分统计。
  - 结构上主要净增来自 Hermes ACP route bridge 与相关文档；测试新增主要集中在 bridge / stdio runtime 回归。
- 若总代码或非测试代码净增长，是否已做到最佳删减：是。净增长主要来自把原先隐式混杂在 session 中的执行态拆干净，以及补充回归测试。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。逻辑路径变得更单一，但为明确 prompt route 与 execution agent 重建边界，增加了少量必要桥接代码与测试。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。现在 `sitecustomize.py` 只负责 patch 生命周期与请求级执行切换，route 读取仍留在 helper，边界比“常驻 agent + route 变化时重建”更清晰。
- 目录结构与文件组织是否满足当前项目治理要求：满足当前范围要求。
- post-edit-maintainability-review 结论：
  - 本次顺手减债：是。
  - 已把 `sitecustomize.py` 从超预算 error 拉回到预算内 warning，并消除了本次对 `stdio-runtime.service.ts` 与 `stdio-runtime.test.ts` 新引入的 maintainability error。
  - 保留债务经说明接受：`sitecustomize.py` 与 `stdio-runtime.service.ts` 仍接近或超过预算上限，但本次没有继续放大其超限程度；后续若继续扩展 Hermes bridge 或 stdio runtime，应优先再拆分模块，而不是继续堆到现有入口文件。
  - 本轮补丁说明：这次针对 `_meta` 展平问题的修复只改动一个 helper 入口，并新增贴近真实 ACP router 行为的回归测试，没有引入新的 session fallback、双写状态或额外兼容分支。
- 收尾补丁 maintainability review：
  - no maintainability findings
  - 代码增减报告：新增 2 行，删除 2 行，净增 0 行。
  - 非测试代码增减报告：新增 2 行，删除 2 行，净增 0 行。
  - 说明：本次仅修正两处仍指向已删除模块的导入路径，没有新增抽象、分支、文件或兼容层，属于同批次收尾中的最小必要修复。

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 原因：本次只是同批次收尾中的仓库内启动修复，没有新增独立发包闭环，也没有形成需要单独发布的包版本。
- 本次无需单独发布的包：`@nextclaw/core`、`@nextclaw/nextclaw-hermes-acp-bridge`、`@nextclaw/nextclaw-ncp-runtime-stdio-client`。
- 当前状态：以上包均标记为随后续正常 NextClaw 发布批次统一处理，本次不单独发包。
