# 可嵌入的悬浮会话

范围补充（用户同轮确认）：悬浮是任意已有会话的展示能力。通知、会话列表、主会话标题栏和工作台子会话列表共用同一个打开动作。既有 ChatSessionMoreActionsMenu 是后三个入口的唯一菜单 owner，仅增加一项；所有调用方传入已有标题，不引入新的会话查询。FloatingSessionManager 统一拥有打开、收起、恢复和关闭，store 只保存目标和可见状态。未创建的新草稿没有 session ID，不提供悬浮入口。同一会话多处展示时共享既有草稿 owner，分别订阅同一真实 session 的消息事件。

补充验收：从任意会话菜单打开不切主页面；当前会话同时在主界面和悬浮层中显示时，草稿与实际回复两处同步；子会话使用相同菜单。方案增量审查通过：无需新增状态或聊天实现，复用现有菜单与悬浮 store。

日期：2026-09-10。feature / standard / L2。design-document: required；plan: not-required（单批交付）。

## 用户结果与范围

### 全局侧栏扩展

用户追加要求：任意会话也可在全局右侧栏展示，并与悬浮态互相切换。复用既有 DocBrowserManager、标签页渲染注册表、停靠宽度及移动端布局；不新增侧栏状态或宿主。新增 chat-session 标签种类和 nextclaw://chat-session/<已编码会话 ID> 资源路由，使用已有开放 kind 合同和标签持久化形状。通知与菜单继续共用会话展示动作 owner，原 FloatingSessionManager 改名 SessionSurfaceManager，分别调用浮层 store 与已有 DocBrowserManager。

侧栏标签内容直接组合 SessionConversationArea，工具栏只提供弹出为独立悬浮会话的动作；切换位置允许订阅视图重新挂载，但草稿由原会话 owner 保留，运行不取消。停靠同一个 session 按 dedupeKey 复用标签；从侧栏弹出只关闭该会话标签，不关闭其它标签。侧栏仅当前活动且打开的会话计入可见会话，防止重复通知；切到其它标签后恢复提醒。未创建的新草稿仍无该入口。

传播与验证：资源 URI 编解码 → 路由解析/等价与 historyPolicy=none → 原标签存储/恢复 → 注册 renderer → 原桌面/移动宿主；无后端或 CLI 变化。定向验证包含特殊会话 ID、标签去重、仅关闭目标标签、通知可见集合、浮层和侧栏之间草稿延续；真实界面验证打开、停靠、弹出、输入与回复及切页面保留。实现前增量方案 Review 通过：所有承载位置共用会话内容，布局状态保持各自既有 owner，不复制页面或创建嵌套 iframe。

从后台回复通知的展开图标打开真实会话，读历史、发送追问、接收流式回复；当前页面、主会话草稿和右侧工作台保持原位。关闭或收起不会取消运行。此能力帮助用户在持续工作中及时回应搭档，不承担切换上下文的成本。

通知正文保留原有跳转；新增图标专门展开。单个悬浮会话，右下定位，桌面约 560px 宽、视口内高度，窄屏自动适配。标题栏有收起、转到主会话、关闭；收起后保留标题条，点击恢复。无遮罩、不锁背景、不因点击外部关闭。Escape 在悬浮层内收起；减少动态效果偏好下禁用进入动画。打开另一个通知替换悬浮目标，草稿仍由既有会话草稿 owner 保存。刷新不恢复悬浮外壳。

## 证据与复用

主界面 `ChatConversationPanel` 与工作台 `WorkspaceSelectedContent` 已使用 `SessionConversationArea`。该组件经 `useSessionConversationController` 将显式 sessionKey 写入发送 envelope，经 `useNcpSessionConversation` 加载历史、订阅运行；输入由会话草稿 owner 隔离。直接复用这一组件，不复制输入、历史、工具展示或流式处理。

公共 presenter、路由动作绑定和 query 同步目前在 `NcpChatPage` 内。提升到应用共享 `ChatRuntimeProvider`，主页面仅保留路由选中和页面事件同步。悬浮与主页面使用同一个 presenter 和 query owner，避免新增独立 chat runtime 或两份依赖同步。新增 `floating-session.store` 只拥有目标会话和收起状态。

事件链：MessageCompleted → ChatCompletionNotificationManager → 通用通知 action → floating-session store → FloatingSessionConversation → SessionConversationArea。可见会话统一在共享 runtime 汇总主页面、右栏、展开的悬浮层；收起后允许新回复通知。通知组件只接受通用 action，不解析聊天路由。

