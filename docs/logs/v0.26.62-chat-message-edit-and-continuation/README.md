# 会话消息编辑与中断后继续运行

## 迭代完成说明

- 新增对标 Codex / Cursor 的同会话消息编辑：只允许编辑最近一条可见用户消息，确认后直接回退当前 session 的 journal、消息投影与内存快照，删除目标及其后的旧 AI / reasoning / tool 历史，再由编辑后的消息在同一 session 启动新 run；不创建分支、不导航、不产生不可见的后台会话。
- 新增中断后继续运行：当会话处于 `cancelled` / `failed` 且已经 idle 时，保留已有 assistant 与工具进展，追加模型可见、UI 隐藏的 continuation 指令；输入框空白时主按钮与最近一条中断 assistant 消息都提供入口，用户开始输入后主按钮恢复发送语义。
- 交互统一收口：运行或排队期间完全隐藏编辑入口；编辑、继续及输入框纯图标操作都有 tooltip、aria-label 和 focus-visible；消息继续操作使用线性圆形播放图标，输入框使用非实心三角。
- 编辑器直接复用共享 Lexical composer core，进入编辑后自动聚焦到末尾。首次输入标点时光标跳回标点前的根因，是 `focusComposerAtEnd` 在已经即时应用末尾选区后仍遗留 `pendingSelectionRef`，第一次受控节点同步又消费了旧选区；现已删除重复待恢复状态，并让延迟 focus 回调只在内容签名和选区均未变化时才允许落选区。
- 同一 session 的 edit / continue 使用统一 pending command owner：相同命令并发合并，不同命令互斥；前端另有同步命令锁，覆盖双击发生在 React 重渲染之前的窗口。

## 测试/验证/验收方式

- Kernel 定向测试：3 个文件、20 项通过，覆盖同 session 历史编辑、最近用户消息约束、隐藏消息、busy 拒绝、继续运行、命令去重/互斥和 activity preview 隐藏消息；`session.manager.test.ts` 另有 1 项持久化回退定向测试通过。
- Server / SDK 合同测试：服务端 14 项、Client SDK 16 项通过，覆盖 edit / continue route、payload 与同 session run handle。
- 共享聊天 UI：3 个文件、58 项通过，覆盖主按钮状态、tooltip、图标、消息动作与共享 Lexical owner。
- 产品 UI：9 个文件、60 项通过，覆盖编辑乐观替换与失败恢复、无导航、继续双入口、运行态隐藏编辑、消息与附件 round-trip、自动聚焦及“第一次输入逗号后光标仍在逗号末尾”。
- TypeScript：在只应用本次暂存补丁的隔离工作树中，`@nextclaw/shared`、`@nextclaw/ncp-react`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` 的 `tsc` 均通过。
- 构建：隔离暂存快照按依赖拓扑构建上述 7 个受影响 package 及其 workspace 依赖，共 23 个 package 全部通过；构建只出现既有 Browserslist 和 chunk size warning，无构建错误。
- ESLint：定向源码与测试为 0 error；既有超长测试文件 warning 保留，未以格式化或无关拆分扩大本次范围。
- 治理：`post-edit-maintainability-guard` 通过；`AgentRunRequestManager` 从越界的 664 行收敛到 510 行，session command 独立 owner；消息列表容器从 507 行收敛到 451 行。
- 未重启当前 NextClaw 宿主或桌面实例，因此没有声明真实桌面手工冒烟；用户可见行为由生产构建、同会话集成测试和最贴近真实输入的 `userEvent` 编辑器回归覆盖。

## 发布/部署方式

- 本次源码、测试、设计文档、changeset 与迭代记录随当前功能提交；未推送、未部署、未发布，也未重启当前运行实例。
- 后续通过统一 changeset 版本化和发布流程交付。

## 用户/产品视角的验收步骤

1. 在 idle 会话中 hover 最近一条用户消息，确认出现带 tooltip 的编辑操作；进入编辑后无需再次点击，光标已在末尾，第一次输入逗号后光标仍在逗号后。
2. 修改内容并确认，确认 session 和路由不变，原消息及其后的旧 AI / tool 历史消失，编辑后的消息立即显示且 AI 在当前会话继续回复。
3. 在 AI 运行或存在排队消息时，确认编辑图标完全不出现。
4. 中止一个尚未完成的 run，确认已有部分回复保留；空输入框主按钮和最近中断 assistant 消息均出现“继续运行”，hover 有明确提示。
5. 点击任一继续入口，确认在当前会话接着执行且不重复已完成内容；在输入框键入文本后，主按钮恢复发送，但消息尾部继续入口仍可找到。

## 可维护性总结汇总

- 这是新增用户能力，受影响生产路径相对基线为 `+1327/-151，净增 1176`；净增长主要来自跨 shared / kernel / transport / React / UI 的完整合同、同会话恢复能力和共享编辑器复用，不适用非功能改动净增不大于零门槛。
- 守卫首次发现两个越界后已直接减债：把 edit / continue 的校验、同 session 并发锁、历史回退和 continuation 消息构造从 `AgentRunRequestManager` 拆入 `AgentRunSessionCommandManager`，请求主干恢复为 send / runtime 执行 owner；把 timeline divider 从消息列表容器移到稳定展示组件，容器较基线净减 33 行。
- 前端没有复制第二套 contenteditable；内联编辑复用 `ChatComposerEditor` 和同一个 `ChatComposerLexicalOwner`，因此 token、附件、选区与键盘语义仍由共享 editor owner 维护。
- 队列消息恢复也改为复用同一 `buildSessionMessageComposerSnapshot` owner，删除 `session-queued-input.utils.ts` 内重复的文本 token、附件和技能快照构造，生产代码净减 93 行。
- session journal 重写只有 `SessionManager.rewindSessionBeforeMessage` 一个持久化 owner，`SessionRun.replaceMessages` 只同步当前内存态；router、SDK 和 UI 不直接篡改持久化数据。
- 仍需关注但未越界：共享 Lexical owner 477 行、会话输入 487 行、SessionManager 600 行；本次未继续拆分，因为各自仍保持单一稳定职责，额外拆分不会直接降低当前功能风险。

## NPM 包发布记录

- 需要后续统一发布 patch：`@nextclaw/shared`（0.4.17）、`@nextclaw/ncp-react`（0.5.18）、`@nextclaw/kernel`（0.6.20）、`@nextclaw/server`（0.15.20）、`@nextclaw/client-sdk`（0.5.20）、`@nextclaw/agent-chat-ui`（0.6.19）、`@nextclaw/ui`（0.15.21）与 `nextclaw`（0.28.0）。
- 当前状态：均未在本次任务中发布，标记为 `待统一发布`。
