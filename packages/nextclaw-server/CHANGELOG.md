# nextclaw-server

## 0.18.0

### Minor Changes

- ec60bc1: 新增全局 Extension 管理入口、会话级持续关注管理，以及会话时间线中的可见外部事件卡片。事件消息使用通用的 `observation.event` 标识，不绑定具体产品或协议品牌。

### Patch Changes

- eeac1f6: 修复会话历史摘要删除工具调用结构节点导致上下文压缩边界和 Continue 后续内容错位的问题。摘要现在保留完整的 part 顺序与数量，仅延迟大 payload 的加载。
- f9c6477: 修复会话历史可靠性问题：保留历史 replay、projection 恢复和压缩消息视图的修复，不再用 journal 目录级 writer ownership 阻止同一 `NEXTCLAW_HOME` 下的第二个 runtime 或新会话启动。
- Updated dependencies [2c7ce8c]
- Updated dependencies [5b07b81]
- Updated dependencies [eeac1f6]
- Updated dependencies [5f68b2f]
- Updated dependencies [41cb756]
- Updated dependencies [037d93e]
- Updated dependencies [eabdf41]
- Updated dependencies [ec60bc1]
- Updated dependencies [70dd515]
- Updated dependencies [3817714]
- Updated dependencies [f9c6477]
- Updated dependencies [83c0628]
  - @nextclaw/kernel@0.10.0
  - @nextclaw/ncp@0.9.0
  - @nextclaw/core@0.17.7
  - @nextclaw/runtime@0.4.33
  - @nextclaw/mcp@0.3.34

## 0.18.0-beta.0

### Minor Changes

- ec60bc1: 新增全局 Extension 管理入口、会话级持续关注管理，以及会话时间线中的可见外部事件卡片。事件消息使用通用的 `observation.event` 标识，不绑定具体产品或协议品牌。

### Patch Changes

- eeac1f6: 修复会话历史摘要删除工具调用结构节点导致上下文压缩边界和 Continue 后续内容错位的问题。摘要现在保留完整的 part 顺序与数量，仅延迟大 payload 的加载。
- f9c6477: 修复会话历史可靠性问题：保留历史 replay、projection 恢复和压缩消息视图的修复，不再用 journal 目录级 writer ownership 阻止同一 `NEXTCLAW_HOME` 下的第二个 runtime 或新会话启动。
- Updated dependencies [2c7ce8c]
- Updated dependencies [5b07b81]
- Updated dependencies [eeac1f6]
- Updated dependencies [5f68b2f]
- Updated dependencies [41cb756]
- Updated dependencies [037d93e]
- Updated dependencies [ec60bc1]
- Updated dependencies [70dd515]
- Updated dependencies [3817714]
- Updated dependencies [f9c6477]
- Updated dependencies [83c0628]
  - @nextclaw/kernel@0.10.0-beta.0
  - @nextclaw/ncp@0.9.0-beta.0
  - @nextclaw/core@0.17.7-beta.0
  - @nextclaw/runtime@0.4.33-beta.0
  - @nextclaw/mcp@0.3.34-beta.0

## 0.17.3

### Patch Changes

- 9816eaf: Fix Windows Desktop Service App requests so packaged runtimes retain classified errors across package boundaries, and verify Favorites and Calendar actions in the real packaged desktop runtime.
- Updated dependencies [9816eaf]
  - @nextclaw/kernel@0.9.2

## 0.17.2

### Patch Changes

- 82e8b03: Built-in Service Apps now keep a structured error response when a request fails, instead of showing a non-JSON server error. Desktop releases also verify Favorites and Calendar on Linux and Windows without a system Node.js installation.

## 0.17.1

### Patch Changes

- 1d63057: 重载工具调用会话现在会先显示受预算保护的最近内容，再自动补齐近期上下文，并减少重复 hydrate 与首屏资源串行等待；发布包同时内置经过校验的预压缩 UI 资产，外部静态服务器升级后不再丢失快速传输路径。真实 VPS 已登录热刷新中位约 1.13 秒，同时保留完整工具详情和更早历史。
- 3e6da7e: 应用市场现在使用 NextClaw 提供的真实宿主 target 判断兼容性：不支持当前设备的应用会被明确标注并禁用安装，同时仍可查看详情；历史安装失败不再跨页面刷新持续显示为错误和“重试”。
- 6587602: 新增默认关闭的产品活跃统计与隐私设置：未登录安装使用随机匿名标识，登录后按账号归并，并可将团队和 QA 测试流量从外部 DAU、WAU、MAU 中分开。
- 0f0753a: 修复桌面端 Service App 启动：声明 `node` 或 `node.exe` 的应用现在统一使用 NextClaw 宿主内置 Node，不再要求 Windows、macOS 或 Linux 额外安装系统 Node；运行失败也会返回结构化错误。
- 7cc703c: 新增会话插话能力：AI 运行中普通发送继续自动排队，使用 Command/Ctrl + Enter 可在下一安全步骤插入完整消息；排队内容也可直接转为插话，并以独立用户消息和后续 AI 消息呈现在会话中。排队区域会保留并展示图片缩略图和文件摘要，编辑时仍可完整恢复富内容。
- Updated dependencies [3e6da7e]
- Updated dependencies [6587602]
- Updated dependencies [0f0753a]
- Updated dependencies [7cc703c]
  - @nextclaw/kernel@0.9.1
  - @nextclaw/core@0.17.6
  - @nextclaw/ncp@0.8.1
  - @nextclaw/mcp@0.3.33
  - @nextclaw/runtime@0.4.32

## 0.17.0

### Minor Changes

- c19ae8f: 大工具调用历史会话改为按预算分级加载：首屏显示真实工具调用数量和类型，只有展开处理过程时才按消息读取完整参数与结果，并对超大工具组分批展示。历史分页与会话摘要改走有界投影读模型，避免打开会话时扫描完整 journal；会话列表先限量并限制 metadata 读取并发，减少首屏请求之间的 I/O 争用。

  <!-- release-note-blog: docs/blog-drafts/2026-08-20-heavy-tool-call-session-performance.blog-draft.md -->

### Patch Changes

- e8d725a: 支持用户从 Panel Apps 列表或运行中 App 的更多菜单手动添加主侧栏入口，并在主内容区无重复宿主 Header 地完整使用。安装不会自动占用主侧栏；禁用后入口暂时隐藏并可在重新启用后恢复，卸载或删除则会清理入口。添加/移除即时反馈，打开 App 不再等待活动统计写盘；右侧 Panel App 移除重复的“返回应用”动作，统一遵循资源浏览器历史。
- Updated dependencies [c19ae8f]
- Updated dependencies [e8d725a]
- Updated dependencies [c10dcaa]
  - @nextclaw/kernel@0.9.0
  - @nextclaw/core@0.17.5
  - @nextclaw/mcp@0.3.32
  - @nextclaw/runtime@0.4.31

## 0.16.7

### Patch Changes

- Updated dependencies [ae676ff]
  - @nextclaw/kernel@0.8.7

## 0.16.6

### Patch Changes

- @nextclaw/kernel@0.8.6

## 0.16.5

### Patch Changes

- 7da88a5: Reuse content-hashed UI assets across page reloads while keeping pages and stale chunk recovery uncached.
- 65dc8fb: Open idle NCP event streams immediately through development proxies and keep retryable stream transport failures out of conversation error state.
- Updated dependencies [ef5d9ae]
- Updated dependencies [1df4217]
  - @nextclaw/core@0.17.4
  - @nextclaw/kernel@0.8.5
  - @nextclaw/mcp@0.3.31
  - @nextclaw/runtime@0.4.30

## 0.16.4

### Patch Changes

- Updated dependencies [80f7660]
  - @nextclaw/core@0.17.3
  - @nextclaw/kernel@0.8.4
  - @nextclaw/mcp@0.3.30
  - @nextclaw/runtime@0.4.29

## 0.16.3

### Patch Changes

- Updated dependencies [56ab5c2]
  - @nextclaw/core@0.17.2
  - @nextclaw/kernel@0.8.3
  - @nextclaw/mcp@0.3.29
  - @nextclaw/runtime@0.4.28

## 0.16.2

### Patch Changes

- 004d51f: 增强会话工作台：概览底部新增当前会话的 Token 用量，支持按模型查看输入、输出、缓存输入、总量与缓存命中率；子会话管理页新增“新建子会话”入口，并复用侧边对话的上下文继承链路。
- Updated dependencies [aa08a3f]
- Updated dependencies [e2a7c8e]
- Updated dependencies [004d51f]
  - @nextclaw/ncp@0.8.0
  - @nextclaw/core@0.17.1
  - @nextclaw/kernel@0.8.2
  - @nextclaw/mcp@0.3.28
  - @nextclaw/runtime@0.4.27

## 0.16.1

### Patch Changes

- 27d7293: Harden App, Panel App, and Service App data management with isolated instance storage, crash-safe deletion recovery, side-effect-free catalog reads, and explicit keep-or-delete uninstall controls.
- Updated dependencies [27d7293]
  - @nextclaw/kernel@0.8.1

## 0.16.0

### Minor Changes

- ca2c98d: 把 App 数据生命周期补齐为可管理的产品能力：App 更新继续复用原实例，卸载与 Workspace Service 删除默认保留个人数据，也可以在确认后同时永久删除 data、config、state、cache、tmp 和 logs。

  Apps 页面会显示六类数据占用、受管路径和已保留数据，并支持稍后清理；CLI 新增 `nextclaw app data list/delete`，开发态可用 `nextclaw app dev --reset-data --confirm <app-id>` 精确重置当前实例。HTTP、Client SDK、双语文档与内建自管理 Skill 同步使用同一套安全确认和 active/retained 规则。

### Patch Changes

- Updated dependencies [ca2c98d]
  - @nextclaw/kernel@0.8.0
  - @nextclaw/core@0.17.0
  - @nextclaw/mcp@0.3.27
  - @nextclaw/runtime@0.4.26

## 0.15.29

### Patch Changes

- Updated dependencies [298233c]
  - @nextclaw/kernel@0.7.0

## 0.15.28

### Patch Changes

- 4be6947: 加快长会话的打开和历史加载：默认每页读取 40 条消息，空闲会话不再为首屏分页扫描完整消息索引，向上加载旧消息时也不再重复计算整段会话的上下文窗口。
- Updated dependencies [4be6947]
- Updated dependencies [237a931]
  - @nextclaw/kernel@0.6.28
  - @nextclaw/core@0.16.0
  - @nextclaw/mcp@0.3.26
  - @nextclaw/runtime@0.4.25

## 0.15.27

### Patch Changes

- Updated dependencies
- Updated dependencies [2542896]
  - @nextclaw/mcp@0.3.25
  - @nextclaw/kernel@0.6.27

## 0.15.26

### Patch Changes

- 9b22a7d: 支持将文档浏览器中的文档、应用、Panel App 和网页标签添加到聊天。发送后仍可识别并重新打开对应资源，AI 也能获得当时的资源地址和页面信息。项目文件树现在会保留展开与滚动状态，刷新会覆盖全部展开目录，“全部折叠”可可靠生效，并通过低开销的按需文件监听自动反映可见目录变化。
- efb52a7: 应用市场现在按页加载并支持服务端搜索，安装、更新、版本切换与卸载在后台持续执行；同时补齐应用图标、封面、详情与失败恢复体验，并允许用户卸载内置应用后按需重新安装。

  <!-- release-note-image: en-US | images/screenshots/nextclaw-app-marketplace-en.png | NextClaw Add apps dialog showing Personal Space, Hello Notes, and Workspace Glance with their artwork and install state -->

- Updated dependencies [9b22a7d]
- Updated dependencies [efb52a7]
  - @nextclaw/kernel@0.6.26
  - @nextclaw/core@0.15.24
  - @nextclaw/mcp@0.3.24
  - @nextclaw/runtime@0.4.24

## 0.15.25

### Patch Changes

- fb73f89: 改进 Marketplace 技能更新：检测到安装后的本地修改时返回明确冲突，并在用户确认后才覆盖更新；取消操作会保留现有技能文件。
- 7179c7a: 新增统一的系统管理对象 `@` 引用协议，首批支持收件箱报告和定时任务的分类浏览、分组搜索、不可变快照与模型上下文；`@` 面板中的文件和文件夹现在拥有独立入口、搜索分组与选择语义；收件箱“继续聊”进入带可见报告引用的聊天草稿，不再创建隐藏关联会话。
- 6b3127f: 新增完整的 Apps 与 Mini App 体验：可从内置市场发现、安装、启用、更新、回滚和卸载组合应用，并首发由待办、Markdown 笔记、收藏与日历组成的“个人空间”。应用代码按版本不可变安装，个人数据保存在稳定目录；安装事务、包完整性、运行时授权清理、远程下载预算与日历订阅网络边界也得到强化。
- Updated dependencies [7179c7a]
- Updated dependencies [6b3127f]
  - @nextclaw/kernel@0.6.25
  - @nextclaw/core@0.15.23
  - @nextclaw/mcp@0.3.23
  - @nextclaw/runtime@0.4.23