## 取舍与边界

复用现有会话组件优于复制聊天实现；独立悬浮 presenter 会重复共享依赖并争用 store，故提升既有依赖入口。选择非模态面板以允许继续操作主会话；模态遮罩会阻断原任务。单窗足以覆盖通知随手追问，不建设多窗注册表、拖拽系统或窗口持久化。保留会话内容唯一 owner，外壳只负责布局和可见状态。

纯视觉承载方式无需新增 CLI、后端 API、持久化协议或迁移；现有会话 CLI 不变。中英文后台结果指南同步。授权仅实现和本地验证，不 commit/push/发布。

## 验收与交付

1. 真实通知展开图标可达：点击不改变 URL、主会话输入 DOM/草稿、工作台选择；通知消失且显示目标标题及历史。
2. 悬浮中发送到目标 session，呈现流式及最终回答；错误沿原会话提示展示。主、右、浮动三处复用同一 SessionConversationArea。
3. 收起/恢复保留输入 DOM 与草稿，关闭不触发 abort；再次展开仍可加载历史。不同会话之间草稿不串线。
4. 展开时抑制该会话重复通知，收起/关闭后恢复提醒；正文和转到主会话动作保留显式导航。
5. 桌面、窄屏及明暗主题正常渲染；键盘按钮可用，无背景遮罩，reduce-motion 禁用动画。
6. 定向组件/集成测试、匹配 UI tsc、diff maintainability 检查通过；浏览器实际检查通知→打开→发送→回复及主输入保留。用户仅需判断尺寸和视觉偏好。

交付为隔离工作区源码与可打开的本地 UI 预览；记录实际验证范围和待主观验收项。

## 方案审查

design-review: passed。核对现有消费者、显式发送目标、草稿 owner 和应用挂载位置；共享依赖提升消除非聊天页无 provider/query 的缺口。验证覆盖真实通知入口、回复目标、后台运行与 DOM 身份；不以外壳渲染代替可对话结果。

## 验证与交付记录

- 工作区：`codex/floating-session`；本地前端 5198，代理现有真实后端 18792。无后端、CLI、安装包或线上发布变更。
- UI `pnpm tsc` 通过。最终受影响的 8 个测试文件 35 条通过；原发送控制器、草稿隔离与布局测试的定向证据也通过。targeted ESLint、治理检查通过；diff maintainability 0 errors，应用入口接近原有行数预算的 1 条提示经复核不需扩大范围。
- 真实会话 `ncp-mtvno6kc-37yype3w`，native / deepseek/deepseek-flash：23:02 通知完成事件经真实通知图标展开，主路由保持 draft，主输入 DOM 身份不变；23:03 悬浮追问收到实际回答，主草稿保留，无重复通知。
- 23:12 从主会话菜单打开同一会话，两个输入框同步草稿；发送后两处均出现「双视图同步成功。」，同一对输入 DOM 未重建，两处草稿同步清空。会话列表菜单也已真实操作验证。跨到 /model 设置页后悬浮会话仍保留历史和输入。
- 收起/恢复保留输入 DOM；关闭仅卸载订阅，复用 client.stop，不调用 server abort。桌面与 390×844 深色视口正常，面板宽 358px、无横向溢出、标题栏操作可达。动画仅在 motion-safe 下启用。窄屏/主题检查为布局证据，不替代上述真实发送链路。
- 用户指出浏览器缩小时裁切：实测外窗 845×760，模拟内容仍为 1440×900。清除 DevTools viewport override 后恢复实际 845×617；输入框、发送和底部设置均位于视口内，根 scrollWidth=845。原因是本次测试配置，未修改产品布局来掩盖。交付浏览器已清除模拟设置。
- 后续移动端测试标签也被用户继续使用，再次暴露固定 390×844 视口残留；已清除两个可见测试标签的 viewport override，实际内容恢复 500×672，底栏位于 y=617–672。纠偏后的验证改为独立 headless Playwright 进程，连续切换 500×672、390×844、1100×700：每次根节点宽高与视口一致、scrollWidth 等于视口宽度；移动底栏始终贴合底部，桌面按断点切换。可见标签不再用于固定视口验证；不能把“后台标签”当作与用户隔离的测试环境。此处只记录本次测试操作根因与恢复证据，不伪造产品 CSS 修复。
- 复盘：会话嵌入合同与视口测试恢复证据更新在本文及用户指南；现有规则足够，不为本次操作疏漏新增治理规则。当前只交付本地功能，宣传稿与发布留待正式版本，不产生额外公开内容。

