# @nextclaw/ui

## 0.24.3

### Patch Changes

- b51f599: 修复正常 AI 回复在说明 `<noreply/>` 静默标记时被整条隐藏的问题。现在只有完整可见正文严格匹配该标记时才会静默，消息列表、回复策略与继续运行锚点使用一致语义。
- 35079f9: 修复已安装 NextClaw PWA 时 Panel App 的“在新标签页中打开”被捕获到 PWA 专属窗口的问题，让链接继续交由当前浏览器的新标签页处理。
- 8bbb717: 将项目移除入口调整到按项目查看的会话列表项目行“更多操作”菜单中，并使用普通样式展示菜单项和确认动作，避免在项目详情页常驻显示高权重的危险按钮。
- db88c76: 完全移除旧项目 Marker 与项目观测机制。Projects 不再读取 `.nextclaw/project.yaml`、扫描项目文件或全部历史会话，也不再提供 observation API 与 `nextclaw projects observe`；历史配置不会再产生 Marker 或未知字段诊断。

  项目材料改为零配置的单一来源：产物只展示 Project Work 工作项显式关联的文件，支持去重、分页与搜索；Skills 固定读取 `.agents/skills`；工作约定固定读取项目根目录 `AGENTS.md`。

  同时简化项目工作项列表与看板的状态分组，移除外层卡片边框和底色，只保留工作项自身的边界与轻量分组标题。

- Updated dependencies [b51f599]
- Updated dependencies [db88c76]
  - @nextclaw/shared@0.5.1
  - @nextclaw/client-sdk@0.12.0

## 0.24.2

### Patch Changes

- 25a59ef: 新增安全的项目移除能力：用户可在项目页面确认影响后将项目从列表移除，或通过要求精确项目 ID 确认的 CLI 执行同一操作；本地目录、历史会话和 Project Work 保持不变，重新添加同一目录会恢复原项目。
- 76cf3df: 让项目工作项的内置默认状态跟随界面语言显示，同时保留自定义状态名称。
- d3a705a: 支持从 Panel App 的更多操作中在浏览器或新标签页单独打开应用；独立页面只显示应用内容，并继续连接当前 NextClaw 实例。
- 7b960b9: 恢复项目概览中同等重要的当前工作与最近产物双区域，并为 UI、API、Agent Tool 和 CLI 增加按状态分组的有界工作项游标分页。
- Updated dependencies [25a59ef]
- Updated dependencies [7b960b9]
  - @nextclaw/client-sdk@0.11.2

## 0.24.1

### Patch Changes

- @nextclaw/client-sdk@0.11.1

## 0.24.0

### Minor Changes

- 3cd57bf: 新增由 NextClaw 独立持久化的项目工作项：支持自定义状态、完整状态变化历史、关注标记、软删除恢复和项目内产物关联，不再依赖扫描会话历史或向项目目录写入追踪文件。

  项目内会话会按条件获得工作项工具；CLI 提供同一套 CRUD、状态与产物入口并强制指定项目 ID。项目主页的概览、列表和看板会响应实时变更，所有工作项统一在右侧详情抽屉中打开，同时保留原有产物、Skills、工作约定与项目会话能力。

- 86d3479: 新增 Projects 项目主页：通过项目配置、项目文件、会话 Marker 和项目 Skills 展示可追溯的工作项、产物、上下文、AI 运行状态、待关注事项与诊断。已有项目会话与旧版观测快照会保持可读。

  新增 `client.projects.getObservation()`、`GET /api/projects/:projectId/observation` 和 `nextclaw projects observe`，三条入口复用同一份 Kernel 快照合同。项目 setup 经用户确认后会建立 `.nextclaw/project.yaml`、根 `AGENTS.md` 与项目内工作追踪 Skill；后续 AI 在每个工作节点开始前输出紧凑 Marker，项目页会在流式输出期间更新。不会新增项目任务数据库、特殊会话类型或运行时 Skill 注入。

### Patch Changes

- a02fc22: 修复项目主页在移动端打开文件预览时挤压内容区域的问题，并优化窄屏布局。
- 50f2129: 为 WASI 应用补齐用户目录授权闭环。用户现在可以在应用页面或 CLI 中查看声明的目录权限，选择运行主机上的文件夹，以只读或读写方式授权，并随时替换或撤销；授权变化会立即淘汰旧的 Runtime 挂载。
- Updated dependencies [3cd57bf]
- Updated dependencies [86d3479]
- Updated dependencies [50f2129]
  - @nextclaw/client-sdk@0.11.0
  - @nextclaw/shared@0.5.0
  - @nextclaw/ncp-toolkit@0.6.23

## 0.24.0-beta.1

### Minor Changes

- 3cd57bf: 新增由 NextClaw 独立持久化的项目工作项：支持自定义状态、完整状态变化历史、关注标记、软删除恢复和项目内产物关联，不再依赖扫描会话历史或向项目目录写入追踪文件。

  项目内会话会按条件获得工作项工具；CLI 提供同一套 CRUD、状态与产物入口并强制指定项目 ID。项目主页的概览、列表和看板会响应实时变更，所有工作项统一在右侧详情抽屉中打开，同时保留原有产物、Skills、工作约定与项目会话能力。

### Patch Changes

- a02fc22: 修复项目主页在移动端打开文件预览时挤压内容区域的问题，并优化窄屏布局。
- 50f2129: 为 WASI 应用补齐用户目录授权闭环。用户现在可以在应用页面或 CLI 中查看声明的目录权限，选择运行主机上的文件夹，以只读或读写方式授权，并随时替换或撤销；授权变化会立即淘汰旧的 Runtime 挂载。
- Updated dependencies [3cd57bf]
- Updated dependencies [50f2129]
  - @nextclaw/client-sdk@0.11.0-beta.1
  - @nextclaw/shared@0.5.0-beta.0

## 0.24.0-beta.0

### Minor Changes

- 86d3479: 新增 Projects 项目主页：通过项目配置、项目文件、会话 Marker 和项目 Skills 展示可追溯的工作项、产物、上下文、AI 运行状态、待关注事项与诊断。已有项目会话与旧版观测快照会保持可读。

  新增 `client.projects.getObservation()`、`GET /api/projects/:projectId/observation` 和 `nextclaw projects observe`，三条入口复用同一份 Kernel 快照合同。项目 setup 经用户确认后会建立 `.nextclaw/project.yaml`、根 `AGENTS.md` 与项目内工作追踪 Skill；后续 AI 在每个工作节点开始前输出紧凑 Marker，项目页会在流式输出期间更新。不会新增项目任务数据库、特殊会话类型或运行时 Skill 注入。

### Patch Changes

- Updated dependencies [86d3479]
  - @nextclaw/client-sdk@0.11.0-beta.0
  - @nextclaw/ncp-toolkit@0.6.23

## 0.23.0

### Minor Changes

- f38b756: Complete the Portable Capability Runtime with host-mediated files, secrets, networking, SQLite, jobs, streaming, resident events, AI and Agent slots, versioned providers, shared Panel/Agent/CLI invocation, and a current-evidence acceptance contract. Add end-to-end developer commands, real reference apps, cross-platform release gates, and user/developer documentation.

### Patch Changes

- Updated dependencies [f38b756]
  - @nextclaw/client-sdk@0.10.0

## 0.22.5

### Patch Changes

- 99a2f2c: 将 WASM Service App 的共享执行器切换为嵌入式 Spin Runtime Factors，同时保持现有 `.napp`、WIT、Service Action 与 runner 协议不变。

  新增外部依赖就绪状态：默认 App 仍为自包含并可直接启用；显式声明额外 capability 或 resource 的 App 会在 API、CLI 和界面中显示缺失要求，并在依赖未满足时阻止误启用。

  新增独立 Provider App 与资源绑定闭环：Provider 可声明版本化 capability，Consumer 可通过 API、CLI 或 Agent 检查、绑定、验证和解绑；绑定只保存非敏感 Provider 引用，并通过 runner allowlist 执行受控跨 App 调用。
  - @nextclaw/client-sdk@0.9.5

## 0.22.4

### Patch Changes

- 9377757: 修复子 Agent 的运行、等待和通知语义：`sessions_spawn` 现在默认立即启动且不阻塞父 Agent，`notify` 只控制完成通知，`wait` 独立控制同步等待；仅创建空会话改为显式 `start=false`。异步任务结束后，原工具结果会可靠更新并在冷重启后保持终态。
  - @nextclaw/client-sdk@0.9.4

## 0.22.3

### Patch Changes

- 824f59e: 加快岛屿主题背景加载：图片体积减半并在启用主题时提前加载，刷新后复用长期缓存，不再重复下载整张背景。
  - @nextclaw/client-sdk@0.9.3

## 0.22.2

### Patch Changes

- 51fac6a: 修复旧实例在第 20 次工具调用后突然中止 Agent 任务的问题：废弃并移除可配置的工具调用上限，旧配置文件中的相关值不再参与运行；NextClaw native runtime 统一使用固定的 1000 次工具调用安全预算，设置页、Agent 详情和 API 也不再暴露该配置。
  - @nextclaw/client-sdk@0.9.2

## 0.22.1

### Patch Changes

- Updated dependencies [60febb5]
  - @nextclaw/shared@0.4.30
  - @nextclaw/client-sdk@0.9.1

## 0.22.0

### Minor Changes

- 4066c41: 新增 Rust-first Portable Runtime 产品基础：NextClaw 现在可以从产品资源启动共享 Wasmtime runner，在现有 App Package、Panel App 与 Service Action 体系内运行 Rust/WASM Component，不需要手工配置开发者 runner 路径。

  内置「日常小工具箱」提供今日清单、灵感便签、专注小钟和联系人整理四个真实场景，覆盖持久数据、Resident 后台事件、Provider/Consumer 组合、Panel 授权与 Agent Tool 复用。runner 超时或异常退出后会按依赖顺序恢复持久组件，并保留宿主管理的数据。

  应用安装失败时会清理新建的不可变版本目录，避免发布者或实例校验失败阻塞后续合法安装。`nextclaw app check/dev/call` 已复用同一 Runtime 支持 Portable Service，构建合同和 CI 覆盖 macOS arm64、Linux x64 与 Windows x64，并保留 macOS x64、Linux arm64 目标映射；平台 runner 资源使用原子替换，热构建不会覆盖正在执行的二进制。Secret、Blob、长任务、流式能力和生产级资源隔离仍在整体产品计划中保持为未关闭项。

### Patch Changes

- 94c6f2a: <!-- release-note-image: zh-CN | images/screenshots/nextclaw-island-inbox-workspace-cn.png | NextClaw 岛屿主题在同一桌面中展示收件箱、AI 简报、会话、应用和工作区 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-island-inbox-workspace-cn.png | NextClaw Island theme showing the AI inbox, delivered briefing, conversations, apps, and workspace in one desktop view -->

  Add the Island theme with a continuous warm paper canvas, an original gently animated tropical tree, coastal green accents, quieter navigation and composer surfaces, and persistent selection from Appearance settings.

- Updated dependencies [4066c41]
- Updated dependencies [94c6f2a]
  - @nextclaw/client-sdk@0.9.0
  - @nextclaw/agent-chat-ui@0.7.2

## 0.21.0

### Minor Changes

- f80df69: 新增统一的桌面应用授权与操作链路。NextClaw AI 现在可以在受限 `node_repl` 中使用私有 `desktop` SDK，在用户按 Agent 和目标应用授权后读取有界界面、点击、写入文本或发送常用按键；设置中可检查 macOS 辅助功能状态、查看并撤销 Agent 与 Extension 的应用访问许可。

  新增微信桌面观察 Extension，可把当前微信窗口的可见内容作为会话上下文，并通过持续关注关系将新出现的可见消息送回原会话。桌面 SDK 不按“发送”或“确认”等控件文案另设产品级阻断；系统权限、用户 grant、目标窗口绑定和审计仍然有效。

  Panel App 与 Service App 现在复用同一授权存储和撤销语义：启用、禁用、卸载或失败恢复时，会一并保持或恢复关联的面板状态、桥接会话与服务动作授权，避免包生命周期留下失效或越权的调用路径。

  平台支持由统一 feature-controls 合同提供；当前运行环境不支持桌面自动化时，不显示桌面操作设置入口。

- 4a6fc30: 现在可以在 MCP 页面连接任意受信任的 stdio、HTTP 或 SSE MCP 服务。保存前会测试连接并显示发现的工具数量；已保存的服务可与 Marketplace 项目一起启用、停用、诊断和移除。配置抽屉适合长表单输入，命令行与 Agent 也可使用 `nextclaw mcp` 完成同一套管理操作。

### Patch Changes

- bad2c8d: 现在可以直接从聊天侧边栏每个会话的更多菜单删除会话，无需先打开目标会话。删除当前会话会回到会话根页；删除其它会话不会中断当前阅读，并会显示成功或失败提示。删除确认弹窗打开后，可按 Enter 确认或 Escape 取消。命令行也新增 `nextclaw sessions delete <session-id> --confirm <session-id> --json`，确认值必须与会话 ID 完全一致。
- Updated dependencies [f80df69]
- Updated dependencies [4a6fc30]
- Updated dependencies [882b6e0]
  - @nextclaw/client-sdk@0.8.0
  - @nextclaw/shared@0.4.29

## 0.20.3

### Patch Changes

- 4ecb43f: 修复长回复尚未完整恢复时，多条上下文压缩提示被错误堆叠到会话末尾的问题；压缩边界现在只会在能够定位到回复中的正确位置后显示。
- a5a03e5: Prevent one unavailable App package from breaking the Apps list, and show its diagnostic while other Apps remain available.
- f8d7f74: 会话内的定时任务现在支持启用或暂停、立即运行、查看完整任务详情和删除；长任务内容会保持紧凑展示，避免撑开工作区卡片。
- 444e666: 会话工作台的 Token 用量现在会显示 Agent 轮次、模型调用次数与已报告调用次数。缓存读取占比明确只按输入 Token 计算，按模型明细也会显示对应调用次数。
- c8410fd: 在工作区、会话和常用页面间切换后，NextClaw 会恢复此前的阅读位置。Markdown 文件预览现在会在切换文件，以及在源码和渲染预览之间往返时保留滚动位置。
- Updated dependencies
  - @nextclaw/client-sdk@0.7.7

## 0.20.2

### Patch Changes

- 667c4fd: 产品活跃统计改为默认开启的匿名汇总：每个客户端仅为当日、当周和当月生成相互独立的一次性收据，不再上传或保存稳定安装标识、账号、令牌、IP、User-Agent、消息内容或工具参数；隐私设置新增本机投递状态，管理后台同步展示当前自然日、自然周、自然月活跃与成功使用趋势。
- cfce362: 排队消息已自动开始运行时，插嘴操作会刷新队列并清除过期错误，不再显示找不到旧队列项的提示。
- 9120123: 在会话工作台的 Markdown 预览路径栏增加文档目录，可查看标题层级并快速跳转到对应章节。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-markdown-outline-navigation-cn.png | Markdown 文档目录展示标题层级并支持章节跳转 -->

- 44c8cdc: 会话与项目列表新增简约悬浮信息卡片，集中展示所属项目、子会话和定时任务等上下文；项目数量和展开图标改为按需显示，并修复会话操作图标重叠与标题过早截断。
- e43fbe1: 会话列表仅在悬停显示操作按钮时为其预留空间，非悬停状态下可以展示更完整的会话标题。
- 8716fb9: 统一运行中直接插话与排队后插话的状态迁移、消息展示和运行原数据，避免直接插话被误显示为普通消息，或完成后缺少“更多操作”入口。
- Updated dependencies [667c4fd]
- Updated dependencies [8716fb9]
  - @nextclaw/client-sdk@0.7.6
  - @nextclaw/ncp-react@0.5.26

## 0.20.1

### Patch Changes

- 08d2da7: 精简子会话详情：移除消息内容上方重复的会话类型、模型和项目元信息，让对话内容直接承接子会话标签页。
- af85fa6: 修复继承父会话上下文的子会话连续性：子会话会继续使用父会话选择的模型，并且不会把父会话的历史上下文压缩记录重复展示在自己的消息流中。
- 4f21c38: 修复文件工具展开后同时显示结构化预览和重复原始内容的问题。读取、写入、编辑和补丁结果现在只保留一份清晰的文件预览，解析失败与错误信息仍会正常显示。
- 50f064c: 为所有模型运行记录可查询的触发证据，包括发起者、来源渠道、触发与运行模型、关联会话、消息、请求和工具调用；消息的“更多操作”现在统一提供这些详情。后台完成通知只由人类直接发起的运行触发，代理委派、定时任务、观察和系统运行保持静默。
- 9ee3a68: 修复运行中插到下一步时消息短暂错序的问题。当前步骤的 AI 输出现在会稳定显示在插话消息之前，流式过程中、步骤完成后和刷新重载后的顺序保持一致。
- Updated dependencies [50f064c]
- Updated dependencies [9ee3a68]
  - @nextclaw/ncp@0.10.0
  - @nextclaw/ncp-toolkit@0.6.23
  - @nextclaw/shared@0.4.28
  - @nextclaw/ncp-react@0.5.25
  - @nextclaw/ncp-http-agent-client@0.4.22
  - @nextclaw/client-sdk@0.7.5

## 0.20.0

### Minor Changes

- ec60bc1: 新增全局 Extension 管理入口、会话级持续关注管理，以及会话时间线中的可见外部事件卡片。事件消息使用通用的 `observation.event` 标识，不绑定具体产品或协议品牌。

