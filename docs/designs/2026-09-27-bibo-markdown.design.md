# Bibo Markdown 统一渲染与阅读体验

## 来源与目标

2026-09-27 用户要求完整检查 Bibo Markdown，提供了列表有缩进却没有标记的截图，要求参考 NextClaw 完善公式与图表，并授权统一优化、合入主干、部署。截图用作异常证据，不作为整页视觉原型。使命对齐：让搭档给出的结构化内容可完整阅读、复制和继续讨论。

范围是 Bibo 对话、收件箱和文件预览的 Markdown 展示、列表排版、流式组件身份和面向用户的说明；模型、账号、额度、存储和容器运行语义保持原合同。源工作区起点 `16ab3bf14830db39756613d9fb47625eccf99cb1`，既有五份 thought WIP 不属于本任务。首版草稿完成后发现远程主线已迁移至 personal-agent-ui；全部有效改动迁入以 `be98e4aca16a7b3a7fa11157ae30adaf2cf75968` 为起点的 `codex/bibo-markdown-unified`，保留现代会话和工作空间功能。

## 方案与 owner

- Bibo 保留 `@nextclaw/personal-agent-ui` 公共入口；其 Markdown 使用 `@nextclaw/agent-chat-ui` 根入口公开的 `ChatMessageMarkdown`。公式、Mermaid 流式节流和预览、脚注、图片共用原 owner；代码展示槽保留 personal-agent-ui 成熟的复制按钮、高亮和源码切换。删除重复 Mermaid 实现。Bibo 保留 HTTPS 图片和安全外链策略，原始 HTML 不执行；用户输入仍按原合同显示纯文本。
- 样式 owner 是 personal-agent-ui 的 `theme.css`，保留现代 Tailwind 4 配置；补充共享组件 utilities 的扫描源，以语义类适配主题。Tailwind preflight 已清除浏览器列表默认值，因此显式恢复普通、嵌套和有序标记，仅任务项取消圆点。同时改善六级标题、行内代码、长表格换行与最小列宽，代码和长公式保留局部滚动。
- 消息状态仍归聊天 store；为已保存/临时消息分配浏览器展示 ID，提交后沿用临时 ID。同一行在统一列表位置展示，避免生成完成时重建图表/预览。稳定行组件隔离历史 Markdown 与草稿/delta 更新。
- 共享渲染器若有直接影响本链路的容器或脚注缺陷，在其原 owner 修正并加定向回归；不创建 Bibo 特例解析器。
- 使用公开包入口与正式依赖；禁止从 shared 源文件 subpath 导入。包的默认产物需先构建，开发模式使用 package 的 development 条件。

选择共享组件而不是在 Bibo 增加一套插件，原因是同一语法、异步图表、错误处理和安全净化应只有一个 owner。Bibo 保留品牌外观；不引入 NextClaw 全站 CSS。单批交付，`plan: not-required`。

## 验收契约

contract-id: `bibo-markdown-2026-09-27`；revision: 2；parent-goal: 改善 Bibo Markdown，并合入及部署。目标与验收 ID 不变，架构适配最新主线。单阶段全部 Required。

| ID | 用户结果与判定 | 证据 |
| --- | --- | --- |
| MD-01 | 打开带标题、嵌套列表、任务列表、引用、行内代码与长表格的回答；标记清楚、续行对齐、段落有层次，手机无整页横向溢出 | 桌面/390px/窄屏真实浏览器计算样式和截图 |
| MD-02 | 阅读行内/块公式及 Mermaid；公式显示正确，图表可展开、缩放、关闭，错误源码可读 | 共享定向测试与 Bibo 组装页面 |
| MD-03 | 复制代码、打开图片和链接；代码保留换行，图片可展开，邮件/脚注链接有效，危险 HTML/URL 不执行 | 浏览器交互与共享边界回归 |
| MD-04 | 从生成到保存继续阅读；历史文本选区、临时行和图表 DOM 身份保持，读旧内容时不抢滚动 | SSE 组装冒烟、节点身份断言 |
| MD-05 | 中英文文档与帮助页说明新增能力，类型、定向静态与维护性检查通过 | 文档 diff、tsc、lint、Review |
| MD-06 | 本次提交进入 origin/master；从冻结远程 master 部署 Bibo，线上登录/生成/保存/刷新正常且资产包含新渲染器 | 主线协调结果、Wrangler 版本、live smoke |

黄金链路：登录 Bibo → 发消息要求列表、公式、Mermaid 与代码 → 阅读实时回答 → 展开图表/复制代码 → 保存完成后继续操作 → 刷新保留回答。另一路：手机阅读长列表/表格/公式 → 局部滚动 → 输入区始终可见。

偏好由用户判断，语法、交互、DOM 稳定性、数据保存和线上可达由 AI 验证。离线模拟可证明渲染边界，不冒充线上模型与保存链路。部署不涉及新的存储 migration，不发布 NPM/runtime/desktop。

## 方案 Review

mode=design：通过。已核对原始截图、完整 Bibo API→store→renderer 链路及公开共享组件；交付包括真实线上入口而非仅源码。主要风险是共享组件 utilities 缺失、包 CSS 产物装配和流式提交 remount，分别由 MD-01/02/04/06 覆盖。未关闭设计 findings：0。
