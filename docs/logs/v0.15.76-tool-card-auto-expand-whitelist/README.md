# v0.15.76-tool-card-auto-expand-whitelist

## 迭代完成说明

- 将工具卡片“运行中自动展开”从默认行为收敛为白名单行为。
- 仅保留 `write_file` 与 `edit_file` 在运行中可自动展开；终端工具、搜索工具、通用工具，以及 `file_change` / `apply_patch` 等其它文件类卡片默认保持折叠。
- 保留原有的大体积 `write_file` 预览保护逻辑：超大写文件预览仍默认不自动展开，避免大 diff 抢占视线。
- 将 reasoning 区块展示文案统一收敛为“思考”。
- 为思考内容增加最大高度限制与内部滚动容器，避免长思考全文直接撑开聊天列表。
- 复用现有 `useStickyBottomScroll`，让流式思考内容在用户停留底部时自动贴底更新，用户手动滚离后则不强拉回底部。
- 更新相关测试：
  - 通用工具卡片不再因为运行中而自动展开。
  - 非编辑类文件操作卡片运行中保持折叠。
  - 原有 `write_file` / `edit_file` 相关行为保持覆盖。
  - 思考块标题、最大高度与贴底滚动行为得到覆盖。

## 测试/验证/验收方式

- 已执行：`pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
  - 结果：`2` 个测试文件通过，`29` 条测试通过。
- 已执行：`pnpm -C packages/nextclaw-agent-chat-ui lint`
  - 结果：通过；存在仓库既有 warning，无本次改动新增 error。
- 已执行：`pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - 结果：未通过。
  - 原因：当前工作区存在并行删除/迁移中的 `chat-composer-*` 文件，导致其对应旧测试 import 失效；失败与本次思考区改动无直接关系。
- 已执行：`pnpm -C packages/nextclaw-agent-chat-ui build`
  - 结果：通过。
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：未通过。
  - 原因：命中仓库既有历史问题 `packages/nextclaw/src/cli/commands/service.ts` 文件预算超限，与本次改动无直接关系；同时提示 `chat-message-list` 目录与 `tool-card-views.tsx` 接近/达到维护性预算，需要后续治理关注。
- 已执行：`pnpm lint:new-code:governance`
  - 结果：未通过。
  - 原因：当前工作区存在其它并行未提交改动，命中这些既有/并行改动里的 `context-destructuring` 规则，不是本次这三个改动文件引入的新违规。
- 冒烟说明：
  - 本次以组件级渲染测试作为最小 UI 冒烟，重点覆盖“运行中是否自动展开”与“思考区滚动/贴底”的真实展示路径。

## 发布/部署方式

- 本次未执行发布，不适用。
- 若后续随前端版本发布，按常规前端发布链路合入即可；本次改动仅影响 `@nextclaw/agent-chat-ui` 的工具卡片展开策略与思考区展示方式，无额外 migration、环境变量或部署前置步骤。

## 用户/产品视角的验收步骤

1. 在聊天 UI 中触发一个普通运行中工具，例如 `exec_command` 或搜索类工具。
2. 确认卡片保持折叠，只显示摘要与运行状态，不会在进入执行阶段后自动展开。
3. 触发一个 `write_file` 或 `edit_file` 工具。
4. 确认小体积文件预览会在短延迟后自动展开，便于用户直接感知即将写入/编辑的内容。
5. 触发一个大体积 `write_file` 预览。
6. 确认卡片仍默认折叠，避免长内容自动抢焦点。
7. 触发一个 `file_change` 等非 `write_file` / `edit_file` 的文件工具。
8. 确认其运行中保持折叠，只有用户主动点击时才展开。
9. 触发带 reasoning 的流式回复。
10. 确认标题显示为“思考”，而不是“Reasoning”或“推理过程”。
11. 当思考内容较长时，确认展示区域存在最大高度限制，内部滚动而不是整块把消息列表撑开。
12. 在思考内容持续流式增长时，若当前停留在底部，应自动贴底展示最新内容；若手动向上滚动查看历史，则不应被强制拉回底部。

## 可维护性总结汇总

- 可维护性复核结论：通过
- 本次顺手减债：是
- no maintainability findings

### 长期目标对齐 / 可维护性推进

- 本次顺着“默认更安静、用户按需展开、工具细节不主动打断主流程”的方向推进了一小步，更符合 NextClaw 作为统一入口应有的克制体验。
- 实现上没有再叠加新的开关、状态层或额外组件，而是把原本偏宽的自动展开策略收敛成一个清晰白名单，并把思考区滚动能力复用到现有贴底逻辑上，减少默认行为的惊扰面。
- 这次能删的，是“所有运行中工具默认自动展开”的隐性产品假设；删不掉的大文件/目录治理问题属于仓库既有债务，本次仅记录入口，未扩大其复杂度。

### 代码增减报告

- 新增：196 行
- 删除：17 行
- 净增：+179 行

### 非测试代码增减报告

- 新增：45 行
- 删除：7 行
- 净增：+38 行

### 复核判断

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有新增新层级，只是把默认展开逻辑改成白名单，并把思考区直接接到已有贴底滚动能力上，再用测试保护行为边界。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到。总代码净增主要来自测试补强；非测试代码净增 `38` 行，没有新增文件，也没有继续摊平目录。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。通过局部 helper 统一“哪些文件工具允许运行中自动展开”，并在思考区直接复用现有 hook，而不是再造一套滚动状态机。
- 目录结构与文件组织是否满足当前项目治理要求：部分未满足。`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list` 目录仍处于预算警戒区，`tool-card-views.tsx` 接近文件预算，`chat-message-list.test.tsx` 也已超过 lint 的 `max-lines` 警戒；本次未继续新增文件平铺，但后续应考虑按工具类型拆分视图与测试文件。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核；结论是本次改动本身没有新增可维护性问题，剩余风险主要是目录和文件体积的历史债务。
- 后续整理入口：
  - 可优先把 `tool-card-views.tsx` 按 `terminal / file / search / generic` 继续拆成独立模块。
  - 可为 `chat-message-list` 目录记录或落实结构化拆分方案，避免后续继续在平铺目录中叠加文件。
