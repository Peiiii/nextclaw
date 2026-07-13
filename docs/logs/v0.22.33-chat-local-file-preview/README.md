# v0.22.33-chat-local-file-preview

## 迭代完成说明

本批统一了会话中的本地文件展示链路，并修复流式输出期间会话弹层被输入框焦点关闭的问题。

- AI 在回复中展示图片时优先使用 Markdown 图片；需要立即打开侧栏时使用 `show_file`，`view_image` 仅用于模型读取图片。
- 任何语法成立的 Markdown 链接都保持链接语义，目标缺失或失效在点击后由文件打开链路反馈；危险协议保留禁用链接语义但不会执行。
- `show_file` 默认使用自动预览，SVG、常见图片、音视频、PDF、DOCX、XLSX 和 PPTX 会按文件类型展示；只有 HTML 的自动 viewer 默认展示源码。
- 本地 Markdown 图片支持绝对路径和项目相对路径，不再把文件系统路径直接交给浏览器。
- 工作区侧栏新增 Word、Excel、PowerPoint 预览；缺少纸张几何信息的 DOCX 使用响应式阅读样式，多列表格局部横向滚动；旧 `.doc/.ppt` 等不支持格式仍提供下载与系统打开。
- 设置、会话切换、项目选择等聊天弹层统一使用 `ChatPopoverContent`。流式输入框程序化恢复焦点时弹层保持打开，点击外部与 Escape 仍会正常关闭。

根因确认：本地文件曾同时存在路径段 URL、相对路径读取和浏览器直接加载三种方式，Markdown 安全层还把可点击资格绑定在扩展名白名单上；`ChatThreadManager` 又把所有 `viewer=auto` 错误改成 `source`。DOCX 默认渲染器在文档缺少纸张尺寸时会直接压缩到侧栏宽度，导致表格逐字断行。弹层则只在设置菜单局部处理输入框焦点，其他聊天弹层没有共享该规则。本次将新调用统一到 `/api/server-paths/content?path=...&basePath=...`，分离 Markdown 语法、资源可用性与 viewer 选择，并把焦点策略收敛到聊天域共享弹层组件。

## 测试/验证/验收方式

已通过：

- `@nextclaw/agent-chat-ui`：Markdown 资源与流式输入焦点定向测试，58 tests。
- `@nextclaw/ui`：本地文件预览、Office viewer、viewer manager、共享弹层和 URL 构建定向测试，54 tests。
- `@nextclaw/server`：server path controller、Office MIME 与原始字节定向测试，13 tests。
- `@nextclaw/kernel`：回复合同、`show_file` 与静态上下文合同测试，9 tests。
- 四个触达包的 `tsc --noEmit`。
- 本次触达文件的定向 ESLint 通过且无 warning；scoped governance、backlog ratchet、generated-clean 与 `git diff --check` 通过。全工作区 governance 被并行改动中的 Claude SDK 测试 `../types` 导入阻断，与本批路径无关。
- 前端开发服务器 `http://127.0.0.1:5174` 经代理请求源码后端：真实 DOCX/XLSX/PPTX 均返回正确 MIME 且响应字节与源文件一致。
- 在真实会话 `ncp-mrj8jw0a-9d3199e5` 中验证：原 `[hangzhou-weather-2026-07-13.docx](hangzhou-weather-2026-07-13.docx)` 已成为可点击链接；真实 DOCX 在 447px 侧栏渲染出“杭州天气简报”和表格，六列表格局部滚动且不逐字断行；真实 XLSX 显示 3 个工作表，真实 PPTX 显示幻灯片内容。

## 发布/部署方式

本次未执行发布或部署。

已新增 `.changeset/chat-local-file-preview.md`，后续随受影响包的 patch 版本统一发布。

## 用户/产品视角的验收步骤

1. 让 AI 用 `show_file` 展示本地 PNG 或 SVG，确认图片在会话工作区中可见。
2. 在 Markdown 中引用绝对图片路径和项目内相对图片路径，确认两者均正常显示。
3. 在侧栏打开 DOCX，确认文档内容、响应式页边距和多列表格可读；打开 XLSX/PPTX，确认工作表切换与幻灯片内容可见；旧 DOC/PPT 仍可下载或系统打开。
4. 收起侧边栏并让 AI 持续流式输出，打开会话切换或左下角设置，确认菜单不会立即消失；点击外部或按 Escape 后正常关闭。

## 可维护性总结汇总

- 可维护性闸门通过：本批生产代码新增 1012 行、删除 355 行、净增 657 行；这是 Word/Excel/PowerPoint 新用户能力、统一本地资源协议和共享弹层行为所需的功能增长。
- 原工作区预览组件从 536 行降到 422 行，文件类型识别、DOCX、表格、演示文稿、加载状态与 ArrayBuffer 获取被拆到同一 workspace feature 的职责文件中。
- 删除了前端 POSIX/Windows 绝对路径的两套 URL 拼接分支，新调用统一使用 query 内容路由。
- 没有新增平行 preview owner；Office 组件的 React effect 只同步 fetch、第三方解析器和 DOM renderer 等外部系统。
- 现有 message list、context provider 和 server app 目录预算提示均有既有例外，本次未增加这些目录的直接文件数量；`chat-thread.manager.ts` 保持 602 行、净增长为 0。

## NPM 包发布记录

本次未发布 NPM 包，以下包均为 patch，待统一发布：

- `@nextclaw/agent-chat-ui`
- `@nextclaw/kernel`
- `@nextclaw/server`
- `@nextclaw/ui`
