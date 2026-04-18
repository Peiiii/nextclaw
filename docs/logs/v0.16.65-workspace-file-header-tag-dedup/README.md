# v0.16.65-workspace-file-header-tag-dedup

## 迭代完成说明（改了什么）
- 去掉聊天右侧工作区文件面板头部里重复的 `Diff / Preview` 类型 tag，不再在路径标题下方重复提示已经由顶部 tab 表达过的语义。
- 继续收紧同一处头部的垂直节奏：当 header 只有标题、没有第二排元信息时，不再额外渲染空的元信息容器，避免标题上下间距不对称。
- 将文件头部的纵向 padding 和标题行高轻微收紧，让 `preview / diff` 两种状态下的整体头部高度更接近 tab 和正文的视觉密度。
- 保留真正仍有信息价值的头部元信息：文件定位行列号与 `truncated` 状态标签继续展示，不影响排查和定位。
- 补充组件测试，明确约束“不要在 workspace header 里重复渲染 preview 类型标签”，同时覆盖标题态保持紧凑、行列号与截断标签仍然保留的行为。
- 同批次续改将原先“header 里的一整行路径字符串”升级成更接近 VSCode 的 breadcrumb 导航条：现在路径展示被提升为 tab 与正文之间的独立导航层，而不再只是预览组件内部的一段标题文案。
- 同批次继续收紧 breadcrumb 的垂直节奏，改成更接近 VSCode 的紧凑导航条：
  - 外层 `padding`、segment 高度、图标尺寸、segment 间距和右侧元信息胶囊都同步下调。
  - 弱化整块渐变和过强的 chip 感，让 breadcrumb 更像“导航信息层”，而不是第二个内容 header。
- 同批次继续修正横向滚动条的“位置感”：
  - 问题根因不是“滚动条不够细”，而是此前把横向滚动条和内容层绑在同一个容器里，导致一旦试图通过 `padding` 去移动滚动条位置，就会顺带影响 tab 下划线和正文节奏。
  - 本轮不再在原容器上补丁式加 `padding`，而是直接把横向滚动条提升到真正带 `border / background` 的外层边界壳上。
  - 最终结构收敛成两层：
    - `shell`：同时承担边界线、背景和横向滚动条
    - `content`：只负责 tab / breadcrumb 内容本身
  - 中间那层额外 viewport 已删除，避免“为了改滚动条位置，结果把中间层 padding、tab 下划线位置和文字节奏一起带偏”的问题。现在滚动条通过 `scrollbar-gutter: stable` 贴靠真正的底部边界，而不再靠内容层 padding 去“挪位置”。
- 根因说明：此前右侧工作区虽然已经支持文件预览和 diff，但文件路径仍然被内嵌在 `ChatSessionWorkspaceFilePreview` 里的 `WorkspaceFileHeader` 单体实现中，既没有“工作区根目录 -> 相对路径 -> 当前文件”的结构化视图模型，也没有可复用的导航条组件，所以很难自然长出 VSCode 风格的路径导航体验。
- 本次修复没有继续在原 header 上补样式，而是沿着根因重做边界：
  - 新增 `lib/session-project/workspace-file-breadcrumb.ts`，统一负责把绝对路径、相对路径与 `sessionProjectRoot` 收敛成 breadcrumb 视图模型。
  - 新增 `components/chat/workspace/chat-session-workspace-file-breadcrumbs.tsx`，把路径展示抽成独立可复用组件，保留行列号与 `truncated` 元信息，但不再重复 tab 已表达过的模式语义。
  - `ChatSessionWorkspaceFilePreview` 改成只负责组合 breadcrumb 与正文内容，不再自己持有一个专用的 `WorkspaceFileHeader` 内联实现。
- 为避免继续把热点目录摊平，本轮还顺手把“路径逻辑”放进 `lib/session-project/`，把“breadcrumb 展示组件”放进 `components/chat/workspace/`，而不是继续堆在 `components/chat/` 根目录或 `chat/adapters/` 目录里。

## 测试/验证/验收方式
- 已执行：`pnpm -C packages/nextclaw-ui test -- src/lib/session-project/workspace-file-breadcrumb.test.ts src/components/chat/chat-session-workspace-file-preview.test.tsx src/components/chat/chat-conversation-panel.test.tsx`
  - 结果：通过（3 个测试文件、20 个测试全部通过）。
  - 覆盖点：breadcrumb 视图模型构建、工作区文件预览组件渲染、现有 workspace panel 集成面未回归。