## 0.15.24

### Patch Changes

- ffb365c: 会话工作区现在提供与文件预览连续协作的项目文件 Explorer：目录树和预览可同时显示，支持新建文件与文件夹、上传、下载、重命名、删除、路径复制以及将文件或文件夹添加到聊天。Explorer 宽度可拖动并记忆，空间不足时才切换为覆盖式侧栏；所有写操作均由服务端限制在当前项目根目录内，同名上传只有在用户明确确认后才会覆盖。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-workspace-explorer-cn.png | NextClaw 项目文件 Explorer 和 Markdown 预览同时打开 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-workspace-explorer-en.png | NextClaw project Explorer beside a Markdown file preview -->

- 0b7df97: 改善 Web Chat 长连接的稳定性：空闲 SSE 现在会主动保活，短暂断流可在后台补齐会话并重连，不再立即展示无意义的网络错误；持续连接失败仍会明确提示。启动恢复同时改为逐会话、逐行扫描历史日志，降低大 journal 场景的峰值内存和 OOM 风险。
- Updated dependencies [c783019]
- Updated dependencies [0b7df97]
- Updated dependencies [7786bdf]
  - @nextclaw/core@0.15.22
  - @nextclaw/kernel@0.6.24
  - @nextclaw/ncp@0.7.17
  - @nextclaw/mcp@0.3.22
  - @nextclaw/runtime@0.4.22

## 0.15.23

### Patch Changes

- 4ab158d: 渠道扩展改为按需启动：未启用渠道不再常驻独立 Node 进程，运行中启用或禁用渠道会自动创建或回收对应扩展；同时增加 ready/generation 隔离、鉴权会话租约、有限故障恢复和扩展进程内存诊断。

  在 ARM64 Linux、2 vCPU / 2 GiB 限制和无活跃任务的空配置基准中，三轮平均 working set 从旧版本约 865～885 MiB 降至 164.94 MiB，下降约 81%。活跃 Agent runtime、浏览器、MCP、本地模型和已启用渠道仍会按实际工作增加内存占用。

- Updated dependencies [4ab158d]
- Updated dependencies [c54a1d9]
  - @nextclaw/kernel@0.6.23
  - @nextclaw/core@0.15.21
  - @nextclaw/mcp@0.3.21
  - @nextclaw/runtime@0.4.21

## 0.15.22

### Patch Changes

