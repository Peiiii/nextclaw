# Markdown 资源链接与模型认知闭环

- contract-id: resource-link-20260916
- parent-goal: 用户点击 AI 提供的会话及其它资源链接能打开正确资源；AI 从工具取得有效链接，不再猜测协议。
- flow: standard（由协议 bugfix 扩展）；risk: L3（跨 shared、kernel、UI 的 URI 与统一展示合同）。
- scope-revision: 6；追加用户确认的统一资源展示：管理入口和聊天链接复用原生详情，保留引用和布局能力。
- plan: not-required，单批实现与验收；未经授权不提交或发布。

## 事实与根因

Markdown 保留 nextclaw 协议，document capture 点击进入 PageResourceManager，再由资源路由决定目标。sessions authority 没有注册，返回 content 后被明确拒绝。现有 chat-session 使用前端私有 sid_ 编码。

回复提示要求会话名称可点击；sessions_list、sessions_history、session_search、sessions_spawn 没有 URI。已在真实 5174 页面展开原消息工具轨迹：列表调用 limit=10/messageLimit=1，目标结果包含 ID 和标题但无 URI；随后模型输出 sessions 链接，再根据用户纠偏改成 objects/chat-session 和 objects/chat-sessions。实际点击 objects/chat-session 复现“此资源类型尚未接入，或 URI 格式不正确”。它与有效的 chat-session/sid_ 不是同一 URI。

## 用户链路与设计

1. 用户在消息里点击既有 sessions 链接，系统归一化为现有会话身份，按统一页面策略打开会话；返回原会话后重复点击仍指向同一目标。已有浮动/工作区会话继续复用。
2. 用户让 AI 查找或创建会话，工具返回 sessionId 与 resourceUri，AI 原样放入 Markdown；点击打开对应会话。无需模型了解 base64 编码。
3. 文档、对象、应用、文件和外部网址保留各自 owner；统一核对 Markdown 到解析、打开的链路与拒绝非法输入行为。

共享模块持有会话 URI 生成与解析；UI 原 API 复用该合同，kernel 工具只消费公共入口。规范输出为 sessions/<percent-encoded-id>，主页面使用 /chat/<percent-encoded-id>；仅 draft 和 sid_ 开头的保留身份继续编码以避免历史路由歧义，资源 URI 不受此例外影响。chat-session/sid_、chat-session/<id> 和事故中已发出的 objects/chat-session(s)/<id> 作为历史输入归一化为 sessions，不保留第二套页面状态。保留期间以用户历史消息及已持久页面为消费者；除非显式迁移全部持久消息，否则不能删除该输入。会话别名必须先于对象快照匹配，且在读取历史缓存前归一化；持久标签恢复时同步修正身份和资源种类。

保留现有路由及资源 manager，不新增 registry、service 或持久字段。拒绝空 ID、畸形编码、多段会话路径和未知协议，不把未知资源猜成某个页面。CLI 命令无变化：本次修复工具输出和 UI 导航，不新增导航 CLI。

## 方案 Review

design-review: passed（revision 3 复审）。检查工具输出到 Markdown 再到页面身份的单一闭环；历史输入保持兼容，主会话路径从原始 pathname 解码一次，保留字避免冲突；测试包含真实失败链接、特殊字符、非法路径、其它资源及工具 URI 消费，真实浏览器必须看见目标会话内容，打开空容器不算通过。只做 UI 别名会遗留认知缺口；只加提示词仍让模型计算 URI，因此均不采用。

## Active acceptance ledger

### 统一资源展示（revision 6，standard / L3，待用户验收）

用户确认每种资源有唯一展示器，管理列表与聊天链接打开同一详情；容器只负责主区域、侧栏、悬浮。复用 PageResourceManager 与既有 system-object renderer 分派，不新增资源协议或持久状态。Agent/定时任务复用既有详情组件和数据操作；项目/工作项复用项目界面；应用使用真实应用入口；服务与 MCP 复用管理组件；Inbox 使用原投递内容；技能展示真实 SKILL.md（技能本身是文档），不再把对象描述 Markdown 作为所有类型的默认页面。快照解析保留给引用和技能正文，未知类型显式提示未接入。

design-review: passed。拒绝复制一套资源详情 UI，也不把对象链接替换成说明文档加“前往管理”按钮。原列表详情入口收敛到相同打开器与内容组件；已有标签按 URI 自动得到新展示器，无持久迁移。plan: not-required，按资源类型在同批实现和验证。新增文件仅为原 feature 的连接组件及已有资源 renderer 的类型分派，避免新 manager/registry owner。

新增必需验收如下。改变的对象页已用原生展示与引用重新验证，不沿用旧 Markdown 快照作为 UI 证据。未授权提交或发布。

