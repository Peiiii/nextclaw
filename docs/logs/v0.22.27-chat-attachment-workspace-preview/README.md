# v0.22.27-chat-attachment-workspace-preview

## 迭代完成说明

本批把消息附件打开路径收敛到工作区右侧文件预览，并继续收轻全局键盘 focus 与消息图片展示。

核心交付：

- 消息中的文件 / 图片点击不再默认 `target=_blank`；有 handler 时走 `openFilePreview`，与 Markdown / HTML / 代码预览同一工作区 owner。
- 工作区 file tab 支持 `contentUrl` + `mimeType`：图片、音频、视频、PDF、HTML 在侧栏内嵌预览；docx / xlsx / 压缩包等诚实显示不支持，并提供下载与系统打开。
- 消息内图片去掉边框和「图片」角标，大小仅 hover 显示。
- 消息图片支持全局 lightbox：右上角放大按钮、单击 / 双击放大，Esc / 遮罩 / 关闭按钮退出。
- 全局 focus 去掉 `ring-offset` 方框，tabs / switch / dialog / shared button 统一为更轻的 `ring-1 ring-border`。

关键判断：

- 附件打开应是「文件预览」，不是 doc-browser 网页浏览。
- 图片在消息流里的主交互是全局放大预览；工作区侧栏预览留给文件/文档类附件。
- docx 等 office 格式不在浏览器原生渲染能力内；不引入假 iframe 预览，也不上 OnlyOffice 级重方案。

## 测试/验证/验收方式

已通过：

- `packages/nextclaw-agent-chat-ui`：`chat-message-list.attachments.test.tsx`（9 tests）
- `packages/nextclaw-ui`：`chat-message-list.container.test.tsx` + `chat-session-workspace-file-preview.test.tsx`（31 tests）

## 发布/部署方式

本次未执行发布或部署。

已新增 `.changeset/chat-attachment-workspace-preview.md`，后续随 `@nextclaw/ui` 与 `@nextclaw/agent-chat-ui` patch 统一发布。

## 用户/产品视角的验收步骤

1. 在会话中点开图片 / PDF / 音频 / 视频附件，确认在右侧工作区侧栏打开，而不是新浏览器窗口。
2. 点开 `.docx` 等 office 附件，确认侧栏说明暂不支持版式预览，并提供下载 / 系统打开。
3. 消息里的图片无边框、无「图片」角标；hover 才出现大小；点击图片、双击或右上角放大图标可进入全屏 lightbox。
4. lightbox 下按 Esc、点遮罩或关闭按钮可退出。
5. 用键盘 Tab 到 Marketplace 技能 tab 或其它按钮，确认 focus 只剩轻描边，不再出现厚方框。

## 可维护性总结汇总

- 复用现有 `openFilePreview` / workspace file tab，没有新增平行 preview owner。
- 图片 lightbox 收敛在 `ChatMessageFile` 内，未引入第三方 viewer 或新全局 store。
- 仅给 file tab 增加 `contentUrl` / `mimeType` 合同字段，预览分支按 kind 内嵌，office 走诚实空态。
- 全局 focus 收敛到 shared primitive 与 design-system utility，避免页面各自定义 ring-offset。
- 未引入 office 解析依赖或第三方 viewer。

## NPM 包发布记录

本次未发布 NPM 包。

- `@nextclaw/agent-chat-ui`：patch，消息附件交互与图片展示；待后续统一发布。
- `@nextclaw/ui`：patch，工作区附件预览、focus 规范与文案；待后续统一发布。
