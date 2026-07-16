# 会话 `@` 文件与目录引用设计

## 背景

当前会话输入框已经支持用 `@` 选择面板应用，但还不能像 Cursor 一样，把项目内文件或目录作为显式上下文加入消息。用户需要的是统一的 `@` 引用入口：既能直接搜索文件，也能进入“文件与文件夹”视图浏览；选中后形成可编辑、可删除的 token，并让 AI 在本次运行中真实获得对应上下文。

这项能力增强了 NextClaw 对当前项目和用户显式上下文选择的感知，符合“统一入口、意图优先、自感知优先”的产品愿景。

## 现状依据

- `ChatInputSurfaceHost` 与 Lexical composer 已经拥有稳定的触发器、菜单、键盘导航和 token 插入链路，不需要另造输入框或平行编辑器。
- `@` 当前由 `panel-app-reference` 单独占用；同一个 marker 不能再注册一套互相竞争的插件，应收敛成统一的 context reference plugin。
- composer 中的 `file` token 已用于上传附件，并在发送时转换成 NCP `file` part；项目文件引用不能复用这个 kind。
- 会话发送链路已经把 composer token 写入消息 metadata，kernel 的 context provider 又是运行前构造模型上下文的唯一 owner，适合在这里做路径校验与延迟物化。
- `/api/server-paths/browse` 只支持单层目录浏览，没有项目内递归搜索合同；前端不能为了搜索而拉取整棵目录树。
- 当前会话或草稿已经能解析出有效项目目录：已存在会话使用 session `projectRoot`，草稿使用 `pendingProjectRoot`，否则使用默认 workspace。

## 核心判断

1. `@` 应成为统一引用入口，而不是“面板应用入口”与“文件入口”两条平行链路。
2. 文件与目录引用是轻量 scope，不是上传附件。composer 保存项目相对路径，消息保存结构化 metadata；绝对路径与内容只在 kernel 运行前解析。
3. 文件内容必须按预算延迟读取并显式标记截断；目录只提供有界结构摘要，不能递归灌入全部内容。
4. 文件搜索必须由服务端在项目根目录内完成，有限额、忽略典型依赖/构建目录，并拒绝越出根目录的符号链接结果。
5. 本轮对齐 Cursor 的核心交互，不顺带实现 Branch、Browser、Past Chats。

## 推荐方案

### 统一 `@` 入口

`@` 根视图包含：

- “文件与文件夹”导航项；
- 查询非空时的文件/目录匹配结果；
- 现有面板应用结果。

选择“文件与文件夹”后，菜单保持打开并切换为专用视图：空查询通过现有目录浏览 API 展示当前位置的直接子项，选择目录继续进入，返回项逐级回到父目录；进入子目录后提供“引用当前文件夹”，避免“进入目录”和“选择目录”争用同一个点击语义。输入查询后切换到项目根目录范围的服务端搜索，不把搜索范围错误收窄到当前浏览目录。列表左侧显示名称与项目相对父路径，右侧显示路径层级预览；鼠标和键盘共用同一 active item。

为支持菜单内导航，shared chat UI 给 item 增加通用的 `selectionBehavior: "navigate"` 语义。导航项不修改 composer、不关闭菜单；真正的引用项仍走现有 token 插入链路。该合同只表达交互行为，不包含 NextClaw 文件业务。

### 消息内引用交互

发送后的 skill、panel app、workspace file 和 workspace directory token 统一使用接近 Markdown 链接的单行行内样式，不使用固定高度 pill，避免撑高普通文本行。共享 inline token badge 拥有图标、字号、行高、focus 与 tooltip 合同；业务容器只负责点击后的意图路由。

- skill 引用继续打开技能文件预览；
- panel app 引用通过既有 content owner 打开面板应用；
- workspace file 引用通过既有 workspace preview 打开文件；
- workspace directory 引用把项目相对路径解析为项目内目标后，通过同一 workspace preview 打开目录浏览。

tooltip 展示稳定 key 或完整项目相对路径，使截断标签在 hover/focus 后仍可理解；不只依赖浏览器原生 `title`。

### Token 与消息协议

新增两种 composer token：

- `workspace_file`
- `workspace_directory`

`tokenKey` 保存项目相对路径。消息文本使用可恢复的协议标记：

- `@file:<percent-encoded-relative-path>`
- `@folder:<percent-encoded-relative-path>`

消息 metadata 同时保存 `{ kind, key, label, rawText }`，供消息气泡恢复 token 展示，也供 kernel 直接消费。已有 `file` 上传附件和 `panel_app` 协议保持不变。

### 服务端搜索

新增 `GET /api/server-paths/search`：

