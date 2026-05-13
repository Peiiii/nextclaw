# v0.18.35 Runtime Bootstrap Remote Sync

## 迭代完成说明

- 根因：本地 service 的 remote connector 已经把运行态写入 remote status store，但 bootstrap status 只在启动时把 `remote.enabled` 初始化为 `pending`，后续没有订阅 remote runtime state，因此 `/api/runtime/bootstrap-status` 会长期返回 `remote.state: "pending"`，与 `/api/remote/status` 的 `runtime.state: "connected"` 不一致。
- 确认方式：本机 `http://127.0.0.1:55667/api/runtime/bootstrap-status` 返回 `phase: "ready"` 且 `remote.state: "pending"`，同时 `/api/remote/status` 返回 `runtime.state: "connected"`。
- 修复：remote status store 写入时通知 gateway，`ServiceBootstrapStatusStore` 将 remote runtime state 映射到 bootstrap remote state；同时按治理要求把 classless remote support/runtime 模块迁入 `utils/`，把 bootstrap status store 改成 `.service.ts`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service test -- src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts src/shared/services/runtime/utils/service-remote-runtime.utils.test.ts src/commands/remote/utils/remote-runtime-support.utils.test.ts`
- 其中 `service-bootstrap-status.service.test.ts` 包含路由级验收：通过 `createUiRouter` 请求 `/api/runtime/bootstrap-status`，确认 remote runtime 写入 `connected` 后 API 返回 `remote.state: "ready"`。
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`

## 发布/部署方式

- 未执行发布、部署或 NPM 发版。
- 当前 `http://127.0.0.1:55667` 进程来自全局安装的 `nextclaw/dist/cli/app/index.js`，不是当前 worktree 源码；需要后续构建/发布/重新安装后，已安装版本才能体现本次修复。

## 用户/产品视角的验收步骤

1. 启动修复后的本地 NextClaw service。
2. 打开 `http://127.0.0.1:<uiPort>/api/remote/status`，确认 remote runtime 为 `connected`。
3. 打开 `http://127.0.0.1:<uiPort>/api/runtime/bootstrap-status`，确认 `remote.state` 同步为 `ready`，不再长期停留在 `pending`。
4. 打开 UI，确认左侧系统连接状态不再因 bootstrap/remote 自感知不一致而误导用户。

## 可维护性总结汇总

- 本次使用 `post-edit-maintainability-review` 进行复核。
- 非测试代码净增为 `0`：新增 remote 状态同步路径，同时删除 bootstrap 初始化中的重复 pending/ready 入口，并完成角色命名治理。
- 正向减债动作：职责收敛 + 命名治理。remote runtime 状态仍由 remote connector 产生，bootstrap store 只负责映射 bootstrap 视图；classless 模块迁入 `utils/`，避免伪 service。
- 剩余债务：`service-managed-startup.service.ts` 仍超过文件预算，但本次只更新导入路径，未继续增大。

## NPM 包发布记录

- 不涉及 NPM 包发布。
