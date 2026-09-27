# Bibo Markdown 统一优化

## 原始输入与约束

2026-09-27 用户先询问 Markdown 问题，随后提供列表缩进存在但标记不可见的局部截图，明确要求“公式和图表这些可以参考 nextclaw 实现完善的支持”，最后授权“统一优化部署合入主干”。截图在本任务对话附件中，仅作为异常证据。初次调查遗漏排版细节，本次以真实浏览器组装链路补齐。

## 完成说明

状态：已合入远程主干并部署；真实生成验收因每日试用额度耗尽阻塞，整体验收尚未完成。隔离分支 `codex/bibo-markdown-unified`；[设计与完整标准](../../designs/2026-09-27-bibo-markdown.design.md)。源区已有 thought WIP 未修改。首版以过期主线起草，已迁移至现代 personal-agent-ui 并重新验收；旧版浏览器证据不用于当前交付。

## 变更

Bibo 删除独立简化 Markdown renderer，消费共享公共组件；改善列表/任务列表/标题/行内代码/表格主题，支持公式、Mermaid、代码高亮/复制、图片预览和链接。Store 持有稳定消息展示 ID，临时→提交沿用身份，历史行使用稳定对象避免逐 delta 重解析。

## 根因与证据

现代 theme.css 导入 Tailwind preflight，列表类型被重置为 none，而 Markdown 样式只恢复缩进，没有恢复标记；这是当前源码链路中已确认的缺陷。截图部署 DOM 未取得，仍不把线上历史版本归因到某一构建。混排任务项与普通项时，父列表 contains-task-list 的 none 也会隐去普通圆点，改为只对任务项取消标记。

接入共享组件后的浏览器修前证据：代码出现 `pre pre`；两条同名脚注出现重复 `user-content-user-content-fn…` ID，全部引用/回链目标不存在。原因为 Markdown 生成 pre 与代码组件自己的 pre 重复，以及 sanitizer 加 ID 前缀后引用未同步、消息间未隔离。共享 owner 修正容器与 ID/引用命名空间。流式公式测试还发现净化阶段移除了未完整公式的 pending 属性，已保留安全属性，并由渲染器固定展示样式。

## 验收账本

contract-id: `bibo-markdown-2026-09-27`；revision: 2；parent-goal 及标准见设计。所有条目 Required=true。

| ID | 状态 | 当前证据 |
| --- | --- | --- |
| MD-01 | passed | 1440/390/320px 对话及收件箱真实构建：嵌套标记、混排任务项、起始编号、六级标题、表格右对齐、局部滚动且无整页溢出 |
| MD-02 | passed | 四类公式、真实 Mermaid、图表展开/缩放/Escape；81 项共享定向回归通过 |
| MD-03 | passed | 代码复制与失败反馈、手机复制按钮 44px、图片展开、危险 HTML/URL 过滤、中文脚注及回链有效；3 项 personal 回归通过 |
| MD-04 | passed | 模拟 SSE 验证历史节点、选区、读旧内容不抢滚动；提交后消息节点与图表源码视图保持，刷新恢复；既有 product/composer 冒烟通过 |
| MD-05 | passed | 共享、personal、应用三组 tsc；81+3 项回归、最终集成 36 项应用测试通过；定向 ESLint、文件/包边界治理、ratchet、中英镜像检查通过；主观 Review 无阻塞 |
| MD-06 | blocked | 已合入、部署且线上资产逐字节匹配；真实登录/历史/桌面手机刷新通过，线上三屏 Markdown fixture 通过；真实生成首轮失败、后续模型接口与 availability 返回每日额度耗尽 429，生成保存链路未完成 |

浏览器 fixture 仅验证真实构建资产与 UI，接口由模拟数据提供；不冒充模型和持久化验证。现代截图保存在 `/tmp/bibo-markdown-chat-{width}.png` 与 `/tmp/bibo-markdown-inbox-{width}.png`，属于临时验收材料。用户可评估排版审美，AI 负责行为与渲染正确性。

## 可维护性与复盘

复用 NextClaw 的稳定公共 renderer，删除 personal-agent-ui 重复 Mermaid 实现，保留成熟复制控件；主题与宿主布局保持各自 owner。脚注和流式缺陷沉淀为共享回归，正文与 README 记录真实能力；不增加全局规则。自动维护性检查 0 errors / 3 warnings：已有 message-list 目录例外未新增文件，renderer 460/500 行、回归文件 882/900 行接近预算。主观 Review 核对公共包入口、安全策略、统一消息身份和共享状态，未发现阻塞；本次新增槽均有宿主消费者，不为普通净增长拆出转发层。

迁移审计：旧 bibo-ui 消息/皮肤映射至 personal-agent-ui；旧 store 和页面改动适配现代会话 owner；Tailwind 3 草稿丢弃，保留现有 Tailwind 4；保留现代 product/composer 测试并补独立对话 Markdown 冒烟；共享修复、changeset、设计、日志及中英说明全部纳入新分支。旧草稿补丁已存临时恢复材料，提交前清除旧隔离区仅属于本任务的草稿，源区五份 thought WIP 保持原样。

## NPM 发布记录

本批不发布 NPM、runtime 或 desktop。共享 `@nextclaw/agent-chat-ui` 修复通过 changeset 标记待统一发布；Bibo 是独立托管部署。存储/API 未变化，无 migration。

## 部署与验证边界

- 功能提交 `acb074042`；集成远程 snapshot/task-save 修复后，从干净、冻结的远程 master `1b0e04a77f5ae6a7ff8466160471ed14830cd971` 执行既有 deploy 入口。
- Wrangler 4.138.0 部署 Worker 版本 `b6d4a724-1b37-4f63-8bdc-3aae8a659694`，容器镜像 digest `sha256:f060bf2ed90fdafdc07c570b495921b5e1505bf4e4bb449db7f8fddfb6e5ace0`；入口 https://app.bibo.bot/ 。部署无存储迁移，本批不发布 NPM/runtime/desktop。
- 线上入口 JS、预加载模块、chat JS 和 chat CSS 与冻结构建完全相同；真实公开资产上的 1440/390/320px fixture 验证公式、图表/图片展开、嵌套标记、中文脚注、复制、流式保存身份与刷新，接口数据为模拟值。
- 实际 smoke 账号登录、历史读取（2 条）、桌面/手机刷新通过；availability 返回 HTTP 429「今日试用额度已用完，请明天再试」。首轮真实 Agent 返回通用错误，未取得其内部根因；后续 quota 阻断复现，不把首次失败认定为已证实的额度根因。没有调整产品额度或清空用户数据。额度恢复后用现有 `smoke:live` 补齐 MD-06。
- 文档部署 pipeline `36297174415` 已成功：全球站、国内站与同一冻结 artifact 的一致性验证全部通过。
- 主线回流 `LOCAL_WORKTREE_RETRYING`：主工作区原五份 thought WIP 保留，retry worker 自动接管；远程 master 已包含功能，不宣称本地镜像已同步。
- `AUTOMATION_INTERVENTIONS: 1`：首次真实冒烟失败后重新运行既有入口；后续被每日额度阻断。只读观察与诊断不计入；未执行部署回滚或修改配额。
