# 贡献者 PR 集中推进与验收

## 当前目标与授权

- 2026-09-08 最新授权修正：用户要求撤回本任务批量评论。已删除 12 条普通评论（#47 总纲、#30/#31/#36/#38/#50/#42/#48/#51/#32 各一条、#49 两条），并将 #30/#31/#36/#38/#42/#49/#50 的 7 条正式 review 正文清空、状态全部 DISMISSED。GitHub 正式 review 保留历史。重新查询普通评论已无本批 AI 评论。禁止自动重新发表评论、催促或 REQUEST_CHANGES；此前授权及历史“已发送”记录不再表示有效跟进要求。技术发现仅供内部决策。
- 语音 #43 已完成用户验收、53 项定向测试、类型检查及 GitHub 检查，并合入主干，本地已同步。详见末尾交付记录；下方按时间保留的未提交/等待验收记录均为历史状态。

- 最新用户纠偏：节省 Token，UI 验收默认直接给可访问实例 URL + 一句改动说明/建议；不要自动制作截图、对比页或重复视觉材料。已有 #49 对比页仅保留，不继续扩展。此为本任务执行约束，不新增全局规则。

- contract-id：contributor-pr-20260907；task-id：dt-a73c9e21。
- parent-goal：由 AI 负责 suantea 当前 18 个 PR 的审查、问题修复/作者跟进、验证与交付推进；用户仅验收产品方向及视觉偏好，UI 变化提供真实运行截图或可交互预览。
- scope-revision：1；scope-confirmation：用户明确委托流程推进。当前 18 个 PR 不等于接受贡献者全部长期路线。
- 技术审查、隔离验证、修复、GitHub 评论跟进与符合条件的合并已获用户明确授权（2026-09-07 异步答复）。用户不亲自执行合并。
- 产品卡口：明确 bug 修复和有充分证据的必要/确定更优优化，由 AI 决策并合并；新增能力、改变产品设计/工作流、有真实取舍或不能确定更优的优化，以及所有审美变化，必须先经用户同意。技术可用不等于产品值得接收；报告须说明解决的问题、真实效果、代价与 AI 建议。
- 未授权发布、部署、重启现有实例。使用独立端口、测试数据与 worktree。
- 本文为 L0 协作计划，留在主工作区；产品代码在隔离 worktree 中处理。设计策略采用下方内联流程设计；具体 PR 涉及跨层/持久化/工作流时，在其实现前进入专项设计。

## 流程设计与不变量