| ID | Status | 当前证据与边界 |
| --- | --- | --- |
| UR-1 | passed | 真实点击聊天资源链接、全局定时任务列表、绑定会话工作台中的同一 Issue #28 任务，均显示同一计划、提示词、会话和最近执行结果；只读验证，未执行、启停或删除任务。 |
| UR-2 | passed | 灵魂哲学家链接及 Agent 管理列表共用原生身份、运行和上下文详情；编辑实际打开正确身份并取消；开始对话复用既有 manager，由定向回归覆盖，未发送消息。 |
| UR-3 | passed | 项目、MCP、服务应用、Panel App、收件箱真实点击显示各自界面；技能仍显示实际 SKILL.md。项目工作项无现存实例，复合 ID 到既有工作项详情的分派和列表打开由测试覆盖，未声称真实工作项点击。 |
| UR-4 | passed | 原生 Agent 页拖选 philosopher 后添加到当前输入框；cron 整页添加生成资源引用；刷新后已有任务标签恢复原生详情；不存在的 Agent 显示“资源已删除或不存在”。选段来源 URI 点击由定向测试覆盖，未发送验收草稿。 |
| UR-5 | passed | UI tsc、两组定向回归（82 项及 80 项，含重叠）通过；后续入口导出与引用收敛分别补跑 10 项和 4 项。定向 ESLint、模块治理、diff-only maintainability 无错误；本地 5174 已运行，尚待用户验收。 |

revision 6 acceptance: acceptance-ready（含上述真实实例与测试证据边界）。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| RL-1 | true | 给定 sessions 链接及原有会话 URI 打开同一正确会话，非法输入明确拒绝 | passed | 原始故障消息三个链接真实点击，目标 Markdown 与公式内容可见；刷新后旧错误标签恢复；解析边界回归通过 |
| RL-2 | true | 列表、历史、搜索、创建工具提供共享生成的 URI，提示要求原样复用 | passed | 工具及提示测试；实际模型在未提示 URI 格式时查询并输出正确 sessions 链接，点击到正确会话 |
| RL-3 | true | Markdown 资源家族回归：对象、应用、文档、文件、外链及安全拒绝 | passed | 资源矩阵回归；8 类真实对象 API 解析；浏览器智能体和项目详情内容验证；项目工作项无真实实例，以既有 provider 测试和路由回归验证 |
| RL-4 | true | 匹配范围类型检查、回归与维护性审查通过 | passed | shared/kernel/UI tsc；UI 148 项、相邻会话 51 项、Markdown 51 项；kernel 定向及提示预算通过；ESLint、治理检查、diff-only maintainability 无错误 |
| RL-5 | true | 含修复的本地入口完成 AI 实际操作验证，交给用户验收 | passed | 5174 前端与 18792 当前源码后端运行；两次真实模型 smoke 均 run.finished，验收入口如下；用户验收尚待进行 |
| RL-6 | true | 资源加载不能无限等待，当前验收实例恢复显示所有现有类型正文 | passed | 本地请求默认 30 秒超时、保留调用方取消；正文读取限时；连接层 63 项回归、UI tsc、ESLint 和维护性检查通过；8 类真实资源逐一点击显示正文 |
| RL-7 | true | 资源选段点击后进入聊天输入框并保留来源 | passed | 用户当前“灵魂哲学家”页真实选择 Runtime: native、点击后输入框出现 15 字符引用；DOM token 保存 nextclaw://objects/agent/philosopher；全局文件跨会话来源和无回调隐藏动作由定向测试覆盖 |

交付为本地可运行改动及中英文用户文档；不以发布代替用户验收。未建立无关性能、视觉重设计或全量测试标准，避免稀释原始故障。

## 交付证据与边界

- 会话验收：http://127.0.0.1:5174/chat/smoke-native-mu3fsvkh-4mjjw25k 。实际模型 codex-sub/gpt-5.6-sol 返回 `nextclaw://sessions/ncp-mu2x4zdy-9wzl0otb`，点击复用已打开目标视图。
- 其它类型验收：http://127.0.0.1:5174/chat/smoke-native-mu3fx31v-xnqz6xmj 。实际模型从发现工具返回 cron-job、skill、agent、project、panel-app、service-app、mcp-server、inbox-delivery 八类 URI；全部由真实 API 解析成功。project-work 当前为空，未宣称真实实例点击验证。
- 排查中同步修复文档 query/fragment 丢失及去重错误、服务应用页面标题错误；文件、应用、市场详情、内部页面和外链由定向测试覆盖，不宣称全部进行真实浏览器逐项点击。
- 原 18792 后端来自旧工作区；确认 1436 个会话无运行/排队任务后替换为当前源码进程。保留此进程供验收，未动其它服务。
- implementation-review: passed。共享合同单 owner，原 manager/路由复用，无新增服务层；维护性检查两个提示为既有目录例外和既有测试文件大小，未新增对应负担。工作区改动属于本任务，未提交、推送或发布。