AI 验收通过，待用户判断悬浮尺寸与视觉偏好。未 commit、push、合入或发布。

## 通知紧凑布局纠偏

用户否定独立文字操作行带来的冗余；本次局部 L1 调整沿已确认方案，通知只保留标题与单行摘要，右侧悬浮打开/关闭图标水平并排，复用 IconActionButton 的提示与键盘合同。卡片高度 68px、圆角 16px，两按钮均为 36px 点击区域。正文跳转与独立悬浮动作保持不变。独立 headless 浏览器在 320/390/1100px 宽度实测卡片均高 68px、两按钮同一水平线、页面无水平溢出；3 条既有交互测试与 UI tsc 通过，本组件定向 maintainability 0 errors/0 warnings。复盘：通知快捷动作不应为了解决图标堆叠而另起完整一行，应优先收敛到同一操作组。视觉偏好待用户查看。

## 2026-09-11 合入范围与增量证据

用户授权本批改动合入主干并推送，不含 NPM 或网站部署。范围同时包含：移动列表紧凑头部、按需搜索、触摸操作、标题缩写与稳定配色；窄容器消息脚注收敛且详情保留完整执行信息；所有新会话入口去除重复运行类型菜单；用户指定原始移动截图存入图片源目录与官网资产目录，官网首页增加中英文移动展示段落。

自动标题由 kernel 的 SessionTitleService 在持久化 RunFinished 后异步生成，复用配置的 LLM provider，25 秒超时且不阻塞回复。只读取用户/助手最终文本，无工具调用；话题不足返回 null，等待下一轮。手动标题与已生成标题不覆盖；旧记录只识别确切历史截断标题。通过 journal 已有串行 metadata 写入链的预期值比较抵挡生成期间的手动改名，持久化后调用原摘要投影与事件通知。SessionManager 的 set/update 元数据路径合并复用，工厂直接接收已有 kernel owner，避免增加构造函数逐字段转发；测试夹具独立在测试工具目录。

定向测试覆盖生成、空话题、无效模型响应、取消、手动标题保护、并发改名、已删除目标以及摘要索引重载。26 条标题/会话 manager 测试通过，kernel tsc 通过；真实配置模型独立验证生成「查询杭州今日天气」和「悬浮会话草稿切换与右侧栏停靠验收」。该真实模型验证使用内存记录，运行中的旧后端 18792 没有被本次重启或冒称已更新。官网 build/tsc 通过，独立 headless 浏览器确认中英文页面图片已加载且 390px 无横向溢出。用户原图完整保留，不把旧截图里的测试标题当作新自动标题效果。

完整 diff maintainability 检查 58 文件、0 errors；剩余提示为既有目录/测试体量和接近预算，没有为消除提示扩大重构。复核异步写入、草稿 owner、共享渲染器与菜单事件隔离，无阻塞 findings。交付为主干源码；发布、安装包与运行实例升级属于独立动作。

## 2026-09-13 自动标题真实链路修复

用户在 5174 UI / 18793 源码后端发送首条消息后，正常收到 codex-sub/gpt-5.6-sol 回答，但标题仍为首句。复现会话 `ncp-mtzq8hum-1wq918az` 的 label_source 为 manual；活动预览 producer 把包含 label 的整份 metadata 当作 patch 写回，触发 SessionManager 的显式改名保护。此前内存模型验证和直接 appendSessionEvent 测试没有覆盖完整事件摄入链，不能证明产品可用。

本批为 bugfix / L2，复用 SessionTitleService、活动预览和 journal owner，不增加入口或配置。活动预览仅写自身字段，避免误标标题及覆盖并发元数据；标题优先使用本轮最终回答的 ai_execution.model（现有执行事实），缺失时保留旧记录的会话模型解析。模型调用仍经同一 kernel provider manager，后台请求保持无工具、有界上下文、关闭思考和超时，不复用聊天的长系统提示。历史 manual 标记无法可靠区分误标和真实改名，不批量猜测覆盖；用户手动改名始终受保护。

