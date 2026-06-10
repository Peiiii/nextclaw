# v0.20.63 Runtime Default Model Sentinel

## 迭代完成说明

本次修复选择“运行时默认”模型时，NARP stdio runtime 把内部 sentinel `__nextclaw_runtime_default__` 当成真实 ACP `modelId` 下传的问题。

根因：

- UI 用 `__nextclaw_runtime_default__` 表达“使用 runtime 自己的默认模型”。
- kernel 的 provider route 解析会正确把这个值视为“不走 NextClaw provider”。
- 但 `@nextclaw/nextclaw-ncp-runtime-stdio-client` 的 `resolveModelId` 没有识别这个 sentinel，导致它继续调用 ACP `unstable_setSessionModel`，把 sentinel 当作真实模型传给下游 runtime。
- 对 Codex NARP 来说，这会让 `threadOptions.model` 变成 `__nextclaw_runtime_default__`，而不是不传 model 并回退到 `~/.codex/config.toml` 的默认模型。

确认方式：

- 用 echo ACP fixture 复现：修复前 tool result 中 `modelId` 为 `__nextclaw_runtime_default__`。
- 用 Codex NARP wrapper 旁路验证：无 `modelId` 时 `model/threadOptions.model` 均为空；传入 sentinel 时会被当作真实模型。
- 修复后 dist smoke 中 echo fixture 返回 `modelId: null`、`routedModel: null`、`envRoutedModel: null`。

修复方式：

- 在 stdio runtime 的 `resolveModelId` 边界把 `__nextclaw_runtime_default__` 转回 `undefined`。
- 增加回归测试，确保 runtime-default sentinel 不会再作为 ACP session model 下传。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client build`
- dist smoke：发送 metadata `preferred_model/model = "__nextclaw_runtime_default__"` 到 echo ACP fixture，返回 `modelId: null`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm clean:generated`

未完成验证：

- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test -- src/stdio-runtime.test.ts` 未能执行测试体，原因是当前工作区已有无关导入问题：`@core/features/agent/tools/registry.tools.js` 找不到。

## 发布/部署方式

本次只修改源码、测试和 changeset，不执行发布。后续随统一 NPM 发布流程发布。

## 用户/产品视角的验收步骤

1. 在 Codex/NARP stdio 会话中选择模型下拉里的“Runtime default”。
2. 发送消息。
3. 预期 NextClaw 不再把 `__nextclaw_runtime_default__` 作为模型名传给 ACP runtime。
4. 对 Codex runtime，预期不传 model，由 Codex 自己读取 `~/.codex/config.toml` 中的默认模型。

## 可维护性总结汇总

已使用 maintainability guard。本次相关源码的非测试代码净增为 `0`，满足非功能 bugfix 的 `非测试代码净增 <= 0` 要求。

维护性动作：

- 修复点收敛在 stdio transport 边界，避免在 Codex wrapper 下游做兜底。
- 没有新增兼容分支或第二套模型选择路径。
- `stdio-runtime.service.ts` 仍超过文件预算，但本次没有继续增加该文件行数；后续拆分方向仍是提取 orchestration、IO 和状态迁移。

红区触达：未触达当前 maintainability hotspot 清单中的文件。

## NPM 包发布记录

需要随下一批 NPM 发布进入 patch：

- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：待统一发布。原因是修复 runtime-default 模型 sentinel 的 stdio transport 语义。