- 8049f49: 支持直接编辑当前会话最近一条用户消息并在同一会话继续执行；中断或失败后可从输入框或最近一条 AI 回复继续运行，后续输出会直接续写原回复而不是新增消息气泡，并准确区分续写前后成功与取消的工具操作。编辑器会自动聚焦到末尾，运行中隐藏编辑操作，所有纯图标入口均提供明确提示；切换模型时会继续保留可用的恢复入口。
- db9cab7: 定时任务列表现在优先展示最新创建的任务，新增任务无需翻页查找。
- e309470: 搜索设置新增 Exa 提供商：可配置 API Key 与自定义 Base URL，并使用统一的全局结果数量上限执行语义搜索和网页正文提取。感谢 [@suantea](https://github.com/suantea) 通过 [#23](https://github.com/Peiiii/nextclaw/pull/23) 贡献这项能力。
- 8e53d92: Native 会话会在同一次长任务的工具调用轮次之间自动压缩上下文；压缩输入、输出和最终 checkpoint 使用包含工具 schema 与输出预留的同一动态预算，压缩后除完整摘要外还会按 token 预算保留最近的真实用户原文。上下文指示器会按完整输入显示系统与工具、会话内容、自动压缩线和输出预留。Agent 配置会按当前指令与全量工具动态拒绝不可用的小窗口；send、继续运行和编辑重跑共享同一运行状态入口，进程中断统一恢复为可继续的中性终态。运行中压缩与 continuation 前压缩会稳定显示在对应助手过程位置，刷新后不再堆到消息末尾。
- 071c144: 增加提供商模型目录获取与后台自动刷新：Kimi 现在也能在提供商设置中获取当前模型列表，并参与每 12 小时的目录刷新；未填写 API Key 或上游拒绝鉴权时会直接给出可操作的本地化提示，不再展示原始英文 401，后台目录失败也不再被其他 Provider 的刷新状态拖成持续加载。其他尚未确认支持模型目录的提供商继续支持手工配置。候选只保留文本输出的聊天 LLM，图像、视频、语音、Embedding、Rerank 与 Moderation 模型不会进入聊天配置。聊天模型选择器只在展开后提示上次已见基线之后真正新增的模型，并支持“本批不再提醒”；首次大目录不会制造数百条提醒。具体提供商页会自动提示对应差集，超过 50 个候选时隐藏“全部添加”、支持搜索并只渲染前 50 个匹配项；已配置模型也可进入批量删除模式后全选或删除所选。显式获取、自动刷新和批量操作都只修改当前草稿或目录快照，不会绕过用户保存。
- Updated dependencies [c3eb33c]
- Updated dependencies [8049f49]
- Updated dependencies [ae21568]
- Updated dependencies [38e3e98]
- Updated dependencies [b507e1c]
- Updated dependencies [e309470]
- Updated dependencies [31d5655]
- Updated dependencies [8e53d92]
- Updated dependencies [bf3ff68]
- Updated dependencies [071c144]
- Updated dependencies [08325d3]
  - @nextclaw/core@0.15.20
  - @nextclaw/kernel@0.6.22
  - @nextclaw/ncp@0.7.16
  - @nextclaw/runtime@0.4.20
  - @nextclaw/mcp@0.3.20

## 0.15.21

### Patch Changes

- 43b0e1d: 让全新安装的 NextClaw 默认接入 OpenCode Zen 当前可调用的七个免费试用模型，无需填写 API Key 即可在模型选择器中直接选择并开始聊天；已有其他提供商配置保持不变，已失效的 Ling 免费模型会从 OpenCode 配置中移除，并明确提示公共网关的限额、模型变化与数据隐私边界。
- 14f321a: 会话列表中的思考、工具调用、运行失败与意外中断预览会跟随界面语言显示；已有会话中保存的英文活动预览也会按当前语言呈现。
- Updated dependencies [dbececb]
- Updated dependencies [43b0e1d]
- Updated dependencies [14f321a]
  - @nextclaw/core@0.15.19
  - @nextclaw/kernel@0.6.21
  - @nextclaw/runtime@0.4.19
  - @nextclaw/mcp@0.3.19

## 0.15.20

### Patch Changes

- 5b9dbcd: 新增 AI 主动送达收件箱：支持 Markdown 与隔离 HTML 报告、未读与归档管理、单窗阅读、文件快照送达，以及从送达内容继续创建上下文关联会话。

  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-ai-delivery-inbox-cn.png | AI 将项目晨报主动送达到 NextClaw 收件箱 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-ai-delivery-inbox-en.png | AI delivering a project brief to the NextClaw inbox -->
  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-ai-delivery-html-cn.png | 后台 Agent 生成的每日 AI 与科技简报在收件箱阅读窗中展示 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-ai-delivery-html-en.png | A daily AI and technology briefing created by a background Agent and displayed in the inbox reader -->
  <!-- release-note-image: zh-CN | images/screenshots/nextclaw-inbox-page-cn.png | 在 NextClaw 收件箱集中查看和管理 AI 主动送达的报告 -->
  <!-- release-note-image: en-US | images/screenshots/nextclaw-inbox-page-en.png | Viewing and managing AI-delivered reports in the NextClaw inbox -->

- Updated dependencies [5b9dbcd]
  - @nextclaw/kernel@0.6.20
  - @nextclaw/core@0.15.18
  - @nextclaw/mcp@0.3.18
  - @nextclaw/runtime@0.4.18

## 0.15.19

### Patch Changes

- d80eeb2: Keep Codex conversations attached to the same thread across idle timeouts, and treat ongoing command output as activity so long-running commands can continue while they are still making progress.
- Updated dependencies
- Updated dependencies [d80eeb2]
- Updated dependencies [215a61f]
  - @nextclaw/core@0.15.17
  - @nextclaw/mcp@0.3.17
  - @nextclaw/runtime@0.4.17
  - @nextclaw/ncp@0.7.15
  - @nextclaw/kernel@0.6.19

## 0.15.18

### Patch Changes

- 77208ed: Panel App 与 HTML 文件展示现在支持传入结构化参数；页面可在首次脚本执行时通过只读的 `window.nextclaw.params` 使用这些运行时数据。
- Updated dependencies [c35189d]
- Updated dependencies
- Updated dependencies [77208ed]
- Updated dependencies [5476d85]
  - @nextclaw/ncp@0.7.14
  - @nextclaw/core@0.15.16
  - @nextclaw/kernel@0.6.18
  - @nextclaw/mcp@0.3.16
  - @nextclaw/runtime@0.4.16

## 0.15.17

### Patch Changes

- 9ec5ea2: 修复带行号打开小型文本或 Markdown 文件时被错误裁成局部内容的问题；未超过预览上限的文件现在会完整展示并继续定位到目标行。
- Updated dependencies
  - @nextclaw/core@0.15.15
  - @nextclaw/kernel@0.6.17
  - @nextclaw/mcp@0.3.15
  - @nextclaw/ncp@0.7.13
  - @nextclaw/runtime@0.4.15

## 0.15.16

### Patch Changes

- 6b84324: Remote access now keeps disconnect and recovery diagnostics, correlates local and relay connection events, detects heartbeat loss, and automatically retries temporary connector-offline pages.
- Updated dependencies
  - @nextclaw/core@0.15.14
  - @nextclaw/kernel@0.6.16
  - @nextclaw/mcp@0.3.14
  - @nextclaw/ncp@0.7.12
  - @nextclaw/runtime@0.4.14

## 0.15.15

### Patch Changes

- e9d49c0: 会话正在回复时继续发送的消息现在由后端按会话排队，并会在当前回复完成后按顺序执行；切换会话或刷新页面后仍能查看、编辑和删除对应会话的待发消息。
- Updated dependencies
- Updated dependencies [80eda82]
- Updated dependencies [e9d49c0]
  - @nextclaw/core@0.15.13
  - @nextclaw/mcp@0.3.13
  - @nextclaw/ncp@0.7.11
  - @nextclaw/runtime@0.4.13
  - @nextclaw/kernel@0.6.15

## 0.15.14

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
  - @nextclaw/core@0.15.12
  - @nextclaw/kernel@0.6.14
  - @nextclaw/mcp@0.3.12
  - @nextclaw/ncp@0.7.10
  - @nextclaw/runtime@0.4.12

## 0.15.13

### Patch Changes

- a7b66d2: Add a clear project-list entry for either creating a new project or adding an existing directory without modifying its contents.
- 36c5362: 新增会话级手动上下文压缩命令，统一通过 Kernel runtime capability 调用 Native 压缩链路或 Codex `thread/compact/start`，并为不支持、会话忙碌和无可压缩历史提供明确反馈。
- d116010: 允许 `show_panel_app` 通过可选绝对路径打开标准 Panels 目录之外的 Panel App，并让侧栏与聊天内联展示复用同一份路径合同和资源加载链路。
- Updated dependencies [36c5362]
- Updated dependencies
- Updated dependencies [d116010]
  - @nextclaw/ncp@0.7.9
  - @nextclaw/kernel@0.6.13
  - @nextclaw/core@0.15.11
  - @nextclaw/mcp@0.3.11
  - @nextclaw/runtime@0.4.11

## 0.15.12

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
  - @nextclaw/core@0.15.10
  - @nextclaw/kernel@0.6.12
  - @nextclaw/mcp@0.3.10
  - @nextclaw/ncp@0.7.8
  - @nextclaw/runtime@0.4.10

## 0.15.11

### Patch Changes

- 61f6bd1: 长会话现在会按需加载较早消息，并使用动态高度虚拟列表保持流畅滚动。HTML、Panel App 与折叠内容展开或收起时会自动校准高度，向上翻页时继续保持当前阅读位置。
- f68d2df: 定时任务页面现在提供自然语言会话入口、任务模板、运行概况、服务端搜索筛选分页和按需详情；创建请求会带入新的 AI 会话继续确认，任务列表也能区分绑定会话与独立会话。
- Updated dependencies [61f6bd1]
- Updated dependencies [97bca64]
- Updated dependencies [dad7880]
- Updated dependencies [c727720]
- Updated dependencies
- Updated dependencies [ddc3213]
  - @nextclaw/ncp@0.7.7
  - @nextclaw/kernel@0.6.11
  - @nextclaw/core@0.15.9
  - @nextclaw/mcp@0.3.9
  - @nextclaw/runtime@0.4.9

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
  - @nextclaw/core@0.15.8
  - @nextclaw/kernel@0.6.10
  - @nextclaw/mcp@0.3.8
  - @nextclaw/ncp@0.7.6
  - @nextclaw/runtime@0.4.8

## 0.15.9

### Patch Changes

- 0111b09: 让桌面端与 NPM 安装态在持续运行期间固定每两小时自动检查更新，不再提供关闭自动检查或启用自动下载的配置；发现新版本后只提示用户，由用户明确点击后才下载和应用。更新通道切换会等待旧检查收口后检查新通道，避免复用过期结果。同步增强本地更新验证，使开发者无需等待真实发版或重启即可验证自动发现、手动下载、应用和版本切换。
- Updated dependencies
- Updated dependencies [0111b09]
  - @nextclaw/core@0.15.7
  - @nextclaw/mcp@0.3.7
  - @nextclaw/ncp@0.7.5
  - @nextclaw/runtime@0.4.7
  - @nextclaw/kernel@0.6.9

## 0.15.8

### Patch Changes

- Updated dependencies [a9b125f]
  - @nextclaw/core@0.15.6
  - @nextclaw/kernel@0.6.8
  - @nextclaw/mcp@0.3.6
  - @nextclaw/runtime@0.4.6

## 0.15.7

### Patch Changes

- 897211a: 新增实验性 UI 注入口：高阶用户和社区工具可以在 NextClaw 数据目录放置 `ui-inject.js`，刷新桌面端或浏览器页面后直接执行自定义界面脚本；删除文件并刷新即可恢复。Skill Marketplace 同步改进最近更新排序、目录刷新、总数表达和历史条目兼容，避免无限滚动末页因旧安装类型导致整页失败。该注入口不提供安全性、DOM 稳定性或跨版本兼容保证。
- Updated dependencies [00c0d23]
  - @nextclaw/kernel@0.6.7

## 0.15.6

### Patch Changes

- 2eceb16: 聊天输入框现在支持通过 `@` 搜索并引用当前项目中的文件或目录：可从统一引用菜单进入文件浏览、查看路径层级并插入引用标签，发送时由 NextClaw 在项目边界内安全、限量地补充对应文件内容或目录结构上下文。
- 59a4723: 新增独立项目注册表与项目模板：项目可以在没有会话时通过界面、CLI 或 AI 创建并展示；界面提供支持导航、搜索和新建文件夹的跨平台服务端目录选择器，并按 macOS、Windows 与 Linux 展示实际可用的常用位置；CLI 与 AI 还可列出项目、修改会话名称及项目目录。
- 8be3173: Allow provider model entries and runtime routing to preserve nested IDs such as `bedrock/claude-fable-5`, including OpenRouter-style vendor/model routes.
- Updated dependencies [2eceb16]
- Updated dependencies [25f8bb0]
- Updated dependencies [59a4723]
- Updated dependencies [8be3173]
  - @nextclaw/kernel@0.6.6
  - @nextclaw/ncp@0.7.4
  - @nextclaw/core@0.15.5
  - @nextclaw/mcp@0.3.5
  - @nextclaw/runtime@0.4.5

## 0.15.5

### Patch Changes

- c01ca0a: 修复 Markdown `file:` 链接的渲染与行列定位：文件保持真实行号，大文件会读取目标行附近的内容，并在源码预览中滚动到目标位置；同时让 `nextclaw-inline` 文件目标在消息中复用现有工作台预览能力展示 HTML、Markdown、代码、图片、媒体、PDF 与 Office 文件。
- 401854e: 聊天框斜杠选择器、底部技能选择器和 Agent 上下文现在会区分项目、NextClaw、全局与内建技能来源；项目技能从项目 `.agents/skills` 加载，项目 `AGENTS.md` 也会随会话上下文生效。
- Updated dependencies [378c8b9]
- Updated dependencies [401854e]
  - @nextclaw/kernel@0.6.5
  - @nextclaw/core@0.15.4
  - @nextclaw/mcp@0.3.4
  - @nextclaw/runtime@0.4.4

## 0.15.4

### Patch Changes

- 91f7bef: Keep valid Markdown resources clickable independently of target availability, render local Markdown images and SVG files correctly, add responsive Word, Excel, and PowerPoint workspace previews, preserve automatic viewers outside HTML source mode, and keep chat popovers open when the streaming composer restores focus.
- Updated dependencies [91f7bef]
  - @nextclaw/kernel@0.6.4

## 0.15.3

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
  - @nextclaw/core@0.15.3
  - @nextclaw/kernel@0.6.3
  - @nextclaw/mcp@0.3.3
  - @nextclaw/ncp@0.7.3
  - @nextclaw/runtime@0.4.3

## 0.15.2

### Patch Changes

- 3fdb755: Support browsing directory paths in the chat workspace preview panel, including relative directory paths resolved against the session working directory.
- Updated dependencies
- Updated dependencies [51cf740]
- Updated dependencies [94c5ab6]
  - @nextclaw/mcp@0.3.2
  - @nextclaw/ncp@0.7.2
  - @nextclaw/runtime@0.4.2
  - @nextclaw/core@0.15.2
  - @nextclaw/kernel@0.6.2

## 0.15.1

### Patch Changes

- 7e94f21: Separate Agent details from editing in the Agent management UI, show per-Agent configuration facts in a read-only details dialog, and limit editable advanced Agent configuration to the context window override.
- 1cc5d4e: Use English defaults for backend, runtime, and protocol-generated session status and abort messages, and carry abort details through NCP events so localized UI can own translation instead of receiving hard-coded Chinese copy.
- a006bb7: Treat user-cancelled chat runs as cancelled session activity instead of failed errors, and keep cancelled runs out of the conversation error surface.
- Updated dependencies [7e94f21]
- Updated dependencies [1cc5d4e]
- Updated dependencies [09b7406]
- Updated dependencies [e6a3443]
- Updated dependencies [a006bb7]
  - @nextclaw/core@0.15.1
  - @nextclaw/kernel@0.6.1
  - @nextclaw/ncp@0.7.1
  - @nextclaw/mcp@0.3.1
  - @nextclaw/runtime@0.4.1

## 0.15.0

### Minor Changes

- Publish the full public NextClaw workspace as a stable minor release.

### Patch Changes

- 191c011: Serve rendered local HTML previews through unrestricted iframe URLs so scripts and relative assets can run closer to normal browser behavior.
- 0c06d9d: Fix false error previews for completed chat sessions whose activity preview was left in a running state.
- Updated dependencies [34f4048]
- Updated dependencies [bf1917a]
- Updated dependencies
- Updated dependencies [6600b99]
- Updated dependencies [61e7a7a]
- Updated dependencies [33a931f]
- Updated dependencies [0c06d9d]
- Updated dependencies [7bcc180]
- Updated dependencies [2d9d1b7]
- Updated dependencies [7bcc180]
- Updated dependencies [b0cb8c2]
  - @nextclaw/kernel@0.6.0
  - @nextclaw/core@0.15.0
  - @nextclaw/mcp@0.3.0
  - @nextclaw/ncp@0.7.0
  - @nextclaw/runtime@0.4.0

## 0.14.8

### Patch Changes

- e990291: Use the nextclaw.net domestic marketplace mirror by default for marketplace reads, with automatic fallback to the official marketplace API when the mirror request fails or times out.
- Updated dependencies [944c27b]
  - @nextclaw/core@0.14.8
  - @nextclaw/kernel@0.5.4
  - @nextclaw/mcp@0.2.18
  - @nextclaw/ncp@0.6.6
  - @nextclaw/runtime@0.3.18

## 0.14.8-beta.0

### Patch Changes

- e990291: Use the nextclaw.net domestic marketplace mirror by default for marketplace reads, with automatic fallback to the official marketplace API when the mirror request fails or times out.
- Updated dependencies
  - @nextclaw/core@0.14.8-beta.0
  - @nextclaw/kernel@0.5.4-beta.0
  - @nextclaw/mcp@0.2.18-beta.0
  - @nextclaw/ncp@0.6.6-beta.0
  - @nextclaw/runtime@0.3.18-beta.0

## 0.14.7

### Patch Changes

- Updated dependencies [901f770]
  - @nextclaw/core@0.14.7
  - @nextclaw/kernel@0.5.3
  - @nextclaw/mcp@0.2.17
  - @nextclaw/runtime@0.3.17

## 0.14.6

### Patch Changes

- Auto-generated full public stable release batch.

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
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
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
  - nextclaw

- Updated dependencies
- Updated dependencies [993fbb8]
- Updated dependencies [d406755]
- Updated dependencies [6586a69]
  - @nextclaw/mcp@0.2.16
  - @nextclaw/ncp@0.6.5
  - @nextclaw/runtime@0.3.16
  - @nextclaw/core@0.14.6
  - @nextclaw/kernel@0.5.2

## 0.14.5

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
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- 13b1d96: Fix Codex NARP sessions getting stuck after prompt timeouts and restore completed activity previews.
- d82790a: Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
- Updated dependencies [f8dfffa]
- Updated dependencies [7067713]
- Updated dependencies
- Updated dependencies [6bb305f]
- Updated dependencies [31601cd]
- Updated dependencies [13b1d96]
- Updated dependencies [9c02046]
- Updated dependencies [595cc16]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
  - @nextclaw/mcp@0.2.15
  - @nextclaw/runtime@0.3.15
  - @nextclaw/core@0.14.5
  - @nextclaw/ncp@0.6.4
  - @nextclaw/kernel@0.5.1

## 0.14.5-beta.1

### Patch Changes

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- Updated dependencies
- Updated dependencies [6bb305f]
- Updated dependencies [9c02046]
  - @nextclaw/core@0.14.5-beta.1
  - @nextclaw/mcp@0.2.15-beta.1
  - @nextclaw/ncp@0.6.4-beta.1
  - @nextclaw/runtime@0.3.15-beta.1
  - @nextclaw/kernel@0.5.1-beta.1

## 0.14.5-beta.0

### Patch Changes

- 13b1d96: Fix Codex NARP sessions getting stuck after prompt timeouts and restore completed activity previews.
- d82790a: Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
- Updated dependencies
- Updated dependencies [13b1d96]
- Updated dependencies [595cc16]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
  - @nextclaw/mcp@0.2.15-beta.0
  - @nextclaw/runtime@0.3.15-beta.0
  - @nextclaw/kernel@0.5.1-beta.0
  - @nextclaw/core@0.14.5-beta.0
  - @nextclaw/ncp@0.6.4-beta.0

## 0.14.4

### Patch Changes

- 3624bbb: Allow NARP runtimes to use their own default model instead of always receiving a NextClaw model override.
- Updated dependencies [89f2f73]
- Updated dependencies
- Updated dependencies [c4ee481]
- Updated dependencies [d2ca679]
- Updated dependencies [3624bbb]
  - @nextclaw/core@0.14.4
  - @nextclaw/kernel@0.5.0
  - @nextclaw/mcp@0.2.14
  - @nextclaw/ncp@0.6.3
  - @nextclaw/runtime@0.3.14

## 0.14.3

### Patch Changes

- Auto-generated full public beta release batch.

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
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
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
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared

- Updated dependencies
- Updated dependencies [6b44d57]
- Updated dependencies [d20dc48]
- Updated dependencies [e283af5]
- Updated dependencies [7eed591]
  - @nextclaw/mcp@0.2.13
  - @nextclaw/ncp@0.6.2
  - @nextclaw/core@0.14.3
  - @nextclaw/kernel@0.4.3
  - @nextclaw/runtime@0.3.13

## 0.14.2

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
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
  - @nextclaw/mcp
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
  - @nextclaw/shared

- Updated dependencies
- Updated dependencies [36c4e56]
  - @nextclaw/core@0.14.2
  - @nextclaw/mcp@0.2.12
  - @nextclaw/runtime@0.3.12
  - @nextclaw/ncp@0.6.1
  - @nextclaw/kernel@0.4.2

## 0.14.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
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
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
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

- cc024b3: Expose the original agent-run peerId on NCP session summaries and support filtering session lists by peerId.
- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies [1ed5aff]
- Updated dependencies
- Updated dependencies [78fcd8f]
- Updated dependencies [42281c8]
- Updated dependencies [cc024b3]
- Updated dependencies [458c9b0]
- Updated dependencies [6ec95a0]
  - @nextclaw/mcp@0.2.11
  - @nextclaw/runtime@0.3.11
  - @nextclaw/ncp@0.6.0
  - @nextclaw/core@0.14.1
  - @nextclaw/kernel@0.4.1

## 0.14.1-beta.0

### Patch Changes

- cc024b3: Expose the original agent-run peerId on NCP session summaries and support filtering session lists by peerId.
- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies
- Updated dependencies [42281c8]
- Updated dependencies [cc024b3]
- Updated dependencies [458c9b0]
- Updated dependencies [6ec95a0]
  - @nextclaw/mcp@0.2.11-beta.0
  - @nextclaw/runtime@0.3.11-beta.0
  - @nextclaw/kernel@0.4.1-beta.0
  - @nextclaw/ncp@0.6.0-beta.0
  - @nextclaw/core@0.14.1-beta.0

## 0.14.0

### Minor Changes

- bfa611f: Add standard agent run client APIs and HTTP routes.

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- Updated dependencies [14c5730]
- Updated dependencies [43da21a]
- Updated dependencies [226b3cf]
- Updated dependencies [0dc6471]
- Updated dependencies [86a0dc8]
- Updated dependencies [240d5ab]
- Updated dependencies [75e0dcb]
- Updated dependencies [170c8be]
- Updated dependencies [86acdbe]
  - @nextclaw/mcp@0.2.10
  - @nextclaw/ncp@0.5.29
  - @nextclaw/runtime@0.3.10
  - @nextclaw/core@0.14.0
  - @nextclaw/kernel@0.4.0

## 0.14.0-beta.1

### Minor Changes

- bfa611f: Add standard agent run client APIs and HTTP routes.

### Patch Changes

- Updated dependencies
- Updated dependencies [226b3cf]
- Updated dependencies [240d5ab]
- Updated dependencies [75e0dcb]
  - @nextclaw/mcp@0.2.10-beta.1
  - @nextclaw/ncp@0.5.29-beta.1
  - @nextclaw/runtime@0.3.10-beta.1
  - @nextclaw/core@0.14.0-beta.1
  - @nextclaw/kernel@0.4.0-beta.1

## 0.13.10-beta.0

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- Updated dependencies
- Updated dependencies [86a0dc8]
- Updated dependencies [170c8be]
- Updated dependencies [86acdbe]
  - @nextclaw/mcp@0.2.10-beta.0
  - @nextclaw/ncp@0.5.29-beta.0
  - @nextclaw/runtime@0.3.10-beta.0
  - @nextclaw/core@0.13.10-beta.0
  - @nextclaw/kernel@0.3.4-beta.0

## 0.13.9

### Patch Changes

- 3061877: Decouple cron jobs from channel delivery settings. Scheduled jobs now ask the agent to call the message tool for notifications, while Weixin sends fail honestly when account, channel, API, or context_token delivery state is unavailable.
- Updated dependencies
- Updated dependencies [3061877]
  - @nextclaw/mcp@0.2.9
  - @nextclaw/ncp@0.5.28
  - @nextclaw/runtime@0.3.9
  - @nextclaw/core@0.13.9
  - @nextclaw/kernel@0.3.3

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
  - @nextclaw/core@0.13.8
  - @nextclaw/kernel@0.3.2
  - @nextclaw/mcp@0.2.8
  - @nextclaw/ncp@0.5.27
  - @nextclaw/runtime@0.3.8

## 0.13.7

### Patch Changes

- Clarify built-in app creator skills so generated Panel Apps and Service Apps do not ask users to restart NextClaw for normal workspace changes.
- Updated dependencies
  - @nextclaw/core@0.13.7
  - @nextclaw/kernel@0.3.1
  - @nextclaw/runtime@0.3.7
  - @nextclaw/mcp@0.2.7

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
  - @nextclaw/core@0.13.6
  - @nextclaw/kernel@0.3.0
  - @nextclaw/mcp@0.2.6
  - @nextclaw/ncp@0.5.26
  - @nextclaw/runtime@0.3.6

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
  - @nextclaw/core@0.13.5
  - @nextclaw/kernel@0.2.5
  - @nextclaw/mcp@0.2.5
  - @nextclaw/ncp@0.5.25
  - @nextclaw/runtime@0.3.5

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
  - @nextclaw/core@0.13.4
  - @nextclaw/kernel@0.2.4
  - @nextclaw/mcp@0.2.4
  - @nextclaw/ncp@0.5.24
  - @nextclaw/runtime@0.3.4

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
  - @nextclaw/core@0.13.3
  - @nextclaw/kernel@0.2.3
  - @nextclaw/mcp@0.2.3
  - @nextclaw/ncp@0.5.23
  - @nextclaw/runtime@0.3.3

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
  - @nextclaw/core@0.13.2
  - @nextclaw/kernel@0.2.2
  - @nextclaw/mcp@0.2.2
  - @nextclaw/ncp@0.5.22
  - @nextclaw/runtime@0.3.2

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
  - @nextclaw/core@0.13.1
  - @nextclaw/kernel@0.2.1
  - @nextclaw/mcp@0.2.1
  - @nextclaw/ncp@0.5.21
  - @nextclaw/runtime@0.3.1

## 0.13.0

### Minor Changes

- Release the NextClaw lightweight app platform as a minor feature line.

  Panel Apps now receive developer-friendly bridge results: service action lists resolve to arrays, service action invokes resolve to business payloads, and built-in app creator skills document the canonical Panel + Service + Agent contract.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.13.0
  - @nextclaw/kernel@0.2.0
  - @nextclaw/mcp@0.2.0
  - @nextclaw/runtime@0.3.0

## 0.12.28

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
  - @nextclaw/core@0.12.27
  - @nextclaw/kernel@0.1.17
  - @nextclaw/mcp@0.1.92
  - @nextclaw/ncp@0.5.20
  - @nextclaw/runtime@0.2.59

## 0.12.27

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
  - @nextclaw/core@0.12.26
  - @nextclaw/kernel@0.1.16
  - @nextclaw/mcp@0.1.91
  - @nextclaw/ncp@0.5.19
  - @nextclaw/runtime@0.2.58

## 0.12.26

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
  - @nextclaw/core@0.12.25
  - @nextclaw/kernel@0.1.15
  - @nextclaw/mcp@0.1.90
  - @nextclaw/ncp@0.5.18
  - @nextclaw/runtime@0.2.57

## 0.12.26-beta.7

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
  - @nextclaw/core@0.12.25-beta.7
  - @nextclaw/kernel@0.1.15-beta.7
  - @nextclaw/mcp@0.1.90-beta.7
  - @nextclaw/ncp@0.5.18-beta.7
  - @nextclaw/runtime@0.2.57-beta.7

## 0.12.26-beta.6

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
  - @nextclaw/core@0.12.25-beta.6
  - @nextclaw/kernel@0.1.15-beta.6
  - @nextclaw/mcp@0.1.90-beta.6
  - @nextclaw/ncp@0.5.18-beta.6
  - @nextclaw/runtime@0.2.57-beta.6

## 0.12.26-beta.5

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
  - @nextclaw/core@0.12.25-beta.5
  - @nextclaw/kernel@0.1.15-beta.5
  - @nextclaw/mcp@0.1.90-beta.5
  - @nextclaw/ncp@0.5.18-beta.5
  - @nextclaw/runtime@0.2.57-beta.5

## 0.12.26-beta.4

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
  - @nextclaw/core@0.12.25-beta.4
  - @nextclaw/kernel@0.1.15-beta.4
  - @nextclaw/mcp@0.1.90-beta.4
  - @nextclaw/ncp@0.5.18-beta.4
  - @nextclaw/runtime@0.2.57-beta.4

## 0.12.26-beta.3

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
  - @nextclaw/core@0.12.25-beta.3
  - @nextclaw/kernel@0.1.15-beta.3
  - @nextclaw/mcp@0.1.90-beta.3
  - @nextclaw/ncp@0.5.18-beta.3
  - @nextclaw/runtime@0.2.57-beta.3

## 0.12.26-beta.2

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
  - @nextclaw/core@0.12.25-beta.2
  - @nextclaw/kernel@0.1.15-beta.2
  - @nextclaw/mcp@0.1.90-beta.2
  - @nextclaw/ncp@0.5.18-beta.2
  - @nextclaw/runtime@0.2.57-beta.2

## 0.12.26-beta.1

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
  - @nextclaw/core@0.12.25-beta.1
  - @nextclaw/kernel@0.1.15-beta.1
  - @nextclaw/mcp@0.1.90-beta.1
  - @nextclaw/ncp@0.5.18-beta.1
  - @nextclaw/runtime@0.2.57-beta.1

## 0.12.26-beta.0

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
  - @nextclaw/core@0.12.25-beta.0
  - @nextclaw/kernel@0.1.15-beta.0
  - @nextclaw/mcp@0.1.90-beta.0
  - @nextclaw/ncp@0.5.18-beta.0
  - @nextclaw/runtime@0.2.57-beta.0

## 0.12.25

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
  - @nextclaw/core@0.12.24
  - @nextclaw/kernel@0.1.14
  - @nextclaw/mcp@0.1.89
  - @nextclaw/ncp@0.5.17
  - @nextclaw/openclaw-compat@1.0.24
  - @nextclaw/runtime@0.2.56

## 0.12.24

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
  - @nextclaw/core@0.12.23
  - @nextclaw/kernel@0.1.13
  - @nextclaw/mcp@0.1.88
  - @nextclaw/ncp@0.5.16
  - @nextclaw/openclaw-compat@1.0.23
  - @nextclaw/runtime@0.2.55

## 0.12.23

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
  - @nextclaw/core@0.12.22
  - @nextclaw/kernel@0.1.12
  - @nextclaw/mcp@0.1.87
  - @nextclaw/ncp@0.5.15
  - @nextclaw/openclaw-compat@1.0.22
  - @nextclaw/runtime@0.2.54

## 0.12.22

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
  - @nextclaw/core@0.12.21
  - @nextclaw/kernel@0.1.11
  - @nextclaw/mcp@0.1.86
  - @nextclaw/ncp@0.5.14
  - @nextclaw/openclaw-compat@1.0.21
  - @nextclaw/runtime@0.2.53

## 0.12.21

### Patch Changes

- @nextclaw/kernel@0.1.10

## 0.12.20

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
  - @nextclaw/core@0.12.20
  - @nextclaw/kernel@0.1.9
  - @nextclaw/mcp@0.1.85
  - @nextclaw/ncp@0.5.13
  - @nextclaw/openclaw-compat@1.0.20
  - @nextclaw/runtime@0.2.52

## 0.12.19

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
  - @nextclaw/kernel@0.1.8
  - @nextclaw/mcp@0.1.84
  - @nextclaw/ncp@0.5.12
  - @nextclaw/ncp-http-agent-server@0.3.24
  - @nextclaw/openclaw-compat@1.0.19
  - @nextclaw/runtime@0.2.51

## 0.12.18

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
  - @nextclaw/kernel@0.1.7
  - @nextclaw/mcp@0.1.83
  - @nextclaw/ncp@0.5.11
  - @nextclaw/ncp-http-agent-server@0.3.23
  - @nextclaw/openclaw-compat@1.0.18
  - @nextclaw/runtime@0.2.50

## 0.12.17

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
  - @nextclaw/kernel@0.1.6
  - @nextclaw/mcp@0.1.82
  - @nextclaw/ncp@0.5.10
  - @nextclaw/ncp-http-agent-server@0.3.22
  - @nextclaw/openclaw-compat@1.0.17
  - @nextclaw/runtime@0.2.49

## 0.12.16

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
  - @nextclaw/kernel@0.1.5
  - @nextclaw/mcp@0.1.81
  - @nextclaw/ncp@0.5.9
  - @nextclaw/ncp-http-agent-server@0.3.21
  - @nextclaw/openclaw-compat@1.0.16
  - @nextclaw/runtime@0.2.48

## 0.12.15

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
  - @nextclaw/kernel@0.1.4
  - @nextclaw/mcp@0.1.80
  - @nextclaw/ncp@0.5.8
  - @nextclaw/ncp-http-agent-server@0.3.20
  - @nextclaw/openclaw-compat@1.0.15
  - @nextclaw/runtime@0.2.47

## 0.12.14

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
  - @nextclaw/kernel@0.1.3
  - @nextclaw/mcp@0.1.79
  - @nextclaw/ncp@0.5.7
  - @nextclaw/ncp-http-agent-server@0.3.19
  - @nextclaw/openclaw-compat@1.0.14
  - @nextclaw/runtime@0.2.46

## 0.12.13

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
- Updated dependencies [85d8439]
  - @nextclaw/core@0.12.13
  - @nextclaw/ncp@0.5.6
  - @nextclaw/runtime@0.2.45
  - @nextclaw/kernel@0.1.2
  - @nextclaw/mcp@0.1.78
  - @nextclaw/ncp-http-agent-server@0.3.18
  - @nextclaw/openclaw-compat@1.0.13

## 0.12.13-beta.6

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
  - @nextclaw/core@0.12.13-beta.5
  - @nextclaw/kernel@0.1.2-beta.6
  - @nextclaw/mcp@0.1.78-beta.5
  - @nextclaw/ncp@0.5.6-beta.4
  - @nextclaw/ncp-http-agent-server@0.3.18-beta.5
  - @nextclaw/openclaw-compat@1.0.13-beta.6
  - @nextclaw/runtime@0.2.45-beta.4

## 0.12.13-beta.5

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
  - @nextclaw/core@0.12.13-beta.4
  - @nextclaw/kernel@0.1.2-beta.5
  - @nextclaw/mcp@0.1.78-beta.4
  - @nextclaw/ncp@0.5.6-beta.3
  - @nextclaw/ncp-http-agent-server@0.3.18-beta.4
  - @nextclaw/openclaw-compat@1.0.13-beta.5
  - @nextclaw/runtime@0.2.45-beta.3

## 0.12.13-beta.4

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
  - @nextclaw/core@0.12.13-beta.3
  - @nextclaw/kernel@0.1.2-beta.4
  - @nextclaw/mcp@0.1.78-beta.3
  - @nextclaw/ncp@0.5.6-beta.2
  - @nextclaw/ncp-http-agent-server@0.3.18-beta.3
  - @nextclaw/openclaw-compat@1.0.13-beta.4
  - @nextclaw/runtime@0.2.45-beta.2

## 0.12.13-beta.3

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
  - @nextclaw/core@0.12.13-beta.2
  - @nextclaw/kernel@0.1.2-beta.3
  - @nextclaw/mcp@0.1.78-beta.2
  - @nextclaw/ncp@0.5.6-beta.1
  - @nextclaw/ncp-http-agent-server@0.3.18-beta.2
  - @nextclaw/openclaw-compat@1.0.13-beta.3
  - @nextclaw/runtime@0.2.45-beta.1

## 0.12.13-beta.2

### Patch Changes

- Updated dependencies [85d8439]
  - @nextclaw/openclaw-compat@1.0.13-beta.2

## 0.12.13-beta.1

### Patch Changes

- Updated dependencies
  - @nextclaw/kernel@0.1.2-beta.2
  - @nextclaw/mcp@0.1.78-beta.1
  - @nextclaw/ncp-http-agent-server@0.3.18-beta.1
  - @nextclaw/openclaw-compat@1.0.13-beta.1

## 0.12.13-beta.0

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
  - @nextclaw/core@0.12.13-beta.1
  - @nextclaw/ncp@0.5.6-beta.0
  - @nextclaw/runtime@0.2.45-beta.0
  - @nextclaw/openclaw-compat@1.0.13-beta.0
  - @nextclaw/mcp@0.1.78-beta.0
  - @nextclaw/ncp-http-agent-server@0.3.18-beta.0
  - @nextclaw/kernel@0.1.2-beta.1

## 0.12.12

### Patch Changes

- Add target session support for cron jobs across CLI, API, UI, and agent tooling.
- Updated dependencies
  - @nextclaw/core@0.12.12
  - @nextclaw/mcp@0.1.77
  - @nextclaw/openclaw-compat@1.0.12
  - @nextclaw/runtime@0.2.44

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
  - @nextclaw/core@0.12.11
  - @nextclaw/mcp@0.1.76
  - @nextclaw/ncp@0.5.5
  - @nextclaw/ncp-http-agent-server@0.3.17
  - @nextclaw/openclaw-compat@1.0.11
  - @nextclaw/runtime@0.2.43

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
  - @nextclaw/core@0.12.10
  - @nextclaw/mcp@0.1.75
  - @nextclaw/ncp@0.5.4
  - @nextclaw/ncp-http-agent-server@0.3.16
  - @nextclaw/openclaw-compat@1.0.10
  - @nextclaw/runtime@0.2.42

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
  - @nextclaw/core@0.12.9
  - @nextclaw/mcp@0.1.74
  - @nextclaw/ncp@0.5.3
  - @nextclaw/ncp-http-agent-server@0.3.15
  - @nextclaw/openclaw-compat@1.0.9
  - @nextclaw/runtime@0.2.41

## 0.12.8

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.12.8
  - @nextclaw/mcp@0.1.73
  - @nextclaw/openclaw-compat@1.0.8
  - @nextclaw/runtime@0.2.40

## 0.12.7

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
  - @nextclaw/core@0.12.7
  - @nextclaw/ncp@0.5.2
  - @nextclaw/openclaw-compat@1.0.7
  - @nextclaw/mcp@0.1.72
  - @nextclaw/runtime@0.2.39
  - @nextclaw/ncp-http-agent-server@0.3.14

## 0.12.6

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
  - @nextclaw/core@0.12.6
  - @nextclaw/mcp@0.1.71
  - @nextclaw/ncp@0.5.1
  - @nextclaw/ncp-http-agent-server@0.3.13
  - @nextclaw/openclaw-compat@1.0.6
  - @nextclaw/runtime@0.2.38

## 0.12.5

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
  - @nextclaw/core@0.12.5
  - @nextclaw/mcp@0.1.70
  - @nextclaw/openclaw-compat@1.0.5
  - @nextclaw/runtime@0.2.37

## 0.12.4

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
  - @nextclaw/core@0.12.4
  - @nextclaw/openclaw-compat@1.0.4
  - @nextclaw/runtime@0.2.36
  - @nextclaw/mcp@0.1.69

## 0.12.3

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
  - @nextclaw/core@0.12.3
  - @nextclaw/mcp@0.1.68
  - @nextclaw/openclaw-compat@1.0.3
  - @nextclaw/runtime@0.2.35

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
  - @nextclaw/core@0.12.2
  - @nextclaw/mcp@0.1.67
  - @nextclaw/openclaw-compat@1.0.2
  - @nextclaw/runtime@0.2.34

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
  - @nextclaw/core@0.12.1
  - @nextclaw/mcp@0.1.66
  - @nextclaw/openclaw-compat@1.0.1
  - @nextclaw/runtime@0.2.33

## 0.12.0

### Minor Changes

- Release the unpublished multi-agent batch as one aligned npm release.

  This release includes the new multi-agent management flow across CLI, server, and UI, agent-scoped session ownership and child-session conversation unification, plus the agent identity rendering improvements for spawned child sessions and tool cards.

  It also ships the openclaw marketplace/runtime npm install alignment and republishes the dependent public package chain so workspace versions stay consistent downstream.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.12.0
  - @nextclaw/ncp@0.5.0
  - @nextclaw/openclaw-compat@1.0.0
  - @nextclaw/mcp@0.1.65
  - @nextclaw/runtime@0.2.32
  - @nextclaw/ncp-http-agent-server@0.3.12

## 0.11.24

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.17
  - @nextclaw/ncp-http-agent-server@0.3.11
  - @nextclaw/mcp@0.1.64
  - @nextclaw/openclaw-compat@0.3.58
  - @nextclaw/runtime@0.2.31

## 0.11.23

### Patch Changes

- Publish the full April 2 to April 3 public package drift as one aligned patch batch.

  This release includes the session-scoped project context chain, project-aware skill loading, chat header project interactions, server path picker improvements, file operation card rendering refinements, and the aligned runtime or engine updates behind them.

  It also republishes the affected direct dependents so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/core@0.11.16
  - @nextclaw/mcp@0.1.63
  - @nextclaw/openclaw-compat@0.3.57
  - @nextclaw/runtime@0.2.30

## 0.11.22

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.6
  - @nextclaw/core@0.11.15
  - @nextclaw/mcp@0.1.62
  - @nextclaw/runtime@0.2.29
  - @nextclaw/openclaw-compat@0.3.56
  - @nextclaw/ncp-http-agent-server@0.3.10

## 0.11.21

### Patch Changes

- Updated dependencies [f65c1f5]
  - @nextclaw/ncp@0.4.5
  - @nextclaw/ncp-http-agent-server@0.3.9
  - @nextclaw/openclaw-compat@0.3.55

## 0.11.20

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/core@0.11.14
  - @nextclaw/mcp@0.1.61
  - @nextclaw/ncp@0.4.4
  - @nextclaw/ncp-http-agent-server@0.3.8
  - @nextclaw/openclaw-compat@0.3.54
  - @nextclaw/runtime@0.2.28

## 0.11.19

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/core@0.11.13
  - @nextclaw/mcp@0.1.60
  - @nextclaw/ncp@0.4.3
  - @nextclaw/ncp-http-agent-server@0.3.7
  - @nextclaw/openclaw-compat@0.3.53
  - @nextclaw/runtime@0.2.27

## 0.11.18

### Patch Changes

- Release pending session labeling and session context icon improvements.
- Updated dependencies
  - @nextclaw/core@0.11.12
  - @nextclaw/mcp@0.1.59
  - @nextclaw/openclaw-compat@0.3.52
  - @nextclaw/runtime@0.2.26

## 0.11.17

### Patch Changes

- Align NCP chat session run status with direct realtime events so parent replies, sidebar spinners, and chat completion state settle without refresh after sub-agent runs finish.
  - @nextclaw/openclaw-compat@0.3.51

## 0.11.16

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.11
  - @nextclaw/ncp@0.4.2
  - @nextclaw/mcp@0.1.58
  - @nextclaw/openclaw-compat@0.3.50
  - @nextclaw/runtime@0.2.25
  - @nextclaw/ncp-http-agent-server@0.3.6

## 0.11.15

### Patch Changes

- Fix NCP subagent completion so results persist back into the originating session, become visible in chat after realtime refresh, and no longer depend on the legacy system-message relay.
- Updated dependencies
  - @nextclaw/core@0.11.10
  - @nextclaw/mcp@0.1.57
  - @nextclaw/openclaw-compat@0.3.49
  - @nextclaw/runtime@0.2.24

## 0.11.14

### Patch Changes

- Align cron list semantics across the agent tool, CLI, and UI server so disabled jobs are visible by default with explicit enabled/disabled status, add clear enable/disable actions without conflating them with remove, and tighten cron skill guidance so one-shot jobs use `at` and scheduled channel sends store runnable instructions instead of only outbound message text.
- Updated dependencies
  - @nextclaw/core@0.11.9
  - @nextclaw/mcp@0.1.56
  - @nextclaw/openclaw-compat@0.3.48
  - @nextclaw/runtime@0.2.23

## 0.11.13

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.8
  - @nextclaw/openclaw-compat@0.3.47
  - @nextclaw/mcp@0.1.55
  - @nextclaw/runtime@0.2.22

## 0.11.12

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.1
  - @nextclaw/ncp-http-agent-server@0.3.5
  - @nextclaw/openclaw-compat@0.3.46

## 0.11.11

### Patch Changes

- Release the current cross-channel routing fixes as one aligned patch batch.
  - expose built-in skill descriptions so the agent can discover `cross-channel-messaging` at the right time
  - let `sessions_list` filter by resolved route fields such as `channel`, `to`, `accountId`, and `sessionKey`
  - fail fast when `message` tries to send to another channel without an explicit target, preventing false-success Feishu sends
  - clarify Feishu and Weixin route lookup guidance so proactive sends reuse saved session routes instead of guessing identifiers
  - include the already-unpublished `@nextclaw/runtime` provider catalog drift in the same release closure so release health returns to clean

- Updated dependencies
  - @nextclaw/core@0.11.7
  - @nextclaw/mcp@0.1.54
  - @nextclaw/openclaw-compat@0.3.45
  - @nextclaw/runtime@0.2.21

## 0.11.10

### Patch Changes

- 2a5f94e: Recover the Weixin self-notify release path after a published version collision on `@nextclaw/channel-plugin-weixin`.

  The previous batch released the main packages successfully, but `@nextclaw/channel-plugin-weixin@0.1.12` already existed on npm and was skipped. This recovery release publishes the actual Weixin route-hint changes under a new version and realigns `@nextclaw/openclaw-compat`, `@nextclaw/server`, and `nextclaw` onto that published dependency.

- Updated dependencies [2a5f94e]
  - @nextclaw/openclaw-compat@0.3.44

## 0.11.9

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/core@0.11.6
  - @nextclaw/mcp@0.1.53
  - @nextclaw/openclaw-compat@0.3.43
  - @nextclaw/runtime@0.2.20

## 0.11.8

### Patch Changes

- Publish the marketplace fetch retry fixes for both the UI server proxy and the CLI skill install flow, and keep the public dependency chain aligned.

## 0.11.7

### Patch Changes

- @nextclaw/openclaw-compat@0.3.42

## 0.11.6

### Patch Changes

- Release the accumulated public workspace drift together with the Codex Responses contract fix. This batch includes the new stream-completion probe, the Codex runtime bundle entry alignment, and the already-unpublished package changes that the release guard requires to be versioned before publish.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.41

## 0.11.5

### Patch Changes

- Fix Codex CLI environment inheritance so the runtime keeps the host `PATH` and other base process variables when spawning command execution, and publish the plugin/runtime pair together for version alignment.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.40

## 0.11.4

### Patch Changes

- Release pending workspace drift from earlier package updates.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.39

## 0.11.3

### Patch Changes

- Fix the installed Codex session provider resolution path by making `@nextclaw/openclaw-compat` consume the host `@nextclaw/core` singleton instead of publishing its own runtime copy. Publish the aligned `@nextclaw/openclaw-compat`, `@nextclaw/server`, `@nextclaw/remote`, and `nextclaw` packages together so installed NextClaw no longer loses provider `defaultApiBase` for non-native models such as `minimax/MiniMax-M2.7`.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.38

## 0.11.2

### Patch Changes

- Publish the current committed runtime and UI startup fixes as one aligned patch batch. This release moves the Codex runtime plugin onto host-injected agent runtime APIs, splits UI session reads from the deferred NCP runtime so `/api/ncp/sessions` is available before the runtime agent is ready, and republishes the linked public packages above the currently published tags so the shipped dependency chain stays version-consistent.
- Updated dependencies
  - @nextclaw/core@0.11.3
  - @nextclaw/openclaw-compat@0.3.36
  - @nextclaw/mcp@0.1.52
  - @nextclaw/runtime@0.2.17

## 0.11.1

### Patch Changes

- Align the Codex NCP runtime plugin with host runtime injection instead of relying on a forced `@nextclaw/core` singleton alias. The plugin now resolves provider runtime, workspace, and bootstrap-aware prompts through the host plugin runtime API, and no longer ships a direct runtime dependency on `@nextclaw/core`.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.35

## 0.11.0

### Minor Changes

- Unify the NCP file pipeline around an asset store abstraction with `put`, `export`, and `stat`.

  This release removes default prompt-time file content injection, replaces `attachmentUri` with `assetUri`, adds `asset_put` / `asset_export` / `asset_stat`, and updates the UI/server upload flow to return and render managed assets directly.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0
  - @nextclaw/ncp-http-agent-server@0.3.4
  - @nextclaw/openclaw-compat@0.3.34

## 0.10.57

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/ncp@0.3.3
  - @nextclaw/core@0.11.2
  - @nextclaw/mcp@0.1.51
  - @nextclaw/runtime@0.2.16
  - @nextclaw/openclaw-compat@0.3.33
  - @nextclaw/ncp-http-agent-server@0.3.3

## 0.10.56

### Patch Changes

- Fix channel startup so a long-running plugin gateway no longer blocks the rest of the channel runtime from starting.

  This release hardens the host-side gateway startup contract and updates the Feishu gateway to run its long-lived monitor in the background, allowing QQ, Discord, Weixin, and other channels to continue starting normally.

- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.32

## 0.10.55

### Patch Changes

- Fix Feishu immediate feedback by triggering reply-start acknowledgements through the runtime bridge and using a visible receipt reaction instead of a streaming placeholder.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.31

## 0.10.54

### Patch Changes

- Release frontend UI changes and aligned CLI/server release group packages.
- Updated dependencies
  - @nextclaw/mcp@0.1.50

## 0.10.53

### Patch Changes

- Fix NCP session type observation so reading available session types no longer triggers Claude capability probes. Split observation and probe semantics for session-type descriptors and isolate Claude descriptor caching per mode. Republish the linked `@nextclaw/mcp` / `@nextclaw/server` / `nextclaw` release group in one batch for version alignment.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.30
  - @nextclaw/mcp@0.1.49

## 0.10.52

### Patch Changes

- Fix the NextClaw plugin runtime contract so Feishu channel gateways no longer fail during startup after the legacy Feishu runtime removal.

  This release adds the missing compat runtime helpers used by the Feishu plugin gateway, including inbound debounce, reply orchestration, text helpers, routing, media helpers, and logging support.

- Updated dependencies
  - @nextclaw/mcp@0.1.48
  - @nextclaw/openclaw-compat@0.3.29

## 0.10.51

### Patch Changes

- Remove the legacy Feishu channel runtime, keep the plugin-based Feishu path as the single ingress implementation, and make plugin runtime image attachments reach the agent even for attachment-only messages.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.28
  - @nextclaw/mcp@0.1.47

## 0.10.50

### Patch Changes

- Unify channel configuration around `channels.*` and stop writing channel runtime state back into plugin config entries.

  Preserve plugin-channel config keys in the core schema, route CLI and UI channel reads and writes through the projected channel view, and ensure plugin channel gateways honor the projected `channels.<id>.enabled` state.

- Updated dependencies
  - @nextclaw/mcp@0.1.46
  - @nextclaw/core@0.11.1
  - @nextclaw/openclaw-compat@0.3.27
  - @nextclaw/runtime@0.2.15

## 0.10.49

### Patch Changes

- ee69ef6: Keep pasted and uploaded NCP images in composer order end to end: preserve caret placement, retain image visibility across follow-up turns without hidden model switching, and serialize mixed text/image message parts in the same order users authored them.
- Updated dependencies [ee69ef6]
  - @nextclaw/mcp@0.1.45

## 0.10.48

### Patch Changes

- Polish remote access failure handling so startup auth bootstrap no longer degrades into a blank screen, keep the remote request path on websocket multiplex with explicit timeouts, and align the bundled NextClaw release group with the updated remote access UX.
- Updated dependencies
  - @nextclaw/mcp@0.1.44

## 0.10.47

### Patch Changes

- Republish the NextClaw CLI release group so the bundled UI includes NCP image attachment support in the shipped ui-dist.
- Updated dependencies
  - @nextclaw/mcp@0.1.43

## 0.10.46

### Patch Changes

- Add NCP image attachment support across the shared chat composer, NCP runtime, React bindings, and bundled NextClaw UI so pasted or uploaded images are sent as NCP file parts and rendered inline. Also keep the required CLI/server/mcp release group in sync for the bundled NextClaw distribution.
- Updated dependencies
  - @nextclaw/mcp@0.1.42

## 0.10.45

### Patch Changes

- Fix Feishu/OpenClaw plugin runtime image attachments so MediaPaths and MediaUrls reach the NextClaw runtime as inbound attachments during direct dispatch, and republish the aligned NextClaw CLI release group for version consistency.
- Updated dependencies
  - @nextclaw/mcp@0.1.41

## 0.10.44

### Patch Changes

- Finalize the Feishu upstream capability sync by splitting the sheets implementation into a shared helper module, keeping the new OAuth, calendar, task, sheets, and identity surface maintainable while preserving the released behavior and release-group alignment.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.26
  - @nextclaw/mcp@0.1.40

## 0.10.43

### Patch Changes

- Ship the next Feishu upstream capability sync round by adding user-identity execution for OAuth, calendar, task, and sheets operations, plus the supporting ticket and scope plumbing needed to mirror the high-value upstream tool surface inside NextClaw. Republish the NextClaw release group so the bundled CLI/runtime chain stays version-aligned.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.25
  - @nextclaw/mcp@0.1.39

## 0.10.42

### Patch Changes

- bb891c2: Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.
- Updated dependencies [bb891c2]
  - @nextclaw/core@0.11.0
  - @nextclaw/openclaw-compat@0.3.24
  - @nextclaw/mcp@0.1.38
  - @nextclaw/runtime@0.2.14

## 0.10.41

### Patch Changes

- Fix the Feishu plugin startup regression where plugin channel gateways enumerated accounts without receiving runtime config, causing nextclaw service startup to fail after update.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.23
  - @nextclaw/mcp@0.1.37

## 0.10.40

### Patch Changes

- Publish a follow-up patch so the published `nextclaw` and `@nextclaw/server` packages depend on the corrected `@nextclaw/openclaw-compat` release instead of the previously published `0.3.20`.
- Updated dependencies
  - @nextclaw/mcp@0.1.36
  - @nextclaw/openclaw-compat@0.3.22

## 0.10.39

### Patch Changes

- Remove the Feishu plugin's runtime dependency on `openclaw/plugin-sdk/*` by switching it to a bundled NextClaw thin compatibility layer. Remove the accidental `openclaw` package dependency and delete the `pi-coding-agent` shim that slipped into the previous release.
- Updated dependencies
  - @nextclaw/mcp@0.1.35
  - @nextclaw/openclaw-compat@0.3.21

## 0.10.38

### Patch Changes

- Align bundled Feishu support with the official OpenClaw plugin by vendoring the upstream Feishu plugin into NextClaw, teaching the compat loader to prefer plugin-local OpenClaw SDK resolution, and adding the minimal loader shims needed for the official Feishu tools to register inside NextClaw.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.20
  - @nextclaw/mcp@0.1.34

## 0.10.37

### Patch Changes

- Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.
- Updated dependencies
  - @nextclaw/core@0.10.0
  - @nextclaw/openclaw-compat@0.3.19
  - @nextclaw/mcp@0.1.33
  - @nextclaw/runtime@0.2.13

## 0.10.36

### Patch Changes

- Raise remote connector exponential backoff to a 30 minute cap for non-terminal websocket failures so long outages generate fewer reconnect requests while terminal auth and configuration errors still stop immediately.
- Updated dependencies
  - @nextclaw/mcp@0.1.32

## 0.10.35

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12
  - @nextclaw/mcp@0.1.31
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-http-agent-server@0.3.2
  - @nextclaw/openclaw-compat@0.3.18
  - @nextclaw/runtime@0.2.12

## 0.10.34

### Patch Changes

- @nextclaw/mcp@0.1.30
- @nextclaw/openclaw-compat@0.3.17

## 0.10.33

### Patch Changes

- Stop unbounded remote websocket reconnect loops by classifying terminal handshake failures,
  backing off retry timing, halting after repeated failures, and preserving the registered
  device across reconnect attempts. Keep the CLI release group aligned with version-only
  companion releases for `@nextclaw/mcp` and `@nextclaw/server`.
- Updated dependencies
  - @nextclaw/mcp@0.1.29

## 0.10.32

### Patch Changes

- Republish the verified Weixin QR auth UI flow above already occupied npm versions so the published CLI and UI packages match the code that passed real smoke validation.

## 0.10.31

### Patch Changes

- Publish the transparent app transport boundary fix so local and remote streaming remain a true transport-only replacement.
  - keep SSE and multiplex adapters transport-only instead of interpreting upper-layer terminal events
  - preserve `final` as a normal streamed event while keeping `openStream().finished` stable
  - ship the repaired local chat UX and remote request-multiplex behavior in the released CLI/UI/runtime chain

- Updated dependencies
  - @nextclaw/mcp@0.1.26

## 0.10.30

### Patch Changes

- Fix the real UI server startup path so plugin channel bindings and UI metadata are passed through to the router, making the Weixin channel appear in frontend config instead of disappearing outside controller-only tests.

## 0.10.29

### Patch Changes

- Expose the Weixin plugin channel in UI config APIs, including `meta.channels`, schema hints, config projection, and save-back to plugin config.

- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.15

## 0.10.28

### Patch Changes

- Republish the verified Weixin channel plugin release above already occupied npm versions so the published packages match the repository state that passed real QR login and real reply validation.
- Updated dependencies
  - @nextclaw/core@0.9.11
  - @nextclaw/openclaw-compat@0.3.14
  - @nextclaw/mcp@0.1.28
  - @nextclaw/runtime@0.2.11

## 0.10.27

### Patch Changes

- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.10
  - @nextclaw/openclaw-compat@0.3.13
  - @nextclaw/mcp@0.1.27
  - @nextclaw/runtime@0.2.10

## 0.10.26

### Patch Changes

- Fix local UI runtime probe fallback so local NextClaw instances keep using local transport
  instead of breaking on `/_remote/runtime` HTML responses.
- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
- Updated dependencies
  - @nextclaw/mcp@0.1.26
  - @nextclaw/core@0.9.9
  - @nextclaw/openclaw-compat@0.3.12
  - @nextclaw/runtime@0.2.9

## 0.10.25

### Patch Changes

- Unify controlled UI requests under appClient, ship the updated built-in UI bundle,
  and keep the CLI release group aligned.
- Updated dependencies
  - @nextclaw/mcp@0.1.25

## 0.10.24

### Patch Changes

- Republish the finalized remote app transport multiplex implementation after maintainability refactors so the published packages match the verified runtime code.
- Updated dependencies
  - @nextclaw/mcp@0.1.24

## 0.10.23

### Patch Changes

- Add remote app transport multiplexing so the UI can switch from direct local transport to remote runtime transport, including browser-side remote requests, realtime event bridging, and streamed chat turns over the remote relay.
- Updated dependencies
  - @nextclaw/mcp@0.1.23

## 0.10.22

### Patch Changes

- Publish the remote instance registration compatibility fix so released CLI builds understand the new platform `instance` payload and registration route.
- Updated dependencies
  - @nextclaw/mcp@0.1.22

## 0.10.21

### Patch Changes

- 7795d61: Replace the UI API CORS middleware with an explicit implementation that avoids both `hono/cors` and the `HonoRequest.header()` hot path on long-running Node servers, while also preventing stale remote runtime state from reporting dead services as connected.
- Updated dependencies [7795d61]
  - @nextclaw/mcp@0.1.21

## 0.10.20

### Patch Changes

- Fix remote access token-expiry handling so expired platform sessions are no longer treated as logged in.

  The local remote runtime now fails fast on expired or malformed platform tokens, and remote doctor/status surfaces the real token state instead of only checking the `nca.` prefix.
  Republish the CLI release group packages for version alignment.

- Updated dependencies
  - @nextclaw/mcp@0.1.20

## 0.10.19

### Patch Changes

- Align the default NextClaw UI port to 55667 across core config, remote access, CLI runtime, UI fallbacks, Docker defaults, smoke scripts, and user-facing docs.
- Updated dependencies
  - @nextclaw/core@0.9.8
  - @nextclaw/mcp@0.1.19
  - @nextclaw/openclaw-compat@0.3.11
  - @nextclaw/runtime@0.2.8

## 0.10.18

### Patch Changes

- Fix the first-run CLI init path so the built-in NextClaw provider stays disabled by default for fresh installs.
- Updated dependencies
  - @nextclaw/mcp@0.1.18

## 0.10.17

### Patch Changes

- Disable the built-in NextClaw provider by default on fresh installs so the seeded provider remains present but no longer starts in an enabled state before it is ready.
- Updated dependencies
  - @nextclaw/core@0.9.7
  - @nextclaw/mcp@0.1.17
  - @nextclaw/openclaw-compat@0.3.10
  - @nextclaw/runtime@0.2.7

## 0.10.16

### Patch Changes

- Add an `enabled` switch for providers so disabled providers stay configured but are excluded from routing, model selection, and runtime diagnostics.

  Expose the provider enabled state through the server and UI config views, and show disabled providers clearly in the Providers page.

- Updated dependencies
  - @nextclaw/core@0.9.6
  - @nextclaw/mcp@0.1.16
  - @nextclaw/openclaw-compat@0.3.9
  - @nextclaw/runtime@0.2.6

## 0.10.15

### Patch Changes

- Fix remote access to bind status and repair actions to the current UI process runtime instead of a stale managed service snapshot.

  Ensure `serve` and dev UI sessions start the remote runtime whenever the current process actually has UI enabled, even if `config.ui.enabled` is false.

- Updated dependencies
  - @nextclaw/mcp@0.1.15

## 0.10.14

### Patch Changes

- Align the remote access UI with the existing product style, remove leftover advanced controls from the main flow, expose the device list entry directly, and surface clearer disconnected hints.
- Updated dependencies
  - @nextclaw/mcp@0.1.14

## 0.10.13

### Patch Changes

- Refine remote access into a user-first NextClaw account flow, simplify the remote access page, and align the web console device copy with the new product path.
- Updated dependencies
  - @nextclaw/mcp@0.1.13

## 0.10.12

### Patch Changes

- Optimize remote relay cost behavior by removing connector heartbeat traffic and aligning the platform relay flow with hibernation-friendly online/session state semantics.
- Updated dependencies
  - @nextclaw/mcp@0.1.12

## 0.10.11

### Patch Changes

- Keep the `@nextclaw/mcp` / `@nextclaw/server` / `nextclaw` release group aligned while shipping the `nextclaw` UI static directory contract tightening.
  - `nextclaw`: remove implicit UI static directory fallbacks so the published CLI only serves the bundled `ui-dist` or an explicit `NEXTCLAW_UI_STATIC_DIR` override. Invalid overrides now fail fast with a non-zero exit instead of silently borrowing repo-local frontend artifacts from `cwd`.
  - `@nextclaw/mcp`: version-only companion release for release-group alignment.
  - `@nextclaw/server`: version-only companion release for release-group alignment.

- Updated dependencies
  - @nextclaw/mcp@0.1.11

## 0.10.10

### Patch Changes

- Add browser-based remote access platform authorization so users can log out and re-authorize from the UI without falling back to CLI password entry.
- Updated dependencies
  - @nextclaw/mcp@0.1.10

## 0.10.9

### Patch Changes

- Productize remote access in the built-in UI by shipping a dedicated Remote Access page, exposing the supporting server APIs, routing in-page managed-service restart through the shared self-restart coordinator so restart reliably relaunches the service instead of only stopping it, and keeping the required `@nextclaw/mcp` release group aligned with the updated server and CLI packages.
- Updated dependencies
  - @nextclaw/mcp@0.1.9

## 0.10.8

### Patch Changes

- Fix Claude readiness probing so working Anthropic-compatible routes are not marked unavailable by a probe-only USD budget cap, and improve local first-party plugin loading when running NextClaw from source.
- Updated dependencies
  - @nextclaw/mcp@0.1.8

## 0.10.7

### Patch Changes

- Publish the final host-adapter cleanup for the remote package split so the released nextclaw version matches the finalized repository state.
- Updated dependencies
  - @nextclaw/mcp@0.1.7

## 0.10.6

### Patch Changes

- Publish the remote runtime package split through fresh npm versions after the previously generated versions were already occupied on npm.
- Updated dependencies
  - @nextclaw/mcp@0.1.6

## 0.10.5

### Patch Changes

- Split the remote access runtime into a standalone `@nextclaw/remote` package and make `nextclaw` consume it through a thin host adapter.
- Updated dependencies
  - @nextclaw/mcp@0.1.5

## 0.10.4

### Patch Changes

- Fix Codex chat startup and plugin resolution when running NextClaw from source in dev mode.
  - prefer repo-local first-party plugins from `packages/extensions` when `NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR` is unset
  - avoid loading stale installed Codex runtime plugins from `~/.nextclaw/extensions` during source-mode smoke tests
  - keep the release group for `@nextclaw/mcp`, `@nextclaw/server`, and `nextclaw` in sync while shipping the Codex chat fix

- Updated dependencies
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.8
  - @nextclaw/mcp@0.1.4
  - @nextclaw/core@0.9.5
  - @nextclaw/runtime@0.2.5

## 0.10.3

### Patch Changes

- Fix npm packaging so publish tarballs always include built `dist` output, and republish the remote access dependency chain above the broken 0.13.2 release.
- Updated dependencies
  - @nextclaw/core@0.9.4
  - @nextclaw/runtime@0.2.4
  - @nextclaw/openclaw-compat@0.3.7
  - @nextclaw/mcp@0.1.3

## 0.10.2

### Patch Changes

- Republish the remote access CLI and local auth bridge above the broken 0.13.1 / 0.10.1 npm versions so global installs regain the `remote` command.

## 0.10.1

### Patch Changes

- d1162f2: Recover the linked MCP/server/nextclaw release chain so marketplace MCP APIs ship together with their consumers.
- Ship the remote access CLI and local auth bridge in a repaired npm release, and make platform api base parsing tolerate `/v` vs `/v1`.
- Updated dependencies [d1162f2]
- Updated dependencies [7e3aa0d]
  - @nextclaw/mcp@0.1.2
  - @nextclaw/core@0.9.3
  - @nextclaw/runtime@0.2.3
  - @nextclaw/openclaw-compat@0.3.6

## 0.10.0

### Minor Changes

- Add lightweight remote access support with platform device registration, remote session relay, and trusted local UI auth bridging.

## 0.9.4

### Patch Changes

- Fix plugin hot-reload cache invalidation so upgraded Codex runtime plugins take effect without requiring a service restart.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.5

## 0.9.3

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.2
  - @nextclaw/openclaw-compat@0.3.4
  - @nextclaw/runtime@0.2.2

## 0.9.2

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1
  - @nextclaw/ncp-http-agent-server@0.3.1
  - @nextclaw/openclaw-compat@0.3.3

## 0.9.1

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1
  - @nextclaw/openclaw-compat@0.3.2
  - @nextclaw/runtime@0.2.1

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
  - @nextclaw/openclaw-compat@0.3.1

## 0.8.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.0
  - @nextclaw/ncp@0.3.0
  - @nextclaw/ncp-http-agent-server@0.3.0
  - @nextclaw/openclaw-compat@0.3.0
  - @nextclaw/runtime@0.2.0

## 0.7.0

### Minor Changes

- eb9562b: Add lightweight built-in UI authentication for NextClaw UI with a single-admin setup flow, HttpOnly cookie sessions, protected API/WebSocket access, and a runtime Security panel.

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0
  - @nextclaw/openclaw-compat@0.2.7
  - @nextclaw/runtime@0.1.7

## 0.6.13

### Patch Changes

- 63c7ab3: Refactor UI router into centralized route binding with modular controllers to improve maintainability and module role clarity.

## 0.6.12

### Patch Changes

- Improve sidebar service status UX with lightweight indicator + shadcn tooltip, and tighten initial health status judgment based on `/api/health` payload status.

## 0.6.11

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.
- Updated dependencies
  - @nextclaw/core@0.7.7
  - @nextclaw/runtime@0.1.6
  - @nextclaw/openclaw-compat@0.2.6

## 0.6.10

### Patch Changes

- fix tool-loop empty final response handling and improve error surfacing with bounded user-visible diagnostics.
- Updated dependencies
  - @nextclaw/core@0.7.6
  - @nextclaw/openclaw-compat@0.2.5
  - @nextclaw/runtime@0.1.5

## 0.6.9

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5
  - @nextclaw/runtime@0.1.4
  - @nextclaw/openclaw-compat@0.2.4

## 0.6.8

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/core@0.7.4
  - @nextclaw/openclaw-compat@0.2.3
  - @nextclaw/runtime@0.1.3

## 0.6.7

### Patch Changes

- @nextclaw/openclaw-compat@0.2.2

## 0.6.6

### Patch Changes

- Release core/runtime/server/CLI linkage updates for telegram streaming and subagent behavior fixes.
- Updated dependencies
  - @nextclaw/core@0.7.3
  - @nextclaw/runtime@0.1.2
  - @nextclaw/openclaw-compat@0.2.1

## 0.6.5

### Patch Changes

- Switch skill distribution to marketplace-first flow and remove GitHub-based skill install paths.

  This release includes:
  - skill/plugin model clean split (skill: `builtin` + `marketplace` only)
  - marketplace API migration from bundled JSON to D1-backed source
  - CLI support for marketplace skill upload/update/install
  - UI and server integration updates for marketplace data, install behavior, and user-facing error messaging

- Updated dependencies
  - @nextclaw/core@0.7.2

## 0.6.4

### Patch Changes

- Expose the NextClaw product version via app metadata and display it in the UI sidebar brand header.

## 0.6.3

### Patch Changes

- Refactor provider and channel architecture with core registry mechanism and runtime assembly.
  - Move builtin provider catalog and builtin channel IDs out of core into `@nextclaw/runtime`.
  - Keep provider registry mechanisms in `@nextclaw/core` with injectable catalog support.
  - Update server/CLI to consume runtime-provided builtin provider/channel metadata.
  - Preserve out-of-box behavior for NextClaw provider bootstrap key generation.

- Updated dependencies
  - @nextclaw/core@0.7.1
  - @nextclaw/runtime@0.1.1

## 0.6.2

### Patch Changes

- Retry publish with fresh patch versions after reserved-version conflict on npm.

## 0.6.1

### Patch Changes

- Introduce backend-managed chat run source of truth with reconnectable run streams, and restore in-progress run state when reopening chat sessions.

## 0.6.0

### Minor Changes

- Unified minor release for accumulated architecture, engine, and chat UX updates.

  Includes:
  - New pluggable engine runtime support (Codex SDK / Claude Agent SDK)
  - Skill-context propagation and chat interaction stability improvements
  - Main workspace routing and conversation UX refinements
  - Core/server/openclaw compatibility and release alignment updates

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.7.0
  - @nextclaw/openclaw-compat@0.2.0

## 0.5.30

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

- Updated dependencies
  - @nextclaw/core@0.6.45
  - @nextclaw/openclaw-compat@0.1.34

## 0.5.29

### Patch Changes

- - fix provider connection test probe to use `maxTokens >= 16`, avoiding OpenAI-compatible gateway errors that reject values below 16.
  - add regression coverage for provider test route to assert probe maxTokens lower bound.
  - include latest UI updates in this release batch.

## 0.5.28

### Patch Changes

- release all pending changes including dynamic custom provider management, custom provider model prefix stripping before upstream calls, and marketplace source link wrapping fix in detail cards.
- Updated dependencies
  - @nextclaw/core@0.6.44
  - @nextclaw/openclaw-compat@0.1.33

## 0.5.27

### Patch Changes

- support dynamic custom providers with add/edit/delete workflow, ensure custom provider test model selection is provider-scoped, and strip only the provider routing prefix before upstream OpenAI-compatible API calls.
- Updated dependencies
  - @nextclaw/core@0.6.43
  - @nextclaw/openclaw-compat@0.1.32

## 0.5.26

### Patch Changes

- Align MiniMax default API base to the CN endpoint and add clear region-specific guidance in provider settings.
- Updated dependencies
  - @nextclaw/core@0.6.42
  - @nextclaw/openclaw-compat@0.1.31

## 0.5.25

### Patch Changes

- Align channel configuration UX with provider page paradigm and fix logo badge consistency.
  - Switch Channels page to a provider-style two-pane workflow with list/filter on the left and persistent form on the right.
  - Fix hook ordering in `ChannelsList` to avoid render-time hook count mismatch.
  - Enforce stable logo badge sizing (`shrink-0`, overflow handling) so provider/channel icons keep consistent frame size.
  - Restrict channel tutorial links to dedicated docs only (currently Feishu).

## 0.5.24

### Patch Changes

- Add channel tutorial metadata and expose in the UI with localized links.
  - Add a Tutorials module to docs (EN/ZH) and include a dedicated Feishu setup page.
  - Extend config meta channel spec with `tutorialUrls` (`default/en/zh`) while keeping `tutorialUrl` for compatibility.
  - Resolve localized tutorial URLs in UI and show guide entry points on channel cards and channel config modal headers.

## 0.5.23

### Patch Changes

- Refresh provider default model catalogs to latest-generation options, improve provider/model selection UX, and align config model list behaviors.
- Updated dependencies
  - @nextclaw/core@0.6.39
  - @nextclaw/openclaw-compat@0.1.30

## 0.5.22

### Patch Changes

- Hotfix publish to ensure provider test route is available in npm runtime.

## 0.5.21

### Patch Changes

- Fix provider API base routing for non-gateway providers and upgrade providers configuration UX in UI.
- Updated dependencies
  - @nextclaw/core@0.6.38
  - @nextclaw/openclaw-compat@0.1.29

## 0.5.20

### Patch Changes

- Introduce event-backed chat storage and event-sequence rendering for UI chat:
  - persist session events (single-write) and project legacy messages from events
  - stream `session_event` frames alongside text deltas in chat SSE
  - render chat by ordered event timeline, merging tool call/result/follow-up in one assistant flow card
  - keep true streaming text while preserving event-order semantics

- Updated dependencies
  - @nextclaw/core@0.6.37

## 0.5.19

### Patch Changes

- Add real chat streaming pipeline from provider to UI via SSE and remove simulated frontend streaming.
- Updated dependencies
  - @nextclaw/core@0.6.36

## 0.5.18

### Patch Changes

- feat: add secrets command suite and ui management panel
  - add `nextclaw secrets audit/configure/apply/reload` with config-aware validation and reload planning
  - add ui secrets panel for editing `secrets.enabled/defaults/providers/refs`
  - add ui api endpoint `PUT /api/config/secrets` and full client hook/types integration
  - document secrets commands in en/zh command guides

- Updated dependencies
  - @nextclaw/core@0.6.35

## 0.5.17

### Patch Changes

- Upgrade UI chat experience with markdown rendering, structured tool cards, and grouped message display.

## 0.5.16

### Patch Changes

- Add built-in Agent chat support in UI with a new chat page, session management, and a backend chat turn API wired to runtime pool.

## 0.5.15

### Patch Changes

- Add a built-in `nextclaw-skill-resource-hub` skill to curate NextClaw-first skill ecosystem resources, including OpenClaw and community sources.
- Updated dependencies
  - @nextclaw/core@0.6.34
  - @nextclaw/openclaw-compat@0.1.28

## 0.5.14

### Patch Changes

- Raise the default `agents.defaults.maxToolIterations` from 20 to 1000 to reduce premature tool-loop fallback responses in long tool chains.
- Updated dependencies
  - @nextclaw/core@0.6.33
  - @nextclaw/openclaw-compat@0.1.27

## 0.5.13

### Patch Changes

- feat(marketplace): support git skill install via skild with explicit skill/path parameters
  - route marketplace git skills through `npx skild install`
  - pass `skill` and `installPath` from UI -> server -> installer
  - allow git-type skills in marketplace skills list

## 0.5.12

### Patch Changes

- Split marketplace plugins and skills across all layers, including typed worker routes, typed server proxy routes, and typed UI API clients.

## 0.5.11

### Patch Changes

- split marketplace data and routes by type, separating plugins and skills endpoints end-to-end

## 0.5.10

### Patch Changes

- Enable gzip compression for built-in UI static assets and improve slow-network loading behavior.

## 0.5.9

### Patch Changes

- fix: defer Discord slash command replies to avoid interaction timeouts
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.26

## 0.5.8

### Patch Changes

- Sync NextClaw packages with updated core and channel runtime versions.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.25

## 0.5.7

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.31
  - @nextclaw/openclaw-compat@0.1.24

## 0.5.6

### Patch Changes

- Add cron management UI with list/enable/disable/run/delete actions and corresponding server API endpoints.
- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.30
  - @nextclaw/openclaw-compat@0.1.23

## 0.5.5

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.
- Add cron management API endpoints for list/remove/enable/run to support the UI.
- Updated dependencies
  - @nextclaw/core@0.6.29
  - @nextclaw/openclaw-compat@0.1.22

## 0.5.4

### Patch Changes

- UI: add confirm dialog flow for destructive actions; Server: allow marketplace manage to resolve plugin id from spec fallback.

## 0.5.3

### Patch Changes

- Fix plugin hot-plug behavior so disabling bundled channel plugins (like Discord) takes effect immediately and enabling restores runtime behavior.

  Also normalize marketplace manage targets from canonical npm specs to real plugin IDs and harden config reload watching for first-time config file creation.

- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.21

## 0.5.2

### Patch Changes

- fix SkillsLoader import crash during update/restart startup.
  - avoid static named import of `SkillsLoader` in runtime-critical paths
  - gracefully handle missing runtime export to prevent ESM load-time crash
  - make core export of `SkillsLoader` explicit for release safety

- Updated dependencies
  - @nextclaw/core@0.6.28

## 0.5.1

### Patch Changes

- unify marketplace plugin identity to canonical channel npm specs and switch default marketplace api base to marketplace-api.nextclaw.io

## 0.5.0

### Minor Changes

- feat(release): promote marketplace milestone to minor version bump
  - reclassify the recent marketplace integration as feature-level release
  - align package versions with semver minor progression
  - keep release coverage across cli, server and ui packages

## 0.4.17

### Patch Changes

- feat(marketplace): add VSCode-style marketplace with installed state and install integration
  - add marketplace query/install API on UI server
  - connect install actions to existing CLI plugin/skill install commands
  - add marketplace frontend page with search, filters, recommendations, and installed tab
  - add installed-status API and UI badges/button states for installed items

## 0.4.16

### Patch Changes

- feat: hot-apply plugin config changes without restarting the gateway process.
  - treat `plugins.*` as reloadable config paths
  - hot-reload plugin registry / plugin channel gateways / channel manager in-place
  - apply plugin extension registry updates to agent runtime pool
  - make `plugins` CLI install/enable/disable/uninstall default to hot-apply messaging
  - update usage docs with plugin hot-reload behavior

- Updated dependencies
  - @nextclaw/core@0.6.27

## 0.4.15

### Patch Changes

- fix: prevent broken historical tool-call chains from causing provider 400 in long-running Discord multi-agent sessions.
  - sanitize stale `assistant(tool_calls)` + `tool` history pairs before provider requests
  - preserve active trailing tool-call chain semantics
  - reduce INVALID_ARGUMENT failures after context-budget pruning

- Updated dependencies
  - @nextclaw/core@0.6.26

## 0.4.14

### Patch Changes

- Add strict dmScope enum guardrails in docs and runtime context prompts, and align AI config-write flow with schema-first patching.
- Updated dependencies
  - @nextclaw/core@0.6.25

## 0.4.13

### Patch Changes

- Fix Model page maxTokens persistence by wiring maxTokens through UI save API and server config update.

## 0.4.12

### Patch Changes

- Add full session management in NextClaw UI with OpenClaw-aligned capabilities.
  - add Sessions tab with filtering, history inspection, metadata patching, clear, and delete
  - add UI API endpoints for sessions list/history/patch/delete
  - sync frontend/server types and hooks for session operations
  - update usage guide for session management UI

## 0.4.11

### Patch Changes

- Add full UI/runtime API support for configuring input context token budgets.
  - Runtime page supports `agents.defaults.contextTokens`
  - Runtime page supports per-agent `agents.list[*].contextTokens`
  - Runtime API persists default context token budget updates
  - Usage docs updated for UI configuration path

## 0.4.10

### Patch Changes

- Align input-context handling with an OpenClaw-style token-budget pruner.
  - add unified input budget pruning in agent and subagent loops
  - support `agents.defaults.contextTokens` and per-agent `contextTokens` overrides
  - hot-reload context token budget updates
  - document configuration and multi-agent usage updates

- Updated dependencies
  - @nextclaw/core@0.6.24

## 0.4.9

### Patch Changes

- Align Discord/Telegram typing lifecycle with OpenClaw-style run completion cleanup.
  - Add typing-stop control message in core bus for no-reply paths.
  - Route control messages through ChannelManager without normal outbound delivery.
  - Keep typing active during agent processing and stop via outbound/control events.
  - Improve typing heartbeat/TTL defaults for long-running replies.

- Updated dependencies
  - @nextclaw/core@0.6.23

## 0.4.8

### Patch Changes

- Align UI routing/runtime configuration with OpenClaw capabilities.
  - Add runtime config API and editor for `agents.list`, `bindings`, and `session` controls.
  - Add ChannelForm fields for Discord/Telegram routing and mention policy settings.
  - Expose runtime settings safely in public config view and wire UI navigation for runtime management.

## 0.4.7

### Patch Changes

- Align multi-agent gateway capabilities with OpenClaw:
  - add bindings-based route resolver and agent runtime pool
  - add agents.list multi-runtime support in gateway service
  - add session.dmScope based session key isolation (including per-account-channel-peer)
  - add agentToAgent.maxPingPongTurns enforcement in sessions_send
  - complete Discord and Telegram policy parity (dmPolicy/groupPolicy/mention gates/account metadata)

- Updated dependencies
  - @nextclaw/core@0.6.22

## 0.4.6

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

- Updated dependencies
  - @nextclaw/core@0.6.21

## 0.4.5

### Patch Changes

- Adopt `<noreply/>` as the silent marker and stop reply/output processing when the marker appears. Cascade release all direct dependents of `@nextclaw/core` to keep internal versions aligned.
- Updated dependencies
  - @nextclaw/core@0.6.20

## 0.4.4

### Patch Changes

- Remove configurable temperature and stop forwarding temperature in runtime provider requests.
  - Remove `agents.defaults.temperature` from config schema and reload rules.
  - Remove temperature propagation across agent loop, subagent manager, and provider manager.
  - Stop sending `temperature` to OpenAI-compatible provider payloads.
  - Remove temperature field/control from UI model configuration and API types.

- Updated dependencies
  - @nextclaw/core@0.6.19

## 0.4.3

### Patch Changes

- Align internal dependency on `@nextclaw/core@^0.6.18` and publish dependent packages together.

## 0.4.2

### Patch Changes

- Introduce Action Schema v1 end-to-end:
  - add schema-driven `actions` metadata in config schema response
  - add unified action execute API (`POST /api/config/actions/:actionId/execute`)
  - migrate Feishu verify flow to generic action runner in UI
  - expose Discord/Slack `allowBots` fields in channel config form

- Updated dependencies
  - @nextclaw/core@0.6.5

## 0.4.1

### Patch Changes

- Align channel inbound behavior with OpenClaw for bot-aware flows and improve release docs consistency.
  - add `channels.discord.allowBots` and `channels.slack.allowBots` (default `false`) to safely allow bot-authored inbound messages when explicitly enabled
  - process Telegram `channel_post` updates and normalize `sender_chat` metadata for channel bot-to-bot scenarios
  - refresh user guides/templates and channel command surfaces to match current runtime behavior

- Updated dependencies
  - @nextclaw/core@0.6.1

## 0.4.0

### Minor Changes

- Remove the OpenClaw plugin compatibility system from runtime/CLI/config flows,
  and harden UI config API responses by redacting sensitive fields
  (token/secret/password/apiKey and authorization-like headers).

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.6.0

## 0.3.7

### Patch Changes

- Align UI host semantics with always-public runtime behavior.
  - Treat `ui.host` as read-only in config metadata/hints.
  - Set UI host schema default/placeholder to `0.0.0.0`.
  - Add `readOnly` field to UI hint typings in core/server/ui packages.
  - Clarify docs that CLI start paths enforce public UI host.

- Updated dependencies
  - @nextclaw/core@0.5.1

## 0.3.6

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.5.0
  - @nextclaw/openclaw-compat@0.1.3

## 0.3.5

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

- Updated dependencies
  - @nextclaw/core@0.4.9
  - @nextclaw/openclaw-compat@0.1.2

## 0.3.4

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

- Updated dependencies
  - @nextclaw/core@0.4.8
  - @nextclaw/openclaw-compat@0.1.1

## 0.3.3

### Patch Changes

- Align config schema + uiHints pipeline with OpenClaw-style mechanism, add schema API, and unify config redaction.
- Updated dependencies
  - nextclaw-core@0.4.5

## 0.3.2

### Patch Changes

- chore: tighten eslint line limits
- Updated dependencies
  - nextclaw-core@0.4.1

## 0.3.1

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.4.0

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.3.0
