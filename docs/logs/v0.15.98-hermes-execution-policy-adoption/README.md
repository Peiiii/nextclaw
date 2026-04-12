# 迭代完成说明

本次迭代改成了“最小改动版”的 Hermes 主动性接入，没有再保留上一版那套过度设计。

最终实现只做了两件事：

- 新增一个很小的提示词 helper：[`execution-prompt.utils.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/execution-prompt.utils.ts)
- 在两个真实接入点按模型条件追加提示词：
  - NCP system prompt：[`nextclaw-ncp-context-builder.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts)
  - runtime user overlay：[`runtime-user-prompt.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts)

第一阶段保留的 Hermes 核心内容：

- `Tool Use Enforcement`
- `OpenAI/Codex Execution Discipline`
- `Google Model Operational Guidance`

本次没有引入：

- `agents.context.executionPolicy` 配置层
- pack 开关 / 总开关 / model override
- resolver / section service / system prompt service
- NCP 额外 message builder service

为了做到最小改动，我恢复复用了现有 [`context.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/context.ts) 作为 system prompt owner，而不是继续替换它。

相关方案文档：

- [2026-04-12-hermes-execution-policy-adoption-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-12-hermes-execution-policy-adoption-plan.md)

# 测试/验证/验收方式

已执行：

- `pnpm -C packages/nextclaw-core exec vitest run src/agent/tests/context.test.ts src/agent/tests/runtime-user-prompt.test.ts`
- `pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
- `pnpm -C packages/nextclaw-core tsc --noEmit`
- `pnpm -C packages/nextclaw tsc --noEmit`

已补跑维护性守卫：

- `pnpm lint:maintainability:guard`

结果说明：

- 本次改动相关的治理检查已通过。
- 守卫最终未能全绿收尾，是因为仓库中还有其它已触达但与本次任务无关的历史/并行改动文件触发了 class-methods 旧规则告警，本次未越界处理这些无关文件。

验证要点：

- GPT 类模型会在 NCP system prompt 中拿到 `Tool Use Enforcement` 和 `OpenAI/Codex Execution Discipline`
- Gemini 类模型会拿到 `Tool Use Enforcement` 和 `Google Model Operational Guidance`
- runtime user overlay 只增加一段很轻的当前轮执行提醒
- 原有 project context、skills、tool catalog、session orchestration 未回归

# 发布/部署方式

本次无需额外部署流程。

- 合入后随 NextClaw 常规构建与重启生效。
- 因为没有新增配置项，所以不存在额外配置迁移或灰度开关。

# 用户/产品视角的验收步骤

1. 用 `gpt-5.4` 发起一个需要读文件、改代码、验证的任务。
2. 观察模型是否更倾向于直接调工具，而不是只口头承诺。
3. 切到 Gemini 类模型，确认 system prompt 中会切换成 Google guidance。
4. 检查 NCP 主链 prompt 仍保留原有结构，只是追加了少量执行纪律文本。

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。

本次是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次主动撤回了上一版过度设计，改为复用现有 `ContextBuilder`，只保留一个很小的 helper 和两个接入点。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：做到。相对上一版实验性实现，本次删掉了整套 `execution-policy/*`、`system-context-prompt.service.ts`、`nextclaw-ncp-openai-message-builder.service.ts` 等重抽象，最终相对主干只保留少量增量改动。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更合适。现在只有一个小 helper 负责“按模型返回哪段提示词”，其余全部复用原有上下文组装链，没有再额外引入一层 system prompt 平台。

目录结构与文件组织是否满足当前项目治理要求：本次新增文件 [`execution-prompt.utils.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/execution-prompt.utils.ts) 满足 kebab-case 和角色约束。仓库内仍存在历史 legacy 命名告警文件，但不属于本次最小改动范围。

若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已基于独立复核填写。

可维护性复核结论：通过

本次顺手减债：是

代码增减报告：

- 新增：71 行
- 删除：19 行
- 净增：52 行

非测试代码增减报告：

- 新增：51 行
- 删除：18 行
- 净增：33 行

可维护性总结：

- 这版实现已经收敛到“一个 helper + 两个接入点”的最低可读结构。
- 没有继续引入配置系统或多层 resolver，符合第一阶段“先直接抄、先看效果”的目标。
- 如果后续验证这套提示词确实有效，再考虑是否有必要做第二阶段抽象；在那之前不建议继续平台化。
