# Session Run 插话实时顺序修复

## 迭代完成说明

- 修复 Agent 运行中使用“插到下一步”后，后续用户消息短暂跑到当前步骤 AI 输出前面的问题；实时流式、当前步骤完成和刷新重载现在稳定保持 `U1 -> A1 -> U2 -> A2`。
- 根因是 NCP conversation manager 把有序 endpoint event stream 错误地按 `message.timestamp` 重新排序。真实故障会话中 A1 的 `MessageCompleted` 为 journal seq 247，U2 的 `MessageSent` 为 seq 248，但 U2 客户端时间比 A1 消息时间早 3236ms，实时 UI 因而展示成 `U1 -> U2 -> A1`；冷重载按 journal 顺序投影后又自行恢复。
- 修复让实时消息按 endpoint event 接纳顺序追加，并由 conversation manager 保存 streaming message 的事件序插入边界；React 只机械物化该边界，历史 prepend 与尚未进入事件流的 optimistic message 才允许按时间戳定位。
- 根因通过用户提供的真实 session journal、当前实例 canonical API、修前确定性排序重放和修后同一时间戳重放共同确认。修复落在共享 NCP 状态 owner 与 React consumer，而不是在聊天组件里对特定消息做重排补丁。

## 测试/验证/验收方式

- `@nextclaw/ncp`、`@nextclaw/ncp-toolkit`、`@nextclaw/ncp-react`、`@nextclaw/ui` 的 TypeScript 检查全部通过。
- NCP toolkit 全量测试：12 个文件、53 项全部通过。
- UI 定向测试：2 个文件、27 项全部通过，覆盖 live streaming 插入顺序和 assistant DOM identity 不变。
- 触达 TypeScript/TSX 的 targeted ESLint 通过；`git diff --check` 通过。
- 真实 session 的 3236ms 时间倒挂隔离重放耗时 1.203ms；live 与 settled 都得到 `user-mt7jp7vd -> assistant-message-2629eaf9-c4ce-4562-b22d-c70f1e8c85e2 -> user-mt7jpad5`。
- diff-only maintainability guard 为 0 error、1 warning；conversation manager 当前位于 600 行预算边界，没有开放 finding。
- `pnpm lint:new-code:governance` 的命名、目录、文档名、文件角色阶段通过，module structure 只报告触达既有冻结 root 的 warning；package-public-imports 阶段因治理脚本把 TSX alias 检查按普通 TS 解析而以 `TSError: '>' expected` 退出。排除 TSX 后对 5 个实际源码文件单独运行 package-public-imports 通过；backlog ratchet 通过。这是治理工具的已知 JSX parser 缺口，不是产品代码 finding。

## 发布/部署方式

- 本迭代只提交源码、测试、设计、changeset 和迭代记录到本地 `master`。
- 不执行 push、NPM/runtime/desktop 发布、部署或 NextClaw 宿主重启。
- 后续统一发布流程消费 `.changeset/session-steering-live-order.md` 后，改动才进入正式安装版本。

## 用户/产品视角的验收步骤

1. 让 Agent 保持推理、流式输出或工具执行状态。
2. 当前步骤进行中提交第二条消息并选择“插到下一步”。
3. 确认当前步骤已经产生的 AI 内容始终位于第二条用户消息之前，下一步骤输出位于第二条消息之后。
4. 等待当前步骤完成并刷新页面，确认顺序始终为 `U1 -> A1 -> U2 -> A2`，没有先错序再靠刷新自愈。
5. 确认流式更新和用户消息交接期间，已有 assistant 气泡没有闪烁、重复或重挂载。

## 可维护性总结汇总

- endpoint event 顺序继续由 `DefaultNcpAgentConversationStateManager` 单一拥有；React hook 不解释 run 因果，只消费明确的 streaming 插入边界。
- 历史时间线排序与实时事件序 upsert 分成两个明确算法，没有新增兼容 fallback、第二 manager、UI 本地顺序 store 或消息 ID 特判。
- 首轮实现使 conversation manager 越过 600 行预算，已把纯数组转换收敛到现有 utils；最终 manager 只净增 2 行并回到预算边界。
- 自动 guard 最终 0 error；1 个 near-budget warning 已完成主观复核，没有为消除警告新增无收益文件或压缩类型安全。新增 changeset 与迭代路径均通过 planned-path preflight。

## 红区触达与减债记录

### packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-conversation-state.manager.ts

- 本次是否减债：是。
- 说明：首轮实现达到 639 行并越过预算；返工后将 streaming 边界重定位与事件序 upsert 纯算法移入既有 utils，主 manager 回到 600 行预算边界。
- 下一步拆分缝：若继续增长，优先把 conversation timeline 状态迁移收敛为独立 owner，不在主 manager 累加新的排序分支。

## NPM 包发布记录

- 需要后续统一发布；本提交不发布任何包。
- `@nextclaw/ncp@0.9.0-beta.0`：新增公开 streaming 插入边界合同，待统一发布（minor changeset）。
- `@nextclaw/ncp-toolkit@0.6.22-beta.0`、`@nextclaw/ncp-react@0.5.24-beta.0`、`@nextclaw/ui@0.20.0-beta.0`：实现并消费实时事件序合同，待统一发布（patch changeset）。
