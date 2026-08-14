# @nextclaw/kernel

## 0.8.2

### Patch Changes

- aa08a3f: 命令工具卡新增实时执行计时：命令真正开始后持续显示已运行时长，并在成功、失败或取消后冻结并保留耗时；刷新会话后仍可从标准 NCP 执行时间恢复。内置命令运行时与 Codex command execution 统一使用同一条计时协议，不再把排队或参数生成时间算作命令执行耗时。
- 004d51f: 增强会话工作台：概览底部新增当前会话的 Token 用量，支持按模型查看输入、输出、缓存输入、总量与缓存命中率；子会话管理页新增“新建子会话”入口，并复用侧边对话的上下文继承链路。
- Updated dependencies
- Updated dependencies [aa08a3f]
- Updated dependencies [e2a7c8e]
- Updated dependencies [004d51f]
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.18
  - @nextclaw/ncp@0.8.0
  - @nextclaw/ncp-toolkit@0.6.20
  - @nextclaw/ncp-agent-runtime@0.4.18
  - @nextclaw/ncp-agent-runtime-next@0.1.18
  - @nextclaw/core@0.17.1
  - @nextclaw/channel-extension-feishu@0.2.25
  - @nextclaw/channel-extension-weixin@0.2.25
  - @nextclaw/ncp-mcp@0.2.28
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.28
  - @nextclaw/shared@0.4.24
  - @nextclaw/mcp@0.3.28
  - @nextclaw/runtime@0.4.27

## 0.8.1

### Patch Changes

- 27d7293: Harden App, Panel App, and Service App data management with isolated instance storage, crash-safe deletion recovery, side-effect-free catalog reads, and explicit keep-or-delete uninstall controls.
- Updated dependencies [27d7293]
  - @nextclaw/app-runtime@0.12.1

## 0.8.0

### Minor Changes

- ca2c98d: 把 App 数据生命周期补齐为可管理的产品能力：App 更新继续复用原实例，卸载与 Workspace Service 删除默认保留个人数据，也可以在确认后同时永久删除 data、config、state、cache、tmp 和 logs。

  Apps 页面会显示六类数据占用、受管路径和已保留数据，并支持稍后清理；CLI 新增 `nextclaw app data list/delete`，开发态可用 `nextclaw app dev --reset-data --confirm <app-id>` 精确重置当前实例。HTTP、Client SDK、双语文档与内建自管理 Skill 同步使用同一套安全确认和 active/retained 规则。

### Patch Changes

- Updated dependencies [ca2c98d]
  - @nextclaw/app-runtime@0.12.0
  - @nextclaw/core@0.17.0
  - @nextclaw/mcp@0.3.27
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.27
  - @nextclaw/runtime@0.4.26
  - @nextclaw/ncp-mcp@0.2.27

## 0.7.0

### Minor Changes

- 298233c: 把 Mini App、Panel App 和 Service App 收敛为可安装、可更新、可卸载的统一 App 产品：每个 App Instance 现在拥有独立的 data、config、state、cache、tmp 和 logs 目录，卸载默认保留个人数据，重装时只允许同一发布者继续使用。

  更新会先安装和探测候选版本，再切换当前版本；候选 Service 启动失败、数据 schema 不兼容或代码完整性异常时，旧版本和旧数据保持可用。Apps 管理界面同时显示真实的数据位置、占用空间和运行隔离等级，原生进程会明确标注为当前用户完整权限，社区原生 Service App 不再允许直接进入公开目录。

### Patch Changes

- Updated dependencies [298233c]
  - @nextclaw/app-runtime@0.11.0

## 0.6.28

### Patch Changes

- 4be6947: 加快长会话的打开和历史加载：默认每页读取 40 条消息，空闲会话不再为首屏分页扫描完整消息索引，向上加载旧消息时也不再重复计算整段会话的上下文窗口。
- Updated dependencies [237a931]
  - @nextclaw/core@0.16.0
  - @nextclaw/app-runtime@0.10.0
  - @nextclaw/mcp@0.3.26
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.26
  - @nextclaw/runtime@0.4.25
  - @nextclaw/ncp-mcp@0.2.26

## 0.6.27

### Patch Changes

- 2542896: 将内置个人空间升级到 0.1.4：重新设计待办和日历，补齐响应式布局、编辑与失败状态、外部日历来源管理，并修复日程范围与同步数据的一致性。同时修复应用检查更新的 Registry 响应兼容问题、成功重试后仍显示历史失败的问题，以及 `app dev/call` 没有为本地 Service APP 注入隔离数据目录的问题。
- Updated dependencies
  - @nextclaw/mcp@0.3.25
  - @nextclaw/ncp-mcp@0.2.25

## 0.6.26

### Patch Changes

- 9b22a7d: 支持将文档浏览器中的文档、应用、Panel App 和网页标签添加到聊天。发送后仍可识别并重新打开对应资源，AI 也能获得当时的资源地址和页面信息。项目文件树现在会保留展开与滚动状态，刷新会覆盖全部展开目录，“全部折叠”可可靠生效，并通过低开销的按需文件监听自动反映可见目录变化。
- efb52a7: 应用市场现在按页加载并支持服务端搜索，安装、更新、版本切换与卸载在后台持续执行；同时补齐应用图标、封面、详情与失败恢复体验，并允许用户卸载内置应用后按需重新安装。

  <!-- release-note-image: en-US | images/screenshots/nextclaw-app-marketplace-en.png | NextClaw Add apps dialog showing Personal Space, Hello Notes, and Workspace Glance with their artwork and install state -->

- Updated dependencies [9b22a7d]
- Updated dependencies [efb52a7]
  - @nextclaw/shared@0.4.23
  - @nextclaw/app-runtime@0.9.15
  - @nextclaw/core@0.15.24
  - @nextclaw/mcp@0.3.24
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.25
  - @nextclaw/runtime@0.4.24
  - @nextclaw/channel-extension-feishu@0.2.24
  - @nextclaw/channel-extension-weixin@0.2.24
  - @nextclaw/ncp-mcp@0.2.24

## 0.6.25

### Patch Changes

- 7179c7a: 新增统一的系统管理对象 `@` 引用协议，首批支持收件箱报告和定时任务的分类浏览、分组搜索、不可变快照与模型上下文；`@` 面板中的文件和文件夹现在拥有独立入口、搜索分组与选择语义；收件箱“继续聊”进入带可见报告引用的聊天草稿，不再创建隐藏关联会话。
- 6b3127f: 新增完整的 Apps 与 Mini App 体验：可从内置市场发现、安装、启用、更新、回滚和卸载组合应用，并首发由待办、Markdown 笔记、收藏与日历组成的“个人空间”。应用代码按版本不可变安装，个人数据保存在稳定目录；安装事务、包完整性、运行时授权清理、远程下载预算与日历订阅网络边界也得到强化。
- Updated dependencies [7179c7a]
- Updated dependencies [6b3127f]
  - @nextclaw/shared@0.4.22
  - @nextclaw/app-runtime@0.9.14
  - @nextclaw/core@0.15.23
  - @nextclaw/mcp@0.3.23
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.24
  - @nextclaw/runtime@0.4.23
  - @nextclaw/channel-extension-feishu@0.2.23
  - @nextclaw/channel-extension-weixin@0.2.23
  - @nextclaw/ncp-mcp@0.2.23

## 0.6.24

### Patch Changes

- c783019: Native 会话现在会并行执行同一轮中的只读文件、图片、网页和记忆查询，同时让写入、命令和未明确声明安全的工具继续独占执行；多个查询可以更快返回，工具结果仍按原调用位置回填，后续模型回复不会因完成顺序不同而错位。
- 0b7df97: 改善 Web Chat 长连接的稳定性：空闲 SSE 现在会主动保活，短暂断流可在后台补齐会话并重连，不再立即展示无意义的网络错误；持续连接失败仍会明确提示。启动恢复同时改为逐会话、逐行扫描历史日志，降低大 journal 场景的峰值内存和 OOM 风险。
- 7786bdf: 移除无法可靠完成会话恢复的 agent `gateway.restart` 能力；需要重启时，现在统一提示用户在外部终端运行顶层 `nextclaw restart`，并明确 `nextclaw gateway` 仅用于启动前台 gateway、不提供生命周期子命令。
- Updated dependencies [c783019]
- Updated dependencies [7786bdf]
  - @nextclaw/core@0.15.22
  - @nextclaw/ncp-agent-runtime-next@0.1.17
  - @nextclaw/ncp@0.7.17
  - @nextclaw/mcp@0.3.22
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.23
  - @nextclaw/runtime@0.4.22
  - @nextclaw/channel-extension-feishu@0.2.22
  - @nextclaw/channel-extension-weixin@0.2.22
  - @nextclaw/ncp-agent-runtime@0.4.17
  - @nextclaw/ncp-mcp@0.2.22
  - @nextclaw/ncp-toolkit@0.6.19
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.17
  - @nextclaw/shared@0.4.21

## 0.6.23

### Patch Changes

- 4ab158d: 渠道扩展改为按需启动：未启用渠道不再常驻独立 Node 进程，运行中启用或禁用渠道会自动创建或回收对应扩展；同时增加 ready/generation 隔离、鉴权会话租约、有限故障恢复和扩展进程内存诊断。

  在 ARM64 Linux、2 vCPU / 2 GiB 限制和无活跃任务的空配置基准中，三轮平均 working set 从旧版本约 865～885 MiB 降至 164.94 MiB，下降约 81%。活跃 Agent runtime、浏览器、MCP、本地模型和已启用渠道仍会按实际工作增加内存占用。

