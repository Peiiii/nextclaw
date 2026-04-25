# v0.16.99-mobile-chat-input-toolbar-responsive

## 迭代完成说明（改了什么）

- 优化了移动端聊天 / 绘画类会话底部输入面板的 toolbar 空间分配。
- 收紧了移动端模型选择器下拉面板宽度，避免手机端下拉层显得过宽。
- 根因已确认：
  - `ChatInputBarToolbar` 之前给模型、会话类型、思考等级触发器设置了固定 `min-width`，移动端空间不足时模型触发器仍会挤占右侧发送 / 停止操作空间。
  - 模型选择触发器使用 `provider/model` 作为选中态文案，provider 部分在收起态优先级低，却会放大移动端横向占用。
  - 技能入口在移动端仍展示“图标 + 文字 + 数字”，导致有限宽度下左侧控制区过重。
  - 模型选择器下拉层内容宽度固定为 `320px`，在移动端视口里留白过多，视觉重心偏重。
- 修复方式：
  - 模型选择触发器改为 `min-w-0 flex-1`，按剩余空间自适应：空间足够时尽量完整展示，空间不足时才截断。
  - 右侧发送 / 停止操作设置为 `shrink-0`，保证操作优先级高于中间模型名。
  - 技能入口在小屏幕下只展示图标；已选技能数量改为右上角角标，桌面尺寸仍保留原有文字样式。
  - 模型收起态只展示 `modelLabel`；下拉列表仍保留 `provider/model`，保证选择时的信息完整性。
  - 模型下拉层宽度改为移动端 `w-[min(18rem,calc(100vw-1rem))]`、桌面端 `sm:w-[320px]`，只在手机端收窄，下拉内容密度更接近会话页可用空间。
  - 会话列表项的未读提醒不再悬在标题行中部，而是移动到原时间槽位，与时间做二选一：无未读时显示时间，有未读时显示圆点；运行状态仍保持在标题行右侧。

## 测试/验证/验收方式

- 已通过：`pnpm --filter @nextclaw/agent-chat-ui test -- chat-input-bar.test.tsx`
  - 结果：`1` 个测试文件、`18` 个测试用例通过。
- 已通过：`pnpm --filter @nextclaw/ui test -- chat-input-bar.utils.test.ts`
  - 结果：`1` 个测试文件、`12` 个测试用例通过。
- 已通过：`pnpm --filter @nextclaw/agent-chat-ui tsc`
- 已通过：`pnpm --filter @nextclaw/ui tsc`
- 已通过：`pnpm lint:new-code:governance`
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-actions.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-skill-picker.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-toolbar.tsx packages/nextclaw-ui/src/features/chat/utils/chat-input-toolbar.utils.ts packages/nextclaw-ui/src/features/chat/utils/chat-input-bar.utils.test.ts`
  - 结果：无 error；保留 `chat-input-bar` 目录历史直接文件数 warning，本次未新增文件、未继续恶化。
  - 代码增减报告：新增 `58` 行，删除 `33` 行，净增 `+25` 行。
  - 非测试代码增减报告：新增 `31` 行，删除 `32` 行，净增 `-1` 行。
- 已通过：`git diff --check`
- 未通过且未作为本次通过前提：`pnpm check:governance-backlog-ratchet`
  - 失败原因：仓库级 `docFileNameViolations` 当前为 `13`，高于 baseline `11`；本次没有新增或修改文档命名相关文件，该失败属于既有 backlog 状态。

## 发布/部署方式

- 本次是前端 UI 源码调整，无需数据迁移、远程配置或额外部署脚本。
- 随下一次前端 / 桌面 / CLI 常规发版进入发布产物。
- 当前未执行发布，也未生成新的前端静态产物包。

## 用户/产品视角的验收步骤

1. 以手机宽度打开聊天或绘画类会话详情页。
2. 查看底部输入面板 toolbar。
3. 确认技能入口在手机宽度下只显示图标；选择多个技能后，图标右上角显示数量角标。
4. 选择一个较长名称的模型，确认右侧发送 / 停止按钮不会被模型名挤出。
5. 在空间足够时确认模型名会尽量完整展示，不会因为固定宽度提前截断。
6. 打开模型下拉列表，确认列表项仍展示 `provider/model`，收起态只展示模型名。
7. 切回桌面宽度，确认技能入口仍保留文字展示，模型和其它 toolbar 控件布局正常。
8. 在会话列表里观察后台会话：默认仍在原时间位置显示时间；当会话产生未读更新后，原时间位置切换为未读圆点，运行状态仍保持在标题行右侧。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有新增移动端专用 toolbar 组件，也没有复制一套输入面板；只在现有 toolbar / skill picker / model select owner 内调整展示契约。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。会话列表继续沿用现有单文件 owner，没有新增组件或额外变体链；本次只是把未读提醒移动到既有时间槽位，没有再引入新的元信息节点。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。模型收起态文案仍由 `buildModelToolbarSelect` 负责，toolbar 布局仍由 `ChatInputBarToolbar` 负责，技能入口仍由 `ChatInputBarSkillPicker` 负责，没有增加新的 helper 层或平台分叉。
- 目录结构与文件组织是否满足当前项目治理要求：本次未新增文件，满足当前改动范围治理要求。守卫提示 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar` 目录历史直接文件数为 `13`，超过预算 `12`，但本次没有继续增加目录文件数；后续若继续大改输入栏，应优先拆分该目录职责或补目录预算治理说明。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。
- `post-edit-maintainability-review` 结论：
  - 可维护性复核结论：通过。
  - 本次顺手减债：是。
  - 长期目标对齐 / 可维护性推进：本次顺着“移动端体验更统一、代码更少、边界更清晰”的方向推进了一小步；没有把手机端体验修正做成第二套组件或隐藏 fallback。
  - 代码增减报告：新增 `58` 行；删除 `33` 行；净增 `+25` 行。
  - 非测试代码增减报告：新增 `31` 行；删除 `32` 行；净增 `-1` 行。
  - 可维护性总结：no maintainability findings。当前保留的 watchpoint 是 `chat-input-bar` 目录历史平铺度偏高；本次未新增文件，后续继续触达该目录时应优先做目录职责拆分。

## NPM 包发布记录

- 本次是否需要发包：不需要。
- 不需要原因：当前只完成源码层移动端输入栏体验修正，未执行发布流程；改动将随下一次统一前端 / 产品发布进入产物。
- 需要发布哪些包：不涉及单独发包。
- 当前是否已经发布：未发布。
- 待统一发布：
  - `@nextclaw/agent-chat-ui`：待统一发布。
  - `@nextclaw/ui`：待统一发布。
- 阻塞或触发条件：等待下一次统一前端 / 产品发布流程触发。
