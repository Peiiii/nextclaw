# v0.26.4 Codex 跨模型会话连续性

## 迭代完成说明

- 修复同一个 NextClaw Codex 会话切换模型后隐式创建新 Codex thread、导致底层上下文断开的行为。
- 根因是 Codex NARP wrapper 把 `codex_thread_model` 当成 thread 身份的一部分；当前模型与保存的模型作用域不一致时，它会丢弃已有 `codex_thread_id`。新 thread 随后覆盖旧绑定，且只接收当前轮消息。
- 修前回归测试直接确认了 `Runtime default -> 自定义模型` 时 `threadId=null`；历史引入提交与运行链路代码共同证明，这是为模型路由加入的防御性隔离错误地进入了会话身份边界。
- 修复后，NextClaw session 只通过 `codex_thread_id` 绑定 Codex thread；模型、provider、thinking 与 API route 继续作为本轮执行参数传入。SDK 同时停止写入重复且误导的 `codex_thread_model`。
- 修复直接落在 thread 恢复和 metadata 写入 owner，没有新增映射表、fallback、历史重放或第二套会话链路。

## 测试/验证/验收方式

- 修前基线：Codex NARP wrapper 定向测试按新合同运行时，2 个用例失败、8 个通过；两处实际值均为 `threadId=null`，稳定复现默认模型和跨模型恢复失败。
- 修后定向测试：`@nextclaw/nextclaw-narp-runtime-codex-sdk` 1 个测试文件、10 个用例通过；`@nextclaw/nextclaw-ncp-runtime-codex-sdk` 7 个测试文件、19 个用例通过。
- 两个包的 TypeScript 检查通过；两个 package lint 均为 0 error。Codex NCP 包保留 1 条本次未触达文件中的既有 warning。
- 两个 Codex 包的生产构建通过，构建产物确认 wrapper 直接读取 `codex_thread_id`，不再读取 `codex_thread_model`。
- 隔离源码实例真实冒烟：同一 session 第一轮使用 Runtime default 记住 `NXC-CONTINUITY-20260720-5F9A`，创建 thread `019f7faa-ea5e-7e72-8eb5-d76cb8677d39`；第二轮切换到 `minimax/MiniMax-M2.7`，运行配置以相同 thread ID 恢复，并准确回复完整标记。会话日志保持 2 条 user 与 2 条 assistant 消息。
- 本次 8 个路径的 scoped `pnpm lint:new-code:governance` 与全仓 governance backlog ratchet 通过。较早的 unscoped governance 也曾完整通过；最终 unscoped 复跑被随后出现的无关并行文件 `workers/nextclaw-provider-gateway-api/src/services/remote-access.service.ts` 角色命名错误阻断，本批未触达该文件。

## 发布/部署方式

- 新增 `.changeset/keep-codex-session-thread-stable.md`，标记 `@nextclaw/nextclaw-narp-runtime-codex-sdk` 与 `@nextclaw/nextclaw-ncp-runtime-codex-sdk` patch。
- 本次未发布 NPM 包、未部署，也未重启现有 NextClaw 实例。
- 验证使用独立 home 和 `18891` 端口的源码实例；冒烟完成后已停止该实例，并把隔离验证 home 移入废纸篓。

## 用户/产品视角的验收步骤

1. 新建一个 Codex 会话，保持 Runtime default 并发送一条要求记住随机标记的消息。
2. 在同一会话中切换到任意已配置的自定义模型。
3. 要求模型复述上一轮标记，确认回答正确且会话没有变成新任务。
4. 继续来回切换模型，确认此前上下文仍然可用。

## 可维护性总结汇总

- `post-edit-maintainability-guard --non-feature` 检查 5 个 TypeScript 文件：总代码 `+18 / -51 / 净减 33`，非测试代码 `+6 / -37 / 净减 31`，0 error、2 warning。
- 两条 warning 均为历史文件接近预算线：`src/index.ts` 当前 364/400 行、app-server runtime 当前 552/600 行；本次分别净减 6 行和 8 行，没有继续恶化。
- 正向减债动作是删除模型作用域身份判断、两个 metadata 写入分支和重复 helper，共同收敛到单一 `codex_thread_id` 身份事实。没有新增文件、分支、owner 或抽象。
- `post-edit-maintainability-review` 复核无新增 finding；thread 身份 owner 更清晰，跨模型行为更少、更可预测，不是靠压缩可读性获得净减。

## NPM 包发布记录

- `@nextclaw/nextclaw-narp-runtime-codex-sdk`：npm 当前已发布 `0.2.9`；本次需要 patch，用于修复模型切换时的 Codex thread 恢复，待统一发布。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：npm 当前已发布 `0.2.8`；本次需要 patch，用于移除模型作用域 metadata 写入，待统一发布。
- Changeset：`.changeset/keep-codex-session-thread-stable.md`。
- 本次未执行 NPM 发布。
