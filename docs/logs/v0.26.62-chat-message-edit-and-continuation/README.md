# 会话消息编辑与中断后继续运行

## 迭代完成说明

- 新增对标 Codex / Cursor 的同会话消息编辑：只允许编辑最近一条可见用户消息，确认后直接回退当前 session 的 journal、消息投影与内存快照，删除目标及其后的旧 AI / reasoning / tool 历史，再由编辑后的消息在同一 session 启动新 run；不创建分支、不导航、不产生不可见的后台会话。
- 新增中断后继续运行：当会话处于 `cancelled` / `failed` 且已经 idle 时，保留已有 assistant 与工具进展，追加模型可见、UI 隐藏的 continuation 指令；输入框空白时主按钮与最近一条中断 assistant 消息都提供入口，用户开始输入后主按钮恢复发送语义。
- 交互统一收口：运行或排队期间完全隐藏编辑入口；编辑、继续及输入框纯图标操作都有 tooltip、aria-label 和 focus-visible；消息继续操作使用线性圆形播放图标，输入框使用非实心三角。
- 编辑器直接复用共享 Lexical composer core，进入编辑后自动聚焦到末尾。首次输入标点时光标跳回标点前的根因，是 `focusComposerAtEnd` 在已经即时应用末尾选区后仍遗留 `pendingSelectionRef`，第一次受控节点同步又消费了旧选区；现已删除重复待恢复状态，并让延迟 focus 回调只在内容签名和选区均未变化时才允许落选区。
- 同一 session 的 edit / continue 使用统一 pending command owner：相同命令并发合并，不同命令互斥；前端另有同步命令锁，覆盖双击发生在 React 重渲染之前的窗口。
- 修复切换模型后恢复入口可能消失：根因是会话 query cache 会无条件保留旧的 realtime `running` 覆盖，即使更新后的摘要已经通过 `last_activity_preview` 明确进入 `cancelled` / `failed`；现仅在新摘要仍为 `running` activity 时保留覆盖，终止摘要会收敛为 `idle`，两个继续入口因此不再受模型偏好更新影响。
- 修正继续运行的消息归属：kernel 在隐藏 continuation 指令上持久化当前中断 assistant 的明确 target，原始 NCP 历史继续保留独立 run 与 assistant 段；UI 时间线统一把关联段续写到原 assistant 气泡，等待首个 delta、实时流、重复继续和刷新 hydration 都保持同一消息身份。最新可见消息仍是 user 时不设置 target，避免把新一轮输出误接到更早回复。
- 修复续写后工具组状态失真：根因是共享聊天组件按同类工具中最严重的一条状态给整个类别贴标签，导致“1 条取消、2 条成功”被汇总为“运行 3 条命令 已取消”；现按每个实际工具单元聚合，全部取消时才标记整组取消，混合结果显示“运行 3 条命令 · 1/3 已取消”，每条明细状态保持不变。

## 测试/验证/验收方式

