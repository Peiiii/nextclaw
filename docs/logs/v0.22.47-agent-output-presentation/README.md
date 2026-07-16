# v0.22.47-agent-output-presentation

## 迭代完成说明

本批把“Agent 如何把结果交给用户”收敛为一份统一合同。聊天 UI 会把最后一个工具调用及其之前的 reasoning / tool activity 收进“已处理”，因此 Agent 现在会明确知道：最后一个工具调用之后必须再给出自包含的最终回复，不能把结论只留在工具前 narration 或原始工具输出里。

原本分散在 `InlineInteractiveSurfaceContextProvider` 与 `ReplyFormatContextProvider` 的 Markdown 链接、图片、inline display、Panel Card 和 side panel 选择规则，已经统一归 `ReplyFormatContextProvider`。实际模型工具仍是 `show_file`、`show_url`、`show_panel_app` 三个窄合同，内部继续复用既有 `showContent` request / event owner，没有新增展示链路。

聊天 Markdown 新增 Mermaid fenced block 展示：按宿主明暗主题动态渲染，使用严格安全模式，语法错误时回退为可复制源码。流式输出会合并高频更新，并在新图完成前保留上一张有效 SVG，不再反复切回加载态或闪出半截语法错误。消息复制动作也从 Agent 消息扩展到用户消息，继续复用同一个复制组件与反馈文案。方案依据与边界记录在 `docs/designs/2026-07-15-agent-output-presentation-contract.design.md`。

Mermaid 闪烁的根因是每个流式 token 都会改变 `renderKey`，旧 SVG 因此在新一轮异步渲染完成前被同步判定为失效并替换成骨架屏；已启动但过期的 Mermaid 任务还会继续排队。回归测试通过延迟第二次渲染稳定复现了“新图未完成时旧 SVG 已从 DOM 消失”，从而确认问题发生在 renderer 生命周期，而不是 ReactMarkdown 整棵消息树重挂载。修复直接改变这条失效链：流式输入先合并，更新期间保留最后一张有效 SVG，cleanup 取消未开始的任务并忽略过期结果，最终内容再立即收敛，因此处理的是根因而不是降低动画或隐藏骨架等表面缓解。

### 2026-07-16 Mermaid 首屏与流式渐进渲染补充

进一步真实使用后确认还有两条体验缺口：首次渲染分支会直接返回 Mermaid 源码块，因此历史会话进入时必然先闪源码；流式调度使用 300ms trailing debounce，每个 token 都会重置完整等待窗口，因此持续输出时实际要等源码结束才开始渲染。两条修前测试分别稳定复现了源码首帧和连续 300ms 无图帧，证明根因在 Mermaid renderer 的加载态与调度语义，不在消息 transport 或 ReactMarkdown 识别。

补充实现删除源码加载态与 trailing debounce，改为稳定 `figure` 占位、200ms latest-only throttle、单在途渲染和最终帧立即收敛。渲染期间的新 token 只覆盖 pending request，当前任务结束后直接追赶最新源码；流式无效快照不进入错误态，最终无效语法才回退可复制源码。React Strict Mode 的 effect 重放也通过独立失败测试发现并闭合，timer cleanup 会同时清空句柄，避免初始流式帧被已取消的 timer 阻塞。

视觉验收继续发现假节点骨架会被理解为“空图”或“渲染失败”，尤其多张 Mermaid 连续出现时，大面积边框会切碎正文节奏。首图占位因此进一步收敛为无边框的紧凑加载条，使用旋转进度图标和本地化“正在渲染图表”文案明确状态；成功 SVG 同样移除卡片边框与底色，作为正文图形直接排版。已有有效 SVG 更新时不出现加载条，仍保持上一帧；只有最终错误态保留边界。这个调整减少视觉重量，但不改变调度器、DOM identity 或失败回退合同。

## 测试/验证/验收方式

