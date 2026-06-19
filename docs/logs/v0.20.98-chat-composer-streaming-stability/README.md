# v0.20.98 Chat Composer Streaming Stability

## 迭代完成说明

本次修复 AI 输出 streaming 过程中输入框干扰用户打字的问题。

根因：底层 `ChatInputBar` 的 composer 在输入事件里读取外部 `nodes` props 作为当前编辑器真相；当父级因为消息流高频重渲染、而外部 owner 还没确认刚输入的节点时，旧 props 会回刷 Lexical 文档，造成中文 IME 输入丢失、内容突然清空或光标跳回前面。第二层根因是本地 `publishSnapshot` 设置了正确 selection 后，Lexical update listener 在程序化同步窗口里仍无条件抢写 `selectionRef`，会把 caret 重新写回 0，导致下一次中文 composition commit 插到最前面。第三层根因是 `compositionEnd` 只按 `event.data` 手动插入，未区分真实浏览器已经把 composition 文本提交进 Lexical 的路径，会在无 streaming 场景下把 `你好` 变成 `你好你好`。第四层根因是 composer document signature 把 text node id 当成内容语义；streaming rerender 或 Lexical root rewrite 产生不同 text id 时，同样文本会被误判为外部文档变更，进而触发不必要同步并重置 caret。

确认方式：新增底层 IME 复现测试，让中文 composition 输入先产生 pending nodes，再模拟 stale owner rerender，继续输入第二个中文字符，断言内容保持为 `你好`。红灯验证中临时移除 stale owner 防回刷逻辑后，同一测试失败，实际内容为 `好你`；恢复防回刷并修正 selection owner 后，同一测试通过。追加无 streaming 的 compositionEnd 红灯用例：模拟真实浏览器已经提交 `你好` 后再触发 `compositionEnd.data`，旧实现发布 `你好你好`；修复后同一用例通过。追加 signature 红灯用例：两个同文本但不同 id 的 text node 在旧实现下签名不同；修复后签名相同。新增会话区域测试，断言 streamed messages 变化不会重渲染 composer input 子树，draft 发送开始也不会仅因 sending 状态替换 welcome composer。

