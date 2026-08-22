# v0.42.8 固有上下文体积优化

## 迭代完成说明

本迭代降低空用户、无额外技能场景的固定模型输入，从约 14,753 tokens 降到 9,907 tokens，减少约 32.9%。

根因是常驻上下文同时存在三类重复成本：技能目录为每项重复 XML 标签、引用和完整路径；Tooling 文本再次列出工具 schema 已经携带的名称与描述；回复格式合同用多组长段落反复表达同一约束。通过真实空环境装配测量确认这些内容属于每轮固定输入，而不是用户消息或会话历史。

修复直接收敛对应 producer：`SkillsLoader` 统一生成按 scope 和 root 分组的紧凑 Markdown 目录，保留所有技能及完整描述；Tooling 以 provider tool schemas 作为唯一工具目录；Reply Format 合并重复规则。没有引入按需搜索、技能隐藏、工具裁剪或行为开关。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core exec vitest run src/features/agent/features/tests/skills.test.ts`：14 项通过。
- `pnpm --filter @nextclaw/kernel exec vitest run src/contributions/context-provider/providers/reply-format-context.provider.test.ts src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`：5 项通过。
- `pnpm --filter @nextclaw/kernel exec vitest run src/managers/__tests__/context-provider.manager.test.ts src/contributions/context-provider/providers/tests/tooling-context.provider.test.ts`：5 项通过。
- `pnpm --filter @nextclaw/core tsc` 与 `pnpm --filter @nextclaw/kernel tsc` 通过。
- 目标文件 ESLint、`git diff --check` 与 diff-only maintainability check 通过；只有 provider 目录既有且未恶化的备案容量 warning。
- 使用临时 HOME 直接启动当前 TypeScript 源码的 `NextclawKernel`，完整装配空用户固定输入并在退出后清理临时目录，测得 `fixedInputTokens=9907`。

## 发布/部署方式

本次仅提交源码、测试、changeset 与迭代记录；未 push、发布、部署或重启当前 NextClaw 实例。改动需在后续正常构建和运行时更新后作用于新会话，已经创建的会话不会逆向缩小上下文。

## 用户/产品视角的验收步骤

1. 使用包含本提交的 NextClaw runtime 创建无用户技能、无项目规则的新会话。
2. 确认完整技能目录及每项完整描述仍可见，技能仍可按根目录加载。
3. 确认工具 schema、可调用工具数量和回复展示能力没有减少。
4. 检查上下文窗口预览，固定输入应低于 10,000 tokens；长会话相比旧版本更晚触发压缩。

## 可维护性总结汇总

本次遵循删除重复和单一 owner 原则：技能目录只有一个 renderer，工具 schema 是工具目录唯一事实源，回复格式合同不再维护多份同义规则。非测试代码净减少 53 行，未新增运行分支、fallback、wrapper 或 provider 文件。自动维护性检查无错误；其目录 warning 来自已有 provider 文件数备案且本次计数未变化，补充主观复核后无 finding。

## NPM 包发布记录

当前未执行 NPM 发布。`@nextclaw/core` 与 `@nextclaw/kernel` 需要在后续统一发布批次中按 patch changeset 发布。