### Patch Changes

- eeac1f6: 修复会话历史摘要删除工具调用结构节点导致上下文压缩边界和 Continue 后续内容错位的问题。摘要现在保留完整的 part 顺序与数量，仅延迟大 payload 的加载。
- e14eeb0: 会话头部、会话列表、子会话列表和工作区子会话 tab 的“更多操作”现在都支持复制对应的会话 ID。
- f9c6477: 修复会话历史可靠性问题：保留历史 replay、projection 恢复和压缩消息视图的修复，不再用 journal 目录级 writer ownership 阻止同一 `NEXTCLAW_HOME` 下的第二个 runtime 或新会话启动。
- a4421b3: 修复运行中通过 Cmd/Ctrl+Enter 插话后，待消费消息未立即显示“等待进入下一步”的问题；当插话回退为排队时也会正确显示在队列中。
- Updated dependencies [2c7ce8c]
- Updated dependencies [eeac1f6]
- Updated dependencies [ec60bc1]
- Updated dependencies [70dd515]
  - @nextclaw/ncp@0.9.0
  - @nextclaw/shared@0.4.27
  - @nextclaw/ncp-http-agent-client@0.4.21
  - @nextclaw/ncp-react@0.5.24
  - @nextclaw/ncp-toolkit@0.6.22
  - @nextclaw/client-sdk@0.7.4

## 0.20.0-beta.0

### Minor Changes

- ec60bc1: 新增全局 Extension 管理入口、会话级持续关注管理，以及会话时间线中的可见外部事件卡片。事件消息使用通用的 `observation.event` 标识，不绑定具体产品或协议品牌。

### Patch Changes

- eeac1f6: 修复会话历史摘要删除工具调用结构节点导致上下文压缩边界和 Continue 后续内容错位的问题。摘要现在保留完整的 part 顺序与数量，仅延迟大 payload 的加载。
- e14eeb0: 会话头部、会话列表、子会话列表和工作区子会话 tab 的“更多操作”现在都支持复制对应的会话 ID。
- f9c6477: 修复会话历史可靠性问题：保留历史 replay、projection 恢复和压缩消息视图的修复，不再用 journal 目录级 writer ownership 阻止同一 `NEXTCLAW_HOME` 下的第二个 runtime 或新会话启动。
- a4421b3: 修复运行中通过 Cmd/Ctrl+Enter 插话后，待消费消息未立即显示“等待进入下一步”的问题；当插话回退为排队时也会正确显示在队列中。
- Updated dependencies [2c7ce8c]
- Updated dependencies [eeac1f6]
- Updated dependencies [ec60bc1]
- Updated dependencies [70dd515]
  - @nextclaw/ncp@0.9.0-beta.0
  - @nextclaw/shared@0.4.27-beta.0
  - @nextclaw/ncp-http-agent-client@0.4.21-beta.0
  - @nextclaw/ncp-react@0.5.24-beta.0
  - @nextclaw/ncp-toolkit@0.6.22-beta.0
  - @nextclaw/client-sdk@0.7.4-beta.0

## 0.19.5

### Patch Changes

- @nextclaw/client-sdk@0.7.3

## 0.19.4

### Patch Changes

- @nextclaw/client-sdk@0.7.2

## 0.19.3

### Patch Changes

- 4c89fa2: 将固定到主侧栏的 Panel App 收拢为可折叠应用分组，并在窄栏中使用单一聚合入口。
- 1d63057: 重载工具调用会话现在会先显示受预算保护的最近内容，再自动补齐近期上下文，并减少重复 hydrate 与首屏资源串行等待；发布包同时内置经过校验的预压缩 UI 资产，外部静态服务器升级后不再丢失快速传输路径。真实 VPS 已登录热刷新中位约 1.13 秒，同时保留完整工具详情和更早历史。
- 3e6da7e: 应用市场现在使用 NextClaw 提供的真实宿主 target 判断兼容性：不支持当前设备的应用会被明确标注并禁用安装，同时仍可查看详情；历史安装失败不再跨页面刷新持续显示为错误和“重试”。
- 6587602: 新增默认关闭的产品活跃统计与隐私设置：未登录安装使用随机匿名标识，登录后按账号归并，并可将团队和 QA 测试流量从外部 DAU、WAU、MAU 中分开。
- 7cc703c: 新增会话插话能力：AI 运行中普通发送继续自动排队，使用 Command/Ctrl + Enter 可在下一安全步骤插入完整消息；排队内容也可直接转为插话，并以独立用户消息和后续 AI 消息呈现在会话中。排队区域会保留并展示图片缩略图和文件摘要，编辑时仍可完整恢复富内容。
- Updated dependencies [1d63057]
- Updated dependencies [3e6da7e]
- Updated dependencies [6587602]
- Updated dependencies [7cc703c]
  - @nextclaw/ncp-react@0.5.23
  - @nextclaw/client-sdk@0.7.1
  - @nextclaw/ncp@0.8.1
  - @nextclaw/ncp-toolkit@0.6.21
  - @nextclaw/agent-chat-ui@0.7.1
  - @nextclaw/ncp-http-agent-client@0.4.20
  - @nextclaw/shared@0.4.26

## 0.19.1

### Patch Changes

- 347e4b7: 统一 Panel App 在列表、右侧运行态和左侧主侧栏中的入口管理：左侧入口悬停后可直接移除，右侧恢复快捷入口也能正确显示添加或移除操作；移除不会中断当前 App 页面。

## 0.19.0

### Minor Changes

- c19ae8f: 大工具调用历史会话改为按预算分级加载：首屏显示真实工具调用数量和类型，只有展开处理过程时才按消息读取完整参数与结果，并对超大工具组分批展示。历史分页与会话摘要改走有界投影读模型，避免打开会话时扫描完整 journal；会话列表先限量并限制 metadata 读取并发，减少首屏请求之间的 I/O 争用。

  <!-- release-note-blog: docs/blog-drafts/2026-08-20-heavy-tool-call-session-performance.blog-draft.md -->

- e8d725a: 支持用户从 Panel Apps 列表或运行中 App 的更多菜单手动添加主侧栏入口，并在主内容区无重复宿主 Header 地完整使用。安装不会自动占用主侧栏；禁用后入口暂时隐藏并可在重新启用后恢复，卸载或删除则会清理入口。添加/移除即时反馈，打开 App 不再等待活动统计写盘；右侧 Panel App 移除重复的“返回应用”动作，统一遵循资源浏览器历史。

### Patch Changes

- Updated dependencies [c19ae8f]
- Updated dependencies [e8d725a]
- Updated dependencies [c10dcaa]
  - @nextclaw/client-sdk@0.7.0
  - @nextclaw/agent-chat-ui@0.7.0
  - @nextclaw/shared@0.4.25

## 0.18.4

### Patch Changes

- ae676ff: 修复 Marketplace Panel App 固定到右侧边栏后无法再次打开的问题。固定入口现在使用稳定的 Panel App ID，并在升级、重装或重新启用后自动解析当前安装版本，不再依赖历史安装路径。
  - @nextclaw/client-sdk@0.6.7

## 0.18.3

### Patch Changes

- @nextclaw/client-sdk@0.6.6

## 0.18.2

### Patch Changes

- ef5d9ae: Keep the universal thinking-off option selected even when a provider only declares active reasoning levels.
- 1df4217: Support one or multiple native platform artifacts per Mini App version, select the compatible artifact during install, expose platform-aware NextClaw app publishing commands, and label supported platforms in the App Marketplace.
- Updated dependencies [65dc8fb]
  - @nextclaw/ncp-http-agent-client@0.4.19
  - @nextclaw/client-sdk@0.6.5

## 0.18.1

### Patch Changes

- 80f7660: Fix OpenAI Responses history encoding and keep explicit thinking-off selections stable across session preference hydration and persistence.
  - @nextclaw/client-sdk@0.6.4

## 0.18.0

### Minor Changes

- a6fd473: Add an Update session title command to the chat slash menu. The command asks AI to generate and apply a concise title from the current conversation without replacing the user's draft.

### Patch Changes

- @nextclaw/client-sdk@0.6.3

## 0.17.2

### Patch Changes

- aa08a3f: 命令工具卡新增实时执行计时：命令真正开始后持续显示已运行时长，并在成功、失败或取消后冻结并保留耗时；刷新会话后仍可从标准 NCP 执行时间恢复。内置命令运行时与 Codex command execution 统一使用同一条计时协议，不再把排队或参数生成时间算作命令执行耗时。
- e2a7c8e: 提升 Web Chat 在普通网络抖动后的恢复稳定性：SSE 半开或长时间无数据时会主动判定失活并重连，连接恢复后重新补齐会话历史，同时保留更晚到达的实时完成事件，无需刷新页面即可继续看到最终回复。
- 03adeb6: 修复内嵌浏览器最右侧标签的关闭操作被横向边界裁切的问题：关闭按钮现在于标签开头悬浮显示，不再因鼠标悬停改变标签宽度。
- 004d51f: 增强会话工作台：概览底部新增当前会话的 Token 用量，支持按模型查看输入、输出、缓存输入、总量与缓存命中率；子会话管理页新增“新建子会话”入口，并复用侧边对话的上下文继承链路。
- Updated dependencies [aa08a3f]
- Updated dependencies [e2a7c8e]
- Updated dependencies [004d51f]
  - @nextclaw/ncp@0.8.0
  - @nextclaw/ncp-toolkit@0.6.20
  - @nextclaw/agent-chat@0.3.14
  - @nextclaw/agent-chat-ui@0.6.25
  - @nextclaw/ncp-http-agent-client@0.4.18
  - @nextclaw/ncp-react@0.5.22
  - @nextclaw/client-sdk@0.6.2
  - @nextclaw/shared@0.4.24

## 0.17.1

### Patch Changes

- 27d7293: Harden App, Panel App, and Service App data management with isolated instance storage, crash-safe deletion recovery, side-effect-free catalog reads, and explicit keep-or-delete uninstall controls.
- Updated dependencies [27d7293]
  - @nextclaw/client-sdk@0.6.1

## 0.17.0

### Minor Changes

- ca2c98d: 把 App 数据生命周期补齐为可管理的产品能力：App 更新继续复用原实例，卸载与 Workspace Service 删除默认保留个人数据，也可以在确认后同时永久删除 data、config、state、cache、tmp 和 logs。

  Apps 页面会显示六类数据占用、受管路径和已保留数据，并支持稍后清理；CLI 新增 `nextclaw app data list/delete`，开发态可用 `nextclaw app dev --reset-data --confirm <app-id>` 精确重置当前实例。HTTP、Client SDK、双语文档与内建自管理 Skill 同步使用同一套安全确认和 active/retained 规则。

### Patch Changes

- Updated dependencies [ca2c98d]
  - @nextclaw/client-sdk@0.6.0

## 0.16.0

### Minor Changes

- 298233c: 把 Mini App、Panel App 和 Service App 收敛为可安装、可更新、可卸载的统一 App 产品：每个 App Instance 现在拥有独立的 data、config、state、cache、tmp 和 logs 目录，卸载默认保留个人数据，重装时只允许同一发布者继续使用。

  更新会先安装和探测候选版本，再切换当前版本；候选 Service 启动失败、数据 schema 不兼容或代码完整性异常时，旧版本和旧数据保持可用。Apps 管理界面同时显示真实的数据位置、占用空间和运行隔离等级，原生进程会明确标注为当前用户完整权限，社区原生 Service App 不再允许直接进入公开目录。

### Patch Changes

- @nextclaw/client-sdk@0.5.29

## 0.15.29

### Patch Changes

- 4be6947: 加快长会话的打开和历史加载：默认每页读取 40 条消息，空闲会话不再为首屏分页扫描完整消息索引，向上加载旧消息时也不再重复计算整段会话的上下文窗口。
- 94468b5: 修复侧边对话与 child 会话的内容区域高度和通知可见性：输入面板保持在工作区底部、长回复可以独立滚动，正在右侧查看的 child 会话完成回复时不再弹出后台通知。
- 988f2bf: 修复通过远程 HTTP 地址访问 NextClaw 时，编辑历史消息后点击发送没有反应的问题；编辑提交不再依赖仅安全上下文可用的 Web Crypto UUID API。
  - @nextclaw/client-sdk@0.5.28

## 0.15.28

### Patch Changes

- 2542896: 将内置个人空间升级到 0.1.4：重新设计待办和日历，补齐响应式布局、编辑与失败状态、外部日历来源管理，并修复日程范围与同步数据的一致性。同时修复应用检查更新的 Registry 响应兼容问题、成功重试后仍显示历史失败的问题，以及 `app dev/call` 没有为本地 Service APP 注入隔离数据目录的问题。
  - @nextclaw/client-sdk@0.5.27

## 0.15.27

### Patch Changes

- 9b22a7d: 支持将文档浏览器中的文档、应用、Panel App 和网页标签添加到聊天。发送后仍可识别并重新打开对应资源，AI 也能获得当时的资源地址和页面信息。项目文件树现在会保留展开与滚动状态，刷新会覆盖全部展开目录，“全部折叠”可可靠生效，并通过低开销的按需文件监听自动反映可见目录变化。
- 3e3a44c: AI 正在回复时发送下一条消息，现在会立即显示正在加入队列的反馈，并在服务器确认后无缝切换为可编辑的排队项。
- efb52a7: 应用市场现在按页加载并支持服务端搜索，安装、更新、版本切换与卸载在后台持续执行；同时补齐应用图标、封面、详情与失败恢复体验，并允许用户卸载内置应用后按需重新安装。

  <!-- release-note-image: en-US | images/screenshots/nextclaw-app-marketplace-en.png | NextClaw Add apps dialog showing Personal Space, Hello Notes, and Workspace Glance with their artwork and install state -->

- Updated dependencies [9b22a7d]
- Updated dependencies [efb52a7]
  - @nextclaw/shared@0.4.23
  - @nextclaw/agent-chat-ui@0.6.24
  - @nextclaw/client-sdk@0.5.26

## 0.15.26

### Patch Changes

- fb73f89: 改进 Marketplace 技能更新：检测到安装后的本地修改时返回明确冲突，并在用户确认后才覆盖更新；取消操作会保留现有技能文件。
- 7179c7a: 新增统一的系统管理对象 `@` 引用协议，首批支持收件箱报告和定时任务的分类浏览、分组搜索、不可变快照与模型上下文；`@` 面板中的文件和文件夹现在拥有独立入口、搜索分组与选择语义；收件箱“继续聊”进入带可见报告引用的聊天草稿，不再创建隐藏关联会话。
- 33eb6b2: 修复设置页更新后仍由 systemd 拉起旧运行时的问题。更新现在保持一键完成，并在切换运行时后由稳定 launcher 重新拉起新版本，页面版本、内核版本和实际进程保持一致。
- 6b3127f: 新增完整的 Apps 与 Mini App 体验：可从内置市场发现、安装、启用、更新、回滚和卸载组合应用，并首发由待办、Markdown 笔记、收藏与日历组成的“个人空间”。应用代码按版本不可变安装，个人数据保存在稳定目录；安装事务、包完整性、运行时授权清理、远程下载预算与日历订阅网络边界也得到强化。
- 8b191a0: 优化会话列表的时间/项目视图切换：改为带图标的分段控件，并在切换时平滑移动选中状态，同时保留键盘和减少动态效果的可访问性支持。
- 4a2d937: Remember whether the file preview Explorer is open and keep it closed by default for new and existing workspaces.
- dffa83e: Keep the workspace Explorer selection synchronized with files opened from outside the directory tree.
- d573f31: The session list toolbar is now more compact and consistent, with a unified Time and Project switch and surface-matched action feedback.
- Updated dependencies [7179c7a]
- Updated dependencies [6b3127f]
  - @nextclaw/shared@0.4.22
  - @nextclaw/client-sdk@0.5.25
  - @nextclaw/agent-chat-ui@0.6.23

## 0.15.25

### Patch Changes

- ffb365c: 会话工作区现在提供与文件预览连续协作的项目文件 Explorer：目录树和预览可同时显示，支持新建文件与文件夹、上传、下载、重命名、删除、路径复制以及将文件或文件夹添加到聊天。Explorer 宽度可拖动并记忆，空间不足时才切换为覆盖式侧栏；所有写操作均由服务端限制在当前项目根目录内，同名上传只有在用户明确确认后才会覆盖。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-workspace-explorer-cn.png | NextClaw 项目文件 Explorer 和 Markdown 预览同时打开 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-workspace-explorer-en.png | NextClaw project Explorer beside a Markdown file preview -->

- deac28b: 修复 NCP 启动期间仍可编辑消息、导致保存请求无响应的问题；消息编辑和继续运行现在会与聊天输入共用运行时就绪状态，并在服务可用后自动恢复。
- 0b7df97: 改善 Web Chat 长连接的稳定性：空闲 SSE 现在会主动保活，短暂断流可在后台补齐会话并重连，不再立即展示无意义的网络错误；持续连接失败仍会明确提示。启动恢复同时改为逐会话、逐行扫描历史日志，降低大 journal 场景的峰值内存和 OOM 风险。
- Updated dependencies [ffb365c]
- Updated dependencies [c783019]
- Updated dependencies [0b7df97]
  - @nextclaw/client-sdk@0.5.24
  - @nextclaw/ncp@0.7.17
  - @nextclaw/ncp-react@0.5.21
  - @nextclaw/ncp-http-agent-client@0.4.17
  - @nextclaw/ncp-toolkit@0.6.19
  - @nextclaw/shared@0.4.21

