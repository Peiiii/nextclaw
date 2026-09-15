# Markdown 折叠区块

## 目标与用户链路

用户打开含 `<details><summary>标题</summary>` 的 Markdown 文件或阅读聊天文档，看到可点击的折叠标题；点击或键盘激活后平滑展示内部 Markdown，再次激活收起。`open` 初始展开；嵌套区块各自控制展开状态。

## 实现选择

风险 L2，standard，单批实现，无独立 plan。共享 `ChatMessageMarkdown` 接入 rehype-raw 与 rehype-sanitize，在 KaTeX 前完成 HTML 解析及过滤。复用成熟 HTML 解析以覆盖嵌套、属性和不完整流式输入，避免手写正则解析器。保留 Markdown 所需标签、公式 class、资源 URI 与内部 token 数据；禁止事件、脚本及任意样式。默认 sanitize schema 承载安全 HTML 白名单。

折叠组件在 markdown 子目录，由模块级稳定组件维护局部展开状态，复用 `ChatCollapsibleContent` 的高度与透明度动效。标题提取为纯文本，避免按钮内部嵌套交互元素。无 summary 时使用本地化默认标题。默认 open 只用于初次挂载，不覆盖用户操作。原 front matter 继续保持独立紧凑布局。行内摘要模式不解析 HTML，避免在 span 内生成块级折叠组件。

输出提示词沿用 `ReplyFormatContextProvider`，仅新增一句语法及适用场景提示，关键结果不可藏入折叠区。

## 验收与边界

- 默认收起、open、键盘激活、嵌套、快速开关及内容追加；正文标题、列表、代码与公式不丢失。
- 代码围栏和行内代码中的标签保持源码；恶意 HTML、事件与危险 URL 被过滤。
- 既有 front matter、资源链接、inline token、公式定向回归；tsc、lint 和维护性检查。
- 本地真实文件预览操作验收，给出可打开文件的会话入口；聊天复用同一渲染器并做组装测试。UI 展示能力无需新增 CLI。
- 不执行文档里的脚本，不把渲染支持视为任意 HTML 应用宿主。

## 方案审查

通过：共享入口覆盖两类消费者；安全过滤先于公式渲染；原生按钮负责键盘语义；共享动画负责过渡和减少动态效果。重点回归内部数据属性、资源协议及流式更新。
