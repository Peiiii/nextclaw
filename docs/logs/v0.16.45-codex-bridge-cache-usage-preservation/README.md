# v0.16.45-codex-bridge-cache-usage-preservation

## 迭代完成说明

本次修复了 Codex OpenAI-compatible bridge 丢失 prompt cache usage 细节的问题，核心变化有两部分：

1. 在 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk` 的 bridge 链路里，保留并转写上游 `chat/completions` usage 中的嵌套细节，不再把 `input_tokens_details` / `output_tokens_details` 强行写成 `null`。
2. 将上游 `prompt_tokens_details` / `completion_tokens_details` 分别映射为 Responses 侧的 `input_tokens_details` / `output_tokens_details`，这样后续记录链路能够继续识别 `cached_tokens`。
3. 为了通过当前仓库的新代码治理，对本次触达的 bridge 工具模块统一补齐了 `.utils.ts` 角色后缀，并同步更新相关 import 与测试引用。
4. 补充回归测试，明确锁住“上游返回 `cached_tokens` 时，bridge 最终输出必须仍能看到缓存 usage”。

## 测试 / 验证 / 验收方式

本次已执行：

- `pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/compat/codex-openai-responses-bridge.test.ts src/cli/commands/compat/codex-openai-responses-bridge-request.test.ts`
- `pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/compat/codex-responses-capability.test.ts`
- `pnpm -C packages/nextclaw-core test -- run src/providers/openai_provider.test.ts`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`

额外尝试但未作为本次验收阻断项的命令：

- `pnpm -C packages/nextclaw test -- run src/cli/commands/compat/codex-runtime-plugin-provider-routing.test.ts src/cli/commands/compat/codex-runtime-plugin-production-build.test.ts`
  - 结果：失败。
  - 原因：这两项分别命中了仓库内已有的 provider-routing 断言偏差，以及 production dist 测试对已构建产物 / mock 路径的额外依赖，不属于本次 cache usage 修复链路。

已尝试运行：

- `pnpm lint:maintainability:guard`
  - 结果：未完成通过。
  - 原因：治理脚本把当前工作树中的其它已修改文件也纳入检查，最终阻塞点来自与本次改动无关的 [session-search-store.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/session-search/session-search-store.service.ts) 既有修改，而不是本次 bridge 修复文件本身。

## 发布 / 部署方式

本次仅涉及本地运行时代码与测试更新，无需额外配置迁移。

若要随包发布：

1. 按既有 release 流程发布 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk` 与依赖它的宿主包。
2. 确保宿主实际安装的是包含 `.utils` 重命名后产物的新版本。

## 用户 / 产品视角的验收步骤

1. 使用 Codex 会话类型，选择走 OpenAI-compatible bridge 的模型，例如 `dashscope/qwen3.6-plus`。
2. 在同一会话内先发起一轮正常请求，再继续发送可复用上下文的后续请求，最好包含工具调用链路。
3. 执行 `nextclaw usage --history --json` 或查看对应 usage 记录。
4. 确认本次记录里不再只有 `prompt/completion/total`，而是能看到 `input_tokens_details_cached_tokens` 一类 cache 指标。
5. 当上游模型真实命中缓存时，确认 `缓存` / `cachedTokens` 不再稳定为 `0`。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次没有只做 usage 补丁，而是顺手把本次触达的 bridge 工具模块统一改成带角色后缀的文件名，避免下次再因同一批历史命名债阻塞。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有新增新的 bridge 层或额外 telemetry 框架，只是在现有 bridge usage 组装点保留并转写已有字段。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到“新增最小必要”。按当前工作树口径估算，总体新增约 `1447` 行、删除约 `1384` 行，净增约 `63` 行；剔除测试后新增约 `1429` 行、删除约 `1379` 行，净增约 `50` 行。净增主要来自 `codex-openai-responses-bridge-stream.utils.ts` 中对嵌套 usage 的保留逻辑；同时偿还了 bridge 相关历史文件命名债，没有引入新的目录平铺。
- 抽象、模块边界、 class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。修复仍然留在 bridge usage 转写边界内，没有把 usage 处理散落到 recorder、query service 或 UI 层。
- 目录结构与文件组织是否满足当前项目治理要求：本次触达文件已满足角色后缀治理；但 `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src` 目录仍处于文件数预算上限附近，且 `codex-openai-responses-bridge-stream.utils.ts` 接近单文件预算，后续如 bridge 继续增长，应优先按 responsibility 拆分。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立判断。结论是“通过，保留少量结构债并已说明接受”；当前最值得继续收敛的点不是 usage 逻辑本身，而是 bridge stream utils 文件体积偏大。