## 0.15.24

### Patch Changes

- eee4271: 统一聊天图片与 Mermaid 图表的全屏预览体验：媒体现在支持适应窗口、缩放、拖拽和明确复位；Mermaid 的复制与放大操作共用对齐的工具栏，并可在全屏中继续复制源码。
- 688ed04: 优化聊天模型选择器的新模型提醒：摘要固定显示在弹层底部，不再随模型列表滚走；查看新增模型时改用更大的模型目录窗口，支持搜索、按提供商筛选、逐项添加和明确忽略本批提醒。开发环境可通过 `?preview=model-discovery` 安全预览完整状态，不修改提供商配置或提醒存储。
- 221eede: 精简右侧快捷栏：移除低频的服务应用默认入口，应用入口保持不变；服务应用仍可从应用页面访问并按需固定。
- c54a1d9: 支持划选稳定的 AI 或用户历史消息并作为结构化片段添加到聊天；输入框与发送后保持一致的紧凑引用展示，AI 会收到选中时的精确快照。文件预览和会话消息共用新的划选浮层：拖选期间不追随鼠标，松手后下一帧立即出现并自动避让视口边界。
- Updated dependencies [eee4271]
- Updated dependencies [688ed04]
- Updated dependencies [4ab158d]
- Updated dependencies [a33d09f]
- Updated dependencies [c54a1d9]
  - @nextclaw/agent-chat-ui@0.6.22
  - @nextclaw/shared@0.4.20
  - @nextclaw/client-sdk@0.5.23

## 0.15.23

### Patch Changes

- 825f589: 新增更柔和的“炭夜”深色主题，以中性炭灰表面和清晰层次减少深黑压迫感；用户消息保持安静的炭灰表面，清蓝色仅用于需要强调的操作。
- c3eb33c: 修复聊天失败时同一供应商错误在对话区和输入框重复显示、视觉提示过强且原始响应被截断的问题；错误现在只在对话区以低干扰样式显示一次，正文保留供应商返回的完整内容，并在内容较长时通过限高滚动查看。
- eb239c5: 聊天页加载模型时不再在输入框内部显示重复的脉冲骨架，输入区域保持干净稳定；模型不可用时仍会提供明确的配置入口。
- 8049f49: 支持直接编辑当前会话最近一条用户消息并在同一会话继续执行；中断或失败后可从输入框或最近一条 AI 回复继续运行，后续输出会直接续写原回复而不是新增消息气泡，并准确区分续写前后成功与取消的工具操作。编辑器会自动聚焦到末尾，运行中隐藏编辑操作，所有纯图标入口均提供明确提示；切换模型时会继续保留可用的恢复入口。
- ae21568: 修复运行中断或服务重启后，较早的助手回复偶尔排到后来用户消息之后的问题；聊天记录会按实际时间线稳定显示，并自动重建已有的错误消息索引。
- b7ca1e2: 聊天输入界面进一步收紧模型选择与文件预览密度，搜索框聚焦不再跳变边框；默认 Main Agent 使用独立的柔和身份色，不再跟随主要操作色。
- 49f826c: 定时任务的执行会话现在会以清晰的链接颜色和下划线显示，并通过站内导航直接打开对应会话，无需刷新整个页面。
- 98c5b7f: 精简默认聊天消息的重复身份信息：Main Agent 使用 Native runtime 时，助手回复不再重复展示头像和名称；新会话发送后，首条用户消息与“Agent 正在思考...”会立即稳定显示，并在正式会话生成前后保持连续；编辑后重新执行或继续运行也无需等待后端 running 确认；首个可见回复出现后立即隐藏思考提示；已处理摘要移除无操作含义的前置图标。
- af524e5: 全局通知新增始终可见的独立关闭按钮：用户可以直接忽略提醒而不进入对应会话；点击通知正文仍会打开目标内容。关闭操作支持键盘、触控与中英文无障碍提示。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-background-session-notification-cn.png | 可直接关闭或打开对应会话的 NextClaw 后台任务完成通知 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-background-session-notification-en.png | A dismissible NextClaw notification for a completed background task -->

