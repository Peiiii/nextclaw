# 上下文压缩截断恢复

## 迭代完成说明

本次修复了上下文压缩摘要触及 provider 输出上限后，会话反复失败且无法推进的问题。根因是旧链路把 `finishReason=length` 直接等同于整份摘要不可用：它既不检查必要上下文是否已经完整，也不缩小下一次压缩输入，checkpoint 因而保持不变，后续消息会重复进入同一失败状态。

该根因由 GitHub #27 的故障信息、原压缩生成链路和定向复现共同确认。修复针对失效状态本身：摘要采用重要性递减且可验证的必要前缀；必要前缀完整时接受截断并原子丢弃未闭合尾部，不完整时最多进行三次输入严格缩小的语义重试；仍失败时不再调用模型，而是从受保护锚点和近期原文构建确定性降级 checkpoint。Provider 鉴权、配置和网络终态错误不进入语义重试。

同时把输出预算改为由可安装目标派生，并让 DeepSeek 兼容调用在压缩时明确关闭 thinking。设计见 [上下文压缩截断恢复设计](../../designs/2026-08-22-context-compaction-truncation-recovery.design.md)，公开技术叙事草稿见 [让上下文压缩不再卡死会话](../../blog-drafts/2026-08-22-context-compaction-without-dead-ends.blog-draft.md)。

## 测试/验证/验收方式

已通过：

- `pnpm validate:context-compaction`：152 项跨 core、kernel、runtime、server 与 UI 的链路测试。
- OpenAI-compatible 与 LiteLLM provider 定向测试：24 项。
- runtime provider 注册表 Node test：4 项。
- `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/runtime` 的 `tsc --noEmit` 与 build。
- diff-only maintainability 检查：0 errors。
- `git diff --check`。
- `pnpm release:summary -- --json`：changeset 与博客绑定校验通过。

覆盖场景包括必要标记前后截断、未闭合可选尾部丢弃、输入 token 单调下降、三次调用上限、第三次 essential-only、确定性近期上下文恢复、provider 终态错误不做语义重试、取消、已有 checkpoint、mid-run continuation 和最终输入预算。

## 发布/部署方式

无迁移和手动配置。合入并随下一稳定版统一发布 `@nextclaw/core`、`@nextclaw/kernel` 与 `@nextclaw/runtime` 后生效。本次仅提交源码、测试、changeset、设计、迭代记录和博客草稿，不执行 push 或发布。

## 用户/产品视角的验收步骤

1. 构造会触发压缩且摘要输出在必要前缀之后截断的长会话，确认 checkpoint 安装成功且下一条消息继续处理。
2. 让摘要在必要前缀完成前连续失败，确认最多三次 provider 调用，每次输入严格缩小。
3. 让三次摘要都不合格，确认不发生第四次模型调用，会话改用近期原文 checkpoint 继续。
4. 模拟 provider 鉴权或配置终态错误，确认只返回真实错误，不伪装成摘要恢复并重复消耗 token。
5. 查看 `summaryDiagnostics`，确认调用次数、finish reason、预算、usage 和 recovery 类型可追踪。

## 可维护性总结汇总

本次把 provider I/O、结构判定、重试和最终恢复从原本过大的 preflight service 拆到单一摘要生成 service；DeepSeek/OpenAI-compatible thinking 映射收敛为纯工具函数，没有新增平行压缩主链路或无意义 wrapper。preflight source 从 634 行降至 466 行，相关 preflight test 从约 967 行降至 763 行，OpenAI provider 维持在原预算以内。

自动维护性检查为 0 errors、5 个临界预算 warnings；经主观复核，没有未关闭 finding。新文件角色、feature 边界和命名通过 planned-path preflight，代码和目录扩散未恶化。

## 红区触达与减债记录

### packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-preflight.service.ts

- 本次是否减债：是。
- 说明：移出摘要生成和恢复状态机，preflight 恢复为编排 owner。
- 下一步拆分缝：当前无需继续拆分；后续仅在 profile/budget 编排出现独立变化点时评估。

### packages/nextclaw-core/src/features/llm-providers/providers/openai.provider.ts

- 本次是否减债：是。
- 说明：移除内联 thinking 特判，改用纯映射工具，文件行数低于改动前。
- 下一步拆分缝：若更多 provider 增加 chat-completions thinking 方言，继续扩展独立 capability mapper，不回填 provider 主类。

### packages/nextclaw-kernel/src/utils/context-compaction-summary-input.utils.ts

- 本次是否减债：部分。
- 说明：协议解析、预算裁剪和确定性 fallback 保持为无 I/O 的纯函数 owner，但文件接近预算预警线。
- 下一步拆分缝：当协议再增加新的独立格式版本时，拆出 protocol parser；当前不为消除 warning 引入额外层。

## NPM 包发布记录

需要随下一稳定版统一发布：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/runtime`，当前状态为“待统一发布”。已添加 changeset；本次未执行 NPM 发布。