- 已执行：`pnpm -C packages/nextclaw-ui test -- src/components/chat/chat-session-workspace-file-preview.test.tsx`
  - 结果：通过（5 个测试全部通过）。
  - 覆盖点：补充锁定 breadcrumb 紧凑 header 的 `py-1.5` 节奏约束，避免后续再次被撑高。
- 已执行：`pnpm -C packages/nextclaw-ui test -- src/components/chat/chat-session-workspace-file-preview.test.tsx src/components/chat/chat-conversation-panel.test.tsx`
  - 结果：通过（2 个测试文件、17 个测试全部通过）。
  - 覆盖点：锁定 breadcrumb 与 workspace tabs 的横向滚动条都直接挂在外层边界壳上，而内容层只保留自身节奏。
- 已执行：`pnpm -C packages/nextclaw-ui tsc`
  - 结果：失败，但失败点来自当前工作区里的并行改动，并非本次 workspace 滚动条重构引入：
    - `src/components/config/ChannelsList.tsx(41,47)`
    - `src/components/config/ChannelsList.tsx(42,48)`
  - 结论：本次改动文件未出现新的类型错误，但 `@nextclaw/ui` 当前整体类型检查未恢复到绿色。
- 已执行：`pnpm -C packages/nextclaw-ui exec eslint src/lib/session-project/workspace-file-breadcrumb.ts src/lib/session-project/workspace-file-breadcrumb.test.ts src/components/chat/workspace/chat-session-workspace-file-breadcrumbs.tsx src/components/chat/chat-session-workspace-file-preview.tsx src/components/chat/chat-session-workspace-file-preview.test.tsx`
  - 结果：通过。
- 已执行：`pnpm -C packages/nextclaw-ui exec eslint src/components/chat/workspace/chat-session-workspace-file-breadcrumbs.tsx src/components/chat/chat-session-workspace-file-preview.test.tsx`
  - 结果：通过。
- 已执行：`pnpm -C packages/nextclaw-ui exec eslint src/index.css src/components/chat/chat-session-workspace-panel-nav.tsx src/components/chat/chat-session-workspace-file-preview.test.tsx`
  - 结果：`TypeScript/TSX` 改动文件通过；`index.css` 被 ESLint 直接忽略（`File ignored because no matching configuration was supplied`），不是代码错误。
- 已执行：`pnpm -C packages/nextclaw-ui exec eslint src/components/chat/workspace/chat-session-workspace-file-breadcrumbs.tsx src/components/chat/chat-session-workspace-panel-nav.tsx src/components/chat/chat-session-workspace-file-preview.test.tsx src/components/chat/chat-conversation-panel.test.tsx`
  - 结果：通过。
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：失败，但失败项均来自当前工作区里与本次 breadcrumb 续改无关的并行改动，例如：
    - `apps/platform-console/src/api/client.ts`
    - `packages/nextclaw-server/src/ui/config.ts`
    - `packages/nextclaw-server/src/ui/types.ts`
    - `scripts/smoke/platform-console-smoke.mjs`
    - `workers/marketplace-api/src/main.ts`
    - `workers/nextclaw-provider-gateway-api/src/types/platform.ts`
  - 结论：本次调整后，先前因新增 breadcrumb 文件而短暂冒出的 `packages/nextclaw-ui/src/components/chat` 与 `packages/nextclaw-ui/src/components/chat/adapters` 目录预算 warning 已被消掉；当前 guard 红项不由本次功能引入。
- 已执行：`pnpm check:governance-backlog-ratchet`
  - 结果：通过（`ratchet status: OK`）。
- 未执行：真实页面端到端手工冒烟
  - 原因：当前会话没有现成运行中的目标聊天页面与可复现文件面板场景；因此本次以定向组件/集成测试替代，并明确保留这一验收缺口。

## 发布/部署方式
- 本次仅涉及 `@nextclaw/ui` 的聊天工作区展示细节调整，无需单独发布。
- 如后续随前端批次发布，按既有前端构建与发布流程一并带出即可。