- c54a1d9: 支持划选稳定的 AI 或用户历史消息并作为结构化片段添加到聊天；输入框与发送后保持一致的紧凑引用展示，AI 会收到选中时的精确快照。文件预览和会话消息共用新的划选浮层：拖选期间不追随鼠标，松手后下一帧立即出现并自动避让视口边界。
- Updated dependencies [4ab158d]
- Updated dependencies [c54a1d9]
  - @nextclaw/shared@0.4.20
  - @nextclaw/channel-extension-feishu@0.2.21
  - @nextclaw/channel-extension-weixin@0.2.21
  - @nextclaw/core@0.15.21
  - @nextclaw/mcp@0.3.21
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.22
  - @nextclaw/runtime@0.4.21
  - @nextclaw/ncp-mcp@0.2.21

## 0.6.22

### Patch Changes

- c3eb33c: 修复聊天失败时同一供应商错误在对话区和输入框重复显示、视觉提示过强且原始响应被截断的问题；错误现在只在对话区以低干扰样式显示一次，正文保留供应商返回的完整内容，并在内容较长时通过限高滚动查看。
- 8049f49: 支持直接编辑当前会话最近一条用户消息并在同一会话继续执行；中断或失败后可从输入框或最近一条 AI 回复继续运行，后续输出会直接续写原回复而不是新增消息气泡，并准确区分续写前后成功与取消的工具操作。编辑器会自动聚焦到末尾，运行中隐藏编辑操作，所有纯图标入口均提供明确提示；切换模型时会继续保留可用的恢复入口。
- ae21568: 修复运行中断或服务重启后，较早的助手回复偶尔排到后来用户消息之后的问题；聊天记录会按实际时间线稳定显示，并自动重建已有的错误消息索引。
- 38e3e98: 修复通过 NARP stdio 运行时发送图片时附件被降级为纯文本的问题，保留附件顺序和文件元数据，并在本地资源无法解析时返回明确错误。
- b507e1c: 切换会话模型后，AI 会在当前会话上下文中收到本轮实际执行的 provider/model 标识，避免把全局默认模型或历史模型自述误当成当前模型。
- e309470: 搜索设置新增 Exa 提供商：可配置 API Key 与自定义 Base URL，并使用统一的全局结果数量上限执行语义搜索和网页正文提取。感谢 [@suantea](https://github.com/suantea) 通过 [#23](https://github.com/Peiiii/nextclaw/pull/23) 贡献这项能力。
- 31d5655: 让 AI 在整理新闻、报告、推荐或文章后说“发给我”时，优先投递到 NextClaw 收件箱；只有明确指定微信、飞书等外部渠道时才使用跨渠道消息。
- 8e53d92: Native 会话会在同一次长任务的工具调用轮次之间自动压缩上下文；压缩输入、输出和最终 checkpoint 使用包含工具 schema 与输出预留的同一动态预算，压缩后除完整摘要外还会按 token 预算保留最近的真实用户原文。上下文指示器会按完整输入显示系统与工具、会话内容、自动压缩线和输出预留。Agent 配置会按当前指令与全量工具动态拒绝不可用的小窗口；send、继续运行和编辑重跑共享同一运行状态入口，进程中断统一恢复为可继续的中性终态。运行中压缩与 continuation 前压缩会稳定显示在对应助手过程位置，刷新后不再堆到消息末尾。
- bf3ff68: Panel App 在全局面板中刷新或重新挂载后会恢复到用户刚才阅读的滚动位置；异步加载内容时，会等页面布局就绪后再完成恢复。
- 071c144: 增加提供商模型目录获取与后台自动刷新：Kimi 现在也能在提供商设置中获取当前模型列表，并参与每 12 小时的目录刷新；未填写 API Key 或上游拒绝鉴权时会直接给出可操作的本地化提示，不再展示原始英文 401，后台目录失败也不再被其他 Provider 的刷新状态拖成持续加载。其他尚未确认支持模型目录的提供商继续支持手工配置。候选只保留文本输出的聊天 LLM，图像、视频、语音、Embedding、Rerank 与 Moderation 模型不会进入聊天配置。聊天模型选择器只在展开后提示上次已见基线之后真正新增的模型，并支持“本批不再提醒”；首次大目录不会制造数百条提醒。具体提供商页会自动提示对应差集，超过 50 个候选时隐藏“全部添加”、支持搜索并只渲染前 50 个匹配项；已配置模型也可进入批量删除模式后全选或删除所选。显式获取、自动刷新和批量操作都只修改当前草稿或目录快照，不会绕过用户保存。
- 08325d3: 新任务现在可以在发送首条消息前打开项目文件，并可随时切回默认工作目录；项目文件树与已打开文件页签共用统一操作菜单，可通过“更多操作”或右键添加到聊天，文件树的展开与滚动状态会在工作台切换后保留，首条消息创建正式会话时已打开的工作台也不会再关闭后闪回。文本型文件预览支持划选片段添加到聊天，引用会携带来源、位置、字符数量与选中快照，发送后可返回源文件，AI 也能准确读取该片段；输入框中的结构化引用支持复制、剪切和粘贴。文件、目录、项目、技能与文本片段在输入框和已发送消息中统一使用紧凑标签与语义图标。修复项目文件引用发送后丢失、AI 无法感知引用、引用后续正文被错误显示为链接，以及默认 workspace 会话中已发送文件引用点击无反应的问题。
- Updated dependencies [c3eb33c]
- Updated dependencies [8049f49]
- Updated dependencies [ae21568]
- Updated dependencies [38e3e98]
- Updated dependencies [98c5b7f]
- Updated dependencies [e309470]
- Updated dependencies [31d5655]
- Updated dependencies [8e53d92]
- Updated dependencies [bf3ff68]
- Updated dependencies [071c144]
- Updated dependencies [08325d3]
  - @nextclaw/core@0.15.20
  - @nextclaw/shared@0.4.19
  - @nextclaw/ncp-toolkit@0.6.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.21
  - @nextclaw/ncp-agent-runtime-next@0.1.16
  - @nextclaw/ncp@0.7.16
  - @nextclaw/runtime@0.4.20
  - @nextclaw/mcp@0.3.20
  - @nextclaw/channel-extension-feishu@0.2.20
  - @nextclaw/channel-extension-weixin@0.2.20
  - @nextclaw/ncp-agent-runtime@0.4.16
  - @nextclaw/ncp-mcp@0.2.20
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.16

## 0.6.21

### Patch Changes

- dbececb: 修复并发消息完成时聊天记录偶发重叠的问题，并隐藏静默回复遗留的异常文本。
- 43b0e1d: 让全新安装的 NextClaw 默认接入 OpenCode Zen 当前可调用的七个免费试用模型，无需填写 API Key 即可在模型选择器中直接选择并开始聊天；已有其他提供商配置保持不变，已失效的 Ling 免费模型会从 OpenCode 配置中移除，并明确提示公共网关的限额、模型变化与数据隐私边界。
- 14f321a: 会话列表中的思考、工具调用、运行失败与意外中断预览会跟随界面语言显示；已有会话中保存的英文活动预览也会按当前语言呈现。
- Updated dependencies [dbececb]
- Updated dependencies [43b0e1d]
  - @nextclaw/shared@0.4.18
  - @nextclaw/core@0.15.19
  - @nextclaw/ncp-toolkit@0.6.17
  - @nextclaw/runtime@0.4.19
  - @nextclaw/mcp@0.3.19
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.20
  - @nextclaw/channel-extension-feishu@0.2.19
  - @nextclaw/channel-extension-weixin@0.2.19
  - @nextclaw/ncp-mcp@0.2.19

## 0.6.20

### Patch Changes

- 5b9dbcd: 新增 AI 主动送达收件箱：支持 Markdown 与隔离 HTML 报告、未读与归档管理、单窗阅读、文件快照送达，以及从送达内容继续创建上下文关联会话。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-ai-delivery-inbox-cn.png | AI 将项目晨报主动送达到 NextClaw 收件箱 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-ai-delivery-inbox-en.png | AI delivering a project brief to the NextClaw inbox -->
  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-ai-delivery-html-cn.png | 后台 Agent 生成的每日 AI 与科技简报在收件箱阅读窗中展示 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-ai-delivery-html-en.png | A daily AI and technology briefing created by a background Agent and displayed in the inbox reader -->
  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-inbox-page-cn.png | 在 NextClaw 收件箱集中查看和管理 AI 主动送达的报告 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-inbox-page-en.png | Viewing and managing AI-delivered reports in the NextClaw inbox -->

- Updated dependencies [5b9dbcd]
  - @nextclaw/shared@0.4.17
  - @nextclaw/core@0.15.18
  - @nextclaw/mcp@0.3.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.19
  - @nextclaw/runtime@0.4.18
  - @nextclaw/channel-extension-feishu@0.2.18
  - @nextclaw/channel-extension-weixin@0.2.18
  - @nextclaw/ncp-mcp@0.2.18

## 0.6.19

### Patch Changes

- 215a61f: 聊天输入框现在可以通过 `@` 选择已登记项目，并把项目名称、路径和目录概览作为本次消息的显式上下文。
- Updated dependencies
- Updated dependencies [d80eeb2]
- Updated dependencies [215a61f]
  - @nextclaw/channel-extension-feishu@0.2.17
  - @nextclaw/channel-extension-weixin@0.2.17
  - @nextclaw/core@0.15.17
  - @nextclaw/mcp@0.3.17
  - @nextclaw/ncp-agent-runtime@0.4.15
  - @nextclaw/ncp-agent-runtime-next@0.1.15
  - @nextclaw/ncp-mcp@0.2.17
  - @nextclaw/ncp-toolkit@0.6.16
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.15
  - @nextclaw/runtime@0.4.17
  - @nextclaw/ncp@0.7.15
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.18
  - @nextclaw/shared@0.4.16

## 0.6.18

### Patch Changes

- c35189d: Codex 和 Claude Code agent runtime 现在会保留各自原生系统提示词，并默认追加 NextClaw 产品指令、工作区上下文与 skill 信息；可通过 `nextclaw agents runtime config` 按 runtime 关闭或恢复注入。
- 77208ed: Panel App 与 HTML 文件展示现在支持传入结构化参数；页面可在首次脚本执行时通过只读的 `window.nextclaw.params` 使用这些运行时数据。
- 5476d85: Agent 现在会根据比较、流程、层级和数值关系主动选择更清楚的表格或 Mermaid 图示；简单问题仍保持简洁文字回答。
- Updated dependencies [c35189d]
- Updated dependencies
- Updated dependencies [77208ed]
  - @nextclaw/ncp@0.7.14
  - @nextclaw/core@0.15.16
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.17
  - @nextclaw/channel-extension-feishu@0.2.16
  - @nextclaw/channel-extension-weixin@0.2.16
  - @nextclaw/mcp@0.3.16
  - @nextclaw/ncp-agent-runtime@0.4.14
  - @nextclaw/ncp-agent-runtime-next@0.1.14
  - @nextclaw/ncp-mcp@0.2.16
  - @nextclaw/ncp-toolkit@0.6.15
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.14
  - @nextclaw/runtime@0.4.16
  - @nextclaw/shared@0.4.15

## 0.6.17

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
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.2.15
  - @nextclaw/channel-extension-weixin@0.2.15
  - @nextclaw/core@0.15.15
  - @nextclaw/mcp@0.3.15
  - @nextclaw/ncp@0.7.13
  - @nextclaw/ncp-agent-runtime@0.4.13
  - @nextclaw/ncp-agent-runtime-next@0.1.13
  - @nextclaw/ncp-mcp@0.2.15
  - @nextclaw/ncp-toolkit@0.6.14
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.13
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.16
  - @nextclaw/runtime@0.4.15
  - @nextclaw/shared@0.4.14

## 0.6.16

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
  - @nextclaw/runtime
  - @nextclaw/shared

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.2.14
  - @nextclaw/channel-extension-weixin@0.2.14
  - @nextclaw/core@0.15.14
  - @nextclaw/mcp@0.3.14
  - @nextclaw/ncp@0.7.12
  - @nextclaw/ncp-agent-runtime@0.4.12
  - @nextclaw/ncp-agent-runtime-next@0.1.12
  - @nextclaw/ncp-mcp@0.2.14
  - @nextclaw/ncp-toolkit@0.6.13
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.12
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.15
  - @nextclaw/runtime@0.4.14
  - @nextclaw/shared@0.4.13

## 0.6.15

### Patch Changes

- 80eda82: 聊天消息现在会显式保存技能的名称、来源与文件路径；点击技能可直接打开对应 `SKILL.md` 预览，旧消息无法解析时也会显示明确错误。
- e9d49c0: 会话正在回复时继续发送的消息现在由后端按会话排队，并会在当前回复完成后按顺序执行；切换会话或刷新页面后仍能查看、编辑和删除对应会话的待发消息。
- Updated dependencies
- Updated dependencies [80eda82]
- Updated dependencies [e9d49c0]
  - @nextclaw/channel-extension-feishu@0.2.13
  - @nextclaw/channel-extension-weixin@0.2.13
  - @nextclaw/core@0.15.13
  - @nextclaw/mcp@0.3.13
  - @nextclaw/ncp@0.7.11
  - @nextclaw/ncp-agent-runtime@0.4.11
  - @nextclaw/ncp-agent-runtime-next@0.1.11
  - @nextclaw/ncp-mcp@0.2.13
  - @nextclaw/ncp-toolkit@0.6.12
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.11
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.14
  - @nextclaw/runtime@0.4.13
  - @nextclaw/shared@0.4.12

## 0.6.14

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
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
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.2.12
  - @nextclaw/channel-extension-weixin@0.2.12
  - @nextclaw/core@0.15.12
  - @nextclaw/mcp@0.3.12
  - @nextclaw/ncp@0.7.10
  - @nextclaw/ncp-agent-runtime@0.4.10
  - @nextclaw/ncp-agent-runtime-next@0.1.10
  - @nextclaw/ncp-mcp@0.2.12
  - @nextclaw/ncp-toolkit@0.6.11
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.10
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.13
  - @nextclaw/runtime@0.4.12
  - @nextclaw/shared@0.4.11

## 0.6.13

### Patch Changes

- 36c5362: 新增会话级手动上下文压缩命令，统一通过 Kernel runtime capability 调用 Native 压缩链路或 Codex `thread/compact/start`，并为不支持、会话忙碌和无可压缩历史提供明确反馈。
- d116010: 允许 `show_panel_app` 通过可选绝对路径打开标准 Panels 目录之外的 Panel App，并让侧栏与聊天内联展示复用同一份路径合同和资源加载链路。
- Updated dependencies [36c5362]
- Updated dependencies
- Updated dependencies [d116010]
  - @nextclaw/ncp@0.7.9
  - @nextclaw/channel-extension-feishu@0.2.11
  - @nextclaw/channel-extension-weixin@0.2.11
  - @nextclaw/core@0.15.11
  - @nextclaw/mcp@0.3.11
  - @nextclaw/ncp-agent-runtime@0.4.9
  - @nextclaw/ncp-agent-runtime-next@0.1.9
  - @nextclaw/ncp-mcp@0.2.11
  - @nextclaw/ncp-toolkit@0.6.10
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.12
  - @nextclaw/runtime@0.4.11
  - @nextclaw/shared@0.4.10

## 0.6.12

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
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
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.2.10
  - @nextclaw/channel-extension-weixin@0.2.10
  - @nextclaw/core@0.15.10
  - @nextclaw/mcp@0.3.10
  - @nextclaw/ncp@0.7.8
  - @nextclaw/ncp-agent-runtime@0.4.8
  - @nextclaw/ncp-agent-runtime-next@0.1.8
  - @nextclaw/ncp-mcp@0.2.10
  - @nextclaw/ncp-toolkit@0.6.9
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.8
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.11
  - @nextclaw/runtime@0.4.10
  - @nextclaw/shared@0.4.9

## 0.6.11

### Patch Changes

- 61f6bd1: 长会话现在会按需加载较早消息，并使用动态高度虚拟列表保持流畅滚动。HTML、Panel App 与折叠内容展开或收起时会自动校准高度，向上翻页时继续保持当前阅读位置。
- 97bca64: Add a built-in Agent Browser workflow and guide agents to use it as a distinct browser path when configured web search is unavailable.
- dad7880: Show the official OpenCode runtime icon and align Native runtime fallback styling across session selectors.
- c727720: 内联 Panel App 现在与 HTML 预览使用同一套简约表面：移除常驻标题、边框与阴影，操作仅在悬浮或键盘聚焦时出现，并根据内容高度自适应展示；可见区域最多占视口高度的 90%，硬上限提高到 1440px。
- ddc3213: 为每条 AI 回复记录实际运行模型与 token 用量，在消息底部使用统一的 `k`、`m`、`b` 单位展示输入和输出统计，并可通过更多操作查看缓存、总量、调用次数和完整运行元数据。
- Updated dependencies [61f6bd1]
- Updated dependencies [97bca64]
- Updated dependencies [c727720]
- Updated dependencies
- Updated dependencies [1f99bb8]
- Updated dependencies [ddc3213]
  - @nextclaw/ncp@0.7.7
  - @nextclaw/ncp-toolkit@0.6.8
  - @nextclaw/shared@0.4.8
  - @nextclaw/core@0.15.9
  - @nextclaw/channel-extension-feishu@0.2.9
  - @nextclaw/channel-extension-weixin@0.2.9
  - @nextclaw/mcp@0.3.9
  - @nextclaw/ncp-agent-runtime@0.4.7
  - @nextclaw/ncp-mcp@0.2.9
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.7
  - @nextclaw/runtime@0.4.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.10
  - @nextclaw/ncp-agent-runtime-next@0.1.7

## 0.6.10

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
  - @nextclaw/channel-extension-feishu@0.2.8
  - @nextclaw/channel-extension-weixin@0.2.8
  - @nextclaw/core@0.15.8
  - @nextclaw/mcp@0.3.8
  - @nextclaw/ncp@0.7.6
  - @nextclaw/ncp-agent-runtime@0.4.6
  - @nextclaw/ncp-agent-runtime-next@0.1.6
  - @nextclaw/ncp-mcp@0.2.8
  - @nextclaw/ncp-toolkit@0.6.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.9
  - @nextclaw/runtime@0.4.8
  - @nextclaw/shared@0.4.7

## 0.6.9

### Patch Changes

- 0111b09: 让桌面端与 NPM 安装态在持续运行期间固定每两小时自动检查更新，不再提供关闭自动检查或启用自动下载的配置；发现新版本后只提示用户，由用户明确点击后才下载和应用。更新通道切换会等待旧检查收口后检查新通道，避免复用过期结果。同步增强本地更新验证，使开发者无需等待真实发版或重启即可验证自动发现、手动下载、应用和版本切换。
- Updated dependencies
- Updated dependencies [0111b09]
  - @nextclaw/channel-extension-feishu@0.2.7
  - @nextclaw/channel-extension-weixin@0.2.7
  - @nextclaw/core@0.15.7
  - @nextclaw/mcp@0.3.7
  - @nextclaw/ncp@0.7.5
  - @nextclaw/ncp-agent-runtime@0.4.5
  - @nextclaw/ncp-agent-runtime-next@0.1.5
  - @nextclaw/ncp-mcp@0.2.7
  - @nextclaw/ncp-toolkit@0.6.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.5
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.8
  - @nextclaw/runtime@0.4.7
  - @nextclaw/shared@0.4.6

## 0.6.8

### Patch Changes

- a9b125f: 增强可视化结果生成指引：Agent 会在结果适合展示时主动选择 Markdown、图表、图片或内联 HTML；内联页面保持单一焦点、自然高度和无嵌套外卡，完成后只保留可视结果，不再重复显示前后的文字复述。
- Updated dependencies [a9b125f]
- Updated dependencies [8f7e915]
  - @nextclaw/core@0.15.6
  - @nextclaw/shared@0.4.5
  - @nextclaw/mcp@0.3.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.7
  - @nextclaw/runtime@0.4.6
  - @nextclaw/ncp-mcp@0.2.6
  - @nextclaw/channel-extension-feishu@0.2.6
  - @nextclaw/channel-extension-weixin@0.2.6

## 0.6.7

### Patch Changes

- 00c0d23: 上下文压缩现在始终沿用当前会话所选模型；压缩请求失败时不会留下半完成状态，切换到可用模型后可以直接继续会话。

## 0.6.6

### Patch Changes

- 2eceb16: 聊天输入框现在支持通过 `@` 搜索并引用当前项目中的文件或目录：可从统一引用菜单进入文件浏览、查看路径层级并插入引用标签，发送时由 NextClaw 在项目边界内安全、限量地补充对应文件内容或目录结构上下文。
- 59a4723: 新增独立项目注册表与项目模板：项目可以在没有会话时通过界面、CLI 或 AI 创建并展示；界面提供支持导航、搜索和新建文件夹的跨平台服务端目录选择器，并按 macOS、Windows 与 Linux 展示实际可用的常用位置；CLI 与 AI 还可列出项目、修改会话名称及项目目录。
- Updated dependencies [2eceb16]
- Updated dependencies [25f8bb0]
- Updated dependencies [59a4723]
- Updated dependencies [8be3173]
  - @nextclaw/shared@0.4.4
  - @nextclaw/ncp@0.7.4
  - @nextclaw/ncp-toolkit@0.6.5
  - @nextclaw/core@0.15.5
  - @nextclaw/channel-extension-feishu@0.2.5
  - @nextclaw/channel-extension-weixin@0.2.5
  - @nextclaw/ncp-agent-runtime@0.4.4
  - @nextclaw/ncp-agent-runtime-next@0.1.4
  - @nextclaw/ncp-mcp@0.2.5
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.6
  - @nextclaw/mcp@0.3.5
  - @nextclaw/runtime@0.4.5

## 0.6.5

### Patch Changes

- 378c8b9: 优化 Agent 最终回复的展示组织，统一 Markdown、内联展示与侧栏展示提示；聊天消息现在支持稳定的流式 Mermaid 图表，并允许复制用户消息。
- 401854e: 聊天框斜杠选择器、底部技能选择器和 Agent 上下文现在会区分项目、NextClaw、全局与内建技能来源；项目技能从项目 `.agents/skills` 加载，项目 `AGENTS.md` 也会随会话上下文生效。
- Updated dependencies [401854e]
  - @nextclaw/core@0.15.4
  - @nextclaw/mcp@0.3.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.5
  - @nextclaw/runtime@0.4.4
  - @nextclaw/ncp-mcp@0.2.4

## 0.6.4

### Patch Changes

- 91f7bef: Keep valid Markdown resources clickable independently of target availability, render local Markdown images and SVG files correctly, add responsive Word, Excel, and PowerPoint workspace previews, preserve automatic viewers outside HTML source mode, and keep chat popovers open when the streaming composer restores focus.
- Updated dependencies [7853b3b]
  - @nextclaw/ncp-toolkit@0.6.4
  - @nextclaw/channel-extension-feishu@0.2.4
  - @nextclaw/channel-extension-weixin@0.2.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.4

## 0.6.3

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
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
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.2.3
  - @nextclaw/channel-extension-weixin@0.2.3
  - @nextclaw/core@0.15.3
  - @nextclaw/mcp@0.3.3
  - @nextclaw/ncp@0.7.3
  - @nextclaw/ncp-agent-runtime@0.4.3
  - @nextclaw/ncp-agent-runtime-next@0.1.3
  - @nextclaw/ncp-mcp@0.2.3
  - @nextclaw/ncp-toolkit@0.6.3
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.3
  - @nextclaw/runtime@0.4.3
  - @nextclaw/shared@0.4.3

## 0.6.2

### Patch Changes

- 94c5ab6: Treat incomplete OpenAI Responses streams as failed runs instead of successful partial answers, retry transient native model stream failures with OpenCode-style retry metadata and backoff, and record lightweight execution contracts in message run specs for debugging.
- Updated dependencies
- Updated dependencies [51cf740]
- Updated dependencies [94c5ab6]
  - @nextclaw/channel-extension-feishu@0.2.2
  - @nextclaw/channel-extension-weixin@0.2.2
  - @nextclaw/mcp@0.3.2
  - @nextclaw/ncp@0.7.2
  - @nextclaw/ncp-mcp@0.2.2
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.2
  - @nextclaw/runtime@0.4.2
  - @nextclaw/shared@0.4.2
  - @nextclaw/ncp-agent-runtime@0.4.2
  - @nextclaw/core@0.15.2
  - @nextclaw/ncp-agent-runtime-next@0.1.2
  - @nextclaw/ncp-toolkit@0.6.2

## 0.6.1

### Patch Changes

- 1cc5d4e: Use English defaults for backend, runtime, and protocol-generated session status and abort messages, and carry abort details through NCP events so localized UI can own translation instead of receiving hard-coded Chinese copy.
- 09b7406: Preserve the current user turn during context compaction, fold compressed context into the leading system prompt, and suppress fresh-session onboarding templates after rollover so compressed NCP/native conversations continue coherently.
- e6a3443: Keep local HTML file links on source preview by default, and open rendered HTML only when show_file or the link viewer query explicitly requests it.
- a006bb7: Treat user-cancelled chat runs as cancelled session activity instead of failed errors, and keep cancelled runs out of the conversation error surface.
- Updated dependencies [7e94f21]
- Updated dependencies [1cc5d4e]
- Updated dependencies [09b7406]
- Updated dependencies [e6a3443]
- Updated dependencies [1cc5d4e]
  - @nextclaw/core@0.15.1
  - @nextclaw/ncp@0.7.1
  - @nextclaw/ncp-agent-runtime-next@0.1.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.1
  - @nextclaw/mcp@0.3.1
  - @nextclaw/runtime@0.4.1
  - @nextclaw/channel-extension-feishu@0.2.1
  - @nextclaw/channel-extension-weixin@0.2.1
  - @nextclaw/ncp-agent-runtime@0.4.1
  - @nextclaw/ncp-mcp@0.2.1
  - @nextclaw/ncp-toolkit@0.6.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.1
  - @nextclaw/shared@0.4.1

## 0.6.0

### Minor Changes

- Publish the full public NextClaw workspace as a stable minor release.

### Patch Changes

- 34f4048: Record the resolved agent run spec on the triggering user message metadata for lightweight failure diagnostics.
- bf1917a: Add inert `nextclaw-inline` Markdown code blocks for inline display declarations, keep model-visible show-content tools side-panel only without a `placement` parameter, and render inline Panel App declarations without a side-panel expand action.
- 33a931f: Add standard NCP event timing and message lifecycle fields so completed assistant process summaries can show real elapsed time derived from started and ended timestamps.
  Stamp first-party runtime, transport, and extension-produced NCP events at their producer boundary instead of estimating duration in UI or journal consumers.
  Make Codex app-server aborts emit the standard NCP abort event promptly so the conversation leaves the running state without waiting for another app-server notification.
- 0c06d9d: Fix false error previews for completed chat sessions whose activity preview was left in a running state.
- 7bcc180: Split the model-facing `show_content` display tool into `show_file`, `show_url`, and `show_panel_app` so required display parameters are explicit JSON Schema properties instead of nested description-only payload fields.
- 2d9d1b7: Add a rendered file-preview viewer for `show_content` so agents can open local HTML/page prototypes in the chat workspace side panel.
- 7bcc180: Open `show_url` targets as browser-like content tabs with address, refresh, external-open controls, and local development server guidance.
- b0cb8c2: Add a `view_image` core agent tool that lets models read local PNG, JPEG, WebP, and GIF files as visual input while preserving the existing workspace restriction policy when enabled.
- Updated dependencies [3cf5890]
- Updated dependencies [bf1917a]
- Updated dependencies
- Updated dependencies [6600b99]
- Updated dependencies [61e7a7a]
- Updated dependencies [549fb8a]
- Updated dependencies [33a931f]
- Updated dependencies [7bcc180]
- Updated dependencies [2d9d1b7]
- Updated dependencies [7bcc180]
- Updated dependencies [b0cb8c2]
  - @nextclaw/ncp-agent-runtime@0.4.0
  - @nextclaw/core@0.15.0
  - @nextclaw/channel-extension-feishu@0.2.0
  - @nextclaw/channel-extension-weixin@0.2.0
  - @nextclaw/mcp@0.3.0
  - @nextclaw/ncp@0.7.0
  - @nextclaw/ncp-agent-runtime-next@0.1.0
  - @nextclaw/ncp-mcp@0.2.0
  - @nextclaw/ncp-toolkit@0.6.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.0
  - @nextclaw/runtime@0.4.0
  - @nextclaw/shared@0.4.0

## 0.5.4

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
  - @nextclaw/channel-extension-feishu@0.1.28
  - @nextclaw/channel-extension-weixin@0.1.32
  - @nextclaw/core@0.14.8
  - @nextclaw/mcp@0.2.18
  - @nextclaw/ncp@0.6.6
  - @nextclaw/ncp-agent-runtime@0.3.47
  - @nextclaw/ncp-agent-runtime-next@0.0.19
  - @nextclaw/ncp-mcp@0.1.113
  - @nextclaw/ncp-toolkit@0.5.41
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.16
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.17
  - @nextclaw/runtime@0.3.18
  - @nextclaw/shared@0.3.3

## 0.5.4-beta.0

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
  - @nextclaw/channel-extension-feishu@0.1.28-beta.0
  - @nextclaw/channel-extension-weixin@0.1.32-beta.0
  - @nextclaw/core@0.14.8-beta.0
  - @nextclaw/mcp@0.2.18-beta.0
  - @nextclaw/ncp@0.6.6-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.47-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.19-beta.0
  - @nextclaw/ncp-mcp@0.1.113-beta.0
  - @nextclaw/ncp-toolkit@0.5.41-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.16-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.17-beta.0
  - @nextclaw/runtime@0.3.18-beta.0
  - @nextclaw/shared@0.3.3-beta.0

## 0.5.3

### Patch Changes

- 901f770: Fix default workspace handling so Docker sessions no longer treat the default workspace symbol as a project override, and hide that default symbol from recent project choices.
- Updated dependencies [901f770]
  - @nextclaw/core@0.14.7
  - @nextclaw/mcp@0.2.17
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.16
  - @nextclaw/runtime@0.3.17
  - @nextclaw/ncp-mcp@0.1.112

## 0.5.2

### Patch Changes

- 993fbb8: Add opt-in parent context inheritance for child sessions spawned through `sessions_spawn`. Child sessions can now inherit parent messages up to the spawn anchor, and the chat timeline marks inherited context at the start of the message list.
- 6586a69: Add a Side chat slash command before skill entries in the slash panel. The command opens a right-side draft child conversation, keeps backend session creation deferred until the first send, and materializes that first send into an inherited child session.
- Updated dependencies
- Updated dependencies [993fbb8]
- Updated dependencies [d406755]
- Updated dependencies [6586a69]
  - @nextclaw/channel-extension-feishu@0.1.27
  - @nextclaw/channel-extension-weixin@0.1.31
  - @nextclaw/mcp@0.2.16
  - @nextclaw/ncp@0.6.5
  - @nextclaw/ncp-agent-runtime@0.3.46
  - @nextclaw/ncp-agent-runtime-next@0.0.18
  - @nextclaw/ncp-mcp@0.1.111
  - @nextclaw/ncp-toolkit@0.5.40
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.15
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.15
  - @nextclaw/runtime@0.3.16
  - @nextclaw/core@0.14.6
  - @nextclaw/shared@0.3.2

## 0.5.1

### Patch Changes

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- 31601cd: Fix Claude Code NCP sessions showing completed tool calls as perpetually running.
- 13b1d96: Fix Codex NARP sessions getting stuck after prompt timeouts and restore completed activity previews.
- 9c02046: Stop extension processes from surviving their service runtime by passing the parent service PID to extension children, shutting down extensions during service signal cleanup, exiting SDK processes when their parent disappears, sweeping legacy orphan channel extension processes on startup, preflighting QQ gateway session quota, waiting for the quota reset before retrying, and surfacing QQ gateway close errors before the startup timeout.
- 595cc16: Add inline placement for `show_content` panel app results so chat messages can render lightweight embedded Panel App cards while keeping the existing side-panel expansion path.
- 5117e15: Clarify that inline Panel Apps are a card-specific delivery form, add landscape-first card experience guidance for built-in app creation prompts, and render inline Panel Apps as pure bounded chat cards with a side-panel expand affordance.
- d82790a: Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
- Updated dependencies [f8dfffa]
- Updated dependencies [7067713]
- Updated dependencies
- Updated dependencies [31601cd]
- Updated dependencies [13b1d96]
- Updated dependencies [595cc16]
- Updated dependencies [b7fb4ab]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
- Updated dependencies [07d776b]
  - @nextclaw/channel-extension-feishu@0.1.26
  - @nextclaw/channel-extension-weixin@0.1.30
  - @nextclaw/mcp@0.2.15
  - @nextclaw/ncp-agent-runtime@0.3.45
  - @nextclaw/ncp-mcp@0.1.110
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14
  - @nextclaw/runtime@0.3.15
  - @nextclaw/core@0.14.5
  - @nextclaw/ncp@0.6.4
  - @nextclaw/ncp-agent-runtime-next@0.0.17
  - @nextclaw/ncp-toolkit@0.5.39
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14
  - @nextclaw/shared@0.3.1

## 0.5.1-beta.1

### Patch Changes

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- 9c02046: Stop extension processes from surviving their service runtime by passing the parent service PID to extension children, shutting down extensions during service signal cleanup, exiting SDK processes when their parent disappears, sweeping legacy orphan channel extension processes on startup, preflighting QQ gateway session quota, waiting for the quota reset before retrying, and surfacing QQ gateway close errors before the startup timeout.
- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.26-beta.1
  - @nextclaw/channel-extension-weixin@0.1.30-beta.1
  - @nextclaw/core@0.14.5-beta.1
  - @nextclaw/mcp@0.2.15-beta.1
  - @nextclaw/ncp@0.6.4-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.45-beta.1
  - @nextclaw/ncp-agent-runtime-next@0.0.17-beta.1
  - @nextclaw/ncp-mcp@0.1.110-beta.1
  - @nextclaw/ncp-toolkit@0.5.39-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14-beta.1
  - @nextclaw/runtime@0.3.15-beta.1
  - @nextclaw/shared@0.3.1-beta.1

## 0.5.1-beta.0

### Patch Changes

- 13b1d96: Fix Codex NARP sessions getting stuck after prompt timeouts and restore completed activity previews.
- 595cc16: Add inline placement for `show_content` panel app results so chat messages can render lightweight embedded Panel App cards while keeping the existing side-panel expansion path.
- 5117e15: Clarify that inline Panel Apps are a card-specific delivery form, add landscape-first card experience guidance for built-in app creation prompts, and render inline Panel Apps as pure bounded chat cards with a side-panel expand affordance.
- d82790a: Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
- Updated dependencies
- Updated dependencies [13b1d96]
- Updated dependencies [595cc16]
- Updated dependencies [b7fb4ab]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
- Updated dependencies [07d776b]
  - @nextclaw/channel-extension-feishu@0.1.26-beta.0
  - @nextclaw/channel-extension-weixin@0.1.30-beta.0
  - @nextclaw/mcp@0.2.15-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.45-beta.0
  - @nextclaw/ncp-mcp@0.1.110-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14-beta.0
  - @nextclaw/runtime@0.3.15-beta.0
  - @nextclaw/core@0.14.5-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14-beta.0
  - @nextclaw/shared@0.3.1-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.17-beta.0
  - @nextclaw/ncp@0.6.4-beta.0
  - @nextclaw/ncp-toolkit@0.5.39-beta.0

## 0.5.0

### Minor Changes

- c4ee481: Add the show_content chat display action so agents can ask the UI to open file, URL, or installed panel app content from tool results and realtime UI events.

### Patch Changes

- 89f2f73: Fix ACP stdio runtime failures in local dev by preventing dev-only Node export conditions from leaking into external runtime child processes, and surface child stderr in runtime errors.
- d2ca679: Persist NARP runtime session metadata updates so Codex thread ids are bound back to NextClaw sessions across restarts, and wait for Codex SDK thread metadata writers before continuing a run.
- 3624bbb: Allow NARP runtimes to use their own default model instead of always receiving a NextClaw model override.
- Updated dependencies [89f2f73]
- Updated dependencies
- Updated dependencies [c4ee481]
- Updated dependencies [d2ca679]
- Updated dependencies [3624bbb]
- Updated dependencies [3624bbb]
  - @nextclaw/core@0.14.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.13
  - @nextclaw/channel-extension-feishu@0.1.25
  - @nextclaw/channel-extension-weixin@0.1.29
  - @nextclaw/mcp@0.2.14
  - @nextclaw/ncp@0.6.3
  - @nextclaw/ncp-agent-runtime@0.3.44
  - @nextclaw/ncp-agent-runtime-next@0.0.16
  - @nextclaw/ncp-mcp@0.1.109
  - @nextclaw/ncp-toolkit@0.5.38
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.13
  - @nextclaw/runtime@0.3.14
  - @nextclaw/shared@0.3.0

## 0.4.3

### Patch Changes

- 6b44d57: Use real context compaction so compressed sessions feed the model a single working-context summary instead of retaining raw message tails.
- e283af5: Improve the native reply formatting prompt so local file references are emitted as clickable Markdown links.
- Updated dependencies
- Updated dependencies [6b44d57]
- Updated dependencies [d20dc48]
- Updated dependencies [aa681ba]
- Updated dependencies [7eed591]
  - @nextclaw/channel-extension-feishu@0.1.24
  - @nextclaw/channel-extension-weixin@0.1.28
  - @nextclaw/mcp@0.2.13
  - @nextclaw/ncp@0.6.2
  - @nextclaw/ncp-agent-runtime@0.3.43
  - @nextclaw/ncp-agent-runtime-next@0.0.15
  - @nextclaw/ncp-toolkit@0.5.37
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.12
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.12
  - @nextclaw/shared@0.2.12
  - @nextclaw/core@0.14.3
  - @nextclaw/runtime@0.3.13
  - @nextclaw/ncp-mcp@0.1.108

## 0.4.2

### Patch Changes

- 36c4e56: Expose session workingDir and use it as the base path for chat local file link previews.
- Updated dependencies
- Updated dependencies [36c4e56]
  - @nextclaw/channel-extension-feishu@0.1.23
  - @nextclaw/channel-extension-weixin@0.1.27
  - @nextclaw/core@0.14.2
  - @nextclaw/mcp@0.2.12
  - @nextclaw/ncp-agent-runtime@0.3.42
  - @nextclaw/ncp-agent-runtime-next@0.0.14
  - @nextclaw/ncp-mcp@0.1.107
  - @nextclaw/ncp-toolkit@0.5.36
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.11
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.11
  - @nextclaw/runtime@0.3.12
  - @nextclaw/shared@0.2.11
  - @nextclaw/ncp@0.6.1

## 0.4.1

### Patch Changes

- 78fcd8f: Move native prompt ownership from core prompt builders to kernel context providers while preserving prompt content, and route local file reply-format guidance through the native provider chain.
- 42281c8: Fix rolling context compaction so repeated checkpoints use unique service message ids and legacy journal markers replay as separate timeline records.
- cc024b3: Expose the original agent-run peerId on NCP session summaries and support filtering session lists by peerId.
- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies [1ed5aff]
- Updated dependencies
- Updated dependencies [78fcd8f]
- Updated dependencies [cc024b3]
- Updated dependencies [458c9b0]
- Updated dependencies [6ec95a0]
  - @nextclaw/channel-extension-feishu@0.1.22
  - @nextclaw/channel-extension-weixin@0.1.26
  - @nextclaw/mcp@0.2.11
  - @nextclaw/ncp-agent-runtime@0.3.41
  - @nextclaw/ncp-agent-runtime-next@0.0.13
  - @nextclaw/ncp-mcp@0.1.106
  - @nextclaw/ncp-toolkit@0.5.35
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.10
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.10
  - @nextclaw/runtime@0.3.11
  - @nextclaw/shared@0.2.10
  - @nextclaw/ncp@0.6.0
  - @nextclaw/core@0.14.1

## 0.4.1-beta.0

### Patch Changes

- 42281c8: Fix rolling context compaction so repeated checkpoints use unique service message ids and legacy journal markers replay as separate timeline records.
- cc024b3: Expose the original agent-run peerId on NCP session summaries and support filtering session lists by peerId.
- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies
- Updated dependencies [cc024b3]
- Updated dependencies [458c9b0]
- Updated dependencies [6ec95a0]
  - @nextclaw/channel-extension-feishu@0.1.22-beta.0
  - @nextclaw/channel-extension-weixin@0.1.26-beta.0
  - @nextclaw/mcp@0.2.11-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.41-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.13-beta.0
  - @nextclaw/ncp-mcp@0.1.106-beta.0
  - @nextclaw/ncp-toolkit@0.5.35-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.10-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.10-beta.0
  - @nextclaw/runtime@0.3.11-beta.0
  - @nextclaw/shared@0.2.10-beta.0
  - @nextclaw/ncp@0.6.0-beta.0
  - @nextclaw/core@0.14.1-beta.0

## 0.4.0

### Minor Changes

- 226b3cf: Expose an app-facing NextClaw App Client projection for Panel Apps.

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- 240d5ab: Fix runtime child process environments so Service App and NARP stdio launches can resolve the current Node executable after autostart.
- 170c8be: Improve session activity previews so thinking states read as thinking and completed tool calls keep the tool name visible.
- 86acdbe: Publish session run status updates from the agent run request flow, keep realtime running overlays from being overwritten by persisted idle summaries, and remove the unused session run publish API from the runtime-next session state contract.
- Updated dependencies [14c5730]
- Updated dependencies [43da21a]
- Updated dependencies [226b3cf]
- Updated dependencies [0dc6471]
- Updated dependencies [86a0dc8]
- Updated dependencies [240d5ab]
- Updated dependencies [75e0dcb]
- Updated dependencies [86acdbe]
  - @nextclaw/channel-extension-feishu@0.1.21
  - @nextclaw/channel-extension-weixin@0.1.25
  - @nextclaw/mcp@0.2.10
  - @nextclaw/ncp@0.5.29
  - @nextclaw/ncp-agent-runtime@0.3.40
  - @nextclaw/ncp-mcp@0.1.105
  - @nextclaw/ncp-toolkit@0.5.34
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9
  - @nextclaw/runtime@0.3.10
  - @nextclaw/shared@0.2.9
  - @nextclaw/ncp-agent-runtime-next@0.0.12
  - @nextclaw/core@0.14.0

## 0.4.0-beta.1

### Minor Changes

- 226b3cf: Expose an app-facing NextClaw App Client projection for Panel Apps.

### Patch Changes

- 240d5ab: Fix runtime child process environments so Service App and NARP stdio launches can resolve the current Node executable after autostart.
- Updated dependencies
- Updated dependencies [226b3cf]
- Updated dependencies [240d5ab]
- Updated dependencies [75e0dcb]
  - @nextclaw/channel-extension-feishu@0.1.21-beta.1
  - @nextclaw/channel-extension-weixin@0.1.25-beta.1
  - @nextclaw/mcp@0.2.10-beta.1
  - @nextclaw/ncp@0.5.29-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.40-beta.1
  - @nextclaw/ncp-agent-runtime-next@0.0.12-beta.1
  - @nextclaw/ncp-mcp@0.1.105-beta.1
  - @nextclaw/ncp-toolkit@0.5.34-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9-beta.1
  - @nextclaw/runtime@0.3.10-beta.1
  - @nextclaw/shared@0.2.9-beta.1
  - @nextclaw/core@0.14.0-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9-beta.1

## 0.3.4-beta.0

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- 170c8be: Improve session activity previews so thinking states read as thinking and completed tool calls keep the tool name visible.
- 86acdbe: Publish session run status updates from the agent run request flow, keep realtime running overlays from being overwritten by persisted idle summaries, and remove the unused session run publish API from the runtime-next session state contract.
- Updated dependencies
- Updated dependencies [86a0dc8]
- Updated dependencies [86acdbe]
  - @nextclaw/channel-extension-feishu@0.1.21-beta.0
  - @nextclaw/channel-extension-weixin@0.1.25-beta.0
  - @nextclaw/mcp@0.2.10-beta.0
  - @nextclaw/ncp@0.5.29-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.40-beta.0
  - @nextclaw/ncp-mcp@0.1.105-beta.0
  - @nextclaw/ncp-toolkit@0.5.34-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9-beta.0
  - @nextclaw/runtime@0.3.10-beta.0
  - @nextclaw/shared@0.2.9-beta.0
  - @nextclaw/core@0.13.10-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.12-beta.0

## 0.3.3

### Patch Changes

- 3061877: Decouple cron jobs from channel delivery settings. Scheduled jobs now ask the agent to call the message tool for notifications, while Weixin sends fail honestly when account, channel, API, or context_token delivery state is unavailable.
- Updated dependencies
- Updated dependencies [3061877]
  - @nextclaw/channel-extension-feishu@0.1.20
  - @nextclaw/mcp@0.2.9
  - @nextclaw/ncp@0.5.28
  - @nextclaw/ncp-agent-runtime@0.3.39
  - @nextclaw/ncp-agent-runtime-next@0.0.11
  - @nextclaw/ncp-mcp@0.1.104
  - @nextclaw/ncp-toolkit@0.5.33
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.8
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.8
  - @nextclaw/runtime@0.3.9
  - @nextclaw/shared@0.2.8
  - @nextclaw/core@0.13.9
  - @nextclaw/channel-extension-weixin@0.1.24

## 0.3.2

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
  - @nextclaw/channel-extension-feishu@0.1.19
  - @nextclaw/channel-extension-weixin@0.1.23
  - @nextclaw/core@0.13.8
  - @nextclaw/mcp@0.2.8
  - @nextclaw/ncp@0.5.27
  - @nextclaw/ncp-agent-runtime@0.3.38
  - @nextclaw/ncp-agent-runtime-next@0.0.10
  - @nextclaw/ncp-mcp@0.1.103
  - @nextclaw/ncp-toolkit@0.5.32
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.7
  - @nextclaw/runtime@0.3.8
  - @nextclaw/shared@0.2.7

## 0.3.1

### Patch Changes

- Clarify built-in app creator skills so generated Panel Apps and Service Apps do not ask users to restart NextClaw for normal workspace changes.
- Updated dependencies
  - @nextclaw/core@0.13.7
  - @nextclaw/runtime@0.3.7
  - @nextclaw/mcp@0.2.7
  - @nextclaw/ncp-mcp@0.1.102

## 0.3.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.18
  - @nextclaw/channel-extension-weixin@0.1.22
  - @nextclaw/core@0.13.6
  - @nextclaw/mcp@0.2.6
  - @nextclaw/ncp@0.5.26
  - @nextclaw/ncp-agent-runtime@0.3.37
  - @nextclaw/ncp-agent-runtime-next@0.0.9
  - @nextclaw/ncp-mcp@0.1.101
  - @nextclaw/ncp-toolkit@0.5.31
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.6
  - @nextclaw/runtime@0.3.6
  - @nextclaw/shared@0.2.6

## 0.2.5

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
  - @nextclaw/channel-extension-feishu@0.1.17
  - @nextclaw/channel-extension-weixin@0.1.21
  - @nextclaw/core@0.13.5
  - @nextclaw/mcp@0.2.5
  - @nextclaw/ncp@0.5.25
  - @nextclaw/ncp-agent-runtime@0.3.36
  - @nextclaw/ncp-agent-runtime-next@0.0.8
  - @nextclaw/ncp-mcp@0.1.100
  - @nextclaw/ncp-toolkit@0.5.30
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.5
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.5
  - @nextclaw/runtime@0.3.5
  - @nextclaw/shared@0.2.5

## 0.2.4

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
  - @nextclaw/channel-extension-feishu@0.1.16
  - @nextclaw/channel-extension-weixin@0.1.20
  - @nextclaw/core@0.13.4
  - @nextclaw/mcp@0.2.4
  - @nextclaw/ncp@0.5.24
  - @nextclaw/ncp-agent-runtime@0.3.35
  - @nextclaw/ncp-agent-runtime-next@0.0.7
  - @nextclaw/ncp-mcp@0.1.99
  - @nextclaw/ncp-toolkit@0.5.29
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.4
  - @nextclaw/runtime@0.3.4
  - @nextclaw/shared@0.2.4

## 0.2.3

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
  - @nextclaw/channel-extension-feishu@0.1.15
  - @nextclaw/channel-extension-weixin@0.1.19
  - @nextclaw/core@0.13.3
  - @nextclaw/mcp@0.2.3
  - @nextclaw/ncp@0.5.23
  - @nextclaw/ncp-agent-runtime@0.3.34
  - @nextclaw/ncp-agent-runtime-next@0.0.6
  - @nextclaw/ncp-mcp@0.1.98
  - @nextclaw/ncp-toolkit@0.5.28
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.3
  - @nextclaw/runtime@0.3.3
  - @nextclaw/shared@0.2.3

## 0.2.2

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
  - @nextclaw/channel-extension-feishu@0.1.14
  - @nextclaw/channel-extension-weixin@0.1.17
  - @nextclaw/core@0.13.2
  - @nextclaw/mcp@0.2.2
  - @nextclaw/ncp@0.5.22
  - @nextclaw/ncp-agent-runtime@0.3.33
  - @nextclaw/ncp-agent-runtime-next@0.0.5
  - @nextclaw/ncp-mcp@0.1.97
  - @nextclaw/ncp-toolkit@0.5.27
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.2
  - @nextclaw/runtime@0.3.2
  - @nextclaw/shared@0.2.2

## 0.2.1

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
  - @nextclaw/channel-extension-feishu@0.1.13
  - @nextclaw/channel-extension-weixin@0.1.16
  - @nextclaw/core@0.13.1
  - @nextclaw/mcp@0.2.1
  - @nextclaw/ncp@0.5.21
  - @nextclaw/ncp-agent-runtime@0.3.32
  - @nextclaw/ncp-agent-runtime-next@0.0.4
  - @nextclaw/ncp-mcp@0.1.96
  - @nextclaw/ncp-toolkit@0.5.26
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.1
  - @nextclaw/runtime@0.3.1
  - @nextclaw/shared@0.2.1

## 0.2.0

### Minor Changes

- Release the NextClaw lightweight app platform as a minor feature line.

  Panel Apps now receive developer-friendly bridge results: service action lists resolve to arrays, service action invokes resolve to business payloads, and built-in app creator skills document the canonical Panel + Service + Agent contract.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.13.0
  - @nextclaw/mcp@0.2.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.0
  - @nextclaw/runtime@0.3.0
  - @nextclaw/shared@0.2.0
  - @nextclaw/channel-extension-feishu@0.1.12
  - @nextclaw/channel-extension-weixin@0.1.15
  - @nextclaw/ncp-mcp@0.1.95

## 0.1.17

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
  - @nextclaw/channel-extension-feishu@0.1.11
  - @nextclaw/channel-extension-weixin@0.1.14
  - @nextclaw/core@0.12.27
  - @nextclaw/mcp@0.1.92
  - @nextclaw/ncp@0.5.20
  - @nextclaw/ncp-agent-runtime@0.3.31
  - @nextclaw/ncp-agent-runtime-next@0.0.3
  - @nextclaw/ncp-mcp@0.1.94
  - @nextclaw/ncp-toolkit@0.5.25
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.19
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.20
  - @nextclaw/runtime@0.2.59
  - @nextclaw/shared@0.1.14

## 0.1.16

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
  - @nextclaw/channel-extension-feishu@0.1.10
  - @nextclaw/channel-extension-weixin@0.1.13
  - @nextclaw/core@0.12.26
  - @nextclaw/mcp@0.1.91
  - @nextclaw/ncp@0.5.19
  - @nextclaw/ncp-agent-runtime@0.3.30
  - @nextclaw/ncp-agent-runtime-next@0.0.2
  - @nextclaw/ncp-mcp@0.1.93
  - @nextclaw/ncp-toolkit@0.5.24
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.19
  - @nextclaw/runtime@0.2.58
  - @nextclaw/shared@0.1.13

## 0.1.15

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
  - @nextclaw/channel-extension-feishu@0.1.9
  - @nextclaw/channel-extension-weixin@0.1.12
  - @nextclaw/core@0.12.25
  - @nextclaw/mcp@0.1.90
  - @nextclaw/ncp@0.5.18
  - @nextclaw/ncp-agent-runtime@0.3.29
  - @nextclaw/ncp-mcp@0.1.92
  - @nextclaw/ncp-toolkit@0.5.23
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18
  - @nextclaw/runtime@0.2.57
  - @nextclaw/shared@0.1.12
  - @nextclaw/ncp-agent-runtime-next@0.0.1

## 0.1.15-beta.7

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
  - @nextclaw/channel-extension-feishu@0.1.9-beta.7
  - @nextclaw/channel-extension-weixin@0.1.12-beta.7
  - @nextclaw/core@0.12.25-beta.7
  - @nextclaw/mcp@0.1.90-beta.7
  - @nextclaw/ncp@0.5.18-beta.7
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.7
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.7
  - @nextclaw/ncp-mcp@0.1.92-beta.7
  - @nextclaw/ncp-toolkit@0.5.23-beta.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.7
  - @nextclaw/runtime@0.2.57-beta.7
  - @nextclaw/shared@0.1.12-beta.7

## 0.1.15-beta.6

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
  - @nextclaw/channel-extension-feishu@0.1.9-beta.6
  - @nextclaw/channel-extension-weixin@0.1.12-beta.6
  - @nextclaw/core@0.12.25-beta.6
  - @nextclaw/mcp@0.1.90-beta.6
  - @nextclaw/ncp@0.5.18-beta.6
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.6
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.6
  - @nextclaw/ncp-mcp@0.1.92-beta.6
  - @nextclaw/ncp-toolkit@0.5.23-beta.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.6
  - @nextclaw/runtime@0.2.57-beta.6
  - @nextclaw/shared@0.1.12-beta.6

## 0.1.15-beta.5

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
  - @nextclaw/channel-extension-feishu@0.1.9-beta.5
  - @nextclaw/channel-extension-weixin@0.1.12-beta.5
  - @nextclaw/core@0.12.25-beta.5
  - @nextclaw/mcp@0.1.90-beta.5
  - @nextclaw/ncp@0.5.18-beta.5
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.5
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.5
  - @nextclaw/ncp-mcp@0.1.92-beta.5
  - @nextclaw/ncp-toolkit@0.5.23-beta.5
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.5
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.5
  - @nextclaw/runtime@0.2.57-beta.5
  - @nextclaw/shared@0.1.12-beta.5

## 0.1.15-beta.4

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
  - @nextclaw/channel-extension-feishu@0.1.9-beta.4
  - @nextclaw/channel-extension-weixin@0.1.12-beta.4
  - @nextclaw/core@0.12.25-beta.4
  - @nextclaw/mcp@0.1.90-beta.4
  - @nextclaw/ncp@0.5.18-beta.4
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.4
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.4
  - @nextclaw/ncp-mcp@0.1.92-beta.4
  - @nextclaw/ncp-toolkit@0.5.23-beta.4
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.4
  - @nextclaw/runtime@0.2.57-beta.4
  - @nextclaw/shared@0.1.12-beta.4

## 0.1.15-beta.3

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
  - @nextclaw/channel-extension-feishu@0.1.9-beta.3
  - @nextclaw/channel-extension-weixin@0.1.12-beta.3
  - @nextclaw/core@0.12.25-beta.3
  - @nextclaw/mcp@0.1.90-beta.3
  - @nextclaw/ncp@0.5.18-beta.3
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.3
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.3
  - @nextclaw/ncp-mcp@0.1.92-beta.3
  - @nextclaw/ncp-toolkit@0.5.23-beta.3
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.3
  - @nextclaw/runtime@0.2.57-beta.3
  - @nextclaw/shared@0.1.12-beta.3

## 0.1.15-beta.2

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
  - @nextclaw/channel-extension-feishu@0.1.9-beta.2
  - @nextclaw/channel-extension-weixin@0.1.12-beta.2
  - @nextclaw/core@0.12.25-beta.2
  - @nextclaw/mcp@0.1.90-beta.2
  - @nextclaw/ncp@0.5.18-beta.2
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.2
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.2
  - @nextclaw/ncp-mcp@0.1.92-beta.2
  - @nextclaw/ncp-toolkit@0.5.23-beta.2
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.2
  - @nextclaw/runtime@0.2.57-beta.2
  - @nextclaw/shared@0.1.12-beta.2

## 0.1.15-beta.1

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
  - @nextclaw/channel-extension-feishu@0.1.9-beta.1
  - @nextclaw/channel-extension-weixin@0.1.12-beta.1
  - @nextclaw/core@0.12.25-beta.1
  - @nextclaw/mcp@0.1.90-beta.1
  - @nextclaw/ncp@0.5.18-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.1
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.1
  - @nextclaw/ncp-mcp@0.1.92-beta.1
  - @nextclaw/ncp-toolkit@0.5.23-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.1
  - @nextclaw/runtime@0.2.57-beta.1
  - @nextclaw/shared@0.1.12-beta.1

## 0.1.15-beta.0

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
  - @nextclaw/channel-extension-feishu@0.1.9-beta.0
  - @nextclaw/channel-extension-weixin@0.1.12-beta.0
  - @nextclaw/core@0.12.25-beta.0
  - @nextclaw/mcp@0.1.90-beta.0
  - @nextclaw/ncp@0.5.18-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.0
  - @nextclaw/ncp-mcp@0.1.92-beta.0
  - @nextclaw/ncp-toolkit@0.5.23-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.0
  - @nextclaw/runtime@0.2.57-beta.0
  - @nextclaw/shared@0.1.12-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.0

## 0.1.14

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
  - @nextclaw/channel-extension-feishu@0.1.8
  - @nextclaw/channel-extension-weixin@0.1.11
  - @nextclaw/core@0.12.24
  - @nextclaw/mcp@0.1.89
  - @nextclaw/ncp@0.5.17
  - @nextclaw/ncp-agent-runtime@0.3.28
  - @nextclaw/ncp-mcp@0.1.91
  - @nextclaw/ncp-toolkit@0.5.22
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.16
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.17
  - @nextclaw/openclaw-compat@1.0.24
  - @nextclaw/runtime@0.2.56
  - @nextclaw/shared@0.1.11

## 0.1.13

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
  - @nextclaw/channel-extension-feishu@0.1.7
  - @nextclaw/channel-extension-weixin@0.1.10
  - @nextclaw/core@0.12.23
  - @nextclaw/mcp@0.1.88
  - @nextclaw/ncp@0.5.16
  - @nextclaw/ncp-agent-runtime@0.3.27
  - @nextclaw/ncp-mcp@0.1.90
  - @nextclaw/ncp-toolkit@0.5.21
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.15
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.16
  - @nextclaw/openclaw-compat@1.0.23
  - @nextclaw/runtime@0.2.55
  - @nextclaw/shared@0.1.10

## 0.1.12

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
  - @nextclaw/channel-extension-feishu@0.1.6
  - @nextclaw/channel-extension-weixin@0.1.9
  - @nextclaw/core@0.12.22
  - @nextclaw/mcp@0.1.87
  - @nextclaw/ncp@0.5.15
  - @nextclaw/ncp-agent-runtime@0.3.26
  - @nextclaw/ncp-mcp@0.1.89
  - @nextclaw/ncp-toolkit@0.5.20
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.14
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.15
  - @nextclaw/openclaw-compat@1.0.22
  - @nextclaw/runtime@0.2.54
  - @nextclaw/shared@0.1.9

## 0.1.11

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
  - @nextclaw/channel-extension-feishu@0.1.5
  - @nextclaw/channel-extension-weixin@0.1.8
  - @nextclaw/core@0.12.21
  - @nextclaw/mcp@0.1.86
  - @nextclaw/ncp@0.5.14
  - @nextclaw/ncp-agent-runtime@0.3.25
  - @nextclaw/ncp-mcp@0.1.88
  - @nextclaw/ncp-toolkit@0.5.19
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.13
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.14
  - @nextclaw/openclaw-compat@1.0.21
  - @nextclaw/runtime@0.2.53
  - @nextclaw/shared@0.1.8

## 0.1.10

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-agent-runtime@0.3.24
  - @nextclaw/ncp-toolkit@0.5.18

## 0.1.9

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
  - @nextclaw/channel-extension-feishu@0.1.4
  - @nextclaw/channel-extension-weixin@0.1.7
  - @nextclaw/core@0.12.20
  - @nextclaw/mcp@0.1.85
  - @nextclaw/ncp@0.5.13
  - @nextclaw/ncp-agent-runtime@0.3.23
  - @nextclaw/ncp-mcp@0.1.87
  - @nextclaw/ncp-toolkit@0.5.18
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.12
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.13
  - @nextclaw/openclaw-compat@1.0.20
  - @nextclaw/runtime@0.2.52
  - @nextclaw/shared@0.1.7

## 0.1.8

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
  - @nextclaw/core@0.12.19
  - @nextclaw/mcp@0.1.84
  - @nextclaw/ncp@0.5.12
  - @nextclaw/ncp-agent-runtime@0.3.22
  - @nextclaw/ncp-http-agent-server@0.3.24
  - @nextclaw/ncp-mcp@0.1.86
  - @nextclaw/ncp-toolkit@0.5.17
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.11
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.11
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.12
  - @nextclaw/openclaw-compat@1.0.19
  - @nextclaw/runtime@0.2.51
  - @nextclaw/shared@0.1.6

## 0.1.7

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
  - @nextclaw/core@0.12.18
  - @nextclaw/mcp@0.1.83
  - @nextclaw/ncp@0.5.11
  - @nextclaw/ncp-agent-runtime@0.3.21
  - @nextclaw/ncp-http-agent-server@0.3.23
  - @nextclaw/ncp-mcp@0.1.85
  - @nextclaw/ncp-toolkit@0.5.16
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.10
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.10
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.11
  - @nextclaw/openclaw-compat@1.0.18
  - @nextclaw/runtime@0.2.50
  - @nextclaw/shared@0.1.5

## 0.1.6

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
  - @nextclaw/core@0.12.17
  - @nextclaw/mcp@0.1.82
  - @nextclaw/ncp@0.5.10
  - @nextclaw/ncp-agent-runtime@0.3.20
  - @nextclaw/ncp-http-agent-server@0.3.22
  - @nextclaw/ncp-mcp@0.1.84
  - @nextclaw/ncp-toolkit@0.5.15
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.9
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.10
  - @nextclaw/openclaw-compat@1.0.17
  - @nextclaw/runtime@0.2.49
  - @nextclaw/shared@0.1.4

## 0.1.5

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
  - @nextclaw/core@0.12.16
  - @nextclaw/mcp@0.1.81
  - @nextclaw/ncp@0.5.9
  - @nextclaw/ncp-agent-runtime@0.3.19
  - @nextclaw/ncp-http-agent-server@0.3.21
  - @nextclaw/ncp-mcp@0.1.83
  - @nextclaw/ncp-toolkit@0.5.14
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.8
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.8
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.9
  - @nextclaw/openclaw-compat@1.0.16
  - @nextclaw/runtime@0.2.48
  - @nextclaw/shared@0.1.3

## 0.1.4

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
  - @nextclaw/core@0.12.15
  - @nextclaw/mcp@0.1.80
  - @nextclaw/ncp@0.5.8
  - @nextclaw/ncp-agent-runtime@0.3.18
  - @nextclaw/ncp-http-agent-server@0.3.20
  - @nextclaw/ncp-mcp@0.1.82
  - @nextclaw/ncp-toolkit@0.5.13
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.8
  - @nextclaw/openclaw-compat@1.0.15
  - @nextclaw/runtime@0.2.47
  - @nextclaw/shared@0.1.2

## 0.1.3

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
  - @nextclaw/core@0.12.14
  - @nextclaw/mcp@0.1.79
  - @nextclaw/ncp@0.5.7
  - @nextclaw/ncp-agent-runtime@0.3.17
  - @nextclaw/ncp-http-agent-server@0.3.19
  - @nextclaw/ncp-mcp@0.1.81
  - @nextclaw/ncp-toolkit@0.5.12
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.7
  - @nextclaw/openclaw-compat@1.0.14
  - @nextclaw/runtime@0.2.46
  - @nextclaw/shared@0.1.1

## 0.1.2

### Patch Changes

- a11f4fd: Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
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
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
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
- Updated dependencies [2418020]
- Updated dependencies [a5da9d6]
- Updated dependencies [1600643]
- Updated dependencies [223037c]
  - @nextclaw/ncp@0.5.6

## 0.1.2-beta.6

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
  - @nextclaw/ncp@0.5.6-beta.4

## 0.1.2-beta.5

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
  - @nextclaw/ncp@0.5.6-beta.3

## 0.1.2-beta.4

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
  - @nextclaw/ncp@0.5.6-beta.2

## 0.1.2-beta.3

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
  - @nextclaw/ncp@0.5.6-beta.1

## 0.1.2-beta.2

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
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
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
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

## 0.1.2-beta.1

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.6-beta.0

## 0.1.1

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
  - @nextclaw/ncp@0.5.5