黄金验收：从新任务选择可用模型并发送首条消息，回复结束后 25 秒内标题更新；无论输入是明确任务还是只有“你好”，都生成比原始截取更能说明会话性质的标题，刷新后同一标题仍在。保持全局默认模型不可用，所选模型成功时标题也能成功。通过事件总线重放运行开始、消息结束、运行结束，证明预览不把 fallback/generated 改成 manual；同时保留生成期间用户改名的并发保护测试。失败请求不影响聊天和临时标题。无需新增 CLI，已有 sessions rename 与列表查询继续消费同一标题 owner。

方案 Review：禁止仅移除 manual 保护或批量重命名历史会话；预览字段 patch 消除根因并缩小写入范围，最终回答执行元数据消除全局模型重新解析歧义。验收覆盖实际 UI、真实模型、事件摄入、持久化及手动改名。design-review: passed；plan: not-required，单批闭环。

修复验证：新增模型优先级两例与事件摄入一例在修前均失败（标题请求使用 undefined/旧偏好，RunStarted 将 fallback 改成 manual）；修后标题、会话和预览 4 文件 42 项通过，kernel tsc 通过。targeted ESLint 无错误，保留未触达测试函数的既有行数提示；diff maintainability 无错误，仅会话测试文件接近预算提示，主观复核无需扩大拆分。治理与 diff whitespace 检查通过。

真实验收：开发 watcher 冷重启为 PID 20135，源码后端 18793 / UI 5174。19:28 使用原生运行时、codex-sub/gpt-5.6-sol 重发同一读书笔记问题，会话 `ncp-mtzqdo96-sr24wyz6` 收到真实回答，标题变为「卡片笔记法简介」，API label_source=generated。页面未刷新时头部已更新，刷新后头部和侧栏均保留新标题。全局默认仍为 deepseek/deepseek-flash，未修改配置；另一个 DeepSeek 模型的请求已返回 402 余额不足，此事实不冒充精确全局默认模型的独立连通性测试。缺失/失效会话偏好不覆盖已完成回复模型由回归测试证明。真实验证范围是 Native + 当前配置的 Codex provider，未冒称验证其它独立运行时的认证与路由。

复盘落点：修正原产品 producer 并把回归提升到事件总线摄入边界；原验证方法已要求真实实例，不新增规则。中英文会话指南与 changeset 已同步。本批草稿位于主工作区，未提交或发布；历史误标会话保留以保护真实手动名称。

用户随后用会话 `ncp-mtzqk2jj-zvbaomxc` 发送“你好”，标题仍为“你好”。该会话 `label_source=fallback` 且写入 `title_attempt_message_id`，证明模型调用已经完成，但按原设计对纯寒暄返回 null。用户把“首轮后仍是原始截取”视为功能未生效，因此这是自动标题 owner 的局部合同缺口，而非模型路由或 UI 刷新问题。

设计修正为：任何有用户文本且正常完成助手回复的首轮都请求非空标题。明确任务概括任务；只有问候、致谢或简单闲聊时概括会话性质，例如“日常问候”或“简短寒暄”，不照抄开场词。模型失败或响应无效仍保留临时标题；手动标题、已生成标题和并发保护不变。不要为旧的 null 结果批量猜测标题；新消息完成后可用新的助手消息 ID再次生成。该修正不增加新状态、入口或配置，复用同一 service、provider、journal 与 UI 投影。

设计 Review：用户链路从“新任务 → 输入你好 → 收到回复 → 标题变为会话性质摘要 → 刷新保留”完整；失败边界、旧数据和手动改名保护明确。仅修改 title prompt 与结果合同即可闭环，不引入通用分类器或第二条标题路径。design-document: updated；design-review: passed；plan: not-required。

修正后验证：标题、会话 manager 与活动预览 4 个测试文件共 43 项通过；kernel tsc、targeted ESLint 与 diff whitespace 检查通过，只有未触达测试函数的既有行数提示。开发 watcher 冷重启后，在用户同一个 5174 页面选择 `codex-sub/gpt-5.6-sol` 并发送“你好”，真实会话 `ncp-mtzqqodx-gs3otpzg` 收到回复后标题更新为「日常问候」；API 显示 `label_source=generated` 且会话模型仍为 `codex-sub/gpt-5.6-sol`，刷新后头部与侧栏均保留该标题。原会话 `ncp-mtzqk2jj-zvbaomxc` 已记录旧版空结果，不批量改写；后续新助手消息完成时可按新消息 ID重试。

## 2026-09-15 标题生成前移到用户消息

