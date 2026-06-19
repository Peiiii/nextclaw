# v0.20.90 Child Session Context Inheritance

## 迭代完成说明

本次为子会话新增可选的父会话上下文继承能力。实现前先补充方案设计文档：`docs/designs/2026-06-19-child-session-inherit-context.design.md`。

核心取舍：

- 不新增 `fork_parent_session_id`。父子关系继续使用既有 `parent_session_id` / `parentSessionId`，上下文继承只用独立的 `inheritContext` 参数表达。
- `inheritContext` 仅允许 `scope: "child"` 使用，默认不继承，避免 standalone 会话意外复制上下文。
- 继承锚点来自本次 `sessions_spawn` tool call id；若创建时锚点消息尚未持久化，则退回到当前已持久化消息快照，并在 metadata 中标记 `anchorKind: "latest_persisted"`。
- `SessionManager` 仍是会话创建和 journal snapshot 写入 owner；具体继承消息复制与 metadata 合并拆入 `session-context-inheritance.utils.ts`，避免 manager 越过文件预算。
- UI 隐藏继承消息气泡，只在消息时间线插入继承分隔线，让用户知道该子会话继承了父会话上下文。

完成项：

- `sessions_spawn` schema 新增 `inheritContext: boolean`。
- child + `inheritContext: true` 会将 `contextInheritance` 传入 session request / session creation 链路。
- `SessionManager.createSession` 在创建子会话时复制锚点前父会话 final messages，并写入 `context_inheritance`、`inherited_from_session_id`、`inherited_from_message_id` metadata。
- chat 消息列表根据继承 metadata 渲染“已继承父会话上下文”分隔线，并过滤 inherited messages，避免把父会话历史重复展示成 child 会话气泡。
- 新增 changeset：`.changeset/child-session-context-inheritance.md`。

## 测试/验证/验收方式

定向测试：

- `pnpm -C packages/nextclaw-kernel test -- --run src/tools/session-spawn.tools.test.ts src/managers/__tests__/session.manager.test.ts src/features/session-request/managers/session-request.manager.test.ts`
- 结果：3 个 test files 通过，20 个 tests 通过。
- `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx`
- 结果：1 个 test file 通过，9 个 tests 通过。

类型检查：

- `pnpm -C packages/nextclaw-core tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-kernel tsc`：未通过，失败点为既有 `@nextclaw/runtime` 模块解析缺口：
  - `src/features/narp-runtime/services/builtin-narp-runtime-provider.service.ts`
  - `src/managers/llm-provider.manager.ts`
  - 该失败不在本次触达文件内。

Lint 与治理：

- 触达文件 ESLint：core / ui 通过；kernel 无 error，保留既有 `session.manager.test.ts` 顶层 `describe` 超长 warning。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm clean:generated`：通过，生成物干净。

可维护性守卫：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- 结果：0 errors，1 warning。
- warning：`session.manager.ts` 当前 599 行，预算 600 行，接近预算但未越界；本次已把继承快照逻辑拆到 `session-context-inheritance.utils.ts`，避免继续膨胀 manager。

## 发布/部署方式

本次未执行发布、部署、远程 migration 或 runtime update。

发布判断：

- 这是用户可见功能与工具能力变更，已新增 `.changeset/child-session-context-inheritance.md`。
- 影响包：`@nextclaw/core` patch、`@nextclaw/kernel` patch、`@nextclaw/ui` patch。
- 不涉及数据库 migration、远程 deploy 或线上 API smoke。

## 用户/产品视角的验收步骤

1. 在父会话中调用 `sessions_spawn`，参数使用 `scope: "child"` 与 `inheritContext: true`。
2. 预期新子会话 metadata 仍保留既有父会话关系字段，不出现新的 fork parent id。
3. 打开子会话消息列表，预期开头出现“已继承父会话上下文”分隔线。
4. 检查子会话消息列表，预期不重复展示继承自父会话的消息气泡，只展示 child 会话自己的后续消息。
5. 检查子会话运行上下文，预期只继承 spawn 锚点之前的父会话 final messages，锚点之后消息不被复制。
6. 使用 `scope: "standalone"` 搭配 `inheritContext: true`，预期工具拒绝该参数组合。

## 可维护性总结汇总

本次是新增用户可见能力，生产代码净增长是功能所需：需要新增工具参数合同、会话继承快照构造、metadata 标记、UI 时间线分隔线与 i18n 文案。

可维护性动作：

- 把“父子关系”和“是否继承上下文”解耦，避免新增重复 parent id。
- 继承逻辑集中在 `session-context-inheritance.utils.ts`，`SessionManager` 只保留创建主流程和 owner 调用。
- UI 只根据消息 metadata 派生继承提示并过滤 inherited messages，不新增平行 store、effect 或会话状态通道。
- `post-edit-maintainability-guard` 已使用；`post-edit-maintainability-review` 结论为新增能力代码增长可接受，但 `session.manager.ts` 接近预算，是后续 session owner 拆分的观察点。

代码增减报告：

- 触达源码与测试：新增 460 行，删除 7 行，净增 453 行。
- 可维护性守卫生产源码口径：新增 253 行，删除 4 行，净增 249 行。
- 设计文档、changeset 与本迭代记录不计入上述代码口径。

## NPM 包发布记录

本次未发布 NPM 包。

后续若进入统一发布：

- `@nextclaw/core`：patch，原因是新增 child session context inheritance 输入类型。
- `@nextclaw/kernel`：patch，原因是 `sessions_spawn` 新增 `inheritContext` 参数并实现子会话继承快照。
- `@nextclaw/ui`：patch，原因是 chat 消息列表新增继承上下文时间线提示。
