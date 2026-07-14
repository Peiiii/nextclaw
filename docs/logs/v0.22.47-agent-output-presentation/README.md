# v0.22.47-agent-output-presentation

## 迭代完成说明

本批把“Agent 如何把结果交给用户”收敛为一份统一合同。聊天 UI 会把最后一个工具调用及其之前的 reasoning / tool activity 收进“已处理”，因此 Agent 现在会明确知道：最后一个工具调用之后必须再给出自包含的最终回复，不能把结论只留在工具前 narration 或原始工具输出里。

原本分散在 `InlineInteractiveSurfaceContextProvider` 与 `ReplyFormatContextProvider` 的 Markdown 链接、图片、inline display、Panel Card 和 side panel 选择规则，已经统一归 `ReplyFormatContextProvider`。实际模型工具仍是 `show_file`、`show_url`、`show_panel_app` 三个窄合同，内部继续复用既有 `showContent` request / event owner，没有新增展示链路。

聊天 Markdown 新增 Mermaid fenced block 展示：按宿主明暗主题动态渲染，使用严格安全模式，语法错误时回退为可复制源码。流式输出会合并高频更新，并在新图完成前保留上一张有效 SVG，不再反复切回加载态或闪出半截语法错误。消息复制动作也从 Agent 消息扩展到用户消息，继续复用同一个复制组件与反馈文案。方案依据与边界记录在 `docs/designs/2026-07-15-agent-output-presentation-contract.design.md`。

Mermaid 闪烁的根因是每个流式 token 都会改变 `renderKey`，旧 SVG 因此在新一轮异步渲染完成前被同步判定为失效并替换成骨架屏；已启动但过期的 Mermaid 任务还会继续排队。回归测试通过延迟第二次渲染稳定复现了“新图未完成时旧 SVG 已从 DOM 消失”，从而确认问题发生在 renderer 生命周期，而不是 ReactMarkdown 整棵消息树重挂载。修复直接改变这条失效链：流式输入先合并，更新期间保留最后一张有效 SVG，cleanup 取消未开始的任务并忽略过期结果，最终内容再立即收敛，因此处理的是根因而不是降低动画或隐藏骨架等表面缓解。

## 测试/验证/验收方式

- `@nextclaw/agent-chat-ui` 定向测试 5 个文件、60 项通过，覆盖 Mermaid 严格配置、流式更新合并、稳定上一帧、瞬时错误抑制、最终立即收敛、明暗主题重渲染、错误源码回退、用户消息复制与既有 Markdown/消息布局回归。
- `@nextclaw/agent-chat-ui` 整包测试共 216 项，其中 214 项通过；两个失败分别来自 `HEAD` 已存在的 `ReactNode` 公共合同冲突，以及本批未触达的文件预览样式断言，不属于 Mermaid 链路。本批不借机扩大范围修改。
- `@nextclaw/kernel` 两个上下文合同测试通过，确认独立 inline surface provider 已移除，最终可见区、Markdown、Mermaid、inline 与 side panel 规则由单一输出 provider 注入。
- `@nextclaw/agent-chat-ui`、`@nextclaw/kernel`、`@nextclaw/ui` TypeScript 检查通过；三个包的 ESLint 均为 0 error，仅保留与本批无关的既有 warning。
- `@nextclaw/agent-chat-ui`、`@nextclaw/kernel` package build 与 `@nextclaw/ui` production build 通过；Mermaid 被 Vite 拆成按需 chunk，没有进入聊天首屏同步主包。
- 真实 Chromium 冒烟中，Mermaid 在 `securityLevel: strict` 下成功解析并生成 1 个 SVG、2 个图节点；该冒烟验证真实浏览器库执行，不冒充完整 NextClaw 会话页面验收。
- `pnpm lint:new-code:governance` 与 backlog ratchet 通过；构建产物已由 `pnpm clean:generated` 清理。

## 发布/部署方式

本次未执行发布或部署。已新增 `.changeset/agent-output-presentation.md`，后续随 `@nextclaw/agent-chat-ui`、`@nextclaw/kernel` 与 `@nextclaw/ui` 统一发布 patch。

不涉及数据库、migration、远程 API 或桌面 installer。依赖锁文件只增加 Mermaid 及其真实传递依赖，已清除不同 pnpm 版本引入的无关 lockfile 漂移。

## 用户/产品视角的验收步骤

1. 让 Agent 先调用任意工具再总结，确认工具活动及之前内容进入“已处理”，工具之后仍有可独立阅读的结论、重要限制和相关链接。
2. 让 Agent 以流式方式输出一个 fenced `mermaid` 流程图，确认源码增长期间不会在 SVG、骨架和错误态之间闪烁，消息完成后立即出现最终图；切换明暗主题后图表配色同步更新。
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

## NPM 包发布记录

本次未发布 NPM 包，以下包均为 patch、待统一发布：

- `@nextclaw/agent-chat-ui`
- `@nextclaw/kernel`
- `@nextclaw/ui`
