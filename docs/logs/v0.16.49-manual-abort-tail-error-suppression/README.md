# v0.16.49-manual-abort-tail-error-suppression

## 迭代完成说明

- 修复手动终止运行后仍被 runtime 尾部 `RunError` / `MessageFailed` 覆盖为错误态的问题。
- 改为在源头 [packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts) 处理取消语义：当 ACP prompt 因手动终止结束时，stdio runtime 直接把它当正常取消返回，不再继续产出 `MessageFailed` / `RunError`。
- 新增慢速取消 fixture [packages/nextclaw-ncp-runtime-stdio-client/src/test-fixtures/slow-cancel-agent.mjs](/Users/peiwang/Projects/nextbot/packages/nextclaw-ncp-runtime-stdio-client/src/test-fixtures/slow-cancel-agent.mjs)、错误语义 helper [packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime-error.utils.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime-error.utils.ts) 和 abort 回归测试 [packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime-abort.test.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime-abort.test.ts)，覆盖“流式输出中手动停止，不应看到 `ACP prompt cancelled` 报错”场景。

## 测试/验证/验收方式

- 通过：`pnpm -C packages/nextclaw-ncp-runtime-stdio-client test -- src/stdio-runtime.test.ts src/stdio-runtime-abort.test.ts`
- 通过：`pnpm -C packages/nextclaw-ncp-runtime-stdio-client tsc`
- 未通过但与本次改动无直接因果：`pnpm lint:maintainability:guard`
  当前失败点来自工作区里其它未收尾改动触发的治理错误：`packages/nextclaw-ui/src/components/common/BrandHeader.tsx` 文件名不符合 kebab-case；本次 stdio runtime 修复本身已把新增 error 收敛为 0，仅保留历史预算 warning。

## 发布/部署方式

- 这是 stdio runtime 行为修复，不需要额外数据迁移或手工配置。
- 合入并发布包含该 stdio runtime 修复的构建后，聊天链路里“用户主动停止”会直接保留取消态，不再从 runtime 源头冒出 `ACP prompt cancelled` 错误。

## 用户/产品视角的验收步骤

1. 在聊天界面发起一次会产生流式输出的请求。
2. 在模型尚未完成前手动点击停止。
3. 确认界面停在“已取消/已停止”的语义，不再出现 `ACP prompt cancelled` 报错。
4. 再次发起一轮请求，确认后续会话可继续正常发送，不存在被上一次 abort 污染成错误态的残留问题。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

- 是。本次把取消语义修回 stdio runtime 源头，而不是在 backend/UI 再吞一层错误，符合“行为明确、可预测、不要靠隐藏兜底制造 surprise success”的长期方向。
- 本次顺手减债：是。取消不再被错误化后再下游修补，减少了未来在 backend、state manager、UI 多层重复兜底的压力。

### 可维护性复核结论

- 通过
- no maintainability findings

### 代码增减报告

- 新增：431 行
- 删除：126 行
- 净增：+305 行

### 非测试代码增减报告

- 新增：159 行
- 删除：124 行
- 净增：+35 行

### 结构与删减判断

- 本次已尽最大努力优化可维护性：是。修复只集中在 stdio runtime 的取消分支，并用一个专门 fixture 证明真实取消路径，不再新增跨层补丁。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。相比在 backend 或 UI 新增兜底，本次直接删除“取消后抛错”的错误语义，保持单一真实行为。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：`stdio-runtime.service.ts` 虽仍是历史超大文件，但本次已从 894 行降到 889 行，没有继续恶化；净增长主要来自新增 abort fixture、独立 abort 测试和本次迭代 README。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。修复点回到 `StdioRuntimeRunController` 自身，语义 owner 更清晰，也避免了下游为了兼容错误上浮再做补丁。
- 目录结构与文件组织是否满足当前项目治理要求：满足。本次仅在现有 `test-fixtures` 下增加 fixture，并在既有 `stdio-runtime.test.ts` 中补充回归覆盖。
- 本次涉及代码可维护性评估：适用，且已基于一次独立于实现阶段的复核填写，而不是仅复述守卫输出。
- 若总代码或非测试代码净增长，是否已做到最佳删减：是。非测试净增主要来自 `stdio-runtime-error.utils.ts` 与取消路径的分阶段 helper；这些新增换来了更少的运行时歧义，同时把主 service 文件体积压回到修改前以下。
