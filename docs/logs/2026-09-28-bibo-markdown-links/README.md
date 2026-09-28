# Bibo Markdown 文件链接与排版

2026-09-28，用户指出 Bibo 中 `[搭档启动卡.md](/data/workspace/搭档启动卡.md)` 未显示为可点击文件链接，并要求举一反三、参照 NextClaw 统一 Markdown 间距及标题比例，直接上线。

## 根因与交付

- 共享 Markdown 已解析链接，但 Bibo 的 `workspaceResources.href` 拒绝绝对路径；无效链接样式又去掉下划线，看起来像普通文字。
- Bibo 用户消息仍用纯文本显示；收件箱的 compact 样式和聊天正文另有不同字号、标题与段落间距。
- 前端现在映射个人工作区相对路径、绝对路径和本地 `file:` URI 到既有文件路由；服务器继续执行账号空间、真实路径和符号链接校验。用户消息、助手消息、收件箱和文件预览复用同一 Markdown renderer。
- Markdown 排版数值对照 `packages/nextclaw-ui/src/index.css`：正文 `0.925rem/1.72`，标题 `1.22/1.12/1.02/0.96rem`，根块间距 `0.75rem`、标题前 `1.25rem`、后 `0.5rem`。删除收件箱独立 compact 分支，并保留混合任务列表里的普通圆点。
- 收件箱跳转文件时使用现有独立文件路由，避免手机端先打开目录页而不显示目标文件。

## 验证

- 共享组件单测 4 项通过；Bibo TypeScript 三范围、共享 UI TypeScript、定向 ESLint、客户端构建通过。
- Playwright 在 1440、390、320px 验证链接、刷新、文件预览、危险 URI 禁用、越界错误、列表标记、公式、Mermaid、代码复制及排版；收件箱布局在 2048、1440、1100、390、320px 通过。
- 本地浏览器截图保存在 `/tmp/bibo-markdown-inbox-{1440,390,320}.png` 与 `/tmp/workspace-resource-{1440,390,320}.png`，供视觉偏好确认。
- 简约主题聊天截图保存在 `/tmp/bibo-markdown-neutral-{1440,390,320}.png`；用户消息文件链接与气泡的实测对比度不低于 4.5。
- diff-only maintainability 检查无错误；两项警告为资源冒烟脚本接近文件预算，以及 `apps/bibo-hosted/src/app` 原有文件数例外。本次未新增该目录文件，脚本仍低于预算。实现 Review 无未关闭 findings。

## 主线与上线

- 与远程新增的 Bibo 缺失文件提示修正合并后，冻结并推送 `master`：`b3a989d2bd7c46b41e5258f57d3549180f155ae6`。合并后的 TypeScript、客户端构建、资源回归、聊天 Markdown 和文件工作台冒烟通过。
- 从这一干净的远程主线提交运行 `pnpm -C apps/bibo-hosted run deploy:client`，Wrangler 版本 `4.138.0`，Worker version ID `b6a9b4aa-1b2e-4349-8a8a-9d5a4e433b8c`。Bibo 主页与 `bibo.bot/app/` 返回 200，JS `index-v285ONHs.js` 和 CSS `index-B4IzgPF0.css` 与本次构建一致。
- 容器应用 `bibo-hosted-bibousercontainer` 部署前后均为版本 22，镜像摘要均为 `sha256:b32bcfb2cde302b69944695df41ee5395ee3f27a6d1d6acc36cc1515f55b381a`；本次未构建、推送或滚动镜像。
- 线上浏览器带 API fixture 在 1440、390、320px 通过资源链接及反馈、聊天 Markdown、收件箱排版；收件箱布局另覆盖 2048 与 1100px。fixture 仅证明线上资产及前端链路。
- 专用线上测试账号的真实模型调用完成文件创建、保存、自动预览和刷新，桌面与手机均成功；测试产物和会话已由脚本清理。首次尝试在会话历史读取时遇到一次网络连接超时，按相同入口重试通过。另用该账号临时创建文档，`file.get({ path: "/data/workspace/<文件名>.md" })` 返回同一文件与内容，随后已删除。
- 本地主工作区有与本任务无关的文档改动，主线同步脚本返回 `LOCAL_WORKTREE_RETRYING` 并由现有自动 worker 接管；未覆盖用户改动。

`AUTOMATION_INTERVENTIONS: 0`。用户仍可根据预览和线上页面确认视觉偏好；功能与生产读取链路已自验。
