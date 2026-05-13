# v0.18.35 Runtime Bootstrap Remote Sync

## 迭代完成说明

- 根因：本地 service 的 remote connector 已经把运行态写入 remote status store，但 bootstrap status 只在启动时把 `remote.enabled` 初始化为 `pending`，后续没有订阅 remote runtime state，因此 `/api/runtime/bootstrap-status` 会长期返回 `remote.state: "pending"`，与 `/api/remote/status` 的 `runtime.state: "connected"` 不一致。
- 确认方式：本机 `http://127.0.0.1:55667/api/runtime/bootstrap-status` 返回 `phase: "ready"` 且 `remote.state: "pending"`，同时 `/api/remote/status` 返回 `runtime.state: "connected"`。
- 修复：remote status store 写入时通知 gateway，`ServiceBootstrapStatusStore` 将 remote runtime state 映射到 bootstrap remote state；同时按治理要求把 classless remote support/runtime 模块迁入 `utils/`，把 bootstrap status store 改成 `.service.ts`。
- 验证修正：用户补充真实命令 `pnpm dev start` 后复现出 dev 后端解析 workspace 源码包私有 alias 失败。最终修复不是在 dev runner 里堆 `@/` 特例，而是把会被复用/同进程加载的后端 package 迁到包级唯一 alias，例如 `@nextclaw-server/*`、`@nextclaw-cli/*`、`@claude-code-sdk/*`、`@narp-stdio-wrapper/*`，并让 dev runtime tsconfig 只聚合这些不冲突的包级 alias。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service test -- src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts src/shared/services/runtime/utils/service-remote-runtime.utils.test.ts src/commands/remote/utils/remote-runtime-support.utils.test.ts`
- 其中 `service-bootstrap-status.service.test.ts` 包含路由级验收：通过 `createUiRouter` 请求 `/api/runtime/bootstrap-status`，确认 remote runtime 写入 `connected` 后 API 返回 `remote.state: "ready"`。
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm dev start`：后端和 Vite 均启动成功；在旧全局服务占用 remote ownership 时，`http://127.0.0.1:18792/api/remote/status` 返回 `runtime.state: "error"`，`/api/runtime/bootstrap-status` 同步返回 `remote.state: "conflict"`。

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
- Alias 减债动作：可复用后端 package 不再占用泛用 `@/`，避免多个 workspace 源码包被同一 Node 进程加载时互相抢占 alias owner。
- 剩余债务：`service-managed-startup.service.ts` 仍超过文件预算，但本次只更新导入路径，未继续增大。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：否。
- 说明：本次只把 `@/` 导入迁移为 `@nextclaw-server/*`，属于运行链路 alias owner 收敛；没有拆分该热点文件内部职责，也没有增加其行数。
- 下一步拆分缝：按 provider/config view/default value 三个方向拆分配置构建与默认值归一化，优先把纯 view projection 和 provider auth 派生逻辑移出 store。

## NPM 包发布记录

- 不涉及 NPM 包发布。
