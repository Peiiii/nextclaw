# 后台会话完成通知

## 迭代完成说明

- 新增可复用的全局应用内通知 owner，继续复用现有 Sonner Portal、队列与生命周期，不新增第二套 toast 容器或通知 store。
- NCP `message.completed` 现在由 chat completion notification manager 统一筛选；只有非当前会话的可见 assistant final 消息会弹出提醒。
- 通知展示会话标题与纯文本回复摘要，点击后通过标准会话路由进入对应会话；当前会话、隐藏消息、非最终消息和重复终态事件不会提醒。
- 回复摘要会去除标题、清单、引用、强调、代码围栏、具名链接地址和表格分隔符等 Markdown 展示标记，保留可读正文后再截断；原始会话消息不变，也没有在通知内引入第二套 Markdown renderer。
- 最近已处理消息 ID 使用 200 条有界集合去重。当前会话里完成的消息也会记入集合，避免离开会话后因事件重放补弹旧提醒。
- 通知卡按参考图的 Retina 比例收敛到 320 × 74px、20px 圆角、18px 阴影落幅、18px 水平 inset 和 12px 图文间距；摘要固定单行省略，窄屏保留 16px 安全边距，夜间主题使用设计令牌自动适配。
- 桌面通知右侧预留 72px，避开 56px 全局 Side Dock；Windows 顶部仍保留既有 56px 标题栏安全区。
- 新增中英文真实产品截图场景，通过全局 `AppNotificationManager` 在运行中的源码 UI 内展示通知，不使用后期合成卡片；截图以“每日 AI 与科技简报”作为可理解的后台结果示例，并由 changeset 绑定为版本说明候选素材。
- 设计依据见 `docs/designs/2026-08-05-background-session-notifications.design.md`。

## 测试/验证/验收方式

- 定向测试：
  - `pnpm --filter @nextclaw/ui test -- src/features/notifications/components/__tests__/app-notification-toast.test.tsx src/features/notifications/managers/__tests__/app-notification.manager.test.ts src/features/chat/managers/__tests__/chat-completion-notification.manager.test.ts src/app/components/__tests__/app-notification-runtime.test.tsx src/features/chat/pages/__tests__/ncp-chat-page.test.tsx`
  - 结果：5 个测试文件、13 个测试全部通过，包含 Markdown 纯文本摘要投影用例。
- TypeScript：`pnpm --filter @nextclaw/ui tsc` 通过。
- ESLint：`pnpm --filter @nextclaw/ui lint` 通过。
- 生产构建：`pnpm --filter @nextclaw/ui build` 通过；仅保留仓库既有的 Browserslist 数据陈旧与大 chunk 提示。
- 真实页面冒烟：在隔离的 `http://127.0.0.1:4179/chat/draft` Vite 实例中，通过真实全局 event bus 发送带 Markdown 的 NCP `message.completed`；`#`、`- [x]`、`**`、链接 URL 和反引号不再出现在通知里，页面显示“后台调研会话 / 调研工作已完成 结果报告已整理好，可以查看关键结论和下一步建议。”，点击后进入 `/chat/sid_dmlzdWFsLW1hcmtkb3duLXNlc3Npb24`，通知退场。
- 真实视觉验收：桌面 1280 × 800 下卡片为 `x=888, y=44, width=320, height=74`，右侧 72px 不遮挡 Side Dock；移动 390 × 844 下为 `x=54, y=16, width=320, height=74`，右侧 16px；Night 主题保持相同几何并正确切换背景、文字与边框。
- 交互验收：卡片是可聚焦链接，点击会 dismiss 并跳转；无目标地址的通知保持非交互 `status` 语义；当前会话完成、后续重放和相同消息 ID 重放均不会补弹。
- 治理检查：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、notification feature 目录组织检查全部通过。
- 可维护性守卫：14 个代码文件，0 error、0 warning、无红区触达；代码总计 `+692/-4`，排除测试后 `+327/-2`。
- UI 全量测试现状：`pnpm --filter @nextclaw/ui test` 为 826/844 通过，18 个失败分布在 6 个本次未修改的测试文件；失败栈未进入通知实现：
  - `chat-conversation-header-section.test.tsx`
  - `chat-sidebar.test.tsx`
  - `session-conversation-input.streaming.test.tsx`
  - `chat-conversation-welcome.test.tsx`
  - `chat-session-workspace-panel-content.test.tsx`
  - `chat-session-workspace-panel.test.tsx`
  主要表现为测试缺少 QueryClientProvider、历史文案断言和 query key 断言与当前实现不一致。本轮未扩大范围修复这些既有测试债务。
