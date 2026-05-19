# v0.18.83 runtime self-relaunch CLI entry

## 迭代完成说明

本次修复 runtime update / runtime control 触发内部 self-restart 后服务不再自动恢复的问题。

根因：`NextclawServiceRuntime.armManagedServiceRelaunch()` 旧逻辑自己用 `import.meta.url` 推导 `./index.js`，在 packaged runtime 中会落到 `@nextclaw/service/dist/index.js`。该文件只是 service package 的库导出入口，不是 NextClaw CLI 入口，因此 helper 执行 `node @nextclaw/service/dist/index.js start --ui-port ...` 后不会真正启动服务。

确认方式：在临时 `NEXTCLAW_HOME` 和临时端口下复现，旧版本日志停在 `Gateway self-restart armed` / `Restart scheduled` / 旧进程 `code=0` 退出，90 秒内没有新 PID，也没有新的 `runtime.process.ready`。

修复方式：self-relaunch 不再猜 package index，也不保留 `NEXTCLAW_SELF_RELAUNCH_CLI` 隐藏救援入口；改为复用现有 `resolveCliSubcommandLaunch()`，从当前 CLI 进程入口 `process.argv[1]` 生成 `start --ui-port <port>` 的真实启动命令。这样 dev/tsx 和 packaged dist 都走同一个 CLI launch contract。

2026-05-19 追加落地：确认用户真实运行的 `~/.nextclaw/launcher/runtime-bundles/versions/0.19.10/runtime` 仍是旧发布产物，内部 `restart-service` 在真实 `~/.nextclaw` 下复现为旧 PID 退出、`55667` 无新服务接管、`restart-sentinel.json` 残留。已将仓库构建出的修复版 `@nextclaw/service/dist/service-runtime.service.js` 替换进该本地 runtime bundle；临时备份文件在复验通过后已删除，避免运行目录残留临时产物。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service test -- --run src/shared/services/restart/service-runtime-self-relaunch.service.test.ts src/shared/services/ui/tests/npm-runtime-update-host.service.test.ts src/commands/service/gateway-manual-restart-contract.controller.test.ts src/shared/services/ui/tests/runtime-control-host.service.test.ts src/commands/remote/services/remote-access-host.service.test.ts`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm -C packages/nextclaw-service build`
- `pnpm -C packages/nextclaw build`
- 临时 home/临时端口真实 smoke：用 `packages/nextclaw/dist/cli/app/index.js` 启动服务，调用 `POST /api/runtime/control/restart-service`，确认旧 PID 退出后新 PID 出现且 `/api/health` 恢复。
- 真实本机配置 smoke：`deepseek/deepseek-v4-flash` 普通 NCP 冒烟通过，返回 `OK`。
- 真实本机 runtime control 复验：在 `~/.nextclaw`、端口 `55667` 下替换本地 runtime bundle 后，先手动 restart 让修复代码加载，再调用 `POST /api/runtime/control/restart-service`；旧 PID `65654` 退出，新 PID `71609` 自动接管，`/api/health` 恢复，restart sentinel 被消费，目标会话出现 assistant 确认回复。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-service/src/service-runtime.service.ts packages/nextclaw-service/src/shared/services/restart/service-runtime-self-relaunch.service.test.ts`
- `pnpm lint:new-code:governance -- packages/nextclaw-service/src/service-runtime.service.ts packages/nextclaw-service/src/shared/services/restart/service-runtime-self-relaunch.service.test.ts docs/logs/v0.18.83-runtime-self-relaunch-cli-entry/README.md`
- `pnpm check:governance-backlog-ratchet`

说明：全量 `pnpm lint:new-code:governance` 被并行/既有微信扩展改动拦截，失败文件不属于本次 self-relaunch 修复范围；本次触达文件的定向 governance 已通过。

## 发布/部署方式

本次尚未发布到 NPM/runtime update channel。修复涉及 runtime update / managed service restart 链路，后续仍需要随下一次 NPM/runtime bundle 发布进入其他用户环境。

本机已完成热修复部署：替换 `~/.nextclaw/launcher/runtime-bundles/versions/0.19.10/runtime/node_modules/@nextclaw/service/dist/service-runtime.service.js`。旧文件的临时备份仅用于落地校验，复验通过后已删除。

## 用户/产品视角的验收步骤

1. 启动 NextClaw managed service。
2. 触发 runtime update apply 或 runtime control restart。
3. 页面可短暂断开，但服务应自动重新拉起。
4. 日志中应出现旧进程退出后的新一轮 `start requested`、新 PID、`runtime.process.ready`。
5. 刷新 UI 后应恢复，而不是停留在服务不可用状态。

## 可维护性总结汇总

已使用 `post-edit-maintainability-review` 口径复核。生产代码净减 3 行；本次正向减债动作是删除隐藏环境变量救援入口、复用既有 CLI launch resolver、合并 helper 中重复退出判断。代码没有新增平行 restart 路径，也没有用“更新后再补一层 restart”掩盖根因。

## NPM 包发布记录

待统一发布。涉及包：`@nextclaw/service` 与承载 CLI/runtime bundle 的 `nextclaw`。当前未执行 NPM 发布；本次仅完成源码修复、本地 runtime bundle 热修复与真实链路验收。
