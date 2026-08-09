# v0.26.61 Workspace File Chat Context

## 迭代完成说明

- 新任务欢迎页的工作目录选择器显式提供默认 workspace，切换到其他项目后仍可切回默认值。
- 新任务无需先发送消息即可打开工作台；草稿阶段只展示已经具备数据条件的项目文件，首条消息发送后沿既有会话物化链路接续。
- 项目文件树增加可复用右键菜单，提供“添加到聊天”“复制路径”“复制相对路径”和桌面端“在文件管理器中显示”。相对路径由文件树层级生成，不再依赖前后端绝对路径字符串完全一致。
- 已打开的项目文件页签改用同一个菜单 primitive；“更多操作”按钮和页签右键消费同一份操作分组，均支持“添加到聊天”，旧的独立 Popover 菜单实现已删除。
- 项目文件面板在工作台内保持挂载，切换文件预览或其他页面后保留目录展开与滚动位置；只有项目根目录真实变化时才重置实例状态。
- 项目文件引用现在使用专属 `workspace_file` token，不再误用上传附件 token；发送时会同时进入 NCP 用户消息正文和 inline-token metadata，用户消息可见且 Agent 能读取。
- 文件引用协议在相邻正文之间自动补充分隔；对已经持久化的连写消息，准确 metadata 优先于贪婪文本推断，避免后续整句话被渲染成文件链接。
- 已发送的 workspace 文件引用可以重新点击打开对应文件；默认 workspace 会话没有 `projectRoot` 时，使用 `workingDir` 还原相对路径，不再静默无响应。
- 新任务首条消息物化为正式会话时，已打开的工作台保持同一个 React/DOM 实例，不再先关闭再重新打开。根因是旧流程先改绑 `workspacePanelParentKey`，随后才由路由布局同步 `selectedSessionKey`，两者短暂不一致触发工作台返回 `null`；现已将 session 选择、工作台改绑和路由替换收敛到 `ChatThreadManager` 的单一物化动作。
- 文本型工作台预览新增“片段引用”：用户划选 Markdown 渲染、Markdown 源码、普通文本、代码、JSON、YAML、配置或日志内容后，可从选区浮层添加到聊天。输入框和已发送消息均显示带文件来源、可靠行号、字符度量和片段指纹的紧凑原子 Tag，完整快照按需浮层预览；kernel 只注入选中时的快照，不再为片段读取整份文件。点击消息 Tag 可回到源文件起始行；重复文本或渲染映射不可靠时不伪造位置。
- 聊天结构化内容展示收敛为统一 Reference Tag 系统：Skill、Panel App、项目、工作区文件、目录、片段与未来扩展引用在输入框和用户消息中共享高度、边框、色调、信息顺序与预览骨架，发送后不再退化为另一套下划线链接。图标由单一语义 owner 选择：Skill、应用、项目、目录、片段各用对应图标，工作区文件和附件按常见扩展名区分 JSON、代码、图片、音视频、表格、压缩包和文档，未知引用使用中性链接图标；composer 只额外提供不占宽度的 hover 移除操作，消息只额外提供打开/回源行为。
- 编辑区 Reference Tag 的删除叉号可见性不再依赖 Lexical 外层 Decorator DOM 的命名 `group-hover` 样式传播，改由 Tag 自身统一拥有 hover 与 focus-within 状态；默认仍为零视觉、零命中，进入 Tag 后稳定显示，且不改变标签宽度。用户真实界面暴露了原实现“按钮节点存在但始终保持 `opacity: 0`”，代码链路确认唯一显示条件位于外层样式选择器，因此修复收敛在编辑区 Tag 交互 owner，而不是给页面宿主补 CSS。
- 稳定的 AI 回复与用户历史消息现在支持划选后添加到聊天，使用独立 `conversation_excerpt` 保存消息身份、角色与选中时快照；输入框和发送后沿统一 Reference Tag 展示，kernel 将精确快照作为引用数据注入上下文，流式消息保持不可引用。
- 文件预览与会话消息的划选浮层收敛到共享 owner：拖选期间不显示，松手后下一动画帧立即出现；水平位置按当前视口内实际选中文本的整体范围居中，默认放在上方、空间不足时下翻，并做四边防越界。源码预览偏移的根因是代码单元使用 `block + flex-1` 占满剩余宽度，原 Range 几何混入整行容器矩形；现改为优先汇总实际被选中的文本节点矩形，不再用容器盒子计算视觉中心。
- 根因：入口实现把项目文件引用调用到了上传附件的 `insertFileToken`，而发送器会丢弃没有上传实体的附件 token；同时协议序列化没有为结构化 token 和相邻正文建立边界。通过追踪“右键意图 → 编辑器节点 → NCP envelope → 持久化消息 → 消息渲染”确认两个首个错误跳点，修复落在 token 语义 owner 和发送序列化 owner，而不是只给渲染器打补丁。

