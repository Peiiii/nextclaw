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
- `pnpm release:summary -- --json`、maintainability guard、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 `git diff --check` 通过。

## 发布/部署方式

- 本轮仅提交源码、测试、changeset 与迭代记录，不执行部署、NPM 发布或桌面端发布。
- 新增 patch changeset，后续由统一发布批次处理 `@nextclaw/ui` 与 `@nextclaw/agent-chat-ui`。
- 没有合格且隐私安全的正式产品截图，因此本 changeset 不绑定 release-note image。

## 用户/产品视角的验收步骤

1. 新建任务，打开工作目录选择器，先选择任意项目，再确认可以选择带“默认”标识的 workspace。
2. 不发送消息，点击“打开会话工作台”，确认直接进入项目文件，并且不展示依赖已存在会话的数据页。
3. 展开多层目录并滚动，打开一个文件预览后再回到项目文件，确认展开状态与滚动位置保持。
4. 右键项目文件，确认可以添加到聊天、复制绝对/相对路径；桌面端还可在 Finder 或系统文件管理器中显示。
5. 在已有正文的光标位置添加文件引用并发送，确认用户消息只把文件名显示为引用，后续正文保持普通文本；Agent 能依据引用读取对应项目文件。
6. 打开任意项目文件，分别点击页签“更多操作”和右键页签，确认菜单分组与操作一致，并可添加到聊天。
7. 在默认 workspace 会话中点击已发送消息里的文件引用，确认工作台直接打开相对路径对应的文件。

## 可维护性总结汇总

- 状态归属收敛：草稿项目根目录进入 thread store；文件引用跨面板意图进入独立 manager；编辑器继续作为光标与 token 节点 owner；发送协议继续由 composer serialization owner 负责。
- 文件树通过稳定挂载保留 React 实例状态，没有新增平行展开缓存或滚动缓存；项目根变化仍由 `key` 明确重建。
- 项目文件与上传附件使用不同 token 语义，删除了隐式复用带来的下游丢失路径；右键菜单为业务无关共享组件，文件业务只提供菜单项配置。
- 页签操作删除了独立 Popover 状态、样式和 action 映射，收敛到共享 `ContextMenuGroup[]`；组件类型、tab key 与文件预览父级保持稳定，菜单不会重挂载预览正文、iframe 或编辑器。
- 重复失败复盘已补强验证 skill：结构化引用除了发送保真，还必须覆盖“持久化 token → 用户点击 → 目标 owner / 目标表面”消费闭环及 root 可选状态；同时明确低风险简单改动只选最小充分证据，权威信号通过后停止等价复验。
- 本次 follow-up 提交范围共 18 个文件，`+479/-156`（净增 323 行）；scoped maintainability guard 报告生产代码 `+195/-94`（净增 101 行），无错误。主要正向减债是删除旧页签 Popover 平行实现；消息列表测试文件仍有超长告警，本轮通过合并既有 metadata 测试承载点击闭环，避免再新增平行测试文件或重复 case。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 完成收尾；无新增红区文件，目录和文件命名通过 preflight governance。
- 最终暂存范围共 58 个文件，`+1806/-232`（净增 1574 行）；排除测试、文档、changeset 与 skill 后，生产代码 `+1018/-211`（净增 807 行）。本轮属于新增用户能力，增长主要来自通用右键菜单、草稿工作台链路、文件引用 owner 与对应桌面能力；未通过压行或转移复杂度伪造减债。

## NPM 包发布记录

- 本轮不直接发布 NPM 包。
- `@nextclaw/ui`：需要 patch，changeset 已添加，状态为待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，changeset 已添加，状态为待统一发布。
- `@nextclaw/desktop` 为私有桌面应用包，本轮不单独发布。
