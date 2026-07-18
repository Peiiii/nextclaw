# v0.25.15 Claude stdio 会话快速终止

## 迭代完成说明

本次修复 Claude Code 会员会话在模型仍在思考、接口响应缓慢或上游取消迟迟不结束时，点击输入面板终止操作后短时间没有反馈的问题。终止意图现在由通用 NARP stdio runtime 直接结束本地事件流，立即发出 `message.abort`，并回收该会话的 stdio 子进程；UI 继续使用既有 `activeRun` owner，不增加 Claude 专用状态、乐观隐藏按钮或超时 fallback。

端到端排查确认既有主链路为 `输入面板 stop → /api/ncp/agent/abort → AgentRunRequestManager.abort → SessionRun.abortRun → AbortSignal → StdioRuntimeNcpAgentRuntime`。UI、HTTP route 与 kernel 都能及时接受终止意图，首个错误点位于 `StdioRuntimeRunController`：它仍在 `buffer.waitForChange()` 中等待远端 `prompt` settle；session 侧虽然向 ACP connection 发送了 cancel，但通用 stdio runtime 不发出 `message.abort`，所以前端仍从 `activeRun` 看到运行中状态。旧回归测试也只断言“不产生错误”，把缺失 `message.abort` 的错误行为固化了下来。

修复把取消完成语义收敛到 run controller：AbortSignal 会唤醒 prompt update buffer、停止等待远端 settle，并发出带原 session/message/run/correlation 身份的 `message.abort`；runtime 在 abort 分支统一 dispose 当前 session，终止未退出的 stdio child。原 session 级 AbortSignal listener 被删除，避免“connection cancel”与“run 完成事件”分散在两个 owner。测试夹具增加远端取消后 2 秒才 settle 的行为，并从 `slow-cancel-agent.mjs` 规范化为 `slow-cancel-agent.utils.mjs`，未保留重复实现。

## 测试/验证/验收方式

- 修复前确定性复现：慢取消 fixture 让 cancel 调用等待 2 秒才允许 prompt settle；定向测试失败，实测终止耗时约 `2010ms`，且事件序列缺少 `message.abort`，证明不是按钮点击、HTTP route 或 kernel 未接收终止。
- 修复后定向回归：`pnpm -C packages/nextclaw-ncp-runtime-stdio-client exec vitest run src/stdio-runtime-abort.test.ts --reporter=verbose` 通过，1 个测试 / 1 个文件，覆盖远端取消迟迟不 settle 时本地终止小于 `500ms`，并断言只出现 `message.abort`、不出现 `message.failed` 或 `run.error`。
- 包级测试：`pnpm -C packages/nextclaw-ncp-runtime-stdio-client test` 通过，2 个测试文件 / 18 个测试。
- 类型与静态检查：`pnpm -C packages/nextclaw-ncp-runtime-stdio-client tsc`、`pnpm -C packages/nextclaw-ncp-runtime-stdio-client lint` 均通过。
- 当前源码真实链路：使用 `pnpm local:source-runtime` 构建并在隔离的 clone-config home 上启动 `0.25.3` 源码实例，确认 Claude session type ready；真实 Claude 会话在 `run.started` 后调用与输入面板相同的 abort API，`26ms` 收到 `message.abort`，事件中没有 `message.failed` 或 `run.error`。
- UI 状态 owner：`pnpm --filter @nextclaw/ui exec vitest run src/features/chat/features/ncp/hooks/__tests__/use-ncp-agent-runtime.test.tsx --reporter=verbose` 通过，1 个文件 / 4 个测试；其中 `message.abort` 用例确认 `isRunning` 变为 `false`、`activeRunId` 清空，对应输入面板终止按钮退出运行态。
- 同会话恢复：在上述已终止 session 上运行 `pnpm smoke:ncp-chat -- --session-type claude ...`，成功返回精确文本 `ABORT_RECOVERY_OK` 和 `run.finished`，证明子进程回收没有让会话失效。
- 隔离实例已在验收后停止；本次没有重启或改动用户正在运行的 NextClaw 实例。源码构建产生的 `packages/nextclaw/ui-dist` 漂移已用 `pnpm clean:generated` 清理，`pnpm check:generated-clean` 通过。
- 治理验证：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 通过；maintainability guard 为 0 error，保留既有大文件预算 warning，详见可维护性章节。

## 发布/部署方式

本次仅执行本地 Git commit；未执行 push、NPM publish、runtime update、Desktop 打包或 GitHub release。数据库 migration、远程部署与 NextClaw 宿主重启不适用；修复等待后续统一 NPM / runtime 发布携带。

## 用户/产品视角的验收步骤

1. 新建或打开 Claude Code 会员类型的会话，发送一条会触发较长思考或慢接口调用的消息。
2. 在回复仍处于运行中时点击输入面板的终止操作，确认终止按钮快速消失，界面不再持续显示运行中，也不出现失败提示。
3. 在同一个会话继续发送新消息，确认能够正常得到回复，不需要新建会话或重启 NextClaw。

## 可维护性总结汇总

maintainability guard 的最终代码范围统计为 `+128/-123`、净增 5 行；按 guard 的非测试口径为 `+118/-119`、净减 1 行。大部分增删来自把既有 84 行 fixture 规范化改名；真正的生产 owner `stdio-runtime.service.ts` 为 `+32/-35`、净减 3 行，测试净增长用于新增终止时延与事件合同。没有新增 Claude 专用分支、额外 UI 状态、超时 fallback、adapter 或 wrapper。正向减债包括删除 session 级平行 abort listener，把“停止等待、发终止事件、回收 child”收敛到 run/runtime 两级现有 owner，并将触达的测试夹具改为合规角色后缀与箭头实例方法。

`stdio-runtime.service.ts` 从 852 行降至 849 行，仍超过 600 行预算，因此 maintainability guard 保留 warning；本次没有继续膨胀该红区，且改动集中在既有 run controller / runtime seam。`stdio-runtime.test.ts` 为 855 行，接近 900 行预算，但本次只更新 fixture 路径；新的终止合同继续放在独立的 `stdio-runtime-abort.test.ts`，避免向该大测试文件追加场景。后续若继续扩展 stdio orchestration，应优先按 session 生命周期、prompt update bridging 与 run event state transition 拆分，而不是在本次紧急修复中引入无验证收益的大范围重构。

## 红区触达与减债记录

### packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts

- 本次是否减债：是。
- 说明：文件从 852 行降至 849 行；删除 session 级平行 AbortSignal listener，把 prompt 等待中止、`message.abort` 事件和 session dispose 收敛到既有 run/runtime owner，没有新增 Claude 专用分支或兼容路径。
- 下一步拆分缝：后续触达时优先拆分 session 生命周期、prompt update bridging 与 run event state transition；本次不为单点修复引入大范围结构迁移。

## NPM 包发布记录

- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：已添加 patch changeset `.changeset/prompt-abort-fast.md`，尚未发布。
- 直接依赖包由 Changesets 的 `updateInternalDependencies: patch` 合同在统一发布时评估；本次不单独改版本号。