## 测试/验证/验收方式

- `@nextclaw/ui` 暂存区独立定向测试：16 个文件、103 条测试通过，覆盖默认 workspace、新任务工作台、草稿项目状态、右键菜单、文件树状态保持、文件引用意图和发送协议。
- `@nextclaw/agent-chat-ui` 暂存区独立定向测试：2 个文件、69 条测试通过，覆盖通用 token 插入与“文件引用后紧跟正文”渲染边界。
- `@nextclaw/ui`、`@nextclaw/agent-chat-ui` TypeScript 检查通过。
- `@nextclaw/desktop` 主进程构建通过；host capability Node 测试 5 条通过，覆盖绝对路径 reveal 与相对路径拒绝。
- `@nextclaw/agent-chat-ui`、`@nextclaw/desktop` 包级 lint 通过；`@nextclaw/ui` 本任务 42 个触达文件定向 ESLint 通过。UI 全包 lint 被并行工作区 `use-session-conversation-controller.test.tsx` 的既有类型导入错误阻塞，与本提交暂存范围无关。
- 本地运行实例 `http://127.0.0.1:5174/chat` 实测：默认 workspace 在切换到 `nextbot` 后仍可见、可用并可切回；新任务未发送消息时可打开工作台，项目文件树成功加载 130 个 treeitem。
- 本次追加验证：`@nextclaw/ui` TypeScript 检查通过；8 个相关测试文件共 81 条通过，最终持久化文件引用组装测试文件 20 条通过；本轮触达文件定向 ESLint 无错误，既有超长测试文件仅保留 `max-lines` 告警。
- 用户报告的精确 URL `http://127.0.0.1:5174/chat/sid_bmNwLW1zajhrcnp3LWIyYWM1Mzkz` 实测：关闭工作台后点击最后一条用户消息中的 `fish.js`，工作台从关闭状态重新打开并出现唯一 `fish.js` 页签；右键该页签显示“添加到聊天”和“关闭文件”。
- 首发物化闪烁定向回归：3 个测试文件、12 条测试通过；组装测试直接断言物化前后的工作台 DOM 节点引用相同。`@nextclaw/ui` TypeScript 检查和本轮 5 个触达文件定向 ESLint 通过。
- 本轮 scoped non-feature maintainability guard 通过：总计 `+87/-46`，非测试代码 `+8/-10`（净减 2 行）；新代码 governance 与 backlog ratchet 通过。
- `pnpm release:summary -- --json`、maintainability guard、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 `git diff --check` 通过。
- 文本片段引用 follow-up：`@nextclaw/shared`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui`、`@nextclaw/kernel` TypeScript 检查通过；UI 6 个文件 47 条、通用聊天 UI 2 个文件 40 条、kernel 2 个文件 9 条定向测试通过，覆盖选区映射、保留输入正文、发送 metadata、消息恢复与点击定位、精确快照注入。触达源码定向 ESLint 无错误/警告，新代码 governance 通过；scoped maintainability guard 无错误，预算提醒已做人工 owner/抽象复核。
- 片段 Tag 交互 follow-up：首次挂载与 JSON 首次划选 3 条定向测试通过；Tag 展示、消息预览与结构化剪贴板 13 条定向测试通过，覆盖无布局占位的 hover 移除入口、内容渐隐、视口约束、混合复制粘贴、剪切失败不删除和非法私有数据回退。`@nextclaw/agent-chat-ui`、`@nextclaw/ui` TypeScript 与触达文件 ESLint 通过；clipboard command 已拆到专职 owner，maintainability guard 从 1 个越界错误收敛为 0 错误。
- 结构化内容统一展示 follow-up：`@nextclaw/agent-chat-ui` 4 个文件 55 条定向测试通过，覆盖 composer/message 配对视觉、Skill/Panel App/项目/目录/JSON/代码/图片/未知引用语义图标、片段预览和消息 Markdown 恢复；`@nextclaw/ui` 5 个文件 36 条上层链路测试通过，覆盖新会话输入、消息回源、工作台划选浮窗和 composer intent。两个 package TypeScript、触达文件 ESLint、`git diff --check` 与 Vite 源码加载检查通过。
- 真实页面视觉验收补充：在 `http://127.0.0.1:5174/chat/sid_bmNwLW1zajhrcnp3LWIyYWM1Mzkz` 对照已发送文件引用与 composer Skill Tag，确认两者计算后的高度 24px、字号 11px、圆角 7px、gap 6px、背景 `rgba(255,255,255,0.8)`、边框 `rgba(230,230,230,0.7)`、文字 `rgb(33,33,33)` 完全一致。根因是 work theme 曾显式把用户消息引用覆盖成蓝色透明链接，已删除该平行样式合同。composer hover 前后宽度均为 163.859px；关闭按钮默认隐藏，Tag hover 后只显示透明圆框，按钮自身 hover 才出现操作背景。验收草稿已清理。
- 删除叉号可见性回归：`@nextclaw/agent-chat-ui` 组件测试 4 条、`@nextclaw/ui` 上层输入装配测试 8 条通过，覆盖 hover 前不可命中、hover 后显示并可命中、离开后恢复隐藏，以及产品层删除文案装配；`@nextclaw/agent-chat-ui` TypeScript、触达文件 ESLint、`git diff --check` 与 scoped maintainability guard 通过，guard 无错误和警告。
- 会话片段与共享划选浮层 follow-up：UI 4 个文件 39 条、通用聊天 UI 2 个文件 17 条、kernel 2 个文件 4 条定向测试通过；`@nextclaw/shared`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui`、`@nextclaw/kernel` TypeScript 检查通过，触达源码定向 ESLint 与 `git diff --check` 通过。maintainability guard 为 0 错误；用户在真实源码预览页面确认修正后的浮层位置符合预期。

## 发布/部署方式

- 本轮仅提交源码、测试、changeset 与迭代记录，不执行部署、NPM 发布或桌面端发布。
- 更新 patch changeset，后续由统一发布批次处理 `@nextclaw/ui`、`@nextclaw/agent-chat-ui`、`@nextclaw/shared` 与 `@nextclaw/kernel`。
- 没有合格且隐私安全的正式产品截图，因此本 changeset 不绑定 release-note image。

## 用户/产品视角的验收步骤

1. 新建任务，打开工作目录选择器，先选择任意项目，再确认可以选择带“默认”标识的 workspace。
2. 不发送消息，点击“打开会话工作台”，确认直接进入项目文件，并且不展示依赖已存在会话的数据页。
3. 展开多层目录并滚动，打开一个文件预览后再回到项目文件，确认展开状态与滚动位置保持。
4. 右键项目文件，确认可以添加到聊天、复制绝对/相对路径；桌面端还可在 Finder 或系统文件管理器中显示。
5. 在已有正文的光标位置添加文件引用并发送，确认用户消息只把文件名显示为引用，后续正文保持普通文本；Agent 能依据引用读取对应项目文件。
6. 打开任意项目文件，分别点击页签“更多操作”和右键页签，确认菜单分组与操作一致，并可添加到聊天。
7. 在默认 workspace 会话中点击已发送消息里的文件引用，确认工作台直接打开相对路径对应的文件。
8. 新建任务并先打开右侧工作台，发送首条消息，确认进入正式会话的过程中工作台持续可见，宽度、打开内容和组件内部状态不被重置。
9. 打开任意文本型文件，划选一段文字并点击“添加到聊天”，确认输入框原有正文保留，片段 Tag 显示文件名、可用行号或字符数和片段指纹；hover 可预览完整快照，移除入口不改变 Tag 宽度。发送后消息继续显示 Tag，Agent 能准确感知选中原文，点击 Tag 可重新打开源文件。
10. 分别添加 Skill、项目、目录、JSON/代码/图片文件与文本片段，确认发送前后保持同一种 Tag 风格和对应语义图标；输入框 hover 才出现关闭入口且 Tag 不位移，消息中的可打开对象仍可回源。
11. 在稳定的 AI 回复、用户历史消息和源码文件预览中分别跨行划选，确认拖选时浮层不追随鼠标，松手后立即在选区可见文本的水平中心上方出现；顶部空间不足时自动下翻且不会越过视口。添加后确认输入框与发送消息显示同一紧凑引用，AI 能读取精确片段快照。

## 可维护性总结汇总

- 状态归属收敛：草稿项目根目录进入 thread store；文件引用跨面板意图进入独立 manager；编辑器继续作为光标与 token 节点 owner；发送协议继续由 composer serialization owner 负责。
- 文件树通过稳定挂载保留 React 实例状态，没有新增平行展开缓存或滚动缓存；项目根变化仍由 `key` 明确重建。
- 项目文件与上传附件使用不同 token 语义，删除了隐式复用带来的下游丢失路径；右键菜单为业务无关共享组件，文件业务只提供菜单项配置。
- 页签操作删除了独立 Popover 状态、样式和 action 映射，收敛到共享 `ContextMenuGroup[]`；组件类型、tab key 与文件预览父级保持稳定，菜单不会重挂载预览正文、iframe 或编辑器。
- 重复失败复盘已补强验证 skill：结构化引用除了发送保真，还必须覆盖“持久化 token → 用户点击 → 目标 owner / 目标表面”消费闭环及 root 可选状态；同时明确低风险简单改动只选最小充分证据，权威信号通过后停止等价复验。
- 首发物化 follow-up 删除了页面层 `useCallback` 与分步 manager 调用，把跨 session/workspace/route 的状态转移收敛到现有 `ChatThreadManager`；没有新增 transition flag、effect、延时、CSS 兜底或平行状态路径。该 follow-up 生产代码净减 2 行，工作台组件类型、key、父级位置与 DOM 身份均保持稳定。
- 本次 follow-up 提交范围共 18 个文件，`+479/-156`（净增 323 行）；scoped maintainability guard 报告生产代码 `+195/-94`（净增 101 行），无错误。主要正向减债是删除旧页签 Popover 平行实现；消息列表测试文件仍有超长告警，本轮通过合并既有 metadata 测试承载点击闭环，避免再新增平行测试文件或重复 case。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 完成收尾；无新增红区文件，目录和文件命名通过 preflight governance。
- 最终暂存范围共 58 个文件，`+1806/-232`（净增 1574 行）；排除测试、文档、changeset 与 skill 后，生产代码 `+1018/-211`（净增 807 行）。本轮属于新增用户能力，增长主要来自通用右键菜单、草稿工作台链路、文件引用 owner 与对应桌面能力；未通过压行或转移复杂度伪造减债。
- 文本片段引用 follow-up 沿既有 composer token、inline-token metadata、workspace context provider 与文件打开 owner 扩展，没有新增第二套输入框、发送通道或文件读取路径。通用聊天 UI 只增加 JSON-safe token data 往返和展示能力，NextClaw 业务字段仍由产品 UI/shared contract 拥有；消息点击路由从超长容器收敛到专用 hook，文件预览复用单一 preview body，避免复制 JSX。自动 guard 的提醒均为接近预算但未越界的既有文件/目录；其中预览文件已主动消除重复增长，`chat-inline-token.utils.ts` 仍接近 400 行预算，后续若继续增加新 token schema，应按 metadata protocol 职责拆分，而不是继续堆分支。
- 结构化内容视觉只保留一个 Reference 展示 owner，删除 message renderer 的本地图标表、下划线链接样式和片段专属平行组件；composer/message adapter 分别只拥有编辑与导航行为。首次 guard 暴露 Lexical node 混入 136 行视觉职责后，已将稳定纯展示拆到 `chat-composer-token-view.tsx`，node 回到序列化、DOM 身份和原子删除职责；最终 guard 0 错误，剩余两条提示均为未新增/未恶化的既有目录与文件预算提醒，未触发额外目录重构。
- 删除叉号回归修复只修改既有编辑区 Tag 交互 owner 与对应测试，没有新增组件、wrapper 或页面 CSS；按钮可见性与正文渐隐共享同一局部状态，避免再次形成跨容器隐式合同。scoped guard 无本次新增可维护性问题，未触发主观复核。
- 会话片段复用既有 composer intent、inline-token metadata、Reference Tag、结构化剪贴板与 context provider 注册链路，没有建立第二套输入或发送协议。共享划选组件同时替换工作台预览的重复监听与定位逻辑；会话片段解析拆入专职 utils，kernel 测试独立于大型合同测试，最终 maintainability guard 从本轮触发的 3 个越界错误收敛为 0 错误。

## NPM 包发布记录

- 本轮不直接发布 NPM 包。
- `@nextclaw/ui`：需要 patch，changeset 已添加，状态为待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，changeset 已添加，状态为待统一发布。
- `@nextclaw/agent-chat-ui` 删除叉号可见性回归新增独立 patch changeset，状态为待统一发布。
- `@nextclaw/shared`：需要 patch，changeset 已添加，状态为待统一发布。
- `@nextclaw/kernel`：需要 patch，changeset 已添加，状态为待统一发布。
- `@nextclaw/desktop` 为私有桌面应用包，本轮不单独发布。