## 用户/产品视角的验收步骤
1. 在聊天页打开右侧工作区文件面板，选中一个 `preview` 或 `diff` 文件 tab。
2. 观察右侧面板顶部：tab 下方、正文上方应出现一条 breadcrumb 导航条，而不是单独一整行原始路径字符串。
3. 当文件位于当前 workspace 根目录下时，确认 breadcrumb 会以 `项目名 / 子目录 / 当前文件` 的结构展示，而不是直接平铺绝对路径。
4. 如果文件不在当前 workspace 根目录下，确认 breadcrumb 仍能退回展示绝对路径层级，不会错误伪装成项目内相对路径。
5. 确认右侧面板顶部仍然不重复显示 `Preview` 或 `Diff` tag；语义继续由顶部 tab 承担。
6. 如果当前文件带有行号定位，确认 breadcrumb 右侧仍会显示类似 `L12:4` 的定位信息。
7. 如果当前预览被截断，确认 breadcrumb 右侧仍会显示截断提示，而不是把有效元信息一起删掉。
8. 在顶部 tab 间切换 `preview` 和 `diff` 文件，确认 breadcrumb 与正文内容同步切换，没有出现路径和内容错位。
9. 观察 breadcrumb 自身高度，确认它更接近一条紧凑导航条，而不是一个较厚的二级 header；segment 与右侧状态胶囊都应明显更薄。
10. 当 breadcrumb 或 workspace tabs 横向内容超出时，确认滚动条贴靠真正的底部边界线，而不是贴着文字本身出现；tab 下划线和 breadcrumb 文本位置不应再被“为了挪滚动条”一起带偏。

## 可维护性总结汇总
- 本次是否已尽最大努力优化可维护性：是。这次不只是补一个视觉条，而是顺手把“路径结构化”和“路径渲染”拆开，并把文件落点重新收敛到更合理的 `lib/session-project/` 与 `components/chat/workspace/`，避免让热点目录继续升温。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。虽然本轮为了新增 breadcrumb 能力引入了最小必要的新代码，但同时删除了旧的 `WorkspaceFileHeader` 内联实现，没有保留“两套头部模型并存”的补丁式过渡层。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。总代码和非测试代码都有净增，因为这是新增可见能力；但通过删除旧 header、把逻辑和 UI 分开放置、并把文件迁出 `chat/adapters` 与 `chat/` 根目录，避免了目录平铺度进一步恶化。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。本次没有引入 manager/store，因为这里只需要确定性的路径推导和纯展示层；最终边界收敛为“`workspace-file-breadcrumb` 纯视图模型工具 + `ChatSessionWorkspaceFileBreadcrumbs` 纯 UI 组件 + `ChatSessionWorkspaceFilePreview` 组合入口”，比把路径逻辑继续塞回预览组件更清晰。
- 目录结构与文件组织是否满足当前项目治理要求：是。路径逻辑放进 `lib/session-project/`，工作区 breadcrumb UI 放进 `components/chat/workspace/`，避免继续给 `components/chat/` 和 `components/chat/adapters/` 增加直接文件数。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 长期目标对齐 / 可维护性推进：这次顺着“统一工作区体验、信息层级更清晰、组件边界更稳定”的方向前进了一小步。右侧文件区现在不再只是一个临时预览块，而更像统一入口里的正式工作面板；同时我们没有把路径逻辑散回组件、effect 或 store，而是保持成可预测的纯推导层。
  - 代码增减报告：
    - 统计口径：仅统计本次 breadcrumb 续改触达文件，相对当前 `HEAD` 的 diff；新文件按当前文件行数计入。
    - 新增：377 行
    - 删除：51 行
    - 净增：+326 行
  - 非测试代码增减报告：
    - 统计口径：同上，并排除 `*.test.*`
    - 新增：286 行
    - 删除：42 行
    - 净增：+244 行
  - no maintainability findings
  - 可维护性总结：这轮代码净增确实不小，但它主要换来了此前缺失的“路径模型 + 导航层”两个稳定边界，而且已经通过删除旧 header、避免 manager/store 过度建模、以及把文件迁出热点目录把增长压在了当前最小必要范围内。最新这次滚动条位置修正没有再在错误层级上补 `padding`，而是进一步删掉了非必要的中间 viewport 层，把职责收敛为“外层边界壳承载滚动条，内层内容只承载内容节奏”；这比继续在原容器上堆样式更容易维护，也更不容易误伤 tab 下划线或文本位置。下一步若这个工作区继续演进，优先的继续拆分缝应是把更多文件视图（例如图片、未来的符号级 breadcrumb）也挂到同一条 breadcrumb/view-model 体系上，而不是再各自长新的顶部头部实现。

## NPM 包发布记录
- 本次是否需要发包：不需要。
- 原因：仅为仓库内前端展示细节微调，当前没有单独发包诉求，也不需要独立发布某个 NPM 包来承接此改动。
- 需要发布哪些包：无。
- 当前发布状态：不涉及 NPM 包发布。
