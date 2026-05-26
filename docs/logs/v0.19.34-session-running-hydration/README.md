# v0.19.34-session-running-hydration

## 迭代完成说明

本次修复刷新前端后运行中 Agent 右下角终止按钮丢失的问题。

根因：刷新后的 session seed 走 `/api/ncp/sessions/:sessionId/messages`，该接口此前读取 `NcpSessionManager.getSession().status`。`NcpSessionManager` 的 running 状态来自 legacy `sessionRunStatus` 事件投影，而当前 agent run 主链路是 branch，branch 的运行态保存在 `SessionRun.activeRunId`，不会更新该 legacy 投影。因此刷新后接口返回 `idle`，前端无法恢复可终止状态。

确认方式：沿 UI router、kernel ingress、`KernelBranch`、branch `SessionRunManager`、NCP runtime event apply 顺序排查，确认 branch runtime 会维护 `SessionRun.activeRunId`，但刷新 seed 没有读取这个 owner。

修复方式：将 session 运行态查询落到 branch `SessionRepository.isSessionRunning`，由 branch `SessionRunManager` 提供运行态来源，kernel 对 router 暴露 `isSessionRunning`。session routes 在返回 list/get/messages/patch session summary 时，用 kernel 运行态覆盖持久 summary 的运行中状态。同时删除 `NcpSessionManager.runningSessionIds` 旧投影，让 `NcpSessionManager` 回到持久 session 管理职责。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`：通过。
- `pnpm -C packages/nextclaw-server tsc`：通过。
- `pnpm -C packages/nextclaw-server exec vitest run src/app/router.ncp-agent.test.ts src/app/router-provider-probe.test.ts`：通过，2 个测试文件、15 个测试通过。
- `pnpm -C packages/nextclaw-kernel lint`：通过。
- `pnpm -C packages/nextclaw-server lint`：通过，0 error，保留既有 warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 error。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

本次为 kernel/server 内部状态读取链路修复，不涉及数据库 migration、远程服务部署、桌面安装包或 runtime update manifest。

## 用户/产品视角的验收步骤

1. 发起一个 branch 链路 Agent run，保持运行中。
2. 刷新前端并重新进入同一个 session。
3. session messages seed 返回 `status: "running"`，前端恢复运行中状态，右下角终止按钮保持可点击。
4. 点击终止按钮后仍走既有 abort ingress。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 和代码复核口径检查。本次非功能修复遵守 owner 收敛原则：运行态由 branch `SessionRun`/`SessionRunManager` 计算，`SessionRepository` 作为 session 查询边界对外提供 `isSessionRunning`，server routes 只做水合，不承载运行态判断。

可维护性结果：总计新增 591 行、删除 569 行、净增 22 行；非测试代码新增 564 行、删除 568 行、净减 4 行。正向减债动作为删除 `NcpSessionManager.runningSessionIds` 及其 legacy status 订阅，减少旧链路状态 owner。

剩余 warning：`packages/nextclaw-server/src/app` 目录仍超过文件数预算；`router.ncp-agent.test.ts` 接近文件预算但未越过 hard guard。本次未新增 app 目录文件。

## NPM 包发布记录

不涉及 NPM 包发布。