GitHub PR head SHA 是审查对象；以现有贡献总纲 [#47](https://github.com/Peiiii/nextclaw/issues/47) 作为作者沟通入口，不新建平行总纲。每个 PR 记录技术结论、检查证据、视觉门、依赖和下一动作。修复或 head 改变使旧验证失效。

纯技术问题由 AI 关闭，不交由用户 debug。视觉变化需真实代码运行，截图标记版本、视口和数据来源；技术失败或原型状态明确标记，不能以示意图冒充验收完成。只有技术验证通过且所需用户判断已通过的 PR 可进入合并。

阶段图：冻结快照与队列 → 独立小 PR 技术验收 / UI 验收包 → 作者返工或维护者修复 → 复验 → 授权范围内交付。阶段完成不等于全部完成。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| CPA-01 | true | 当前 18 个 PR 均有可执行处理结论和依赖记录 | passed | 下方队列、GitHub API 快照 |
| CPA-02 | true | 每个待接收 PR 均完成匹配 head 的技术验证与 Review | not-run | 已集中分诊；尚未逐分支验收 |
| CPA-03 | true | 影响视觉与产品方向的 PR 有真实 UI 验收包和明确决定 | not-run | 准备 #32/#35/#49/#50/#46 |
| CPA-04 | true | 已发现阻塞有具体返工项、跟进状态，复验后才能解除 | not-run | 已发现 #30/#31/#36/#38/#50 问题，待发送/修复 |
| CPA-05 | true | 18 个 PR 交付/返工/方向决定均闭合，不以初筛代替处理 | not-run | 外部操作已授权；产品/视觉决定仍需用户 |

## PR 队列

| PR | 内容 | 技术/产品状态 | 下一动作 |
| --- | --- | --- | --- |
| 30 | 登录备用地址 | 需修正；自定义地址也回退，回退后 v1Base 未同步 | 固定故障复现与地址合同，修复后测试 start/poll/凭据配置链 |
| 31 | 隐私/托名/本地化 | 阻塞；发送链未接脱敏，口令明文 localStorage | 要求撤除虚假保护承诺或完整实现；独立拆分真实可用配置 |
| 32 | 极简模式 | 用户最新决定不认可新增模式，覆盖此前初步认可 | 停止更多菜单补丁，不再催作者；尚未关闭 PR |
| 33 | 工具风险 schema | 基础合同，无执行消费者 | 核对当前权限 owner，明确完整确认链及基础合同接收价值 |
| 35 | 模型分组 | 用户批准，已合并并同步本地主线 | 合并 7ed225587faad5606decc53c69fdd9bd6fa9739e；LOCAL_MAINLINE_SYNCED |
| 36 | 模型测速 | success:false 没有展示原因 | 复现结果丢失，修复失败态及 provider 切换状态，和 #51 对齐 |
| 37 | freellmapi 模板 | 待判定内置必要性；CI 未全通过 | 核对通用 provider 是否已覆盖，避免无收益内置 |
| 38 | fallbackModel | 阻塞；metadata 写入只加到测试替身 | 补真实 kernel contract 与持久化链；不误称运行时回退已实现 |
| 40 | pinned facts | 需深入审查；Linux CI 失败 | 类型/上下文预算/文件边界与画像 owner 验证 |
| 42 | 记忆与画像 store | 基础合同；后续链在 issue #41 | 核对审批写入一致性与来源序列化；明确主线接入顺序 |
| 43 | 按住说话 | 用户验收通过，补丁及检查完成，已合并并同步本地主线 | 合并 f71eee632e54c181bd0bb42995a0d5eaed8293af；LOCAL_MAINLINE_SYNCED |
| 44 | 人格模板 | 优先内容审查 | 核对 USER.md 审批语义，模板与实际记忆合同一致 |
| 45 | 桌宠皮合同 | 产品方向待验收 | 核对公共出口/消费者；和 #46 合并验收 |
| 46 | 桌宠 UI | 依赖且包含 #45；未接宿主 | 隔离组件预览，明确原型与真实宿主边界 |
| 48 | 最大压缩 | 优先技术审查；CI 全绿 | 量化收益/构建代价，确认接收与否 |
| 49 | 布局/主题 | 需视觉决定 | 运行真实页面，桌面/紧凑对比与拖拽验证 |
| 50 | 高级设置/知识库 | 包含 #49；知识库内容仅 useState/mock，保存后卸载即丢失 | 返工知识库；高级设置独立评审，视觉预览标记未通过 |
| 51 | memo 优化 | 待性能证据 | 查 props 稳定性、语言更新；与 #36 同文件集成 |

## 证据与恢复入口

- #49 前端实例：http://127.0.0.1:5289/（Vite session 36820）。未设置 VITE_DEV_PROXY_API_BASE，因此连接现有本地后端 18792；已 GET /api/auth/status 验证连通。必须向用户说明设置修改影响现有数据，不能称为全栈隔离沙盒。截图阶段仅使用 Playwright 请求隔离，不等于浏览器直接访问时隔离。
- 当前 #49 worktree：/Users/peiwang/Projects/nextbot-contributor-pr-ui-acceptance，detached f6f78a595 + git apply 49.diff，内容与 PR head 相同，用于真实 diff-only 检查。codex/contributor-pr-ui-acceptance 分支仍指向原 PR head。不得把这些 materialized PR 改动误当用户新修改。
- #49 UI tsc 在依赖闭包构建后通过；33 个定向测试通过。maintainability 报 DocBrowser 函数 metric=302 新违规，已评论作者。作者原型文案承诺与按钮仅复制剪贴板不符，已反馈。
- #35 worktree：/Users/peiwang/Projects/nextbot-contributor-model-review，codex/contributor-model-review。17 个模型选择测试、UI tsc、定向 ESLint、diff-only maintainability（0 errors/0 warnings）通过。补齐中英文模型说明和 changeset，提交 6f29b6210 推送贡献者分支后 squash 合并。源码 head 的 Linux CI 为取消；文档补充触发的新 CI 合并时仍在运行，不声称全部 CI 通过。5290 Vite session 87281。
- #32 worktree：/Users/peiwang/Projects/nextbot-contributor-minimal-review，codex/contributor-minimal-review，head 645dc9e0601a5343d05b19baecf1799ead491eb6。server 依赖闭包构建、UI tsc、5 个导航测试通过。5291 Vite session 17010，/appearance 页面实际打开且界面模式控件可见；尚未完成全部交互/桌面验证。预览使用现有 18792 后端；界面模式存于该预览源的 localStorage，其余设置可能影响现有数据。
- GitHub 已发送：总纲 #47 的协调评论；#30/#31/#36/#38/#42/#49/#50 的具体返工意见；#48/#51 的收益证据要求。7 个阻塞 PR 的 REQUEST_CHANGES 均已确认成功，不重复发送。
- #42 故障复现：approveCandidate 在 USER.md 访问失败时已经清除候选；隔离 store 回放 before=1，EISDIR 后 after=0。已要求可恢复、幂等处理，并给出故障测试要求。
- 后续跟进自动化已创建：automationId=nextclaw-pr，每小时在当前任务继续，遵守产品卡口，无变化静默。默认实例 URL 的最新用户偏好优先于此前截图计划。
- 已有材料：/Users/peiwang/.codex/visualizations/2026/09/07/01a07c70-9302-7d71-8543-ab8c0cc6a2b7/pr49-review/index.html（5299，session 60653）；5299 只是对比页，不是 PR 实例。当前用户要求直接实例，后续不再默认制作此类页面。

- 本地 diff 缓存：`/tmp/nextclaw-pr-triage/{number}.diff`，2026-09-07 拉取；正式操作前重新核对 head。
- #38 在 PR head `f60c5f677190fa0910b344ed9ffcaf6a98f0b030` 的 `packages/nextclaw-kernel/src/utils/session-manager.utils.ts` 中不存在 fallback_model 写入，而 router-ncp-test-fixtures.ts 有。
- #50 `WikiManagementPage` 用 MOCK_WIKI_ENTRIES 初始化 useState；handleSave 只 setEntries。#31 saveSettings 明文保存 PSEUDONYM_PASSPHRASE_KEY 并仅执行 probe 加密自检。
- #46 → #45、#50 → #49 是叠 PR，不能按标题当独立增量合并；squash 后需重新核对依赖 diff。
- 2026-09-07 快照：全部 MERGEABLE；#31/#35/#36/#37/#38/#40 有失败或取消的 CI，其余 GitHub 报 CLEAN。这不能代替具体功能证据。
- 无子代理授权，保持单代理。当前已运行的用户宿主不得重启。

## 最新用户约束与语音预览（2026-09-08）

- 用户明确不再默认向作者反馈/要求返工；优先判断接收价值，有价值的问题由我们自己补丁，方向性问题交用户决定。停止自动追加作者评论，原有评论保留。
- 用户不认可新增极简模式，#32 停止“更多”补丁方向；尚未执行关闭 PR。前面的初步认可记录已被此决定覆盖。
- 当前请求：用户已批准语音产品设计并授权基于 #43 自行补丁实现；保留桌面按键绑定、区分移动端，原 PR 保留，没有批准合并。
- #43 worktree `/Users/peiwang/Projects/nextbot-contributor-voice-review`，分支 `codex/contributor-voice-review`，head `01a0f017c39b7c22c14c9d21b435d7c438741c08`。5292 Vite session 77460，http://127.0.0.1:5292/chat，连接现有 18792 后端。CUA tab 7 已打开新任务草稿并展开“添加内容”，语音输入按钮可用；未开启麦克风或发送消息，真实声音识别未验证。
- server 依赖闭包构建、UI tsc 通过。原有 9 测试通过；在既有测试文件追加的 3 项回归验证均失败：绑定 V 后 Ctrl+V 被 preventDefault；卸载时未 abort 识别；累计 final 结果重复，hello/world 得到 hello hello world。只修改测试，生产源码仍为原始 PR，未提交推送。后续修复可复用这 3 项失败测试；不要把原来 9 项通过称为功能正确。
- 识别事件累计结果合同参考 https://webaudio.github.io/web-speech-api/#speechrecognitionevent 。以上失败为原始 PR 的初始证据，已被以下补丁及回归验证覆盖。
- 新版补丁已在同一 worktree 完成并热更新，体验地址 http://127.0.0.1:5292/chat/draft ：常驻麦克风、点击开始/结束、完成后合入最新草稿且不自动发送；桌面可选绑定按住说话，移动端无绑定控件/监听；录音状态、计时、取消、错误及部分文字恢复；切换会话/卸载清理、迟到事件隔离、保护粘贴/输入法/普通输入。manager 统一拥有录音生命周期，快捷键设置使用独立持久化 store。设计见 worktree 的 docs/designs/2026-09-08-chat-voice-input.design.md，中英文用户文档及 changeset 已同步。没有提交、推送或合并。
- 最终验证：UI 与共享 agent-chat-ui 类型检查通过；录音生命周期及真实输入组件回归共 28 项通过；新增代码治理全部通过，diff 检查通过。diff-only 可维护性检查 0 错误、4 条既有大文件/函数预算告警，输入组件较原 PR 减少 36 行。浏览器已核对桌面与窄屏正常渲染，绑定/关闭设置可操作并已清除测试绑定。原版真实麦克风链路曾由用户验证可用，新补丁的真实语音服务尚待用户体验，不将模拟识别测试称为真实音频端到端通过。

## 本轮完成：实时输入与评论清理（2026-09-08）

- 用户追加要求直接删除，已尝试 DELETE 正式 review；GitHub 返回 HTTP 422 “Can not delete a non-pending pull request review”。随后已将全部 7 条正式 review 正文清空（body=""），均保持 DISMISSED，未再添加评论。12 条普通评论已删除，只有 GitHub 正式 review/撤销历史仍保留。该状态覆盖前面的“替换为撤回说明”。自动化 nextclaw-pr 的 prompt 已同步禁止自动评论、review、催作者及追加撤回说明。
- #43 新版已完成并更新 http://127.0.0.1:5292/chat/draft 。输入框在原光标/选区实时显示可修正、可缩短的转录；暂定文字点状下划线，结束去除；胶囊状态条不遮挡标题；桌面绑定保留、手机按钮交互。取消恢复原内容，打字/粘贴/指针/IME 接管时保留可见文字并隔离迟到结果。临时预览不发布业务节点，避免提前清理引用附件；提交复用原编辑链。选区从文本开头替换时的既有顺序缺陷已由回归复现并修复。
- 当前证据：共享编辑器 17 项 + 产品 UI/语音 27 项，共 44 项定向测试通过；两个 UI 包 tsc 通过；diff-only maintainability 0 errors / 6 个大文件或函数预算 warning；新增代码治理全部通过，diff --check 通过。定向 lint 无错误，原有两个超预算 warning 保留，新引入的 options 解构 warning 已修复并通过治理。真实 Chrome 页面使用模拟识别事件验证实时插入/替换、完成、取消、窄屏无溢出且隐藏绑定；桌面及手机布局已目视核对。模拟服务仅在独立测试浏览器内注入，不改变用户预览或真实识别器；未发送消息。真实音频识别仍交用户体验。
- 中英文用户文档、设计及 changeset 已同步。补丁尚未 commit/push/merge，原 PR 保留，等待用户产品验收；以上当前证据覆盖前一版卡片式补丁的 28 项结果。

## 当前阶段门与未关闭项

2026-09-08 #43 细节验收：修复浮层四角被裁切（浏览器实证：外层 radius=20px/overflow-x=hidden，内层 radius=16px）。外层改为无圆角、overflow visible，只定位；面板自身限制可用高度并滚动。修复设置关闭按钮缺失翻译键 close，改为 chatInputVoiceCloseSettings（关闭设置 / Close settings）；麦克风 hover 删除长篇说明，复用动作标签（语音输入 / 结束录音）。本轮语音/快捷键涉及的 27 个文案键在中英文目录均存在；Chrome 实际 hover 验证中文“语音输入 / 关闭设置”和英文“Voice input / Close settings”通过。圆角边框和阴影已目视验证，850×400 视口浮层未越界；两包 tsc、diff 检查、maintainability 0 errors / 7 budget warnings 通过。改动已热更新，未提交合并。

2026-09-08 最近一次 #43 验收修复：用户截图复现“无语音时打开设置，录音错误与设置同时出现”。已让 ready 设置视图与录音/错误视图互斥，转入设置清除识别状态，只显示绑定/停用；入口及面板标题均用 Settings 齿轮，删除重复标题和无关转写提示。Popover 锚点改为输入框顶部中央、align=center，保持 Portal 零布局位移。固定入口移到 /keyboard-shortcuts（设置 → 快捷键），外观页移除，两个入口仍共用控件/store，移动导航隐藏快捷键入口。对应中英文用户文档及设计已更新。

本轮验证：36 项语音/输入组件/外观/导航测试通过，新增真实输入组件回归覆盖点击设置后 no-speech 不出现 alert/重试；Chrome 模拟 no-speech 的真实页面复验确认设置内容纯净、两处齿轮、浮层中心与输入框中心误差小于 2px、boundingBox 不变，以及独立设置路由同步绑定/外观不再含绑定。两个 UI tsc、定向 lint、代码治理及 diff 检查通过；仍未实测本轮真实音频服务，未提交或合并。

2026-09-08 最新 #43 产品纠偏已实现：用户确认浮层不得改变页面布局，快捷键在应用设置中提供固定入口，同时在录音浮层最右端提供齿轮，输入栏移除常驻设置按钮。共享 ChatInputBar 改为 Portal Popover，锚定输入框并做视口碰撞处理；设置 → 外观 → 语音输入与录音浮层复用同一 ChatVoiceShortcutControl/store。录音中打开设置先 finish，等最终尾段提交后进入设置，失败也能打开并提示；不自动重录。原预览 URL 不变，尚未提交/合并。

本轮证据：真实 Chrome 使用模拟识别测量输入框 boundingBox，录音出现及展开设置前后完全相同；无常驻设置按钮、最终转录保留、绑定跨两入口同步、移动布局隐藏键盘配置均通过。产品 UI 32 项测试通过（含新增 settings 等待最终结果/失败路径及既有外观设置测试）；两个 UI 包 tsc 通过，maintainability 0 errors / 6 个预算 warning，新增代码治理通过，diff --check 通过。真实声音服务仍由用户体验；没有注入用户浏览器或发送消息。

当前阶段：建立真实 UI 和独立小改动证据。先复用代码、测试与作者报告，补最近链路缺口；不重复全仓构建。UI 验收只要求用户判断审美及方向，技术问题继续由 AI 处理。

恢复顺序：读取本台账 → 核对用户最新授权/验收答复 → 核对对应 PR head → 继续当前 worktree 与证据，不重做已经有效的检查。CPA-02/03/04/05 全部未关闭，整体状态 in-progress。

## #43 交付收尾（2026-09-08，覆盖此前未授权/未提交状态）

- 用户已验收并明确授权合入主干；保留原 PR 和完整提交历史，描述自然介绍功能，不刻意比较双方贡献，不追加评论。
- 补丁 c9a9a59d6、主干集成 213a256e0、日志对齐 fb35b33f4 均以 Peiiii 身份提交；原始 suantea 提交仍在历史中。已普通推送到原 PR 分支，远端 head 为 fb35b33f47e96b971682a758c875fc849809bfdd。
- 集成后两个 UI 包 tsc 及 53 项定向测试通过。GitHub 结构治理、文档构建、代码量、runtime smoke 通过；Windows EXE 的 SQLite 测试出现两项 5 秒超时，kernel/该工作流与已通过的主干相同，等待当前工作流结束后重跑失败项。
- 原 PR 描述已按最终行为更新，未新增评论。Windows 超时项同代码重跑后通过，所有执行的 PR 检查通过，部署项按 PR 条件跳过。
- #43 已以 merge commit f71eee632e54c181bd0bb42995a0d5eaed8293af 合入远程 master，双方提交历史完整保留；不发布 NPM，不重启现有实例。整体 PR 队列继续 in-progress。
- 主工作区协调器返回 LOCAL_MAINLINE_SYNCED，本地 master 与 origin/master 均为 f71eee632，原有未跟踪计划文档保留。

## 静默巡检快照（2026-09-08 02:36 CST）

- 16 个剩余开放 PR head 未变，无新增作者评论或 review。CI 汇总仍为 #31/#36/#37/#38/#40 FAILURE，其余 SUCCESS；没有新的修复证据使已记录阻塞失效。
- #35/#43 保持 MERGED；已修正台账顶部及队列的陈旧语音状态，避免重复实施或再次要求验收。没有外部评论、合并、重启或发布操作；整体队列仍 in-progress。
