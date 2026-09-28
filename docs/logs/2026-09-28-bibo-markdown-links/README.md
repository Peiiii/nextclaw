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

线上版本、部署和线上复验结果在交付时补记。