## 复盘沉淀

### 统一资源展示与验收补漏

系统对象引用曾把供 AI 消费的 Markdown 快照直接作为用户界面，导致管理列表和聊天链接各走一套展示。现由原 SystemObjectResource 按身份分派到领域已有内容；快照仍供 AI 引用解析使用，只有技能等文档资源继续正文预览。不新增资源 manager 或第二套编辑状态。

真实对照还发现已存在标签的“复用”分支仍调用 newTab；改为激活已有标签。原生详情使用同一 PageResourceManager 引用通道，已发送选段的 nextclaw URI 不再当本地文件解析。Agent 两列属性布局在窄侧栏挤碎文本，改为随容器宽度分配的单列属性行，并用实际截图确认。

revision 6 implementation-review: passed。新组件只连接已有查询/操作 owner，列表旧弹层路径已收敛；检查发现的重复引用分支和跨目录导入已修正。四项维护性提示均为既有目录例外或未增长的文件规模；没有增加绕过规则。复盘保留在本合同中，不新增常驻规则。

### 用户验收返工：选段按钮悬停透字

共享 ChatTextSelectionAction 的 hover:bg-[var(--interaction-hover)] 用 foreground/0.04 替换原实色 popover 背景，导致正文透出。改用现有主题不透明 accent 色及配套前景色；聊天与资源选段共用此 owner。真实页面选段后将指针移入按钮，读取 :hover=true、background=rgb(237, 233, 227)、opacity=1，截图确认正文被遮挡。agent-chat-ui tsc、定向 ESLint 和 diff-only maintainability 通过；纯样式修复未新增镜像实现的测试，也未新增用户操作文档。功能点击验收不能代替悬停视觉验收，此处补记具体证据，不新增常驻规则。

### 用户验收返工：选段按钮无响应

系统对象和全局文件页复用了预览组件，却均遗漏 onTextExcerptAdd；组件仍展示选段菜单，点击可选回调后无动作。接入现有 PageResourceManager 到 ChatComposerIntentManager 的引用通道，组件只负责连接；全局引用保留完整资源 URI，避免跨会话误用相对路径，系统对象不伪造文件行号。无回调时不再提供不可执行的动作。

在用户原页完成真实拖选、点击和输入框观察：灵魂哲学家、Runtime: native、15 个字符均可见，DOM 中引用键保留真实 agent URI；未发送消息。文件预览及非聊天页导航由自动测试覆盖，不声称完成这两个入口的真实点击。本轮定向回归、UI 类型检查及维护性复核收尾；维护性三个提示均为既有文件规模或目录例外，无新增结构问题。此前资源打开的验收未覆盖选段动作，现将该动作加入本合同回归，不追加重复常驻规则。

### 用户验收返工：所有资源持续加载

2026-09-16 浏览器 Network 中多个互不相关的 API 请求同时 pending、0 字节；同一时刻命令行请求 5174 代理健康检查、对象解析、资产正文以及脚本均立即成功，18792 后端健康。临时卸载两张验收页没有恢复；只重启 5174 Vite 开发前端并刷新后恢复，后端没有重启。恢复原多标签条件后，逐一点击 cron-job、skill、agent、project、panel-app、service-app、mcp-server、inbox-delivery，均看到实际正文；定时任务显示 ID b6e1c071、时间表达式及 last status=ok。保留用户验收页在此定时任务详情。

证据限定为旧开发连接状态异常与恢复，尚不能证明它由 SSE 连接上限、浏览器扩展或后端锁引起，不把假设写成根因。已确认的无限等待代码原因是 LocalAppTransport 缺少默认超时、正文 fetch 未限时；前者补为默认 30 秒且显式 timeoutMs 仍优先，组合 signal 保留取消，后者对正文读取补 30 秒期限，既有错误/重试界面承接失败。revision 4 Review 检查了显式长请求预算、取消与计时器释放；未修改流式请求预算。本轮无提交和发布。

### 协议与模型认知

此次不是仅有协议拼写问题：工具输出缺少可消费链接，提示要求可点击，模型只能推测；协议生成又藏在 UI 私有编码中。已在 shared 合同、工具输出和原提示 owner 内修正，并以真实模型到真实点击的证据闭合。早期静态判断不足以证明修复，现有验证规则已经明确要求真实链路，故不追加重复治理规则；将事故链接保留为回归输入，并在中英文用户文档记录规范与历史兼容。
