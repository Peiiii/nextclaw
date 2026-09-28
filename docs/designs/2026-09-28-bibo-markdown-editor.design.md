# Bibo Markdown 阅读与编辑

用户要求 Markdown 默认预览，并把编辑体验落地上线。现状：`FileEditor` 使用 textarea，文件页默认编辑、工作区只对 artifact 默认预览；版本保存与冲突由 `BiboSpaceOwner` 完整拥有。本任务采用 standard，交互 L2、浏览器草稿恢复 L3，发布独立执行 L4 合同。

## 用户链路与结果

1. 用户从文件、笔记、聊天链接打开已有 Markdown，先看到现有 Markdown renderer 的完整排版。点击「编辑」进入即时格式编辑：标题层级、粗体、斜体、删除线、引用与代码直接呈现样式，非当前行的格式标记收起。列表自动续行。点击「源码」查看并精确修改原始文本；查找替换、缩进、撤销重做和格式快捷键可用。
2. 编辑后预览显示同一草稿，三态切换保留编辑器实例、选区与撤销历史。保存按钮及 Cmd/Ctrl+S 使用原有版本校验；显示未保存、保存中、已保存或失败。刷新恢复本标签页按账号隔离的草稿，不能把本地恢复声称为服务器保存。
3. 服务端已更新时保留草稿与原版本，保存触发现有冲突处理，用户明确选择读取最新或覆盖。失败可重试，保存期间继续输入不被响应覆盖。文件显式 source 请求仍进入源码；HTML/SVG 继续使用现有隔离预览。

## 方案与 owner

选 CodeMirror 6，在 personal-agent-ui 提供独立可验证的 MarkdownEditor；编辑状态、selection、history 与语法装饰由 CodeMirror 拥有，React 只同步外部 value 与模式。文档字符串仍由 Bibo store 持有并保存。富文本 AST 往返可能重写数学、Mermaid、HTML、frontmatter 等已有文本，故不选；单纯双栏 textarea 不满足输入质量与紧凑工作区。

编辑是保留 Markdown 源文的即时格式模式，不做另一套 Markdown serializer。复杂表格、公式、图表仍在预览完整渲染，编辑/源码可精确修改。CodeMirror 官方 decoration 合同要求通过 decorations 改变内容表现，禁止 React/DOM 手改编辑器子节点；只采用不替换换行的 viewport 装饰，避免块渲染生命周期和输入法复杂度。源码支持 Markdown 及 fenced code language 高亮。快捷键与工具栏操作使用同一命令。

草稿恢复由 store 的 fileDrafts 变化触发，sessionStorage 按账号保存 dirty 文档及原版本，不保存凭据。写入失败有可见反馈；清洁文档移除备份，关闭放弃、删除清理，账号切换不互读。保留原来的 beforeunload 保护。新文件空内容可以直接编辑，已有文档默认预览。

## 验收与交付

- 文件页、笔记及聊天工作区的默认预览；显式 source 请求不被覆盖。
- 桌面和 390/320px 手机：编辑中文、标题/粗体、列表续行、源码高亮、查找替换、撤销重做、预览往返及保存刷新；输入器焦点样式与节点不跳动，两种现有主题。
- 保存失败保留草稿、刷新恢复、版本冲突、保存中继续输入；已有 store tests 与真实页面 fixture 证明异常分支。
- Worker/client/runner 和共享 UI 的 tsc、Vite build、现有产品 smoke 加定向编辑 smoke；上线后在实际站点复验部署资产并用现有专用账号完成真实文件保存刷新链路，清理本任务测试文件。
- 文档同步到中英文用户指南；从干净远程 master 使用 deploy:client，不滚动未变的容器。用户已授权上线所需提交、主线集成、推送与部署。

方案 Review：已核对目标、两个 FileEditor 入口、显式 source 与 store 保存/冲突链路。无第二份服务端协议与富文本文档 owner；不替代原 renderer。需重点验证 composition、外部值同步和 sessionStorage 失败。design-review: passed。plan: not-required，单批完整交付。