修复方式：
- `agent-chat-ui` composer 发布本地编辑快照时立即同步 Lexical 编辑器，并记录 pending owner signature。
- 外部 owner 未追上本地 signature 前，忽略旧 `nodes` props 对编辑器的回刷。
- 输入事件读取 Lexical 当前内容快照，而 selection 继续以 composer owner 保存的 `selectionRef` 为优先事实。
- Lexical update listener 在程序化同步或 IME composition 窗口里不再抢写 composer selection。
- compositionStart 记录基线快照；compositionEnd 时如果 editor 内容相对基线已经变化，接受浏览器提交后的 editor 快照，不再按 `event.data` 二次插入。
- composer document signature 改为只表达内容语义：text node 只看文本内容，token node 只看 token kind/key/label，避免编辑器内部 id 变化误触发同步。
- streaming/stale-owner 复现 harness 从主测试文件拆到 test-utils，降低主测试文件体积并让复现模型更明确。
- `nextclaw-ui` 会话输入区只接收稳定 controller 投影，减少 message streaming 对 composer owner 的重渲染影响。
- 欢迎页 draft 输入不再仅因发送开始切换到默认输入实例。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx`
- 红灯复现：临时移除 stale owner 防回刷逻辑后，`pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx -t "keeps local IME typing stable across stale owner rerenders before the owner flushes nodes"` 失败，实际内容为 `好你`。
- 绿灯验证：恢复防回刷并修正 selection owner 后，同一个 `-t` 用例通过。
- 红灯复现：`pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx -t "does not duplicate IME text already committed by the browser before compositionend"` 在旧实现下失败，实际发布 `你好你好`。
- 绿灯验证：加入 compositionStart 基线判断后，同一个 `-t` 用例通过。
- 红灯复现：`pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx -t "treats text node ids as non-semantic"` 在旧实现下失败，两个同文本不同 id 的 text node 签名不同。
- 绿灯验证：signature 忽略非语义 id 后，同一个 `-t` 用例通过。
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-agent-chat-ui lint`
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/features/conversation/components/__tests__/session-conversation-area.test.tsx src/features/chat/features/conversation/components/__tests__/session-conversation-input.streaming.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`

维护性 guard：
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- 结果：阻塞于非功能非测试代码净增 `+82`。本次记录 line-growth exemption，原因见可维护性总结。

## 发布/部署方式

未执行发布或部署。本次涉及 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 用户可见 bugfix，已添加 changeset，后续随统一 NPM 发布流程发布。

## 用户/产品视角的验收步骤

1. 打开聊天会话并触发 AI streaming 输出。
2. 在输出过程中继续在输入框里用中文输入法输入文字。
3. 预期：输入内容不应突然清空，IME composition 不应被打断，光标不应跳回最前面。
4. 在欢迎页 draft 输入框发送第一条消息。
5. 预期：发送开始本身不应立刻替换 composer 实例；输入框 owner 应保持稳定直到进入真实会话/消息态。

## 可维护性总结汇总

已执行 `post-edit-maintainability-review` 口径复核。

代码增减报告：新增 `785` 行，删除 `54` 行，净增 `+731` 行。

非测试代码增减报告：新增 `134` 行，删除 `52` 行，净增 `+82` 行。

line-growth exemption：本次为用户可见 bugfix，但根因位于编辑器 owner、外部 owner 异步确认合同、IME composition 生命周期合同，以及 composer document signature 语义合同。必要新增包括 pending owner signature、防 stale props 回刷、编辑器当前内容快照读取、selection owner 防抢写、compositionStart 基线判断、语义 signature，以及上层输入区稳定 controller 投影。近处已删除旧的 props 快照读取函数并复用现有 signature、selection、Lexical sync 工具；继续压缩会把状态合同变成隐式分支，降低 IME 与 stale owner 场景的可读性和可验证性。

本次顺手减债：是。正向减债动作是职责收敛、必要解耦抽象和测试结构拆分：把“当前编辑器真相”收回 composer owner，把外部 props 降级为确认/重置来源；上层会话区只向输入区传递稳定的发送控制投影，减少 message streaming 对 composer 的耦合；streaming/stale-owner 复现模型拆到 test-utils，避免主测试文件继续膨胀。

保留债务：`chat-input-bar.test.tsx` 仍接近测试文件预算，当前 `862/900`；`session-conversation-input.tsx` 接近 UI 组件预算，后续可把 toolbar/collection 构建继续拆出。后续优化方向是继续减少 composer 生命周期逻辑在 React 组件/hook 内的占比，向 editor owner/controller 收敛。

后续结构优化：已把 Lexical composer 的 runtime、editor listener、外部状态同步、IME composition、selection 和 imperative handle 生命周期收敛到 `lexical/owners/chat-composer-lexical-owner.ts`。React 组件现在只负责创建 owner、配置当前 runtime、转发 DOM 输入事件；Lexical bindings plugin 只负责绑定 editor、同步 editable/nodes，以及注册一次 editor listener。`KEY_DOWN_COMMAND` / update / selection / blur listener 不再随 `nodes/actions/callbacks` 高频重绑，message streaming 只更新 owner 的 runtime 快照。

后续优化维护性结果：新增 `lexical/owners/` 子边界，避免继续扩张 `lexical` 平铺目录；删除旧组件/插件内的生命周期逻辑与重复 handle owner。定向维护性 guard 结果为非测试生产代码净减 `-1`，owner 文件 `466/500`，保留“接近预算” warning。该 warning 可接受，因为 owner 现在集中承载真实 editor 生命周期；后续若继续增长，应优先拆出纯 handle 命令或 selection 同步 owner，而不是把逻辑放回 React 组件/hook。

## NPM 包发布记录

- 是否需要发布：需要，用户可见输入稳定性 bugfix。
- 涉及包：`@nextclaw/agent-chat-ui`、`@nextclaw/ui`。
- 当前状态：未发布。
- 发布安排：待统一 NPM 发布。