用户再次实测发现，标题会长期停留在首条消息截取。代码与事件链确认这不是前端刷新延迟：`SessionManager` 只在持久化 `RunFinished` 后调度 `SessionTitleService`，而服务又要求最后一条 final 消息为 assistant，因此主 AI 完整回复是标题请求的硬前置条件。与此同时，`AgentRunRequestManager` 在启动主 runtime 前已经把本轮解析后的 `model` 写入用户消息 `run_spec`，依次将 `MessageSent` 写入 session journal、发布 session summary，再启动主运行；该用户消息是足够且更早的可靠触发事实。

本次采用单一路径修正：自动标题仍由 kernel 的 `SessionTitleService` 唯一拥有，但改为在 final 用户 `MessageSent` 已持久化后异步调度。标题上下文取截至该用户输入的最近 final 用户/助手文本，本轮模型优先取触发用户消息的 `run_spec.model`，旧记录才回退到 session 模型。标题请求与主回复并行，不进入回复 stream、不阻塞消息接收；成功后继续通过 journal compare-and-set 写入并发布原 session summary。生成期间若用户手动改名，旧结果仍被拒绝；若又收到更新的用户输入，旧请求不安装过时标题并按现有队列重试最新输入。移除 `RunFinished` 触发，避免形成早晚两条标题链路。

不新增标题状态、provider wrapper、UI 刷新通道或配置项。失败和 25 秒超时继续保留临时标题且不影响主回复；已生成及手动标题继续稳定。旧会话不批量改名，下一条可触发的用户消息才会重试。CLI 不新增命令：标题生成是既有会话行为，`sessions` 查询与改名继续消费同一 owner。

### Active acceptance contract

- contract-id：`session-title-on-user-message-v1`
- parent-goal：用户发送消息后，无需等待主 AI 回复完成即可开始生成并自动看到稳定、可持久化的会话标题。
- scope-revision：1；由用户本轮明确修正触发时序。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| ST-1 | true | final 用户消息持久化后即发起标题请求，且请求开始不依赖 assistant final 或 `RunFinished` | passed | event ingestion 回归；真实会话标题生成时仍为 running 且无 final assistant |
| ST-2 | true | 标题请求使用该用户消息已解析的本轮模型，并只读取截至该输入的有界会话文本 | passed | service 模型优先级与请求边界测试；真实使用 `codex-sub/gpt-5.6-sol` |
| ST-3 | true | 标题结果经既有 CAS、持久化和 session summary 实时投影更新，手动/已生成标题不被覆盖 | passed | manager CAS/重载回归；5174 页面实时显示并刷新保留 |
| ST-4 | true | 标题失败、超时或与新输入竞争不阻塞主回复，也不安装过时结果 | passed | malformed/dispose/空结果、手动改名及新输入竞争回归 |
| ST-5 | true | 中英文用户指南准确说明发送后并行生成的时序与失败边界 | passed | chat 与 background-results 双语指南及 changeset 已同步 |

黄金验收：新建任务并发送一条足以命名的消息，标题请求在主回答仍未完成时已经开始；模型返回后，当前头部和侧栏自动更新，刷新仍保留标题。辅助场景覆盖主回答很慢、用户同时手动改名、标题模型失败以及标题生成期间出现更新用户输入。交付为本地源码、回归证据与同步文档；不含 commit、push、发布或部署。design-document: updated；plan: not-required（单批可闭环）。

验证记录：kernel `tsc` 通过；标题 service 与 session manager 的 31 项定向/组装边界测试通过；本任务 4 个 TS 文件 targeted ESLint 0 errors，仅保留同一既有 manager 测试块的行数 warning。真实源码实例 18793 / UI 5174 中，会话 `ncp-mu2pqwx3-dcb4a146` 在发送后 5.9 秒生成「终端延迟时序验收」时仍是 running、尚无 final assistant，之后正常完成回复；会话 `ncp-mu2priiv-c896c131` 在 `sleep 20` 工具仍执行时，当前页面标题已实时变成「前端标题刷新验收」，最终回复完成后刷新页面仍保留标题与生成来源。仓库级 new-code governance 的命名、目录、文档角色、模块和公共导入检查均通过；总命令被其它未提交的 `use-sticky-bottom-scroll.test.tsx` 既有 class-method 违规阻塞，本任务未触碰或代改该 WIP。diff-only maintainability 0 errors；两个接近文件预算的 warning 经复核不应触发无 owner 收益的拆分。实现 Review 无 findings。AI 验收 ST-1 至 ST-5 全部通过，parent_status: ready-for-completion-check。
