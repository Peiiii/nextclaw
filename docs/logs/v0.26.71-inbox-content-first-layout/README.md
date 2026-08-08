# v0.26.71 收件箱内容优先布局

## 迭代完成说明

- 阅读弹窗不再为 Markdown 单独展示大标题和可见摘要；Markdown 与 HTML 统一使用单行小标题、时间和按需出现的翻页控件，摘要只保留为无障碍描述。
- 只有存在多条未读内容时才显示项数与上下切换按钮；单条内容不再展示无效的“第 1 项，共 1 项”和禁用箭头。
- 收件箱管理页移除页面说明与详情摘要，把详情标题压缩为单行顶栏；Markdown 阅读宽度由 `max-w-3xl` 扩到 `max-w-5xl`，HTML 继续使用无额外边框的内容画布。
- 列表区改用轻量 muted 表面，与正文自然分层；当前筛选和当前邮件复用主题系统的 selection token，保证明暗主题都有明确反馈，普通历史标题降低对比，未读项只增强标题字重并在第二行显示状态点。三个筛选项内联展示与其视图一致的数量，一行标题加一行摘要/日期与会话列表保持相同阅读节奏。底部按钮统一使用小号尺寸，管理动作与“继续聊”分组。
- 根因除了标题和摘要重复、正文被过窄宽度和过高 chrome 挤压之外，列表的筛选器、标题、摘要、时间与选中态视觉权重过于接近，缺少区域层和状态层。通过实际界面与会话列表逐项对照确认后，直接删除第三行时间与强对比筛选态，并复用现有灰阶、字号和表面 token，而不是增加新的展示模式或补丁覆盖。
- 同步刷新 Markdown、HTML 阅读弹窗及收件箱管理页的中英文产品截图；截图场景改为明确等待 iframe，避免紧凑标题与 HTML iframe 共享 `title` 时产生定位歧义。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/inbox/components/inbox-reader-dialog.test.tsx src/features/inbox/pages/inbox-page.test.ts`：5 个定向测试通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm exec eslint packages/nextclaw-ui/src/features/inbox/components/inbox-reader-dialog.tsx packages/nextclaw-ui/src/features/inbox/components/inbox-reader-dialog.test.tsx packages/nextclaw-ui/src/features/inbox/pages/inbox-page.tsx scripts/docs/product-screenshots/inbox-delivery-scenes.config.mjs`：通过。
- `pnpm --filter @nextclaw/ui lint`：0 个错误；保留 3 个与本轮无关的既有聊天测试文件长度警告。
- `pnpm --filter @nextclaw/ui build` 与 `pnpm --filter @nextclaw/landing build`：通过；仅保留既有 Browserslist 数据过期与 UI chunk 体积提示。
- `SCREENSHOT_SCENES=inbox-delivery-zh,inbox-delivery-en,inbox-html-delivery-zh,inbox-html-delivery-en pnpm run screenshots:refresh`：四个阅读弹窗场景通过。
- `SCREENSHOT_SCENES=inbox-page-zh,inbox-page-en pnpm run screenshots:refresh`：两个管理页场景通过。
- `SCREENSHOT_UI_THEME=charcoal SCREENSHOT_SCENES=inbox-page-zh pnpm run screenshots:refresh`：暗色管理页场景通过；确认当前筛选、当前邮件和三个筛选数量清晰可辨，随后重新生成正式雾蓝主题中英文资产。
- 人工逐张检查中英文 Markdown、HTML 与管理页截图：标题退到辅助层、单项翻页控件消失、正文首屏面积明显增加；列表与正文表面可区分，当前、未读和普通历史项具有明确权重，筛选器不再抢占主注意力，底部操作仍可理解。6 张源图均为 `3024 × 1656`、雾蓝主题、非空内容且没有调试或隐私信息，源图与 landing 镜像哈希逐对一致。
- `pnpm release:summary -- --json`：识别 `quiet-inbox-reading` patch changeset 及中英文配图，素材错误为 0。
- maintainability guard、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean` 与 `git diff --check`：全部通过。

## 发布/部署方式

- 本轮改动尚未提交、推送或部署。
- 不涉及数据库迁移、服务端部署或运行时更新；随 `@nextclaw/ui` 后续统一发布进入产品。
- 官网使用的收件箱展示镜像已经与仓库截图源同步，待后续正常官网发布后生效。

## 用户/产品视角的验收步骤

1. 收到一条 Markdown 报告并打开阅读弹窗，确认顶部只显示单行小标题和时间，不再重复显示摘要；正文从顶栏下方直接开始。
2. 仅有一条未读报告时，确认不显示项数和左右箭头；存在多条未读报告时，确认翻页控件恢复且仍可切换。
3. 打开 HTML 报告，确认正文继续占满阅读区域，iframe 四周有留白但没有额外黑色边框。
4. 进入收件箱管理页，确认未读、全部和已归档分别显示准确数量；列表区与正文区具有轻量表面差异，当前项、未读项和普通历史项能够依次辨认，筛选器不会比正文更抢眼，条目保持一行标题与一行摘要/日期；底部仍可标记、归档、删除或继续聊。
5. 切换到暗色主题，确认当前筛选和当前邮件具有清晰选中表面，hover 与选中状态不会混淆。
6. 在移动端确认标题不会挤压翻页和关闭操作，时间让位但完整标题仍可被无障碍读取。

## 可维护性总结汇总

- 删除 Markdown 与 HTML 两套阅读弹窗头部分支，统一为一个内容优先顶栏；没有新增组件、模式、状态或兼容路径。
- 复用现有 Button、IconActionButton、InboxDeliveryContent 与截图自动化 owner，只调整现有视觉合同和定位条件。
- 页面与弹窗的数据、状态和交互 owner 保持不变；本轮只收敛展示结构，没有把业务逻辑搬进样式层或新增 React effect。
- maintainability guard 检查 4 个源码、测试与脚本文件：总代码新增 145 行、删除 156 行、净减 11 行；排除测试后新增 135 行、删除 152 行、净减 17 行，0 个错误、0 个警告。
- 已使用 `post-edit-maintainability-review` 复核，结论为通过，`no maintainability findings`。正向减债动作是删除与简化：移除重复头部分支和重复可见信息层级，而不是通过压行、降低类型安全或转移复杂度达成净减。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch 发布，changeset 已添加，当前待后续统一发布。
