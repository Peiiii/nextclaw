# v0.20.80 Chat 新会话类型偏好

## 迭代完成说明

本次将 chat sidebar 左上角的新会话入口拆成“创建动作”和“类型偏好”两个语义：

- 左侧 `新增会话` 是唯一创建动作，按当前偏好创建会话。
- 右侧控件只切换后续新会话类型，不再直接创建会话。
- 左侧新增和右侧类型切换默认使用无边框 `brandSoft` 风格，右侧常态只展示当前 agent runtime / session type 图标；类型名称只在下拉菜单里展示。
- 顶部操作区保留 `neutralSurface`、`brandSoft`、`brandTextSurface`、`brandSolid` 四个语义化颜色变种，便于设计调试时对比中性浅色、柔和品牌色、中性表面品牌文字和实心品牌主色。
- 右侧类型切换器新增小下拉箭头，并增强左右两个按钮的 hover 反馈，避免用户误以为右侧只是静态图标。
- 新会话类型通过 kernel-backed preference 持久化，key 为 `chat.newSession.sessionType`。
- 前端 preference key 收敛到统一 registry，现有 `chat.modelFavorites` 也迁入同一 key catalog。

根因：原右侧下拉组件名和行为都偏向“选择即创建”，但用户心智更接近“设置后续新会话类型”，导致控件语义和实际动作不一致。

确认方式：通过 sidebar 组件测试验证右侧选择只写 preference、不触发创建；通过 hook 测试验证 preference 读取、无效值回退和不可选类型不写入。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/features/session-type/components/__tests__/chat-session-type-menu.test.tsx src/features/chat/features/session-type/components/__tests__/chat-session-type-option-item.test.tsx src/features/chat/features/session-type/hooks/__tests__/use-chat-new-session-type-preference.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm lint:new-code:governance -- --files ...`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`

本地 UI 冒烟：

- 页面：`http://127.0.0.1:5174/chat`
- 方式：Playwright headless DOM 验证，不截图。
- 结果：左侧 `New Task` 和右侧 session type trigger 常态计算样式均为 `rgba(93, 107, 82, 0.1)`，对应 `brandSoft` 的 `bg-primary/10 text-primary`；无边框；hover 后背景和 soft shadow 发生变化；右侧 trigger 文本为空，并同时包含 runtime 图像和下拉箭头；打开下拉后展示 Native、Codex、Hermes 等类型名称和选中态；临时切到 Native 后 `/api/preferences/chat.newSession.sessionType` 写入 `native`；URL 保持 `/chat`，session link 数量保持不变；最后恢复原偏好 `codex`。

## 发布/部署方式

不涉及部署。

## 用户/产品视角的验收步骤

1. 打开 chat 主界面，观察 sidebar 左上角右侧类型控件只显示当前 runtime 图标。
2. 点击右侧图标，打开会话类型菜单，菜单里能看到类型名称、图标、ready/setup 状态和当前选中状态。
3. 在菜单里选择 Codex 等非默认类型，确认没有立即创建会话。
4. 点击左侧 `新增会话`，确认新会话使用刚刚选择的类型。
5. 刷新页面后，确认右侧图标恢复上次选择的类型。

## 可维护性总结汇总

本次新增用户可见能力，允许必要代码增长。维护性处理重点是收敛语义 owner：

- preference key 统一进入 UI API key catalog，避免 feature 内散落字符串。
- 新会话类型偏好逻辑放在 `features/chat/features/session-type` hook，不进入输入组件或 sidebar 展示组件。
- `ChatSidebarCreateMenu` 收敛为中性 `ChatSessionTypeMenu`，避免组件名继续暗示“选择即创建”。
- sidebar toolbar 只消费解析后的当前类型和选择回调，不直接知道 preference API 细节。

`post-edit-maintainability-review` 结论：通过。

代码增减报告：

- 新增：589 行
- 删除：30 行
- 净增：+559 行

非测试代码增减报告：

- 新增：314 行
- 删除：22 行
- 净增：+292 行

这是新增用户可见能力，因此非测试净增不适用非功能 `<= 0` 硬门槛。净增主要来自新偏好 hook、菜单组件重命名后的中性化实现、组件测试和 hook 测试。维护性 guard 仅剩 warning：`chat-sidebar.test.tsx` 当前 898 行，接近 900 行预算，后续继续扩展该文件时应优先拆 fixtures/builders；`shared/lib/api` 保持已有目录预算豁免，未新增根目录文件数量。

## NPM 包发布记录

需要随下一次 NPM 批次发布 `@nextclaw/ui` patch，因为本次包含 chat sidebar 用户可见交互变化。当前仅添加 `.changeset/chat-new-session-type-preference.md`，状态为待统一发布。