- Kernel 定向测试：3 个文件、20 项通过，覆盖同 session 历史编辑、最近用户消息约束、隐藏消息、busy 拒绝、继续运行、命令去重/互斥和 activity preview 隐藏消息；`session.manager.test.ts` 另有 1 项持久化回退定向测试通过。
- Server / SDK 合同测试：服务端 14 项、Client SDK 16 项通过，覆盖 edit / continue route、payload 与同 session run handle。
- 共享聊天 UI：全量 35 个文件、253 项通过；除主按钮状态、tooltip、图标、消息动作与共享 Lexical owner 外，补充覆盖混合成功/取消结果及全部取消两种工具组汇总。
- 产品 UI：9 个文件、60 项通过，覆盖编辑乐观替换与失败恢复、无导航、继续双入口、运行态隐藏编辑、消息与附件 round-trip、自动聚焦及“第一次输入逗号后光标仍在逗号末尾”。
- TypeScript：在只应用本次暂存补丁的隔离工作树中，`@nextclaw/shared`、`@nextclaw/ncp-react`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` 的 `tsc` 均通过。
- 构建：隔离暂存快照按依赖拓扑构建上述 7 个受影响 package 及其 workspace 依赖，共 23 个 package 全部通过；构建只出现既有 Browserslist 和 chunk size warning，无构建错误。
- ESLint：定向源码与测试为 0 error；既有超长测试文件 warning 保留，未以格式化或无关拆分扩大本次范围。
- 治理：`post-edit-maintainability-guard` 通过；`AgentRunRequestManager` 从越界的 664 行收敛到 510 行，session command 独立 owner；消息列表容器从 507 行收敛到 451 行。
- 模型切换稳定性补充验证：先用回归测试确认旧实现会把 `cancelled` / `failed` 错误保留为 `running`，修复后 query cache、继续运行 controller 与会话区域共 3 个文件、26 项测试通过；`@nextclaw/ui` ESLint 与 `tsc` 通过。真实页面在空输入框下切换模型后，消息尾部和输入框两个“继续运行”入口从即时状态到 3 秒后的观察点均保持存在。
- 消息连续性补充验证：覆盖 kernel target 选择、首个 delta 前原消息 pending、单次/重复 continuation 归并、原消息 ID 与 parts 顺序、无回复轮次不误关联，以及没有 metadata 的相邻 assistant 永不合并；时间线投影始终只向容器交付一个 canonical assistant 行。
- 本轮连续性定向回归：Kernel 2 个文件、12 项通过；产品 UI 4 个文件、37 项通过；共享聊天 UI 全量 35 个文件、253 项通过。
- 工具组混合状态回归：共享聊天组件定向测试覆盖“1 条命令取消、后续 2 条成功”，汇总标题为“运行 3 条命令 · 1/3 已取消”，不再把整个分组误报为取消。
- 真实页面补充冒烟：在用户指定的运行中 Vite 会话点击消息级“继续运行”，开始前、首个 delta 后、停止后及刷新后文章节点始终为 6 个，没有生成第 7 个 assistant 气泡；原“已思考 568 个字符”与续写的“已思考 4650 个字符”保留在同一节点。证明界面结果后主动停止验证 run，避免它继续执行会话中的外部操作；未重启当前 NextClaw 宿主或桌面实例。

## 发布/部署方式

- 初始编辑/继续能力已进入本地提交 `51775ef62`；本轮“原消息原地续写”、工具组真实状态与模型切换稳定性修正随本次本地提交交付，未推送、未部署、未发布，也未重启当前运行实例。
- 后续通过统一 changeset 版本化和发布流程交付。

## 用户/产品视角的验收步骤

1. 在 idle 会话中 hover 最近一条用户消息，确认出现带 tooltip 的编辑操作；进入编辑后无需再次点击，光标已在末尾，第一次输入逗号后光标仍在逗号后。
2. 修改内容并确认，确认 session 和路由不变，原消息及其后的旧 AI / tool 历史消失，编辑后的消息立即显示且 AI 在当前会话继续回复。
3. 在 AI 运行或存在排队消息时，确认编辑图标完全不出现。
4. 中止一个尚未完成的 run，确认已有部分回复保留；空输入框主按钮和最近中断 assistant 消息均出现“继续运行”，hover 有明确提示。
5. 点击任一继续入口，确认思考反馈和后续输出都紧接在原中断 AI 消息内，不新增第二个气泡，且不重复已完成内容；再次中断并继续仍保持同一气泡。在输入框键入文本后，主按钮恢复发送，但消息尾部继续入口仍可找到。
6. 在可继续的终止会话里保持输入框为空并切换模型，确认消息尾部和输入框的“继续运行”入口都不会消失。
7. 让一条命令在中断时取消，再继续完成两条命令，确认组标题显示“运行 3 条命令 · 1/3 已取消”，明细中只有第一条为取消，后两条为成功。

## 可维护性总结汇总

- 这是新增用户能力，受影响生产路径相对基线为 `+1327/-151，净增 1176`；净增长主要来自跨 shared / kernel / transport / React / UI 的完整合同、同会话恢复能力和共享编辑器复用，不适用非功能改动净增不大于零门槛。
- 守卫首次发现两个越界后已直接减债：把 edit / continue 的校验、同 session 并发锁、历史回退和 continuation 消息构造从 `AgentRunRequestManager` 拆入 `AgentRunSessionCommandManager`，请求主干恢复为 send / runtime 执行 owner；把 timeline divider 从消息列表容器移到稳定展示组件，容器较基线净减 33 行。
- 前端没有复制第二套 contenteditable；内联编辑复用 `ChatComposerEditor` 和同一个 `ChatComposerLexicalOwner`，因此 token、附件、选区与键盘语义仍由共享 editor owner 维护。
- 队列消息恢复也改为复用同一 `buildSessionMessageComposerSnapshot` owner，删除 `session-queued-input.utils.ts` 内重复的文本 token、附件和技能快照构造，生产代码净减 93 行。
- session journal 重写只有 `SessionManager.rewindSessionBeforeMessage` 一个持久化 owner，`SessionRun.replaceMessages` 只同步当前内存态；router、SDK 和 UI 不直接篡改持久化数据。
- 仍需关注但未越界：共享 Lexical owner 477 行、会话输入 487 行、SessionManager 600 行；本次未继续拆分，因为各自仍保持单一稳定职责，额外拆分不会直接降低当前功能风险。
- 本次模型切换修正的生产代码为 `+7/-10，净减 3 行`：继续复用唯一的 session query cache owner，并把摘要时序判断收敛为单一表达式，没有新增组件状态、fallback 或平行恢复路径。守卫无阻塞项；`shared/lib/api` 历史目录仍为 13 个直接文件，但已有目录预算豁免且本次未新增文件。
- 本轮原消息原地续写与工具组真实状态修正的生产代码为 `+156/-30，净增 126 行`；加上模型切换净减 3 行后，当前未提交生产改动合计 `+163/-40，净增 123 行`，含测试总计 `+401/-42，净增 359 行`。增长用于共享 metadata 合同、唯一时间线投影与真实工具结果聚合，没有新增 service/manager、组件状态或第二条历史链路；消息列表容器只净增 2 行并保持在 500 行预算内。`post-edit-maintainability-guard` 为 0 error，警告仅涉及既有目录预算、接近预算的 468 行容器和集中覆盖边界的时间线测试。

## NPM 包发布记录

- 需要后续统一发布 patch：`@nextclaw/shared`（0.4.18）、`@nextclaw/ncp-react`（0.5.19）、`@nextclaw/kernel`（0.6.21）、`@nextclaw/server`（0.15.21）、`@nextclaw/client-sdk`（0.5.21）、`@nextclaw/agent-chat-ui`（0.6.20）、`@nextclaw/ui`（0.15.22）与 `nextclaw`（0.28.2）。
- 当前状态：均未在本次任务中发布，标记为 `待统一发布`。