- ad02654: 斜杠命令列表会根据操作显示不同图标，让“侧边对话”和“压缩上下文”更容易区分。
- e309470: 搜索设置新增 Exa 提供商：可配置 API Key 与自定义 Base URL，并使用统一的全局结果数量上限执行语义搜索和网页正文提取。感谢 [@suantea](https://github.com/suantea) 通过 [#23](https://github.com/Peiiii/nextclaw/pull/23) 贡献这项能力。
- 55c489f: 修复收件箱静态 HTML 中的外部链接无法打开的问题；链接现在会在阅读器外打开，脚本、远程资源和表单等隔离限制保持不变。
- f418af5: 修复 Agent 管理页暗色表面与创建草稿问题，并统一收件箱、Agent 管理、定时任务和技能市场的页面画布与标题区视觉规范。服务应用改用更紧凑的列表布局，连接操作直接可见，断开、删除、动作与诊断信息按需展开。
- 8e53d92: Native 会话会在同一次长任务的工具调用轮次之间自动压缩上下文；压缩输入、输出和最终 checkpoint 使用包含工具 schema 与输出预留的同一动态预算，压缩后除完整摘要外还会按 token 预算保留最近的真实用户原文。上下文指示器会按完整输入显示系统与工具、会话内容、自动压缩线和输出预留。Agent 配置会按当前指令与全量工具动态拒绝不可用的小窗口；send、继续运行和编辑重跑共享同一运行状态入口，进程中断统一恢复为可继续的中性终态。运行中压缩与 continuation 前压缩会稳定显示在对应助手过程位置，刷新后不再堆到消息末尾。
- bf3ff68: Panel App 在全局面板中刷新或重新挂载后会恢复到用户刚才阅读的滚动位置；异步加载内容时，会等页面布局就绪后再完成恢复。
- 071c144: 增加提供商模型目录获取与后台自动刷新：Kimi 现在也能在提供商设置中获取当前模型列表，并参与每 12 小时的目录刷新；未填写 API Key 或上游拒绝鉴权时会直接给出可操作的本地化提示，不再展示原始英文 401，后台目录失败也不再被其他 Provider 的刷新状态拖成持续加载。其他尚未确认支持模型目录的提供商继续支持手工配置。候选只保留文本输出的聊天 LLM，图像、视频、语音、Embedding、Rerank 与 Moderation 模型不会进入聊天配置。聊天模型选择器只在展开后提示上次已见基线之后真正新增的模型，并支持“本批不再提醒”；首次大目录不会制造数百条提醒。具体提供商页会自动提示对应差集，超过 50 个候选时隐藏“全部添加”、支持搜索并只渲染前 50 个匹配项；已配置模型也可进入批量删除模式后全选或删除所选。显式获取、自动刷新和批量操作都只修改当前草稿或目录快照，不会绕过用户保存。
- 3bca9fb: 优化 AI 收件箱的阅读层级：列表和正文现在通过轻量背景自然分区，筛选数量一目了然，明暗主题下的当前、未读与历史内容也更容易区分；紧凑的标题、摘要和操作区为 Markdown 与 HTML 正文留出更多空间。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-inbox-page-cn.png | 以紧凑列表和宽阔正文区域展示 AI 主动送达报告的 NextClaw 收件箱 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-inbox-page-en.png | The NextClaw inbox showing AI-delivered reports with a compact list and a spacious reading area -->

- 3485009: 让聊天输入草稿按会话独立保存，切换会话或刷新页面后仍可恢复；未创建的新会话使用自己唯一的固定草稿区。
- 08325d3: 新任务现在可以在发送首条消息前打开项目文件，并可随时切回默认工作目录；项目文件树与已打开文件页签共用统一操作菜单，可通过“更多操作”或右键添加到聊天，文件树的展开与滚动状态会在工作台切换后保留，首条消息创建正式会话时已打开的工作台也不会再关闭后闪回。文本型文件预览支持划选片段添加到聊天，引用会携带来源、位置、字符数量与选中快照，发送后可返回源文件，AI 也能准确读取该片段；输入框中的结构化引用支持复制、剪切和粘贴。文件、目录、项目、技能与文本片段在输入框和已发送消息中统一使用紧凑标签与语义图标。修复项目文件引用发送后丢失、AI 无法感知引用、引用后续正文被错误显示为链接，以及默认 workspace 会话中已发送文件引用点击无反应的问题。
- Updated dependencies [825f589]
- Updated dependencies [8049f49]
- Updated dependencies [ae21568]
- Updated dependencies [b7ca1e2]
- Updated dependencies [98c5b7f]
- Updated dependencies [ad02654]
- Updated dependencies [8e53d92]
- Updated dependencies [bf3ff68]
- Updated dependencies [071c144]
- Updated dependencies [08325d3]
  - @nextclaw/agent-chat-ui@0.6.21
  - @nextclaw/shared@0.4.19
  - @nextclaw/ncp-react@0.5.20
  - @nextclaw/client-sdk@0.5.22
  - @nextclaw/ncp-toolkit@0.6.18
  - @nextclaw/ncp@0.7.16
  - @nextclaw/ncp-http-agent-client@0.4.16

## 0.15.22

### Patch Changes

- dbececb: 修复并发消息完成时聊天记录偶发重叠的问题，并隐藏静默回复遗留的异常文本。
- 8b7a24c: 普通会话内容会在输入框上方柔和渐隐，同时保留末条内容的完整可读性，并与左侧会话列表使用一致的边缘过渡。
- c569770: Keep global completion notifications fully opaque when hovered.
- 43b0e1d: 让全新安装的 NextClaw 默认接入 OpenCode Zen 当前可调用的七个免费试用模型，无需填写 API Key 即可在模型选择器中直接选择并开始聊天；已有其他提供商配置保持不变，已失效的 Ling 免费模型会从 OpenCode 配置中移除，并明确提示公共网关的限额、模型变化与数据隐私边界。
- 9c6abce: 简化聊天侧边栏的视觉层级与间距，并修复切换到定时任务等非会话页面后仍保留会话选中态的问题。
- 9506f3b: 简化聊天欢迎页和输入工具栏，统一轻量 hover 与无边框聚焦反馈，改进技能和模型选择，并为图片附件、内嵌 token 与富文本选区提供更紧凑一致的交互。
- 14f321a: 会话列表中的思考、工具调用、运行失败与意外中断预览会跟随界面语言显示；已有会话中保存的英文活动预览也会按当前语言呈现。
- 9c453a1: 修复会话侧栏在时间与项目视图之间切换时控制区上下跳动的问题，并用文件夹加号明确“添加项目”操作。
- Updated dependencies [dbececb]
- Updated dependencies [9506f3b]
  - @nextclaw/shared@0.4.18
  - @nextclaw/ncp-toolkit@0.6.17
  - @nextclaw/agent-chat-ui@0.6.20
  - @nextclaw/client-sdk@0.5.21
  - @nextclaw/ncp-react@0.5.19

## 0.15.21

### Patch Changes

- 5b9dbcd: 新增 AI 主动送达收件箱：支持 Markdown 与隔离 HTML 报告、未读与归档管理、单窗阅读、文件快照送达，以及从送达内容继续创建上下文关联会话。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-ai-delivery-inbox-cn.png | AI 将项目晨报主动送达到 NextClaw 收件箱 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-ai-delivery-inbox-en.png | AI delivering a project brief to the NextClaw inbox -->
  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-ai-delivery-html-cn.png | 后台 Agent 生成的每日 AI 与科技简报在收件箱阅读窗中展示 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-ai-delivery-html-en.png | A daily AI and technology briefing created by a background Agent and displayed in the inbox reader -->
  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-inbox-page-cn.png | 在 NextClaw 收件箱集中查看和管理 AI 主动送达的报告 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-inbox-page-en.png | Viewing and managing AI-delivered reports in the NextClaw inbox -->

- 2368b56: 当其他会话的 AI 回复完成时，NextClaw 现在会在右上角显示可点击的通知，以清爽的纯文本摘要呈现结果，并直接带你回到对应会话。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-background-session-notification-cn.png | 后台会话完成后，NextClaw 在右上角显示可点击的结果通知 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-background-session-notification-en.png | NextClaw showing a clickable result notification after a background session completes -->

- Updated dependencies [5b9dbcd]
  - @nextclaw/shared@0.4.17
  - @nextclaw/client-sdk@0.5.20

## 0.15.20

### Patch Changes

- 15771a6: Remove a queued message from the composer queue as soon as stopping the current reply starts that message.
- 215a61f: 聊天输入框现在可以通过 `@` 选择已登记项目，并把项目名称、路径和目录概览作为本次消息的显式上下文。
- Updated dependencies
- Updated dependencies [d80eeb2]
- Updated dependencies [215a61f]
  - @nextclaw/agent-chat@0.3.13
  - @nextclaw/client-sdk@0.5.19
  - @nextclaw/ncp-http-agent-client@0.4.15
  - @nextclaw/ncp-react@0.5.18
  - @nextclaw/ncp-toolkit@0.6.16
  - @nextclaw/ncp@0.7.15
  - @nextclaw/shared@0.4.16
  - @nextclaw/agent-chat-ui@0.6.19

## 0.15.19

### Patch Changes

- 77208ed: Panel App 与 HTML 文件展示现在支持传入结构化参数；页面可在首次脚本执行时通过只读的 `window.nextclaw.params` 使用这些运行时数据。
- 8f93ce4: 修复 AI 回复期间追加消息会同时出现在会话记录和待发队列的问题；排队消息会在真正开始执行后进入会话记录，并且只显示一次。
- e85976d: 聊天中的 Mermaid 图表现在支持点击放大查看，并可通过关闭按钮、遮罩或 Escape 键退出全屏预览。
- Updated dependencies [c35189d]
- Updated dependencies
- Updated dependencies [77208ed]
- Updated dependencies [8f93ce4]
- Updated dependencies [e85976d]
  - @nextclaw/ncp@0.7.14
  - @nextclaw/agent-chat@0.3.12
  - @nextclaw/client-sdk@0.5.18
  - @nextclaw/ncp-http-agent-client@0.4.14
  - @nextclaw/ncp-toolkit@0.6.15
  - @nextclaw/shared@0.4.15
  - @nextclaw/agent-chat-ui@0.6.18
  - @nextclaw/ncp-react@0.5.17

## 0.15.18

### Patch Changes

- 2802f74: 手动压缩上下文时立即在当前会话时间线显示进行中反馈，并在请求完成或失败后正确清理。
- ccb9829: 修复发送消息后偶尔需要刷新页面才会显示的问题；消息会立即出现在当前会话中，实时连接中断后也会自动补回遗漏内容。
- cf539fe: 修复新任务切换 Agent Runtime 后仍沿用其他 Runtime 模型的问题。现在会优先恢复用户最近为该 Runtime 选择的模型；没有历史选择时，再使用该 Runtime 的推荐模型或全局默认模型。
- Updated dependencies [ccb9829]
  - @nextclaw/ncp-react@0.5.16

## 0.15.17

### Patch Changes

- d924f27: 修复流式消息动态增高时重新夺回滚动位置的问题；向上滚动超过 10px 后会持续保持逃逸状态。
- af2b22b: 在移动端底部导航增加“应用”入口，可以直接浏览并打开面板应用。
- Updated dependencies
  - @nextclaw/agent-chat@0.3.11
  - @nextclaw/agent-chat-ui@0.6.17
  - @nextclaw/client-sdk@0.5.17
  - @nextclaw/ncp@0.7.13
  - @nextclaw/ncp-http-agent-client@0.4.13
  - @nextclaw/ncp-react@0.5.15
  - @nextclaw/ncp-toolkit@0.6.14
  - @nextclaw/shared@0.4.14

## 0.15.16

### Patch Changes

- 6b84324: Remote access now keeps disconnect and recovery diagnostics, correlates local and relay connection events, detects heartbeat loss, and automatically retries temporary connector-offline pages.
- Updated dependencies
  - @nextclaw/agent-chat@0.3.10
  - @nextclaw/agent-chat-ui@0.6.16
  - @nextclaw/client-sdk@0.5.16
  - @nextclaw/ncp@0.7.12
  - @nextclaw/ncp-http-agent-client@0.4.12
  - @nextclaw/ncp-react@0.5.14
  - @nextclaw/ncp-toolkit@0.6.13
  - @nextclaw/shared@0.4.13

## 0.15.15

### Patch Changes

- 80eda82: 聊天消息现在会显式保存技能的名称、来源与文件路径；点击技能可直接打开对应 `SKILL.md` 预览，旧消息无法解析时也会显示明确错误。
- e9d49c0: 会话正在回复时继续发送的消息现在由后端按会话排队，并会在当前回复完成后按顺序执行；切换会话或刷新页面后仍能查看、编辑和删除对应会话的待发消息。
- 9b9ebfa: 长会话向上滚动时，Mermaid 等异步内容和历史分页不再导致当前阅读位置跳动。
- Updated dependencies
- Updated dependencies [80eda82]
- Updated dependencies [e9d49c0]
  - @nextclaw/agent-chat@0.3.9
  - @nextclaw/ncp@0.7.11
  - @nextclaw/ncp-http-agent-client@0.4.11
  - @nextclaw/ncp-toolkit@0.6.12
  - @nextclaw/agent-chat-ui@0.6.15
  - @nextclaw/shared@0.4.12
  - @nextclaw/client-sdk@0.5.15
  - @nextclaw/ncp-react@0.5.13

## 0.15.14

### Patch Changes

- 1ea89b9: 修复流式回复期间主动向上滚动后仍会被拉回底部的问题；距离底部超过 10px 后会稳定退出自动贴底。
- Updated dependencies
- Updated dependencies [1ea89b9]
  - @nextclaw/agent-chat@0.3.8
  - @nextclaw/client-sdk@0.5.14
  - @nextclaw/ncp@0.7.10
  - @nextclaw/ncp-http-agent-client@0.4.10
  - @nextclaw/ncp-react@0.5.12
  - @nextclaw/ncp-toolkit@0.6.11
  - @nextclaw/shared@0.4.11
  - @nextclaw/agent-chat-ui@0.6.14

## 0.15.13

### Patch Changes

- a7b66d2: Add a clear project-list entry for either creating a new project or adding an existing directory without modifying its contents.
- 36c5362: 新增会话级手动上下文压缩命令，统一通过 Kernel runtime capability 调用 Native 压缩链路或 Codex `thread/compact/start`，并为不支持、会话忙碌和无可压缩历史提供明确反馈。
- 1bfb5f3: 收紧聊天侧边栏项目列表的行高与项目间距，让项目视图更紧凑。
- 6a6fc32: 为会话工作台文件预览补充友好的本地化错误提示，文件不存在时不再直接展示服务端诊断信息。
- d116010: 允许 `show_panel_app` 通过可选绝对路径打开标准 Panels 目录之外的 Panel App，并让侧栏与聊天内联展示复用同一份路径合同和资源加载链路。
- Updated dependencies [a7b66d2]
- Updated dependencies [36c5362]
- Updated dependencies
- Updated dependencies [d116010]
  - @nextclaw/client-sdk@0.5.13
  - @nextclaw/ncp@0.7.9
  - @nextclaw/agent-chat@0.3.7
  - @nextclaw/ncp-http-agent-client@0.4.9
  - @nextclaw/ncp-react@0.5.11
  - @nextclaw/ncp-toolkit@0.6.10
  - @nextclaw/shared@0.4.10
  - @nextclaw/agent-chat-ui@0.6.13

## 0.15.12

### Patch Changes

- c8974bd: 移动端聊天输入面板会在空间足够时保持工具栏控件单行排列，减少不必要的面板高度。
- dabc87a: 定时任务模板现在会根据可用内容宽度自动调整列数，在窄窗口和移动端保持完整可读。
- 0b88f68: AI 回复拿不到 token 用量时，消息页脚不再显示不可用占位；完整状态仍可在运行元数据中查看。运行元数据弹窗统一复用 shadcn 风格的聊天 Dialog，并修正打开与关闭时的跳位动画。
- Updated dependencies
- Updated dependencies [c8974bd]
- Updated dependencies [0b88f68]
  - @nextclaw/agent-chat@0.3.6
  - @nextclaw/client-sdk@0.5.12
  - @nextclaw/ncp@0.7.8
  - @nextclaw/ncp-http-agent-client@0.4.8
  - @nextclaw/ncp-react@0.5.10
  - @nextclaw/ncp-toolkit@0.6.9
  - @nextclaw/shared@0.4.9
  - @nextclaw/agent-chat-ui@0.6.12

## 0.15.11

### Patch Changes

- 61f6bd1: 长会话现在会按需加载较早消息，并使用动态高度虚拟列表保持流畅滚动。HTML、Panel App 与折叠内容展开或收起时会自动校准高度，向上翻页时继续保持当前阅读位置。
- dad7880: Show the official OpenCode runtime icon and align Native runtime fallback styling across session selectors.
- c727720: 内联 Panel App 现在与 HTML 预览使用同一套简约表面：移除常驻标题、边框与阴影，操作仅在悬浮或键盘聚焦时出现，并根据内容高度自适应展示；可见区域最多占视口高度的 90%，硬上限提高到 1440px。
- be2a018: Keep chat model search and other shared chat fields visually unchanged when focused.
- 25515df: 会话工作台固定展示“子会话”“定时任务”“项目文件”三个导航标签页，不再提供关闭入口，并统一使用简洁名称。
- f68d2df: 定时任务页面现在提供自然语言会话入口、任务模板、运行概况、服务端搜索筛选分页和按需详情；创建请求会带入新的 AI 会话继续确认，任务列表也能区分绑定会话与独立会话。
- 7f128da: 移动端打开具体会话后，现在可以直接从顶部新建任务，无需先返回会话列表；新任务会沿用已选择的会话类型。
- c985dfd: 移动端新任务菜单现在会完整显示每种会话类型，不再重复显示已选类型或遗漏 Native。
- 70080bf: Keep model option panels open when users click an already-focused model input.
- 165f1cb: 修复包含内联 HTML 的混合回复在完成后只剩 HTML 预览的问题；正文、图片、Panel App、Mermaid 与表格现在都会按原始消息继续显示。
- ddc3213: 为每条 AI 回复记录实际运行模型与 token 用量，在消息底部使用统一的 `k`、`m`、`b` 单位展示输入和输出统计，并可通过更多操作查看缓存、总量、调用次数和完整运行元数据。
- 79dd1ed: Show each chat session's Agent runtime identity in assistant message avatars, align sidebar runtime icons with session titles, and refine runtime selector icon and tooltip behavior.
- 3c9615e: Make settings more compact and consistent with one shared page canvas, low-border groups, adaptive list-detail layouts, clearer advanced-navigation ordering and sign-in management wording, preferences consolidated under Appearance, reusable navigation links, and complete Chinese labels.
- Updated dependencies [61f6bd1]
- Updated dependencies [c727720]
- Updated dependencies
- Updated dependencies [be2a018]
- Updated dependencies [f68d2df]
- Updated dependencies [165f1cb]
- Updated dependencies [ddc3213]
- Updated dependencies [79dd1ed]
  - @nextclaw/ncp@0.7.7
  - @nextclaw/ncp-toolkit@0.6.8
  - @nextclaw/ncp-react@0.5.9
  - @nextclaw/client-sdk@0.5.11
  - @nextclaw/shared@0.4.8
  - @nextclaw/agent-chat@0.3.5
  - @nextclaw/ncp-http-agent-client@0.4.7
  - @nextclaw/agent-chat-ui@0.6.11

## 0.15.10

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui

- Updated dependencies
  - @nextclaw/agent-chat@0.3.4
  - @nextclaw/agent-chat-ui@0.6.10
  - @nextclaw/client-sdk@0.5.10
  - @nextclaw/ncp@0.7.6
  - @nextclaw/ncp-http-agent-client@0.4.6
  - @nextclaw/ncp-react@0.5.8
  - @nextclaw/ncp-toolkit@0.6.7
  - @nextclaw/shared@0.4.7

## 0.15.9

### Patch Changes

- 0111b09: 让桌面端与 NPM 安装态在持续运行期间固定每两小时自动检查更新，不再提供关闭自动检查或启用自动下载的配置；发现新版本后只提示用户，由用户明确点击后才下载和应用。更新通道切换会等待旧检查收口后检查新通道，避免复用过期结果。同步增强本地更新验证，使开发者无需等待真实发版或重启即可验证自动发现、手动下载、应用和版本切换。
- Updated dependencies
- Updated dependencies [0111b09]
  - @nextclaw/agent-chat@0.3.3
  - @nextclaw/agent-chat-ui@0.6.9
  - @nextclaw/ncp@0.7.5
  - @nextclaw/ncp-http-agent-client@0.4.5
  - @nextclaw/ncp-react@0.5.7
  - @nextclaw/ncp-toolkit@0.6.6
  - @nextclaw/client-sdk@0.5.9
  - @nextclaw/shared@0.4.6

## 0.15.8

### Patch Changes

- cffeb5e: 修复在聊天引用菜单中返回后再次进入“文件与文件夹”时，默认高亮错误恢复到之前某一行的问题；现在每次进入该视图都会从第一行开始。
- e2c303a: 修复聊天引用菜单中文件与文件夹面板在切换目录或搜索结果时的高度跳动，并用更明确的操作文案提示引用当前文件夹。
- b815813: Keep the header compact while still exposing release notes: the current version keeps its version-label link, and available-update notes move into the download or update control's hover and keyboard-focus surface.
- a9b125f: 增强可视化结果生成指引：Agent 会在结果适合展示时主动选择 Markdown、图表、图片或内联 HTML；内联页面保持单一焦点、自然高度和无嵌套外卡，完成后只保留可视结果，不再重复显示前后的文字复述。
- 8f7e915: 修复运行时更新应用后的后续检查可能把“新版本已运行但验证失败”笼统显示为更新失败的问题；页面会区分检查、下载和应用失败，展示完整错误原因，并给出查看完整日志的命令。
- Updated dependencies [cffeb5e]
- Updated dependencies [e2c303a]
- Updated dependencies [a9b125f]
- Updated dependencies [8f7e915]
  - @nextclaw/agent-chat-ui@0.6.8
  - @nextclaw/shared@0.4.5
  - @nextclaw/client-sdk@0.5.8

## 0.15.7

### Patch Changes

- e2c303a: 聊天中的文件与文件夹引用现在支持逐层进入目录和项目全范围搜索；发送后的文件、目录、技能与面板应用标签统一为紧凑链接样式，并可查看提示或点击打开对应内容。
- ed86214: 修复桌面端只在应用启动后检查更新的问题：应用运行期间会定期判断是否需要检查，并在窗口重新获得焦点或系统恢复后补查；关闭自动检查时仍不会发起后台请求。
- a9b125f: 聊天中的 HTML 预览不再显示文件名和卡片边框，使用与图片一致的轻微圆角，根据页面内容自动调整高度，并仅在悬停时于预览外部正上方居中提供侧栏预览与源码入口。
- 576f9bc: 优化聊天中的 Mermaid 图表体验：打开历史会话时不再先闪现源代码，以紧凑加载状态等待首图；流式回复会在生成过程中逐步呈现有效图形，并在更新期间保持上一帧稳定；完成后的图表以无边框画布自然融入正文。
- 4052d16: 修复窄屏布局从会话列表进入已有会话时，历史消息偶尔显示为空的问题；会话详情标题现在也可以直接下拉搜索和切换会话。
- 897211a: 新增实验性 UI 注入口：高阶用户和社区工具可以在 NextClaw 数据目录放置 `ui-inject.js`，刷新桌面端或浏览器页面后直接执行自定义界面脚本；删除文件并刷新即可恢复。Skill Marketplace 同步改进最近更新排序、目录刷新、总数表达和历史条目兼容，避免无限滚动末页因旧安装类型导致整页失败。该注入口不提供安全性、DOM 稳定性或跨版本兼容保证。
- Updated dependencies [e2c303a]
- Updated dependencies [576f9bc]
- Updated dependencies [4052d16]
  - @nextclaw/agent-chat-ui@0.6.7
  - @nextclaw/ncp-react@0.5.6
  - @nextclaw/client-sdk@0.5.7

## 0.15.6

### Patch Changes

- 36b3702: 修复中文输入法取消拼音或按数字选择候选词后，字符异常恢复、光标跳到输入框开头的问题。
- 2eceb16: 聊天输入框现在支持通过 `@` 搜索并引用当前项目中的文件或目录：可从统一引用菜单进入文件浏览、查看路径层级并插入引用标签，发送时由 NextClaw 在项目边界内安全、限量地补充对应文件内容或目录结构上下文。
- b815813: Make the header expose release notes for both the currently running NextClaw version and the available update target when docs notes are available.
- 9ae8d96: 统一聊天 Markdown 的内容块间距：标题、表格、代码块、引用、列表与分隔线现在遵循一致的垂直节奏，章节标题也会更清晰地归属于后续内容。
- 25f8bb0: 修复聊天中的会话模型恢复、重试错误提示、技能选择和折叠会话列表交互，并为 `/`、`@` 选择项补充类型图标。
- 59a4723: 新增独立项目注册表与项目模板：项目可以在没有会话时通过界面、CLI 或 AI 创建并展示；界面提供支持导航、搜索和新建文件夹的跨平台服务端目录选择器，并按 macOS、Windows 与 Linux 展示实际可用的常用位置；CLI 与 AI 还可列出项目、修改会话名称及项目目录。
- 8be3173: Allow provider model entries and runtime routing to preserve nested IDs such as `bedrock/claude-fable-5`, including OpenRouter-style vendor/model routes.
- Updated dependencies [36b3702]
- Updated dependencies [2eceb16]
- Updated dependencies [611e7aa]
- Updated dependencies [25f8bb0]
- Updated dependencies [59a4723]
  - @nextclaw/agent-chat-ui@0.6.6
  - @nextclaw/client-sdk@0.5.6
  - @nextclaw/shared@0.4.4
  - @nextclaw/ncp@0.7.4
  - @nextclaw/ncp-toolkit@0.6.5
  - @nextclaw/ncp-react@0.5.5
  - @nextclaw/ncp-http-agent-client@0.4.4

## 0.15.5

### Patch Changes

- 378c8b9: 优化 Agent 最终回复的展示组织，统一 Markdown、内联展示与侧栏展示提示；聊天消息现在支持稳定的流式 Mermaid 图表，并允许复制用户消息。
- c435b16: 修复流式输出期间输入框后台同步覆盖页面选区、聚焦输入框连续删除时光标跳到斜杠前、历史 Markdown 因动态 renderer 变化重新挂载，以及内联 Panel App 被动态工具分组重新挂载的问题，并移除弹层对输入框焦点的旧兜底特判。
- e715b8d: 会话工作台现在允许关闭概览之外的页面、子会话、草稿和文件标签页；关闭当前标签页时会回到最近可用页面，并可从概览重新打开。
- c01ca0a: 修复 Markdown `file:` 链接的渲染与行列定位：文件保持真实行号，大文件会读取目标行附近的内容，并在源码预览中滚动到目标位置；同时让 `nextclaw-inline` 文件目标在消息中复用现有工作台预览能力展示 HTML、Markdown、代码、图片、媒体、PDF 与 Office 文件。
- 401854e: 聊天框斜杠选择器、底部技能选择器和 Agent 上下文现在会区分项目、NextClaw、全局与内建技能来源；项目技能从项目 `.agents/skills` 加载，项目 `AGENTS.md` 也会随会话上下文生效。
- e7c6d56: 修复版本号旁更新异常图标缺少可见说明的问题：鼠标悬停或键盘聚焦感叹号时，现在会展示完整原因、诊断信息和恢复命令。
- Updated dependencies [378c8b9]
- Updated dependencies [c435b16]
- Updated dependencies [c01ca0a]
- Updated dependencies [401854e]
  - @nextclaw/agent-chat-ui@0.6.5
  - @nextclaw/client-sdk@0.5.5

## 0.15.4

### Patch Changes

- 7f7eed8: Move chat input send errors into a full-width status row above the input toolbar, with localized details text in the app.
- 91f7bef: Keep valid Markdown resources clickable independently of target availability, render local Markdown images and SVG files correctly, add responsive Word, Excel, and PowerPoint workspace previews, preserve automatic viewers outside HTML source mode, and keep chat popovers open when the streaming composer restores focus.
- 2afdba2: 新增可持久化的卡片式与平铺式消息布局切换，并默认使用平铺式；已保存的布局选择继续保留。同步优化平铺会话和输入面板的阅读宽度，统一约束消息图片尺寸、间距、圆角、Markdown 与连续附件的三列排列和放大预览，同时增强正文与过程提示的灰阶层级并修正 Markdown 标题节奏。
- 13dbd99: 新增可从会话 Header 展开和收起的右侧工作台，统一查看子会话、会话定时任务与项目文件树，并分别持久化会话工作台和全局右侧面板的宽度；同时让会话列表的置顶和编辑操作仅在 hover 或操作获得焦点时展示。
- 7853b3b: 修复重新进入会话后流式文件工具展示不完整、手动展开的工具过程会在完成时自动收起的问题；同时为工具汇总与思考补充图标，让单个工具也保留工作流连线，并允许在结构化预览尚未形成时展开查看已接收的参数。
- 8152b63: 会话工作台的项目文件树、文件 Tab 和面包屑现在会按文件类型展示统一的 VS Code 风格图标，常见代码、配置、文档、图片、音视频与 Office 文件更容易快速辨认。
- 8152b63: 会话工作台现在统一支持图片、音频、视频和 Office 文档预览状态，并为 Markdown、HTML 提供独立的源码与预览 Tab；打开的文件视图和当前选中项会在刷新后准确恢复。
- Updated dependencies [7f7eed8]
- Updated dependencies [91f7bef]
- Updated dependencies [2afdba2]
- Updated dependencies [a43cffd]
- Updated dependencies [7853b3b]
  - @nextclaw/agent-chat-ui@0.6.4
  - @nextclaw/ncp-toolkit@0.6.4
  - @nextclaw/client-sdk@0.5.4
  - @nextclaw/ncp-react@0.5.4

## 0.15.3

### Patch Changes

- 404acd9: Open chat file attachments in the workspace sidebar preview, add a fullscreen lightbox for message images, simplify image chrome, and lighten global keyboard focus rings.
- b727239: Refine chat process presentation with compact, aligned reasoning and tool rows; localized state-aware labels for built-in tools; reasoning character counts; workflow grouping across intervening reasoning; distinct file and directory activity counts; clearer terminal and file previews; edit line statistics; and clickable skill references.
- cb7e089: Restore marketplace skill detail documents after a browser refresh instead of leaving the detail tab unavailable.
- cb7e089: Polish cron cards, marketplace search, document browser controls, and shared form fields with more consistent theme-aware surfaces and focus styling.
- Updated dependencies
- Updated dependencies [404acd9]
- Updated dependencies [b727239]
  - @nextclaw/agent-chat@0.3.2
  - @nextclaw/client-sdk@0.5.3
  - @nextclaw/ncp@0.7.3
  - @nextclaw/ncp-http-agent-client@0.4.3
  - @nextclaw/ncp-react@0.5.3
  - @nextclaw/ncp-toolkit@0.6.3
  - @nextclaw/shared@0.4.3
  - @nextclaw/agent-chat-ui@0.6.3

## 0.15.2

### Patch Changes

- 7aeae7a: Move model and thinking controls beside the context window and send action, with a compact content-sized model trigger instead of a stretched fixed-width control.
- 9b172b8: Keep the chat settings menu open when streaming output restores focus to the composer, while preserving normal outside-click dismissal.
- 7aeae7a: 支持置顶会话和项目，并将项目列表改为可展开的文件夹行；原生会话不再在对话标题中显示运行时标签。
- b8250d1: Keep the chat sidebar search box focusable when users click the search icon area.
- ad85a7a: Polish the chat surface: remove the decorative bot icon above the new-session welcome title, drop the chat sidebar right border so background color alone separates the rail from the canvas, and unify input-bar toolbar labels with the skill control's muted text weight.
- 44e1a4b: Keep keyboard input inside focused Panel App iframes so interactive apps such as piano panels can respond to key presses instead of the chat composer.
- e24a333: Route Chinese and mainland-timezone documentation links to the domestic docs mirror, with environment overrides for global fallback.
- ced8f04: 设置侧边栏现在按“基础配置”和“高级配置”分组展示，模型、提供商和渠道保持在基础配置中。
- bae3516: Add the Default theme with a white workspace, soft gray navigation surfaces, monochrome navigation controls, light gray user messages, blue assistant links, theme-owned marketplace surfaces, and consistent compact user message bubbles. It is listed first and used when no saved theme preference exists.
- 3fdb755: Support browsing directory paths in the chat workspace preview panel, including relative directory paths resolved against the session working directory.
- 771a296: Add a refresh action to workspace file previews so users can reload updated file contents from the right-side workspace panel.
- 0c714ca: Add a container-scoped maximize control for the chat workspace panel so users can expand it across the current conversation area and restore it without covering global side panels.
- Updated dependencies
- Updated dependencies [7aeae7a]
- Updated dependencies [ad85a7a]
- Updated dependencies [94c5ab6]
- Updated dependencies [bae3516]
- Updated dependencies [3fdb755]
  - @nextclaw/agent-chat@0.3.1
  - @nextclaw/ncp@0.7.2
  - @nextclaw/ncp-http-agent-client@0.4.2
  - @nextclaw/ncp-react@0.5.2
  - @nextclaw/shared@0.4.2
  - @nextclaw/agent-chat-ui@0.6.2
  - @nextclaw/ncp-toolkit@0.6.2
  - @nextclaw/client-sdk@0.5.2

## 0.15.1

### Patch Changes

- 7e94f21: Separate Agent details from editing in the Agent management UI, show per-Agent configuration facts in a read-only details dialog, and limit editable advanced Agent configuration to the context window override.
- 2c9cf0a: Add a searchable collapsed-sidebar chat header session switcher so users can jump between recent sessions without reopening the left sidebar.
- e6a3443: Keep local HTML file links on source preview by default, and open rendered HTML only when show_file or the link viewer query explicitly requests it.
- a006bb7: Treat user-cancelled chat runs as cancelled session activity instead of failed errors, and keep cancelled runs out of the conversation error surface.
- a6c3c4d: Show structured release notes in the update screen before users download or apply a new version.
- Updated dependencies [1cc5d4e]
- Updated dependencies [e6a3443]
  - @nextclaw/ncp@0.7.1
  - @nextclaw/ncp-react@0.5.1
  - @nextclaw/agent-chat-ui@0.6.1
  - @nextclaw/client-sdk@0.5.1
  - @nextclaw/ncp-http-agent-client@0.4.1
  - @nextclaw/ncp-toolkit@0.6.1
  - @nextclaw/shared@0.4.1

## 0.15.0

### Minor Changes

- Publish the full public NextClaw workspace as a stable minor release.

### Patch Changes

- 3cf5890: Fix chat attachments being dropped after upload or paste, and stop sending a default image detail value that some OpenAI-compatible providers reject.
- 9df29a4: Collapse completed assistant reasoning and tool-process content behind a processed summary while keeping the final answer visible.
- bf1917a: Add inert `nextclaw-inline` Markdown code blocks for inline display declarations, keep model-visible show-content tools side-panel only without a `placement` parameter, and render inline Panel App declarations without a side-panel expand action.
- b2032cf: Add chat input queuing while an agent run is active, with editable queued drafts that send in order after the current run completes.
- ad67894: Add a floating scroll-to-bottom action in chat conversations when the message list is away from the latest message.
- fd95ade: Show failed session previews inside the chat detail view near the composer so conversation-level errors are visible beyond the session list.
- 854f3db: Expand compact workspace/browser tab hit areas so clicking the full visible tab selects it while close buttons remain isolated.
- 2e15783: Auto-collapse the left sidebar on narrower desktop layouts when docked DocBrowser and the chat workspace right panel are both opened, keeping the central chat workspace usable without turning the behavior into a continuous layout state calculation.
- d9b60a7: Improve floating DocBrowser interactions: drag from the header, resize from all four corners, use a semantic float icon, and keep tooltips, popovers, and dialogs above floating panels.
- 191c011: Serve rendered local HTML previews through unrestricted iframe URLs so scripts and relative assets can run closer to normal browser behavior.
- 2d9d1b7: Fix Markdown absolute file links so local file anchors keep clean DOM output and continue opening through the chat workspace file preview action.
- 33a931f: Add standard NCP event timing and message lifecycle fields so completed assistant process summaries can show real elapsed time derived from started and ended timestamps.
  Stamp first-party runtime, transport, and extension-produced NCP events at their producer boundary instead of estimating duration in UI or journal consumers.
  Make Codex app-server aborts emit the standard NCP abort event promptly so the conversation leaves the running state without waiting for another app-server notification.
- fee6faa: Add a Night theme with dark appearance persistence and improve dark-mode readability for Markdown, status surfaces, error notices, switches, composer file tokens, native right-side marketplace detail views, and the session metadata dialog.
- 7bcc180: Split the model-facing `show_content` display tool into `show_file`, `show_url`, and `show_panel_app` so required display parameters are explicit JSON Schema properties instead of nested description-only payload fields.
- 854f3db: Allow source and rendered previews for the same file to stay open as separate chat workspace tabs.
- 2d9d1b7: Add a rendered file-preview viewer for `show_content` so agents can open local HTML/page prototypes in the chat workspace side panel.
- 7bcc180: Open `show_url` targets as browser-like content tabs with address, refresh, external-open controls, and local development server guidance.
- be1759e: Add bottom SideDock utilities for opening the NextClaw GitHub project, hiding the dock with confirmation, and restoring it from Appearance settings.
- c6ca436: Align left sidebar hover and selected-state feedback across navigation, utility, and session-adjacent rows so scheduled tasks, skills, agent management, and session list items share the same understated gray interaction treatment. The fixed sidebar footer now drops the divider line and uses a subtle scroll-edge fade above the bottom controls to make the list-to-footer handoff feel lighter.
- 2d8a871: Add Slash menu category filters with counts and let Slash panel app actions open panel apps in the right sidebar without inserting input tokens.
- 9338c97: Make workspace file preview breadcrumbs clickable so users can browse nearby folders and open files directly from the breadcrumb menu.
- eb0d40a: Highlight code syntax in workspace file previews by reusing the existing chat code highlighter and server language hints.
- Updated dependencies [9df29a4]
- Updated dependencies [bf1917a]
- Updated dependencies [b2032cf]
- Updated dependencies [ad67894]
- Updated dependencies
- Updated dependencies [2d9d1b7]
- Updated dependencies [61e7a7a]
- Updated dependencies [33a931f]
- Updated dependencies [fee6faa]
- Updated dependencies [2d9d1b7]
- Updated dependencies [2d8a871]
- Updated dependencies [7a77c87]
- Updated dependencies [eb0d40a]
  - @nextclaw/agent-chat-ui@0.6.0
  - @nextclaw/agent-chat@0.3.0
  - @nextclaw/client-sdk@0.5.0
  - @nextclaw/ncp@0.7.0
  - @nextclaw/ncp-http-agent-client@0.4.0
  - @nextclaw/ncp-react@0.5.0
  - @nextclaw/ncp-toolkit@0.6.0
  - @nextclaw/shared@0.4.0

## 0.14.4

### Patch Changes

- 944c27b: Full public stable release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies [944c27b]
  - @nextclaw/agent-chat@0.2.16
  - @nextclaw/agent-chat-ui@0.5.4
  - @nextclaw/client-sdk@0.4.7
  - @nextclaw/ncp@0.6.6
  - @nextclaw/ncp-http-agent-client@0.3.48
  - @nextclaw/ncp-react@0.4.56
  - @nextclaw/ncp-toolkit@0.5.41
  - @nextclaw/shared@0.3.3

## 0.14.4-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.2.16-beta.0
  - @nextclaw/agent-chat-ui@0.5.4-beta.0
  - @nextclaw/client-sdk@0.4.7-beta.0
  - @nextclaw/ncp@0.6.6-beta.0
  - @nextclaw/ncp-http-agent-client@0.3.48-beta.0
  - @nextclaw/ncp-react@0.4.56-beta.0
  - @nextclaw/ncp-toolkit@0.5.41-beta.0
  - @nextclaw/shared@0.3.3-beta.0

## 0.14.3

### Patch Changes

- 786bfb5: Fix chat composer stability while assistant messages are streaming, including IME input and caret preservation during stale parent rerenders.
- 37a1748: Add the natural default theme, keep a minimal black-and-white theme option, and align chat, tool, provider, DocBrowser, and side dock surfaces with shared theme tokens.
- 901f770: Fix default workspace handling so Docker sessions no longer treat the default workspace symbol as a project override, and hide that default symbol from recent project choices.
- Updated dependencies [786bfb5]
- Updated dependencies [37a1748]
  - @nextclaw/agent-chat-ui@0.5.3
  - @nextclaw/client-sdk@0.4.6

## 0.14.2

### Patch Changes

- dd6c939: Show the current instance identifier in the browser tab title, using the port-only label for local loopback URLs.
- f867220: Fix the chat conversation header so parent sessions with existing child sessions show the child-session entry automatically, even before a child session has been opened from a tool card.
- 3e3e9bf: Add a generic chat input surface plugin flow and Panel App references from the composer. Slash skill selection now uses the shared input surface path, `@` can insert Panel App references, and sent `@panel-app:<appId>` text renders as a distinct Panel App inline token.
- ec39c49: Fix chat workspace file previews so project-relative Markdown links use the selected session working directory as their base path.
- 993fbb8: Add opt-in parent context inheritance for child sessions spawned through `sessions_spawn`. Child sessions can now inherit parent messages up to the spawn anchor, and the chat timeline marks inherited context at the start of the message list.
- 7f20731: Fix workspace child-session tabs so clicking the tab icon selects the tab, and compact the child-session panel header by removing the duplicated title from the content area.
- 80ef499: Fix input surface session ownership so slash search, panel app references, Chinese IME input, Escape dismissal, deletion, pointer selection, default focus, and flipped input panels stay responsive after input panel pluginization.
- 89899a7: Render chat inline tokens through markdown-aware parsing so Panel App references and skill tokens inside code remain literal.
- 1311916: Refactor the chat conversation area into a reusable self-contained surface. Root chat and workspace child sessions now share the same conversation input/send flow, child sessions can continue from the right panel, and the app presenter context stays stable across local hot reloads.
- 6586a69: Add a Side chat slash command before skill entries in the slash panel. The command opens a right-side draft child conversation, keeps backend session creation deferred until the first send, and materializes that first send into an inherited child session.
- de59b83: Add a persisted collapsible left sidebar with a compact rail presentation. The collapsed rail now uses the shared viewport layout store, keeps a minimal borderless visual style, and applies consistent sizing, spacing, tooltip, desktop chrome, and navigation behavior across chat, settings, scheduled tasks, skills, and agent entry points.
- Updated dependencies
- Updated dependencies [3e3e9bf]
- Updated dependencies [80ef499]
- Updated dependencies [89899a7]
- Updated dependencies [6586a69]
  - @nextclaw/agent-chat@0.2.15
  - @nextclaw/client-sdk@0.4.5
  - @nextclaw/ncp@0.6.5
  - @nextclaw/ncp-http-agent-client@0.3.47
  - @nextclaw/ncp-react@0.4.55
  - @nextclaw/ncp-toolkit@0.5.40
  - @nextclaw/agent-chat-ui@0.5.2
  - @nextclaw/shared@0.3.2

## 0.14.1

### Patch Changes

- a2f4451: Update the built-in main agent fallback avatar to use the NextClaw brand primary background with a primary foreground icon.
- afab873: Fix the chat context window indicator so it resets on session switches and appears whenever the active thread has context window metadata.
- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- e812753: Improve the chat sidebar new-session control so the session type switcher stores the next-session type preference, shows the current runtime icon with a dropdown affordance, and keeps the create action separate from type selection.
- 5cadd07: Fix chat model preference resolution so new draft sessions remember the recent model per runtime while historical sessions keep their own bound model selection.
- dd91bfb: Upgrade the new chat welcome entry with a centered composer, project history picker, visible agent selector, and session type selector while reusing the existing chat input flow.
- 595cc16: Add inline placement for `show_content` panel app results so chat messages can render lightweight embedded Panel App cards while keeping the existing side-panel expansion path.
- 4602651: Add first-use guidance to the Panel Apps empty state, including a sample prompt action that opens chat and drafts a starter panel app request.
- 5117e15: Clarify that inline Panel Apps are a card-specific delivery form, add landscape-first card experience guidance for built-in app creation prompts, and render inline Panel Apps as pure bounded chat cards with a side-panel expand affordance.
- d82790a: Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
- df32fb2: Make Skill Marketplace cards denser and easier to scan with a three-column desktop layout, bottom-aligned tags, filtered redundant skill tags, and hover-revealed card actions.
- Updated dependencies [f8dfffa]
- Updated dependencies [7067713]
- Updated dependencies
- Updated dependencies [6bb305f]
- Updated dependencies [dd91bfb]
- Updated dependencies [595cc16]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
  - @nextclaw/agent-chat@0.2.14
  - @nextclaw/client-sdk@0.4.4
  - @nextclaw/ncp-http-agent-client@0.3.46
  - @nextclaw/ncp-react@0.4.54
  - @nextclaw/ncp@0.6.4
  - @nextclaw/ncp-toolkit@0.5.39
  - @nextclaw/shared@0.3.1
  - @nextclaw/agent-chat-ui@0.5.1

## 0.14.1-beta.1

### Patch Changes

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- dd91bfb: Upgrade the new chat welcome entry with a centered composer, project history picker, visible agent selector, and session type selector while reusing the existing chat input flow.
- Updated dependencies
- Updated dependencies [6bb305f]
- Updated dependencies [dd91bfb]
  - @nextclaw/agent-chat@0.2.14-beta.1
  - @nextclaw/client-sdk@0.4.4-beta.1
  - @nextclaw/ncp@0.6.4-beta.1
  - @nextclaw/ncp-http-agent-client@0.3.46-beta.1
  - @nextclaw/ncp-react@0.4.54-beta.1
  - @nextclaw/ncp-toolkit@0.5.39-beta.1
  - @nextclaw/shared@0.3.1-beta.1
  - @nextclaw/agent-chat-ui@0.5.1-beta.1

## 0.14.1-beta.0

### Patch Changes

- afab873: Fix the chat context window indicator so it resets on session switches and appears whenever the active thread has context window metadata.
- 5cadd07: Fix chat model preference resolution so new draft sessions remember the recent model per runtime while historical sessions keep their own bound model selection.
- 595cc16: Add inline placement for `show_content` panel app results so chat messages can render lightweight embedded Panel App cards while keeping the existing side-panel expansion path.
- 4602651: Add first-use guidance to the Panel Apps empty state, including a sample prompt action that opens chat and drafts a starter panel app request.
- 5117e15: Clarify that inline Panel Apps are a card-specific delivery form, add landscape-first card experience guidance for built-in app creation prompts, and render inline Panel Apps as pure bounded chat cards with a side-panel expand affordance.
- d82790a: Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
- Updated dependencies
- Updated dependencies [595cc16]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
  - @nextclaw/agent-chat@0.2.14-beta.0
  - @nextclaw/client-sdk@0.4.4-beta.0
  - @nextclaw/ncp-http-agent-client@0.3.46-beta.0
  - @nextclaw/ncp-react@0.4.54-beta.0
  - @nextclaw/agent-chat-ui@0.5.1-beta.0
  - @nextclaw/shared@0.3.1-beta.0
  - @nextclaw/ncp@0.6.4-beta.0
  - @nextclaw/ncp-toolkit@0.5.39-beta.0

## 0.14.0

### Minor Changes

- c4ee481: Add the show_content chat display action so agents can ask the UI to open file, URL, or installed panel app content from tool results and realtime UI events.

### Patch Changes

- 2d50763: Fix NCP chat loading and header rendering after moving raw query results into the chat query store.
- cb7f342: Improve DocBrowser tab visibility and resize handling around embedded web content.
- 2d49463: Fix the Skill Marketplace header tabs and SkillHub action copy while preserving the marketplace refactor.
- 3624bbb: Allow NARP runtimes to use their own default model instead of always receiving a NextClaw model override.
- Updated dependencies
- Updated dependencies [c4ee481]
- Updated dependencies [3624bbb]
  - @nextclaw/agent-chat@0.2.13
  - @nextclaw/client-sdk@0.4.3
  - @nextclaw/ncp@0.6.3
  - @nextclaw/ncp-http-agent-client@0.3.45
  - @nextclaw/ncp-react@0.4.53
  - @nextclaw/ncp-toolkit@0.5.38
  - @nextclaw/shared@0.3.0
  - @nextclaw/agent-chat-ui@0.5.0

## 0.13.13

### Patch Changes

- ac44df2: Improve chat sticky-scroll lifecycle cleanup so queued scroll frames are cancelled on unmount, reducing the chance of stale chat scroll scheduling after session or view transitions.
- b2702b9: Persist chat workspace panel state and add workspace-local back/forward navigation across child-session, cron, and file preview tabs.
- 05d6f6b: Keep skill marketplace results visible while search and sort refresh, with lightweight updating feedback.
- 41a6435: Add a SkillHub link to the skill marketplace and route external navigation through the host browser bridge.
- 42ad22f: Improve Side Dock pinned emoji shortcuts so they render as visual dock icons instead of small text labels.
- Updated dependencies
- Updated dependencies [ac44df2]
  - @nextclaw/agent-chat@0.2.12
  - @nextclaw/client-sdk@0.4.2
  - @nextclaw/ncp@0.6.2
  - @nextclaw/ncp-http-agent-client@0.3.44
  - @nextclaw/ncp-react@0.4.52
  - @nextclaw/shared@0.2.12
  - @nextclaw/agent-chat-ui@0.4.12

## 0.13.12

### Patch Changes

- 36c4e56: Expose session workingDir and use it as the base path for chat local file link previews.
- Updated dependencies
- Updated dependencies [36c4e56]
  - @nextclaw/agent-chat@0.2.11
  - @nextclaw/agent-chat-ui@0.4.11
  - @nextclaw/client-sdk@0.4.1
  - @nextclaw/ncp-http-agent-client@0.3.43
  - @nextclaw/ncp-react@0.4.51
  - @nextclaw/shared@0.2.11
  - @nextclaw/ncp@0.6.1

## 0.13.11

### Patch Changes

- 641fc22: Support project-relative local file links in chat markdown and improve the cron jobs page card interactions.
- cc024b3: Expose the original agent-run peerId on NCP session summaries and support filtering session lists by peerId.
- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies [1ed5aff]
- Updated dependencies
- Updated dependencies [641fc22]
- Updated dependencies [cc024b3]
- Updated dependencies [6ec95a0]
  - @nextclaw/agent-chat@0.2.10
  - @nextclaw/agent-chat-ui@0.4.10
  - @nextclaw/ncp-http-agent-client@0.3.42
  - @nextclaw/ncp-react@0.4.50
  - @nextclaw/shared@0.2.10
  - @nextclaw/client-sdk@0.4.0
  - @nextclaw/ncp@0.6.0

## 0.13.11-beta.0

### Patch Changes

- cc024b3: Expose the original agent-run peerId on NCP session summaries and support filtering session lists by peerId.
- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies
- Updated dependencies [cc024b3]
- Updated dependencies [6ec95a0]
  - @nextclaw/agent-chat@0.2.10-beta.0
  - @nextclaw/agent-chat-ui@0.4.10-beta.0
  - @nextclaw/ncp-http-agent-client@0.3.42-beta.0
  - @nextclaw/ncp-react@0.4.50-beta.0
  - @nextclaw/shared@0.2.10-beta.0
  - @nextclaw/ncp@0.6.0-beta.0
  - @nextclaw/client-sdk@0.4.0-beta.0

## 0.13.10

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- 13eaf56: Simplify the PWA runtime so service workers no longer reload chat pages or serve stale runtime chunks.
- 86acdbe: Publish session run status updates from the agent run request flow, keep realtime running overlays from being overwritten by persisted idle summaries, and remove the unused session run publish API from the runtime-next session state contract.
- Updated dependencies [14c5730]
- Updated dependencies [43da21a]
- Updated dependencies [bfa611f]
- Updated dependencies [226b3cf]
- Updated dependencies [86a0dc8]
  - @nextclaw/agent-chat@0.2.9
  - @nextclaw/agent-chat-ui@0.4.9
  - @nextclaw/ncp@0.5.29
  - @nextclaw/ncp-http-agent-client@0.3.41
  - @nextclaw/ncp-react@0.4.49
  - @nextclaw/shared@0.2.9
  - @nextclaw/client-sdk@0.3.0

## 0.13.10-beta.1

### Patch Changes

- 13eaf56: Simplify the PWA runtime so service workers no longer reload chat pages or serve stale runtime chunks.
- Updated dependencies
- Updated dependencies [bfa611f]
- Updated dependencies [226b3cf]
  - @nextclaw/agent-chat@0.2.9-beta.1
  - @nextclaw/agent-chat-ui@0.4.9-beta.1
  - @nextclaw/ncp@0.5.29-beta.1
  - @nextclaw/ncp-http-agent-client@0.3.41-beta.1
  - @nextclaw/ncp-react@0.4.49-beta.1
  - @nextclaw/shared@0.2.9-beta.1
  - @nextclaw/client-sdk@0.3.0-beta.1

## 0.13.10-beta.0

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- 86acdbe: Publish session run status updates from the agent run request flow, keep realtime running overlays from being overwritten by persisted idle summaries, and remove the unused session run publish API from the runtime-next session state contract.
- Updated dependencies
- Updated dependencies [86a0dc8]
  - @nextclaw/agent-chat@0.2.9-beta.0
  - @nextclaw/agent-chat-ui@0.4.9-beta.0
  - @nextclaw/ncp@0.5.29-beta.0
  - @nextclaw/ncp-http-agent-client@0.3.41-beta.0
  - @nextclaw/ncp-react@0.4.49-beta.0
  - @nextclaw/shared@0.2.9-beta.0
  - @nextclaw/client-sdk@0.2.10-beta.0

## 0.13.9

### Patch Changes

- 3061877: Decouple cron jobs from channel delivery settings. Scheduled jobs now ask the agent to call the message tool for notifications, while Weixin sends fail honestly when account, channel, API, or context_token delivery state is unavailable.
- Updated dependencies
  - @nextclaw/agent-chat@0.2.8
  - @nextclaw/agent-chat-ui@0.4.8
  - @nextclaw/client-sdk@0.2.9
  - @nextclaw/ncp@0.5.28
  - @nextclaw/ncp-http-agent-client@0.3.40
  - @nextclaw/ncp-react@0.4.48
  - @nextclaw/shared@0.2.8

## 0.13.8

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.2.7
  - @nextclaw/agent-chat-ui@0.4.7
  - @nextclaw/client-sdk@0.2.8
  - @nextclaw/ncp@0.5.27
  - @nextclaw/ncp-http-agent-client@0.3.39
  - @nextclaw/ncp-react@0.4.47
  - @nextclaw/shared@0.2.7

## 0.13.7

### Patch Changes

- @nextclaw/client-sdk@0.2.7

## 0.13.6

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.2.6
  - @nextclaw/agent-chat-ui@0.4.6
  - @nextclaw/client-sdk@0.2.6
  - @nextclaw/ncp@0.5.26
  - @nextclaw/ncp-http-agent-client@0.3.38
  - @nextclaw/ncp-react@0.4.46
  - @nextclaw/shared@0.2.6

## 0.13.5

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.2.5
  - @nextclaw/agent-chat-ui@0.4.5
  - @nextclaw/client-sdk@0.2.5
  - @nextclaw/ncp@0.5.25
  - @nextclaw/ncp-http-agent-client@0.3.37
  - @nextclaw/ncp-react@0.4.45
  - @nextclaw/shared@0.2.5

## 0.13.4

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.2.4
  - @nextclaw/agent-chat-ui@0.4.4
  - @nextclaw/client-sdk@0.2.4
  - @nextclaw/ncp@0.5.24
  - @nextclaw/ncp-http-agent-client@0.3.36
  - @nextclaw/ncp-react@0.4.44
  - @nextclaw/shared@0.2.4

## 0.13.3

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.2.3
  - @nextclaw/agent-chat-ui@0.4.3
  - @nextclaw/client-sdk@0.2.3
  - @nextclaw/ncp@0.5.23
  - @nextclaw/ncp-http-agent-client@0.3.35
  - @nextclaw/ncp-react@0.4.43
  - @nextclaw/shared@0.2.3

## 0.13.2

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.2.2
  - @nextclaw/agent-chat-ui@0.4.2
  - @nextclaw/client-sdk@0.2.2
  - @nextclaw/ncp@0.5.22
  - @nextclaw/ncp-http-agent-client@0.3.34
  - @nextclaw/ncp-react@0.4.42
  - @nextclaw/shared@0.2.2

## 0.13.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.2.1
  - @nextclaw/agent-chat-ui@0.4.1
  - @nextclaw/client-sdk@0.2.1
  - @nextclaw/ncp@0.5.21
  - @nextclaw/ncp-http-agent-client@0.3.33
  - @nextclaw/ncp-react@0.4.41
  - @nextclaw/shared@0.2.1

## 0.13.0

### Minor Changes

- Release the NextClaw lightweight app platform as a minor feature line.

  Panel Apps now receive developer-friendly bridge results: service action lists resolve to arrays, service action invokes resolve to business payloads, and built-in app creator skills document the canonical Panel + Service + Agent contract.

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat@0.2.0
  - @nextclaw/agent-chat-ui@0.4.0
  - @nextclaw/client-sdk@0.2.0
  - @nextclaw/shared@0.2.0

## 0.12.37

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.25
  - @nextclaw/agent-chat-ui@0.3.27
  - @nextclaw/client-sdk@0.1.16
  - @nextclaw/ncp@0.5.20
  - @nextclaw/ncp-http-agent-client@0.3.32
  - @nextclaw/ncp-react@0.4.40
  - @nextclaw/shared@0.1.14

## 0.12.36

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.24
  - @nextclaw/agent-chat-ui@0.3.26
  - @nextclaw/client-sdk@0.1.15
  - @nextclaw/ncp@0.5.19
  - @nextclaw/ncp-http-agent-client@0.3.31
  - @nextclaw/ncp-react@0.4.39
  - @nextclaw/shared@0.1.13

## 0.12.35

### Patch Changes

- b99164b: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 2f4f480: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 828495f: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 25207de: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 854abec: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 26163ed: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 5535f60: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 509b157: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies [b99164b]
- Updated dependencies [2f4f480]
- Updated dependencies [828495f]
- Updated dependencies [25207de]
- Updated dependencies [854abec]
- Updated dependencies [26163ed]
- Updated dependencies [5535f60]
- Updated dependencies [509b157]
  - @nextclaw/agent-chat@0.1.23
  - @nextclaw/agent-chat-ui@0.3.25
  - @nextclaw/client-sdk@0.1.14
  - @nextclaw/ncp@0.5.18
  - @nextclaw/ncp-http-agent-client@0.3.30
  - @nextclaw/ncp-react@0.4.38
  - @nextclaw/shared@0.1.12

## 0.12.35-beta.7

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.23-beta.7
  - @nextclaw/agent-chat-ui@0.3.25-beta.7
  - @nextclaw/client-sdk@0.1.14-beta.7
  - @nextclaw/ncp@0.5.18-beta.7
  - @nextclaw/ncp-http-agent-client@0.3.30-beta.7
  - @nextclaw/ncp-react@0.4.38-beta.7
  - @nextclaw/shared@0.1.12-beta.7

## 0.12.35-beta.6

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.23-beta.6
  - @nextclaw/agent-chat-ui@0.3.25-beta.6
  - @nextclaw/client-sdk@0.1.14-beta.6
  - @nextclaw/ncp@0.5.18-beta.6
  - @nextclaw/ncp-http-agent-client@0.3.30-beta.6
  - @nextclaw/ncp-react@0.4.38-beta.6
  - @nextclaw/shared@0.1.12-beta.6

## 0.12.35-beta.5

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.23-beta.5
  - @nextclaw/agent-chat-ui@0.3.25-beta.5
  - @nextclaw/client-sdk@0.1.14-beta.5
  - @nextclaw/ncp@0.5.18-beta.5
  - @nextclaw/ncp-http-agent-client@0.3.30-beta.5
  - @nextclaw/ncp-react@0.4.38-beta.5
  - @nextclaw/shared@0.1.12-beta.5

## 0.12.35-beta.4

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.23-beta.4
  - @nextclaw/agent-chat-ui@0.3.25-beta.4
  - @nextclaw/client-sdk@0.1.14-beta.4
  - @nextclaw/ncp@0.5.18-beta.4
  - @nextclaw/ncp-http-agent-client@0.3.30-beta.4
  - @nextclaw/ncp-react@0.4.38-beta.4
  - @nextclaw/shared@0.1.12-beta.4

## 0.12.35-beta.3

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.23-beta.3
  - @nextclaw/agent-chat-ui@0.3.25-beta.3
  - @nextclaw/client-sdk@0.1.14-beta.3
  - @nextclaw/ncp@0.5.18-beta.3
  - @nextclaw/ncp-http-agent-client@0.3.30-beta.3
  - @nextclaw/ncp-react@0.4.38-beta.3
  - @nextclaw/server@0.12.26-beta.3
  - @nextclaw/shared@0.1.12-beta.3

## 0.12.35-beta.2

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.23-beta.2
  - @nextclaw/agent-chat-ui@0.3.25-beta.2
  - @nextclaw/client-sdk@0.1.14-beta.2
  - @nextclaw/ncp@0.5.18-beta.2
  - @nextclaw/ncp-http-agent-client@0.3.30-beta.2
  - @nextclaw/ncp-react@0.4.38-beta.2
  - @nextclaw/server@0.12.26-beta.2
  - @nextclaw/shared@0.1.12-beta.2

## 0.12.35-beta.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.23-beta.1
  - @nextclaw/agent-chat-ui@0.3.25-beta.1
  - @nextclaw/client-sdk@0.1.14-beta.1
  - @nextclaw/ncp@0.5.18-beta.1
  - @nextclaw/ncp-http-agent-client@0.3.30-beta.1
  - @nextclaw/ncp-react@0.4.38-beta.1
  - @nextclaw/server@0.12.26-beta.1
  - @nextclaw/shared@0.1.12-beta.1

## 0.12.35-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.23-beta.0
  - @nextclaw/agent-chat-ui@0.3.25-beta.0
  - @nextclaw/client-sdk@0.1.14-beta.0
  - @nextclaw/ncp@0.5.18-beta.0
  - @nextclaw/ncp-http-agent-client@0.3.30-beta.0
  - @nextclaw/ncp-react@0.4.38-beta.0
  - @nextclaw/server@0.12.26-beta.0
  - @nextclaw/shared@0.1.12-beta.0

## 0.12.34

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.22
  - @nextclaw/agent-chat-ui@0.3.24
  - @nextclaw/client-sdk@0.1.13
  - @nextclaw/ncp@0.5.17
  - @nextclaw/ncp-http-agent-client@0.3.29
  - @nextclaw/ncp-react@0.4.37
  - @nextclaw/server@0.12.25
  - @nextclaw/shared@0.1.11

## 0.12.33

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.21
  - @nextclaw/agent-chat-ui@0.3.23
  - @nextclaw/client-sdk@0.1.12
  - @nextclaw/ncp@0.5.16
  - @nextclaw/ncp-http-agent-client@0.3.28
  - @nextclaw/ncp-react@0.4.36
  - @nextclaw/server@0.12.24
  - @nextclaw/shared@0.1.10

## 0.12.32

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.20
  - @nextclaw/agent-chat-ui@0.3.22
  - @nextclaw/client-sdk@0.1.11
  - @nextclaw/ncp@0.5.15
  - @nextclaw/ncp-http-agent-client@0.3.27
  - @nextclaw/ncp-react@0.4.35
  - @nextclaw/server@0.12.23
  - @nextclaw/shared@0.1.9

## 0.12.31

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.19
  - @nextclaw/agent-chat-ui@0.3.21
  - @nextclaw/client-sdk@0.1.10
  - @nextclaw/ncp@0.5.14
  - @nextclaw/ncp-http-agent-client@0.3.26
  - @nextclaw/ncp-react@0.4.34
  - @nextclaw/server@0.12.22
  - @nextclaw/shared@0.1.8

## 0.12.30

### Patch Changes

- Publish the Weixin asset store method binding fix and current packaged UI/runtime entry updates.
  - @nextclaw/server@0.12.21
  - @nextclaw/client-sdk@0.1.9

## 0.12.29

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.18
  - @nextclaw/agent-chat-ui@0.3.20
  - @nextclaw/client-sdk@0.1.8
  - @nextclaw/ncp@0.5.13
  - @nextclaw/ncp-http-agent-client@0.3.25
  - @nextclaw/ncp-react@0.4.33
  - @nextclaw/server@0.12.20
  - @nextclaw/shared@0.1.7

## 0.12.28

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.17
  - @nextclaw/agent-chat-ui@0.3.19
  - @nextclaw/client-sdk@0.1.7
  - @nextclaw/ncp@0.5.12
  - @nextclaw/ncp-http-agent-client@0.3.24
  - @nextclaw/ncp-react@0.4.32
  - @nextclaw/server@0.12.19
  - @nextclaw/shared@0.1.6

## 0.12.27

### Patch Changes

- Release frontend UI changes only.

## 0.12.26

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.16
  - @nextclaw/agent-chat-ui@0.3.18
  - @nextclaw/client-sdk@0.1.6
  - @nextclaw/ncp@0.5.11
  - @nextclaw/ncp-http-agent-client@0.3.23
  - @nextclaw/ncp-react@0.4.31
  - @nextclaw/server@0.12.18
  - @nextclaw/shared@0.1.5

## 0.12.25

### Patch Changes

- Auto-generated full public stable release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.15
  - @nextclaw/agent-chat-ui@0.3.17
  - @nextclaw/client-sdk@0.1.5
  - @nextclaw/ncp@0.5.10
  - @nextclaw/ncp-http-agent-client@0.3.22
  - @nextclaw/ncp-react@0.4.30
  - @nextclaw/server@0.12.17
  - @nextclaw/shared@0.1.4

## 0.12.24

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.14
  - @nextclaw/agent-chat-ui@0.3.16
  - @nextclaw/client-sdk@0.1.4
  - @nextclaw/ncp@0.5.9
  - @nextclaw/ncp-http-agent-client@0.3.21
  - @nextclaw/ncp-react@0.4.29
  - @nextclaw/server@0.12.16
  - @nextclaw/shared@0.1.3

## 0.12.23

### Patch Changes

- Fix runtime update status messaging and centralize packaged distribution metadata for npm runtime updates.

## 0.12.22

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.13
  - @nextclaw/agent-chat-ui@0.3.15
  - @nextclaw/client-sdk@0.1.3
  - @nextclaw/ncp@0.5.8
  - @nextclaw/ncp-http-agent-client@0.3.20
  - @nextclaw/ncp-react@0.4.28
  - @nextclaw/server@0.12.15
  - @nextclaw/shared@0.1.2

## 0.12.21

### Patch Changes

- Stable minor release for the NextClaw npm package, with patch releases for the workspace dependency closure.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.12
  - @nextclaw/agent-chat-ui@0.3.14
  - @nextclaw/client-sdk@0.1.2
  - @nextclaw/ncp@0.5.7
  - @nextclaw/ncp-http-agent-client@0.3.19
  - @nextclaw/ncp-react@0.4.27
  - @nextclaw/server@0.12.14
  - @nextclaw/shared@0.1.1

## 0.12.20

### Patch Changes

- 0251268: Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/ncp
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- 2418020: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- a5da9d6: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- 1600643: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- 223037c: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies [0251268]
- Updated dependencies [a11f4fd]
- Updated dependencies [2418020]
- Updated dependencies [a5da9d6]
- Updated dependencies [1600643]
- Updated dependencies [223037c]
  - @nextclaw/agent-chat-ui@0.3.13
  - @nextclaw/ncp@0.5.6
  - @nextclaw/server@0.12.13
  - @nextclaw/agent-chat@0.1.11
  - @nextclaw/client-sdk@0.1.1
  - @nextclaw/kernel@0.1.2
  - @nextclaw/ncp-http-agent-client@0.3.18
  - @nextclaw/ncp-react@0.4.26

## 0.12.20-beta.6

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.11-beta.4
  - @nextclaw/agent-chat-ui@0.3.13-beta.4
  - @nextclaw/client-sdk@0.1.1-beta.6
  - @nextclaw/kernel@0.1.2-beta.6
  - @nextclaw/ncp@0.5.6-beta.4
  - @nextclaw/ncp-http-agent-client@0.3.18-beta.5
  - @nextclaw/ncp-react@0.4.26-beta.5
  - @nextclaw/server@0.12.13-beta.6

## 0.12.20-beta.5

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.11-beta.3
  - @nextclaw/agent-chat-ui@0.3.13-beta.3
  - @nextclaw/client-sdk@0.1.1-beta.5
  - @nextclaw/kernel@0.1.2-beta.5
  - @nextclaw/ncp@0.5.6-beta.3
  - @nextclaw/ncp-http-agent-client@0.3.18-beta.4
  - @nextclaw/ncp-react@0.4.26-beta.4
  - @nextclaw/server@0.12.13-beta.5

## 0.12.20-beta.4

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.11-beta.2
  - @nextclaw/agent-chat-ui@0.3.13-beta.2
  - @nextclaw/client-sdk@0.1.1-beta.4
  - @nextclaw/kernel@0.1.2-beta.4
  - @nextclaw/ncp@0.5.6-beta.2
  - @nextclaw/ncp-http-agent-client@0.3.18-beta.3
  - @nextclaw/ncp-react@0.4.26-beta.3
  - @nextclaw/server@0.12.13-beta.4

## 0.12.20-beta.3

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.11-beta.1
  - @nextclaw/agent-chat-ui@0.3.13-beta.1
  - @nextclaw/client-sdk@0.1.1-beta.3
  - @nextclaw/kernel@0.1.2-beta.3
  - @nextclaw/ncp@0.5.6-beta.1
  - @nextclaw/ncp-http-agent-client@0.3.18-beta.2
  - @nextclaw/ncp-react@0.4.26-beta.2
  - @nextclaw/server@0.12.13-beta.3

## 0.12.20-beta.2

### Patch Changes

- @nextclaw/server@0.12.13-beta.2
- @nextclaw/client-sdk@0.1.1-beta.2

## 0.12.20-beta.1

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat@0.1.11-beta.0
  - @nextclaw/client-sdk@0.1.1-beta.1
  - @nextclaw/kernel@0.1.2-beta.2
  - @nextclaw/ncp-http-agent-client@0.3.18-beta.1
  - @nextclaw/ncp-react@0.4.26-beta.1
  - @nextclaw/server@0.12.13-beta.1

## 0.12.20-beta.0

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/ncp
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.13-beta.0
  - @nextclaw/ncp@0.5.6-beta.0
  - @nextclaw/ncp-http-agent-client@0.3.18-beta.0
  - @nextclaw/ncp-react@0.4.26-beta.0
  - @nextclaw/kernel@0.1.2-beta.1

## 0.12.19

### Patch Changes

- Add target session support for cron jobs across CLI, API, UI, and agent tooling.

## 0.12.18

### Patch Changes

- Fix mobile Chrome viewport sizing so the bottom navigation and chat input stay visible.

## 0.12.17

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.12

## 0.12.16

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/ui

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.11

## 0.12.15

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.10

## 0.12.14

### Patch Changes

- Release frontend UI changes only.

## 0.12.13

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/ui
  - nextclaw

## 0.12.12

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.9
  - @nextclaw/ncp@0.5.5
  - @nextclaw/ncp-http-agent-client@0.3.17
  - @nextclaw/ncp-react@0.4.25

## 0.12.11

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.8
  - @nextclaw/ncp@0.5.4
  - @nextclaw/ncp-http-agent-client@0.3.16
  - @nextclaw/ncp-react@0.4.24

## 0.12.10

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.7
  - @nextclaw/ncp@0.5.3
  - @nextclaw/ncp-http-agent-client@0.3.15
  - @nextclaw/ncp-react@0.4.23

## 0.12.9

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/core
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.6
  - @nextclaw/ncp@0.5.2
  - @nextclaw/ncp-http-agent-client@0.3.14
  - @nextclaw/ncp-react@0.4.22

## 0.12.8

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.10
  - @nextclaw/agent-chat-ui@0.3.5
  - @nextclaw/ncp@0.5.1
  - @nextclaw/ncp-http-agent-client@0.3.13
  - @nextclaw/ncp-react@0.4.21

## 0.12.7

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.4
  - @nextclaw/ncp-react@0.4.20

## 0.12.6

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/core
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.3
  - @nextclaw/ncp-react@0.4.19

## 0.12.5

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.9
  - @nextclaw/agent-chat-ui@0.3.2
  - @nextclaw/ncp-react@0.4.18

## 0.12.4

### Patch Changes

- Release image preview simplification and project-first chat sidebar improvements.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.1

## 0.12.3

### Patch Changes

- Release frontend UI changes only.

## 0.12.2

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.8
  - @nextclaw/ncp-react@0.4.17

## 0.12.1

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/ncp-toolkit
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/agent-chat@0.1.7
  - @nextclaw/ncp-react@0.4.16

## 0.12.0

### Minor Changes

- Release the unpublished multi-agent batch as one aligned npm release.

  This release includes the new multi-agent management flow across CLI, server, and UI, agent-scoped session ownership and child-session conversation unification, plus the agent identity rendering improvements for spawned child sessions and tool cards.

  It also ships the openclaw marketplace/runtime npm install alignment and republishes the dependent public package chain so workspace versions stay consistent downstream.

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.3.0
  - @nextclaw/ncp@0.5.0
  - @nextclaw/ncp-http-agent-client@0.3.12
  - @nextclaw/ncp-react@0.4.15

## 0.11.23

### Patch Changes

- Republish the packages changed after the April 3 unified release batch so the published tarballs match the current workspace, including the new NCP session request and session spawn flow.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.21
  - @nextclaw/ncp-http-agent-client@0.3.11
  - @nextclaw/ncp-react@0.4.14

## 0.11.22

### Patch Changes

- Publish the full April 2 to April 3 public package drift as one aligned patch batch.

  This release includes the session-scoped project context chain, project-aware skill loading, chat header project interactions, server path picker improvements, file operation card rendering refinements, and the aligned runtime or engine updates behind them.

  It also republishes the affected direct dependents so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.20
  - @nextclaw/ncp-react@0.4.13

## 0.11.21

### Patch Changes

- Publish the remaining unpublished workspace drift from March 31 and April 1 as one aligned patch batch, including the native file preview pipeline updates, structured terminal tool result rendering, and the recent tool card UX refinements.
- Updated dependencies
  - @nextclaw/ncp@0.4.6
  - @nextclaw/ncp-react@0.4.12
  - @nextclaw/agent-chat-ui@0.2.19
  - @nextclaw/ncp-http-agent-client@0.3.10

## 0.11.20

### Patch Changes

- f65c1f5: Republish Nextclaw UI with upstream frontend dependency chain.
- Updated dependencies [f65c1f5]
  - @nextclaw/agent-chat@0.1.6
  - @nextclaw/agent-chat-ui@0.2.18
  - @nextclaw/ncp@0.4.5
  - @nextclaw/ncp-http-agent-client@0.3.9
  - @nextclaw/ncp-react@0.4.11

## 0.11.19

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.17
  - @nextclaw/ncp@0.4.4
  - @nextclaw/ncp-http-agent-client@0.3.8
  - @nextclaw/ncp-react@0.4.10

## 0.11.18

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/agent-chat@0.1.5
  - @nextclaw/agent-chat-ui@0.2.16
  - @nextclaw/ncp@0.4.3
  - @nextclaw/ncp-http-agent-client@0.3.7
  - @nextclaw/ncp-react@0.4.9

## 0.11.17

### Patch Changes

- Release pending session labeling and session context icon improvements.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.15
  - @nextclaw/ncp-react@0.4.8

## 0.11.16

### Patch Changes

- Align NCP chat session run status with direct realtime events so parent replies, sidebar spinners, and chat completion state settle without refresh after sub-agent runs finish.
  - @nextclaw/ncp-react@0.4.7

## 0.11.15

### Patch Changes

- Publish the NCP subagent live follow-up fixes, including spawn tool result updates, parent-agent realtime continuation, and the aligned frontend chat visibility changes.
- Updated dependencies
  - @nextclaw/ncp@0.4.2
  - @nextclaw/ncp-react@0.4.6
  - @nextclaw/ncp-http-agent-client@0.3.6

## 0.11.14

### Patch Changes

- Release frontend UI changes only.

## 0.11.13

### Patch Changes

- Fix NCP subagent completion so results persist back into the originating session, become visible in chat after realtime refresh, and no longer depend on the legacy system-message relay.
  - @nextclaw/ncp-react@0.4.5

## 0.11.12

### Patch Changes

- Republish Nextclaw UI with upstream frontend dependency chain.
- Updated dependencies
  - @nextclaw/agent-chat@0.1.4
  - @nextclaw/agent-chat-ui@0.2.14
  - @nextclaw/ncp@0.4.1
  - @nextclaw/ncp-http-agent-client@0.3.5
  - @nextclaw/ncp-react@0.4.4

## 0.11.11

### Patch Changes

- Release frontend UI changes only.

## 0.11.10

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/agent-chat-ui@0.2.13
  - @nextclaw/ncp-react@0.4.3

## 0.11.9

### Patch Changes

- 1ce3d58: Improve chat stream rendering performance by preserving stable message identities for unchanged messages and batching sticky autoscroll work with requestAnimationFrame.
- Updated dependencies [1ce3d58]
  - @nextclaw/agent-chat-ui@0.2.12
  - @nextclaw/ncp-react@0.4.2

## 0.11.8

### Patch Changes

- Release frontend UI changes only.

## 0.11.7

### Patch Changes

- Release the accumulated public workspace drift together with the Codex Responses contract fix. This batch includes the new stream-completion probe, the Codex runtime bundle entry alignment, and the already-unpublished package changes that the release guard requires to be versioned before publish.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.11

## 0.11.6

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.10

## 0.11.5

### Patch Changes

- Publish the pending frontend UI batch together with the already-drifted public packages required by release guards.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.9

## 0.11.4

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.8

## 0.11.3

### Patch Changes

- Publish the current committed runtime and UI startup fixes as one aligned patch batch. This release moves the Codex runtime plugin onto host-injected agent runtime APIs, splits UI session reads from the deferred NCP runtime so `/api/ncp/sessions` is available before the runtime agent is ready, and republishes the linked public packages above the currently published tags so the shipped dependency chain stays version-consistent.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.7

## 0.11.2

### Patch Changes

- Publish the pending branch changes for Claude NCP event visibility and chat tool status feedback. Claude runtime now exposes richer reasoning and tool-call events to the NCP layer, and the shared chat UI surfaces clearer tool lifecycle states, call IDs, and output labels.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.6

## 0.11.1

### Patch Changes

- Raise the frontend NCP attachment upload limit from 10MB to 200MB.
- Updated dependencies
  - @nextclaw/ncp-react@0.4.1

## 0.11.0

### Minor Changes

- Unify the NCP file pipeline around an asset store abstraction with `put`, `export`, and `stat`.

  This release removes default prompt-time file content injection, replaces `attachmentUri` with `assetUri`, adds `asset_put` / `asset_export` / `asset_stat`, and updates the UI/server upload flow to return and render managed assets directly.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0
  - @nextclaw/ncp-react@0.4.0
  - @nextclaw/ncp-http-agent-client@0.3.4

## 0.10.5

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/ncp@0.3.3
  - @nextclaw/ncp-react@0.3.6
  - @nextclaw/agent-chat@0.1.3
  - @nextclaw/agent-chat-ui@0.2.5
  - @nextclaw/ncp-http-agent-client@0.3.3

## 0.10.4

### Patch Changes

- Release frontend UI changes and aligned CLI/server release group packages.

## 0.10.3

### Patch Changes

- ee69ef6: Keep pasted and uploaded NCP images in composer order end to end: preserve caret placement, retain image visibility across follow-up turns without hidden model switching, and serialize mixed text/image message parts in the same order users authored them.
- Updated dependencies [ee69ef6]
  - @nextclaw/agent-chat-ui@0.2.4
  - @nextclaw/ncp-react@0.3.5

## 0.10.2

### Patch Changes

- Polish remote access failure handling so startup auth bootstrap no longer degrades into a blank screen, keep the remote request path on websocket multiplex with explicit timeouts, and align the bundled NextClaw release group with the updated remote access UX.

## 0.10.1

### Patch Changes

- Add NCP image attachment support across the shared chat composer, NCP runtime, React bindings, and bundled NextClaw UI so pasted or uploaded images are sent as NCP file parts and rendered inline. Also keep the required CLI/server/mcp release group in sync for the bundled NextClaw distribution.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.3
  - @nextclaw/ncp-react@0.3.4

## 0.10.0

### Minor Changes

- bb891c2: Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.

## 0.9.18

### Patch Changes

- Fix Claude NCP runtime model routing by bridging Anthropic Messages to OpenAI-compatible providers, remove the Claude model whitelist concept, and keep the Claude model selector stable when the previously selected model is missing.

## 0.9.17

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/agent-chat@0.1.2
  - @nextclaw/agent-chat-ui@0.2.2
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-http-agent-client@0.3.2
  - @nextclaw/ncp-react@0.3.3

## 0.9.16

### Patch Changes

- Republish the verified Weixin QR auth UI flow above already occupied npm versions so the published CLI and UI packages match the code that passed real smoke validation.

## 0.9.15

### Patch Changes

- Publish the transparent app transport boundary fix so local and remote streaming remain a true transport-only replacement.
  - keep SSE and multiplex adapters transport-only instead of interpreting upper-layer terminal events
  - preserve `final` as a normal streamed event while keeping `openStream().finished` stable
  - ship the repaired local chat UX and remote request-multiplex behavior in the released CLI/UI/runtime chain

## 0.9.14

### Patch Changes

- Add the Weixin channel entry to the Channels page so users can configure personal Weixin accounts directly from the frontend.

## 0.9.13

### Patch Changes

- Fix local UI runtime probe fallback so local NextClaw instances keep using local transport
  instead of breaking on `/_remote/runtime` HTML responses.

## 0.9.12

### Patch Changes

- Unify controlled UI requests under appClient, ship the updated built-in UI bundle,
  and keep the CLI release group aligned.

## 0.9.11

### Patch Changes

- Republish the finalized remote app transport multiplex implementation after maintainability refactors so the published packages match the verified runtime code.

## 0.9.10

### Patch Changes

- Add remote app transport multiplexing so the UI can switch from direct local transport to remote runtime transport, including browser-side remote requests, realtime event bridging, and streamed chat turns over the remote relay.

## 0.9.9

### Patch Changes

- Align the default NextClaw UI port to 55667 across core config, remote access, CLI runtime, UI fallbacks, Docker defaults, smoke scripts, and user-facing docs.

## 0.9.8

### Patch Changes

- Add an `enabled` switch for providers so disabled providers stay configured but are excluded from routing, model selection, and runtime diagnostics.

  Expose the provider enabled state through the server and UI config views, and show disabled providers clearly in the Providers page.

## 0.9.7

### Patch Changes

- Align the remote access UI with the existing product style, remove leftover advanced controls from the main flow, expose the device list entry directly, and surface clearer disconnected hints.

## 0.9.6

### Patch Changes

- Publish the user-first NextClaw account and remote access UI changes under a fresh npm version so the registry matches the repo state.

## 0.9.5

### Patch Changes

- Refine remote access into a user-first NextClaw account flow, simplify the remote access page, and align the web console device copy with the new product path.

## 0.9.4

### Patch Changes

- Add browser-based remote access platform authorization so users can log out and re-authorize from the UI without falling back to CLI password entry.

## 0.9.3

### Patch Changes

- Productize remote access in the built-in UI by shipping a dedicated Remote Access page, exposing the supporting server APIs, routing in-page managed-service restart through the shared self-restart coordinator so restart reliably relaunches the service instead of only stopping it, and keeping the required `@nextclaw/mcp` release group aligned with the updated server and CLI packages.

## 0.9.2

### Patch Changes

- Fix Codex chat model selection being overwritten by stale session hydration after the first send.

## 0.9.1

### Patch Changes

- Release the tokenized chat composer, IME fixes, and inline skill chip UI improvements.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.1

## 0.9.0

### Minor Changes

- Unify the latest NCP native chat chain improvements into a single release batch:
  - fix NCP streaming/state-manager promotion so tool-first assistant streams do not lose parts
  - align session type handling to stay generic outside the built-in native type
  - remove runtime-specific default-model branching and use a generic session-scoped fallback strategy
  - ship the latest NextClaw UI, server, and CLI cutover fixes together
  - republish direct dependents of `@nextclaw/ncp-toolkit` for version alignment

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-react@0.3.1

## 0.8.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.0
  - @nextclaw/ncp@0.3.0
  - @nextclaw/ncp-http-agent-client@0.3.0
  - @nextclaw/ncp-react@0.3.0

## 0.7.0

### Minor Changes

- eb9562b: Add lightweight built-in UI authentication for NextClaw UI with a single-admin setup flow, HttpOnly cookie sessions, protected API/WebSocket access, and a runtime Security panel.

### Patch Changes

- cfcd97f: Split the reusable chat presentation layer into a standalone `@nextclaw/agent-chat-ui` package and wire `@nextclaw/ui` to consume it.
- Updated dependencies [cfcd97f]
  - @nextclaw/agent-chat-ui@0.1.1

## 0.6.15

### Patch Changes

- Improve sidebar service status UX with lightweight indicator + shadcn tooltip, and tighten initial health status judgment based on `/api/health` payload status.

## 0.6.14

### Patch Changes

- Expose the new NCP agent runtime/backend type exports and session delete API, and add the docs entry under Settings in the main chat sidebar.

## 0.6.13

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.

## 0.6.12

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.

## 0.6.11

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/agent-chat@0.1.1

## 0.6.10

### Patch Changes

- Release frontend UI changes only.

## 0.6.9

### Patch Changes

- Switch skill distribution to marketplace-first flow and remove GitHub-based skill install paths.

  This release includes:
  - skill/plugin model clean split (skill: `builtin` + `marketplace` only)
  - marketplace API migration from bundled JSON to D1-backed source
  - CLI support for marketplace skill upload/update/install
  - UI and server integration updates for marketplace data, install behavior, and user-facing error messaging

## 0.6.8

### Patch Changes

- Release frontend UI changes only.

## 0.6.7

### Patch Changes

- Expose the NextClaw product version via app metadata and display it in the UI sidebar brand header.

## 0.6.6

### Patch Changes

- Release frontend UI changes only.

## 0.6.5

### Patch Changes

- Release frontend UI changes only.

## 0.6.4

### Patch Changes

- Polish chat UI loading and conversation interaction behaviors, and ship updated built-in UI assets.

## 0.6.3

### Patch Changes

- Retry publish with fresh patch versions after reserved-version conflict on npm.

## 0.6.2

### Patch Changes

- Introduce backend-managed chat run source of truth with reconnectable run streams, and restore in-progress run state when reopening chat sessions.

## 0.6.1

### Patch Changes

- Release frontend UI changes only.

## 0.6.0

### Minor Changes

- Unified minor release for accumulated architecture, engine, and chat UX updates.

  Includes:
  - New pluggable engine runtime support (Codex SDK / Claude Agent SDK)
  - Skill-context propagation and chat interaction stability improvements
  - Main workspace routing and conversation UX refinements
  - Core/server/openclaw compatibility and release alignment updates

## 0.5.48

### Patch Changes

- Release frontend UI changes only.

## 0.5.47

### Patch Changes

- Release frontend UI changes only.

## 0.5.46

### Patch Changes

- Release frontend UI changes only.

## 0.5.45

### Patch Changes

- Release frontend UI changes only.

## 0.5.44

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

## 0.5.43

### Patch Changes

- - fix provider connection test probe to use `maxTokens >= 16`, avoiding OpenAI-compatible gateway errors that reject values below 16.
  - add regression coverage for provider test route to assert probe maxTokens lower bound.
  - include latest UI updates in this release batch.

## 0.5.42

### Patch Changes

- - ui: refine provider config form layout (display name in primary section, Wire API Mode in advanced settings), plus related input rendering polish.
  - cli: fix Windows self-update strategy detection by supporting PATH/PATHEXT executable resolution and platform-aware update command shell execution.
  - docs: add iteration logs for provider advanced layout and Windows update strategy fix.

## 0.5.41

### Patch Changes

- release all pending changes including dynamic custom provider management, custom provider model prefix stripping before upstream calls, and marketplace source link wrapping fix in detail cards.

## 0.5.40

### Patch Changes

- support dynamic custom providers with add/edit/delete workflow, ensure custom provider test model selection is provider-scoped, and strip only the provider routing prefix before upstream OpenAI-compatible API calls.

## 0.5.39

### Patch Changes

- Align MiniMax default API base to the CN endpoint and add clear region-specific guidance in provider settings.

## 0.5.38

### Patch Changes

- Release frontend UI changes only.

## 0.5.37

### Patch Changes

- Release frontend UI changes only.

## 0.5.36

### Patch Changes

- Align channel configuration UX with provider page paradigm and fix logo badge consistency.
  - Switch Channels page to a provider-style two-pane workflow with list/filter on the left and persistent form on the right.
  - Fix hook ordering in `ChannelsList` to avoid render-time hook count mismatch.
  - Enforce stable logo badge sizing (`shrink-0`, overflow handling) so provider/channel icons keep consistent frame size.
  - Restrict channel tutorial links to dedicated docs only (currently Feishu).

## 0.5.35

### Patch Changes

- Add channel tutorial metadata and expose in the UI with localized links.
  - Add a Tutorials module to docs (EN/ZH) and include a dedicated Feishu setup page.
  - Extend config meta channel spec with `tutorialUrls` (`default/en/zh`) while keeping `tutorialUrl` for compatibility.
  - Resolve localized tutorial URLs in UI and show guide entry points on channel cards and channel config modal headers.

## 0.5.34

### Patch Changes

- Refresh provider default model catalogs to latest-generation options, improve provider/model selection UX, and align config model list behaviors.

## 0.5.33

### Patch Changes

- Release frontend UI changes only.

## 0.5.32

### Patch Changes

- Release frontend UI changes only.

## 0.5.31

### Patch Changes

- eb6446f: Fix provider list icon consistency by enforcing a fixed logo size in the UI.

## 0.5.30

### Patch Changes

- Fix provider API base routing for non-gateway providers and upgrade providers configuration UX in UI.

## 0.5.29

### Patch Changes

- fix chat stream terminal handling and remove end-of-stream typing flicker.

## 0.5.28

### Patch Changes

- Introduce event-backed chat storage and event-sequence rendering for UI chat:
  - persist session events (single-write) and project legacy messages from events
  - stream `session_event` frames alongside text deltas in chat SSE
  - render chat by ordered event timeline, merging tool call/result/follow-up in one assistant flow card
  - keep true streaming text while preserving event-order semantics

## 0.5.27

### Patch Changes

- Release frontend UI changes only.

## 0.5.26

### Patch Changes

- Release frontend UI changes only.

## 0.5.25

### Patch Changes

- Release frontend UI changes only.

## 0.5.24

### Patch Changes

- Add real chat streaming pipeline from provider to UI via SSE and remove simulated frontend streaming.

## 0.5.23

### Patch Changes

- Release frontend UI changes only.

## 0.5.22

### Patch Changes

- feat: add secrets command suite and ui management panel
  - add `nextclaw secrets audit/configure/apply/reload` with config-aware validation and reload planning
  - add ui secrets panel for editing `secrets.enabled/defaults/providers/refs`
  - add ui api endpoint `PUT /api/config/secrets` and full client hook/types integration
  - document secrets commands in en/zh command guides

## 0.5.21

### Patch Changes

- Upgrade UI chat experience with markdown rendering, structured tool cards, and grouped message display.

## 0.5.20

### Patch Changes

- Add built-in Agent chat support in UI with a new chat page, session management, and a backend chat turn API wired to runtime pool.

## 0.5.19

### Patch Changes

- feat(marketplace): support git skill install via skild with explicit skill/path parameters
  - route marketplace git skills through `npx skild install`
  - pass `skill` and `installPath` from UI -> server -> installer
  - allow git-type skills in marketplace skills list

## 0.5.18

### Patch Changes

- Fix embedded docs browser locale routing so docs open under the current UI language locale.

## 0.5.17

### Patch Changes

- Split marketplace plugins and skills across all layers, including typed worker routes, typed server proxy routes, and typed UI API clients.

## 0.5.16

### Patch Changes

- refine marketplace module separation and module-specific copy for plugins and skills

## 0.5.15

### Patch Changes

- split marketplace data and routes by type, separating plugins and skills endpoints end-to-end

## 0.5.14

### Patch Changes

- Release frontend UI changes only.

## 0.5.13

### Patch Changes

- Release frontend UI changes only.

## 0.5.12

### Patch Changes

- Release frontend UI changes only.

## 0.5.11

### Patch Changes

- Release frontend UI changes only.

## 0.5.10

### Patch Changes

- Release frontend UI changes only.

## 0.5.9

### Patch Changes

- Release frontend UI changes only.

## 0.5.8

### Patch Changes

- Refresh UI layout, components, and styling for the config pages.

## 0.5.7

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.

## 0.5.6

### Patch Changes

- Add cron management UI with list/enable/disable/run/delete actions and corresponding server API endpoints.

## 0.5.5

### Patch Changes

- UI: add confirm dialog flow for destructive actions; Server: allow marketplace manage to resolve plugin id from spec fallback.
- UI: add cron management page with view/enable/disable/run/delete actions.

## 0.5.4

### Patch Changes

- fix: sync marketplace toggle state and refresh list data after manage actions

## 0.5.3

### Patch Changes

- - render tooltips in a portal with design-system z-index
  - refresh marketplace cards with avatar + tooltip details

## 0.5.2

### Patch Changes

- switch DocBrowser docs domain to docs.nextclaw.io and remove legacy pages.dev fallback

## 0.5.1

### Patch Changes

- fix(ui): refine floating doc browser resize axis handling
  - support axis-aware floating resize behavior
  - keep width unchanged when dragging vertical-only handle
  - keep height unchanged when dragging horizontal-only handle

## 0.5.0

### Minor Changes

- feat(ui): improve embedded docs browser route sync and link handling
  - sync DocBrowser URL with in-iframe docs route changes
  - avoid intercepting explicitly external doc links
  - refine doc browser URL input UX and labels
  - refresh bundled `nextclaw` ui-dist with latest UI behavior

## 0.4.0

### Minor Changes

- feat(release): promote marketplace milestone to minor version bump
  - reclassify the recent marketplace integration as feature-level release
  - align package versions with semver minor progression
  - keep release coverage across cli, server and ui packages

## 0.3.17

### Patch Changes

- feat(marketplace): add VSCode-style marketplace with installed state and install integration
  - add marketplace query/install API on UI server
  - connect install actions to existing CLI plugin/skill install commands
  - add marketplace frontend page with search, filters, recommendations, and installed tab
  - add installed-status API and UI badges/button states for installed items

## 0.3.16

### Patch Changes

- Fix Model page maxTokens persistence by wiring maxTokens through UI save API and server config update.

## 0.3.15

### Patch Changes

- Add session channel grouping modes (all/by-channel) and complete Sessions i18n labels.

## 0.3.14

### Patch Changes

- Add full session management in NextClaw UI with OpenClaw-aligned capabilities.
  - add Sessions tab with filtering, history inspection, metadata patching, clear, and delete
  - add UI API endpoints for sessions list/history/patch/delete
  - sync frontend/server types and hooks for session operations
  - update usage guide for session management UI

## 0.3.13

### Patch Changes

- Add full UI/runtime API support for configuring input context token budgets.
  - Runtime page supports `agents.defaults.contextTokens`
  - Runtime page supports per-agent `agents.list[*].contextTokens`
  - Runtime API persists default context token budget updates
  - Usage docs updated for UI configuration path

## 0.3.12

### Patch Changes

- Align UI routing/runtime configuration with OpenClaw capabilities.
  - Add runtime config API and editor for `agents.list`, `bindings`, and `session` controls.
  - Add ChannelForm fields for Discord/Telegram routing and mention policy settings.
  - Expose runtime settings safely in public config view and wire UI navigation for runtime management.

## 0.3.11

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

## 0.3.10

### Patch Changes

- Remove configurable temperature and stop forwarding temperature in runtime provider requests.
  - Remove `agents.defaults.temperature` from config schema and reload rules.
  - Remove temperature propagation across agent loop, subagent manager, and provider manager.
  - Stop sending `temperature` to OpenAI-compatible provider payloads.
  - Remove temperature field/control from UI model configuration and API types.

## 0.3.9

### Patch Changes

- Introduce Action Schema v1 end-to-end:
  - add schema-driven `actions` metadata in config schema response
  - add unified action execute API (`POST /api/config/actions/:actionId/execute`)
  - migrate Feishu verify flow to generic action runner in UI
  - expose Discord/Slack `allowBots` fields in channel config form

## 0.3.8

### Patch Changes

- Align UI host semantics with always-public runtime behavior.
  - Treat `ui.host` as read-only in config metadata/hints.
  - Set UI host schema default/placeholder to `0.0.0.0`.
  - Add `readOnly` field to UI hint typings in core/server/ui packages.
  - Clarify docs that CLI start paths enforce public UI host.

## 0.3.7

### Patch Changes

- Decouple dev orchestration from CLI runtime by moving `pnpm dev start` into a dedicated repo-level dev runner and Vite config, while keeping production CLI startup paths free of dev-only port/frontend handling.

  Also remove `--frontend` and `--frontend-port` from `start`/`restart`/`serve` command options.

## 0.3.6

### Patch Changes

- Apply running config changes without manual restart for provider/channel/agent defaults, add missing-provider runtime fallback for smoother first-time setup, and document the new live-apply behavior.

## 0.3.5

### Patch Changes

- Fix session history trimming to keep tool-call / tool-result pairs consistent, reducing intermittent provider tool-call ID errors.

  Improve providers/channels config list rendering in the UI.

## 0.3.4

### Patch Changes

- Show MiniMax API base hints in UI and extend config schema hints/help.

## 0.3.3

### Patch Changes

- Align provider/channel list descriptions with config UI hints and extend schema help entries.

## 0.3.2

### Patch Changes

- chore: tighten eslint line limits

## 0.3.1

### Patch Changes

- Fix dev UI API base/WS derivation and correct port availability checks to avoid conflicts.

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.

## 0.2.5

### Patch Changes

- Update provider/channel logos and UI assets.

## 0.2.4

### Patch Changes

- Add Feishu verify/connect flow, probe API, and channel reload handling.

## 0.2.3

### Patch Changes

- Republish UI updates and refresh bundled UI assets.

## 0.2.2

### Patch Changes

- Make `nextclaw start` avoid auto-starting the frontend dev server by default.

## 0.2.1

### Patch Changes

- Add `start` command and serve bundled UI assets from the UI backend.