- 输入：`basePath`、`query`、`limit`；
- 输出：项目根、相对路径、绝对路径、kind、是否截断；
- 空查询只返回根目录直接子项；
- 非空查询执行有界递归扫描和稳定排序；
- 跳过 `.git`、`node_modules`、构建产物和缓存等高成本目录；
- 不跟随目录符号链接递归，并排除真实路径越出项目根的结果；
- 扫描条目数与返回结果数都有硬上限。

API 类型由 server 导出，client SDK 和 UI query hook 复用同一合同。

### Kernel 延迟物化

新增 workspace reference context provider：

1. 从当前用户消息 metadata 读取 `workspace_file` / `workspace_directory`；
2. 从当前 run 的 project context 获取有效项目目录；
3. 对相对路径做词法边界与 `realpath` 边界校验；
4. 文件按单文件预算、总预算读取文本，二进制或超限时给出明确诊断；
5. 目录生成有深度、条目数和总字符预算的结构摘要；
6. 生成独立的 `Explicit Workspace References` context block，明确这些引用是用户主动选择的上下文。

路径失效、类型变化或越界不会静默伪装成功：context block 中会记录稳定状态；越界目标不会泄露或读取外部内容。

## Owner 与数据流

```text
Lexical composer
  -> context-reference input-surface plugin
  -> server-path search query
  -> workspace_file / workspace_directory token
  -> message text + ui_inline_tokens metadata
  -> AgentRunRequest
  -> WorkspaceReferenceContextProvider
  -> bounded file content / directory outline
  -> model context
```

- `@` 模式、结果组合和 i18n：`nextclaw-ui` chat input feature。
- 菜单导航行为和路径预览基础展示：`nextclaw-agent-chat-ui` input-surface owner。
- 文件系统搜索：`nextclaw-server` server-path feature。
- 共享 metadata key 与 token kind：`nextclaw-shared` 浏览器安全合同。
- 路径校验和上下文物化：`nextclaw-kernel` context-provider contribution。

## 目录组织

- 替换 `panel-app-reference-plugin.utils.ts` 的单一 `@` 职责为 `context-reference-plugin.utils.ts`；面板应用 item builder 保留为该统一插件和 slash plugin 的共享纯映射。
- 搜索实现放在 server-path feature 的 `services/`，controller 只做 HTTP 输入输出映射。
- kernel provider 放在 `context-provider/providers/`，有状态预算与文件系统编排放在对应 `services/`，contribution root 只装配。
- React 查询放在 `shared/hooks/use-server-path-search.ts`，不在输入组件内用 effect 手写请求状态机。

## 兼容与迁移

- 已发送的 `@panel-app:<id>` 文本和 metadata 保持可读。
- slash 菜单中的面板应用入口不变。
- 上传附件继续使用 `file` token 和 NCP file part。
- 本轮不持久化“最近引用”；根视图先以查询结果和项目根目录为事实源，避免在没有稳定 owner 前新增 localStorage 状态。

## 验收标准

- 输入 `@` 能看到“文件与文件夹”和现有面板应用；选择导航项后菜单不关闭。
- 在 macOS、Windows、Linux 路径语义下，相对路径 token 能正确插入、删除、序列化和恢复。
- 输入文件名能返回项目内文件和目录，空查询展示根目录直接子项；搜索不进入典型依赖/构建目录。
- 文件视图可以逐层进入子目录、逐级返回，并能引用当前文件夹；输入查询时仍覆盖整个项目范围。
- 选中文件或目录后，发送消息的 metadata 含结构化引用，消息气泡显示 token 而不是编码协议文本。
- 消息内已知 token 使用单行链接指标、具有 tooltip；文件、目录、skill 与 panel app 点击后进入各自既有内容 owner。
- kernel 对文本文件注入有界内容，对目录注入有界结构；截断、二进制、失效和越界状态均可观察。
- 定向单测覆盖搜索边界、token 序列化、菜单导航、上下文物化；相关 TypeScript package 执行 `tsc`；前端执行 lint；真实页面完成一次 `@` 文件与目录交互冒烟。
- 运行 maintainability guard、new-code governance 与 backlog ratchet，并披露新增用户能力的行数增长豁免。

## 非目标

- Branch、Browser、Past Chats 引用。
- 全仓库常驻索引、向量检索或文件内容全文搜索。
- 把目录中所有文件内容一次性加入 prompt。
- 替代上传附件能力。
- 在本轮新增最近引用、收藏或跨项目引用历史。

## 后续实现顺序

1. 建立共享 token 与 server search 合同。
2. 实现有界服务端搜索及 client/UI query。
3. 把 `@` 收敛为统一引用插件，并补齐菜单导航和路径预览。
4. 完成 token 序列化、metadata 与消息气泡恢复。
5. 实现 kernel 边界校验和延迟物化。
6. 执行定向测试、tsc、lint、真实页面冒烟和治理收尾。
