# v0.17.1-chat-send-availability-relaxation

## 迭代完成说明（改了什么）

- 放宽聊天输入框发送入口的 UI 前置禁用条件：现在只有运行时明确阻塞、或没有任何可发送内容时，才禁用发送。
- 输入框不再因为 `sessionTypeUnavailable` 被整体禁用，用户仍可输入、保留草稿并尝试发送。
- 发送链路不再因为模型列表未加载 / 为空、或会话类型被标记 unavailable 而在 UI 层静默拦截。
- 根因已确认：
  - `isNcpChatSendDisabled` 同时把 `runtime blocked`、空内容、无模型选项、`sessionTypeUnavailable` 都作为硬禁用条件。
  - `isNcpChatComposerDisabled` 又把 `sessionTypeUnavailable` 作为输入框整体禁用条件。
  - 这些状态有一部分来自 provider/session metadata、启动加载或旁路可用性判断；一旦上游状态短暂错误或刷新不同步，核心发送入口就会被沉默锁死。
- 本次修复为何命中根因：
  - 直接收窄同一个 availability owner 的禁用规则，删除导致沉默锁死的模型/会话前置硬拦截。
  - 保留运行时硬阻塞与空内容拦截，避免把无效点击或启动期不可交互状态误放开。
  - 不新增隐藏 fallback；真实发送失败仍由发送链路返回错误并恢复草稿，而不是在按钮层提前失效。

## 测试/验证/验收方式

- 已通过：`pnpm --filter @nextclaw/ui test -- ncp-chat-input-availability.utils.test.ts ncp-chat-input.manager.test.ts`
  - 结果：`2` 个测试文件、`9` 个测试用例通过。
- 已通过：`pnpm --filter @nextclaw/ui exec eslint src/features/chat/utils/ncp-chat-input-availability.utils.ts src/features/chat/utils/ncp-chat-input-availability.utils.test.ts src/features/chat/managers/ncp-chat-input.manager.test.ts`
- 已通过：`pnpm --filter @nextclaw/ui tsc`
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/utils/ncp-chat-input-availability.utils.ts packages/nextclaw-ui/src/features/chat/utils/ncp-chat-input-availability.utils.test.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-input.manager.test.ts`
  - 结果：无 error、无 warning。
  - 代码增减报告：新增 `68` 行，删除 `9` 行，净增 `+59` 行。
  - 非测试代码增减报告：新增 `4` 行，删除 `6` 行，净增 `-2` 行。
- 已通过：`git diff --check -- packages/nextclaw-ui/src/features/chat/utils/ncp-chat-input-availability.utils.ts packages/nextclaw-ui/src/features/chat/utils/ncp-chat-input-availability.utils.test.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-input.manager.test.ts`
- 未通过且未作为本次通过前提：`pnpm lint:new-code:governance`
  - 失败原因：当前工作区已有其它 staged/unstaged 改动触发 `packages/nextclaw-ui/src/shared/lib/i18n/chat.ts` 文件角色命名检查；该文件不是本次发送可用性改动触达文件。
- 未通过且未作为本次通过前提：`pnpm check:governance-backlog-ratchet`
  - 失败原因：仓库级 `docFileNameViolations` 当前为 `13`，高于 baseline `11`；该失败来自既有治理 backlog，不由本次输入框发送改动引入。

## 发布/部署方式

- 本次是前端聊天输入框源码调整，无需数据迁移、远程配置或额外部署脚本。
- 随下一次前端 / 桌面 / CLI 常规发版进入发布产物。
- 当前未执行发布，也未生成新的前端静态产物包。

## 用户/产品视角的验收步骤

1. 打开聊天会话，输入任意文本。
2. 在 provider metadata 尚未完全刷新、模型列表短暂为空、或当前 session type 显示 unavailable 的情况下，确认输入框仍可编辑。
3. 确认只要有文本、附件或技能 token，且运行时没有处于硬阻塞状态，发送按钮不再被上述 metadata 状态禁用。
4. 在运行时启动阻塞状态下，确认发送仍被禁用。
5. 清空文本、附件和技能 token，确认空内容不能发送。
6. 若真实发送链路失败，确认错误由发送链路显示，草稿可恢复，而不是按钮提前静默失效。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有新增补丁式 fallback，也没有新增第二套发送判断；直接删除过宽的前置禁用条件。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。总 diff 因补充定向测试为正；排除测试后非测试代码净增为 `-2` 行，未新增生产文件。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。禁用规则仍由 `ncp-chat-input-availability.utils.ts` 负责，发送动作仍由 `NcpChatInputManager` 负责，没有把状态修补塞进组件。
- 目录结构与文件组织是否满足当前项目治理要求：本次未新增生产文件，当前改动范围满足治理要求。仓库级治理命令被既有其它改动 / backlog 拦截，已在验证记录中说明。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。
- `post-edit-maintainability-review` 结论：
  - 可维护性复核结论：通过。
  - 本次顺手减债：是。
  - 长期目标对齐 / 可维护性推进：本次顺着“核心入口更可靠、代码更少、约束更少且更明确”的方向推进了一小步；把发送入口从旁路 metadata 状态中解耦，强化 NextClaw 作为默认入口的基础可靠性。
  - 代码增减报告：新增 `68` 行；删除 `9` 行；净增 `+59` 行。
  - 非测试代码增减报告：新增 `4` 行；删除 `6` 行；净增 `-2` 行。
  - 正向减债动作：简化 / 删除。
  - 为何不是单纯压缩行数：删除的是导致发送入口沉默失效的过宽分支，保留的测试覆盖了真实风险，不是把逻辑移到别处。
  - 可维护性总结：no maintainability findings。当前 watchpoint 是后续不要再把 provider/session 派生状态重新加回发送按钮硬禁用条件；这些状态应提示或由真实发送链路报错，而不是锁死核心入口。

## NPM 包发布记录

- 本次是否需要发包：不需要。
- 不需要原因：当前只完成源码层聊天发送可用性修正，未执行发布流程；改动将随下一次统一前端 / 产品发布进入产物。
- 需要发布哪些包：不涉及单独发包。
- 当前是否已经发布：未发布。
- 待统一发布：
  - `@nextclaw/ui`：待统一发布。
- 阻塞或触发条件：等待下一次统一前端 / 产品发布流程触发。