- `@nextclaw/agent-chat-ui` 定向测试 5 个文件、60 项通过，覆盖 Mermaid 严格配置、流式更新合并、稳定上一帧、瞬时错误抑制、最终立即收敛、明暗主题重渲染、错误源码回退、用户消息复制与既有 Markdown/消息布局回归。
- `@nextclaw/agent-chat-ui` 整包测试共 216 项，其中 214 项通过；两个失败分别来自 `HEAD` 已存在的 `ReactNode` 公共合同冲突，以及本批未触达的文件预览样式断言，不属于 Mermaid 链路。本批不借机扩大范围修改。
- `@nextclaw/kernel` 两个上下文合同测试通过，确认独立 inline surface provider 已移除，最终可见区、Markdown、Mermaid、inline 与 side panel 规则由单一输出 provider 注入。
- `@nextclaw/agent-chat-ui`、`@nextclaw/kernel`、`@nextclaw/ui` TypeScript 检查通过；三个包的 ESLint 均为 0 error，仅保留与本批无关的既有 warning。
- `@nextclaw/agent-chat-ui`、`@nextclaw/kernel` package build 与 `@nextclaw/ui` production build 通过；Mermaid 被 Vite 拆成按需 chunk，没有进入聊天首屏同步主包。
- 真实 Chromium 冒烟中，Mermaid 在 `securityLevel: strict` 下成功解析并生成 1 个 SVG、2 个图节点；该冒烟验证真实浏览器库执行，不冒充完整 NextClaw 会话页面验收。
- `pnpm lint:new-code:governance` 与 backlog ratchet 通过；构建产物已由 `pnpm clean:generated` 清理。
- 2026-07-16 补充：Mermaid 定向测试 9 项通过，相关 Markdown / message streaming 测试 4 个文件 61 项通过；覆盖历史首屏不见源码、连续 token 下流结束前出现有效帧、慢渲染只保留一个在途任务、最终立即收敛、失败回退、主题切换和 React Strict Mode 初始调度。
- 2026-07-16 补充：`@nextclaw/agent-chat-ui` 整包 224 项中 221 项通过；3 项失败分别是已有 `ReactNode` 公共合同、已有文件写入预览样式断言，以及当前工作区另一批输入选区改动触发的 jsdom `Selection.modify` 缺失，均不在本次 Mermaid 链路。本次不覆盖并行改动。
- 2026-07-16 补充：`@nextclaw/agent-chat-ui` 与消费端 `@nextclaw/ui` 的 `tsc` 通过，agent chat UI 整包 ESLint 通过，两包 production build 通过；UI build 继续把 Mermaid 拆成按需 chunk。
- 2026-07-16 补充：隔离真实浏览器中，历史图首次 SVG 约 240ms 出现，流式图首次有效 SVG 约 244ms 出现而完整源码约 540ms 才结束；两个场景全过程 `sourceEverVisible=false`，最终 SVG 节点与文案完整，控制台无 error/warn。
- 2026-07-16 补充：governance、backlog ratchet 与 generated cleanup 通过；浏览器验收使用的临时 fixture 已删除，不进入交付。

## 发布/部署方式

本次未执行发布或部署。已新增 `.changeset/agent-output-presentation.md`，后续随 `@nextclaw/agent-chat-ui`、`@nextclaw/kernel` 与 `@nextclaw/ui` 统一发布 patch。

2026-07-16 的 Mermaid 体验补充同样未执行发布或部署；新增 `.changeset/mermaid-progressive-rendering.md`，仅将 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 记为待统一发布 patch，不涉及 kernel、数据库、migration、远程 API 或桌面 installer。

不涉及数据库、migration、远程 API 或桌面 installer。依赖锁文件只增加 Mermaid 及其真实传递依赖，已清除不同 pnpm 版本引入的无关 lockfile 漂移。

## 用户/产品视角的验收步骤