- 真实页面同时观察到既有 `NavigationLink` ref 警告，堆栈不经过通知模块；通知链路本身没有新增 console error。
- 宣传素材：`background-session-notification-{en,zh}` 两个场景通过配置测试和真实截图脚本，输出 1512×828 CSS 视口、2x 的中英文资产；人工复核确认右上角通知未遮挡 Side Dock，标题、摘要与页面背景均无测试状态或敏感信息。
- 构建后已运行 `pnpm clean:generated`，最终用 `pnpm check:generated-clean` 确认无生成物残留。

## 发布/部署方式

- 已随 NextClaw `0.28.0` 稳定版统一发布；`@nextclaw/ui` 升级到 `0.15.21`，顶层 `nextclaw` 升级到 `0.28.0`。
- 中英文版本说明已使用 changeset 绑定的真实通知截图，公开页面分别为 [中文](https://docs.nextclaw.io/zh/notes/2026-08-06-nextclaw-v0-28-0) 与 [English](https://docs.nextclaw.io/en/notes/2026-08-06-nextclaw-v0-28-0)。
- stable runtime workflow `31032968267` 已完成四个平台运行包、GitHub Release 资产与公共 manifest 发布。
- 不涉及数据库 migration 或后端服务部署；GitHub Release 事件同时发布了 Desktop `0.0.237` 安装资产与 stable 桌面更新通道。

## 用户/产品视角的验收步骤

1. 在会话 A 发起一次需要等待的 AI 请求。
2. 回复完成前切换到会话 B 或其他页面。
3. 等会话 A 收到最终 AI 回复后，确认右上角出现带会话 A 标题与纯文本回复摘要的通知卡，Markdown 标记和具名链接地址不会直接暴露。
4. 点击通知卡，确认进入会话 A，且通知立即消失。
5. 留在当前会话等待另一条回复完成，确认不会为当前会话弹出冗余通知。
6. 在窄屏和 Night 主题下重复步骤，确认卡片不越界、不遮挡右侧 Dock，文本与焦点状态可辨识。

## 可维护性总结汇总

- 可维护性复核结论：通过。
- 本次顺手减债：是。复用现有 NCP 最终事件、全局 event bus、Sonner Toaster、标准会话路由和现有 session display adapter，避免新增后端派生事件、轮询、平行 Portal、通知历史 store 或重复会话展示规则。
- 代码增减报告：新增 692 行，删除 4 行，净增 688 行。
- 非测试代码增减报告：新增 327 行，删除 2 行，净增 325 行。
- 这是新增用户可见能力；生产增长已经收敛到两个明确 owner：通用 `AppNotificationManager` 负责展示/生命周期，`ChatCompletionNotificationManager` 负责 chat 事件语义。React effect 只同步外部订阅与当前路由会话，没有承载业务编排。
- no maintainability findings。没有为未来假设预建优先级、通知中心、OS 通知或多动作系统；未来若出现真实需求，应继续扩展通用通知合同，而不是让业务模块直接调用 Sonner。

## NPM 包发布记录

- `@nextclaw/ui@0.15.21`：已发布到 `latest`，包含后台会话完成通知与全局应用内通知 owner。
- `nextclaw@0.28.0`：已发布到 `latest`，包含本次 UI 产物；registry 隔离安装与 `--version` 已验证。
- 远端 tags `@nextclaw/ui@0.15.21` 与 `nextclaw@0.28.0` 已推送；GitHub Release 为 https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.28.0。
