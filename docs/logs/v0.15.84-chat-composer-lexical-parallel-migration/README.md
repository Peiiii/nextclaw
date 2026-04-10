# v0.15.84-chat-composer-lexical-parallel-migration

## 迭代完成说明

- 聊天输入框的 tokenized composer 已完成从手写 `contentEditable + DOM 同步` 方案到 Lexical 内核方案的平行迁移，根桥接入口继续保持极薄，只对外暴露原有契约。
- 旧实现已彻底删除，不再保留 `legacy/` 目录、旧 runtime/controller/dom renderer/view controller，也不再保留仅为旧实现守着的测试文件。
- 补齐了这轮迁移中的几个关键验收修正：
  - 选中 skill 后，skill token 在输入框内可见。
  - 粘贴图片/插入文件 token 后，文件 token 在输入框内可见。
  - slash 选中 skill 后按回车确认，不再把同一个 `Enter` 继续落成默认换行，焦点会回到 token 后面。
- 技术方案见：[2026-04-10-chat-composer-lexical-parallel-migration-plan](../../plans/2026-04-10-chat-composer-lexical-parallel-migration-plan.md)

## 测试/验证/验收方式

- 已执行：`pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-input-bar/chat-composer.utils.test.ts src/components/chat/ui/chat-input-bar/chat-composer-keyboard.utils.test.ts src/components/chat/ui/chat-input-bar/chat-slash-menu.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar-selection.test.tsx`
  - 结果：`5 passed / 24 passed`
- 已执行：`pnpm -C packages/nextclaw-agent-chat-ui exec tsc --noEmit`
  - 结果：通过
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：本次 chat composer 链路新增治理违例已清零；命令最终仍失败，但失败原因来自本次改动之外的既有/并行链路，例如 `packages/nextclaw/src/cli/commands/service.ts` 超预算继续增长，不属于本次迁移引入的问题。

## 发布/部署方式

- 本次为前端实现重构，不涉及数据库、后端 migration 或额外部署脚本。
- 按正常前端发布链路构建并发布包含 `packages/nextclaw-agent-chat-ui` 的产物即可。
- 发布前建议至少再次走一遍聊天输入框真实手测，重点覆盖 slash 选 skill、skill picker 选 skill、粘贴图片/插入附件 token、IME 输入。

## 用户/产品视角的验收步骤

1. 在聊天输入框中输入 `/`，选中一个 skill，按回车确认。
2. 确认 skill token 出现在输入框里，且光标停在 token 后面，而不是跳到下一行。
3. 通过 skill picker 选择一个 skill，确认输入框内能立刻看到对应 skill token。
4. 粘贴图片或通过附件入口插入文件，确认文件 token 出现在输入框里。
5. 在 Windows + 搜狗输入法环境下继续进行中文输入，确认不会出现旧实现里那种 preedit/组合态异常。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循删减优先、简化优先、代码更少更好：是。本次先完成平行迁移验证，再直接删除旧实现，而不是长期双栈并存。
- 代码增减报告：
  - 统计口径：仅统计本次 chat composer 迁移相关代码文件，不含 `docs/` 留痕文档。
  - 新增：`2186` 行
  - 删除：`1660` 行
  - 净增：`+526` 行
- 非测试代码增减报告：
  - 统计口径：同上，但排除 `*.test.*`
  - 新增：`1954` 行
  - 删除：`1386` 行
  - 净增：`+568` 行
- 若只看应用源码本身并再排除 `package.json` 与 lockfile，本次净增仍约为 `+242` 行。该增长的最小必要性在于：用 Lexical 稳定编辑内核替换旧的手写 DOM/runtime 黑魔法时，需要显式承接 editor-state、selection、token node、keyboard command、外部同步这几层职责；但与此同时，旧的 controller/runtime/dom renderer/view controller 已整组删除，根桥接层也继续保持极薄，没有留下双栈垃圾。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分达成。`chat-input-bar` 目录的直接文件数已从 `21` 降到 `13`，`legacy/` 目录已完全删除；但目录仍高于预算 `12`，且 `chat-input-bar.test.tsx` 继续变大，这两项债务本次记录保留。
- 抽象、模块边界、class/helper/service/store 等职责划分是否更合适、更清晰：是。现在根入口只做桥接；Lexical 相关实现统一收敛在 `lexical/` 目录；编辑器状态、语义操作、插件绑定、token 节点、handle owner 分层更清晰，不再把复杂度混在 DOM 读写黑箱里。
- 是否避免了过度抽象或补丁式叠加：是。本次没有再包一层兼容开关或 fallback 双路径，而是直接删除旧实现，保留单一路径。
- 目录结构与文件组织是否满足当前项目治理要求：部分满足。`legacy/` 已删除，边界显著清楚；但 `chat-input-bar` 根目录直系文件数仍超预算，下一步应优先把测试夹具/测试 harness 从 [chat-input-bar.test.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx) 中抽离，必要时为该目录补治理 README 或进一步细分子目录。
- 本次可维护性评估是否基于独立于实现阶段的 review：是。本节基于实现完成后的独立复核，不只是复述守卫结果。