1. 让 Agent 先调用任意工具再总结，确认工具活动及之前内容进入“已处理”，工具之后仍有可独立阅读的结论、重要限制和相关链接。
2. 打开包含 Mermaid 的历史会话，确认进入时直接显示稳定图形占位而不闪现源码；再让 Agent 流式输出一个 fenced `mermaid` 流程图，确认流未结束前已经出现有效图形，后续更新保持上一帧，消息完成后立即收敛最终图；切换明暗主题后图表配色同步更新。
3. 输入无效 Mermaid 语法，确认消息显示明确失败说明和原始代码块，源码仍可复制。
4. 悬停或键盘聚焦用户消息底部的复制按钮，确认 tooltip 可见；点击后剪贴板获得用户消息正文。Agent 消息复制保持原行为。
5. 分别要求 Agent 给出 Markdown 文件链接、inline display 和立即打开 side panel 的内容，确认它按统一合同选择 Markdown、`nextclaw-inline` 或实际 `show_*` 工具，不重新调用历史 `show_content` 宽工具。

## 可维护性总结汇总

- 输出规则从两个 provider 收敛为一个事实 owner，删除独立 inline surface provider 及注册入口；没有新增 manager、registry、adapter 或第二套 Markdown parser。
- Mermaid 作为共享 Markdown renderer 的一个 fenced-language 分支落在独立 `mermaid/` 子目录；生产组件保持模块级稳定，主题 effect 只同步宿主 DOM appearance，渲染 effect 通过 debounce、cleanup 和稳定上一帧管理外部 renderer 生命周期，不承担消息业务状态。
- 无效图回退复用既有 `ChatCodeBlock`，用户复制复用既有 `ChatMessageActionCopy`，没有复制代码块或消息 footer 实现。
- maintainability guard 为 0 error、5 warning。当前工作树级统计为新增 543 行、删除 91 行、净增 452 行；排除测试后新增 257 行、删除 66 行、净增 191 行。统计包含用户并行未提交的两个 `brand-header` 文件，因此只作为工作树 guard 证据，不冒充本批精确 diff；当前工作树包含新的 Mermaid 与复制能力，guard 按新增用户能力口径通过。
- warning 均为未增长的既有目录预算或接近预算文件；Mermaid 文件已放入子目录，原本新增的根目录文件预算增长和 provider 测试函数预算错误均已消除。
- `post-edit-maintainability-review` 结论：通过，no maintainability findings。新增代码用于用户可见 Mermaid 与用户消息复制能力；主要正向减债是删除重复 provider、复用既有展示和复制 owner，并把 Mermaid 测试从已接近预算的 Markdown 测试文件拆到独立边界。
- 2026-07-16 补充的最终代码统计为新增 262 行、删除 36 行、净增 226 行；排除测试后新增 129 行、删除 29 行、净增 100 行。该增长用于新的历史首屏、流式渐进、单在途调度、Strict Mode、明确加载状态与本地化文案，属于新增用户可见能力，不适用非功能改动净增 `<= 0` 门槛。
- 2026-07-16 maintainability guard 为 0 error、4 warning：一个是未增长且已有例外记录的 message-list 目录预算，两个是仅新增文案类型键但已接近 500 行预算的既有连接文件，一个是 Mermaid 测试文件增长但仍低于 900 行测试预算。继续拆 fixture 会新增文件和跳转，当前测试仍按 renderer 生命周期聚合，暂不为行数机械拆分。
- 2026-07-16 `post-edit-maintainability-review` 结论：通过，no maintainability findings。生产 owner 仍只有 `ChatMermaidDiagram`，删除了 trailing debounce 与源码加载态，没有新增 manager、parser、wrapper、兼容桥或平行渲染路径；effect 只同步 Mermaid、timer 与宿主主题，组件类型、消息 key、父级位置和 pending -> rendered 的 `figure` identity 保持稳定。

## NPM 包发布记录

本次未发布 NPM 包，以下包均为 patch、待统一发布：

- `@nextclaw/agent-chat-ui`
- `@nextclaw/kernel`
- `@nextclaw/ui`

2026-07-16 补充修复的待发布包：

- `@nextclaw/agent-chat-ui`
- `@nextclaw/ui`
