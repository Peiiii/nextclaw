# v0.20.75 Extension Process Lifecycle

## 迭代完成说明

本次修复本地开发态启动后扩展进程可能变成长期孤儿的问题。表面现象是 QQ channel 启动时反复报 `QQ bot start timed out after 90000ms`；现场确认后，真正会放大问题的是历史 `nextclaw-channel-extension-qq` 孤儿进程仍在后台 reconnect，持续打 QQ gateway 并触发频率限制。

根因分为三层：

- `ManagedServiceSupervisor` 在收到 `SIGTERM` / `SIGINT` / `SIGHUP` 时直接 `process.exit`，会跳过 `ServiceGatewayManager` 的 `kernel.extensions.stop()` cleanup。
- `ExtensionLifecycleService` 启动扩展子进程时没有给子进程下发父 service PID，扩展进程无法判断自己是否已经失去宿主。
- `@nextclaw/extension-sdk` 没有统一父进程死亡 watchdog，具体 channel 即使失去父 runtime，也会继续执行自己的 reconnect 逻辑。

确认方式：

- 本机进程表显示 QQ、Feishu、Weixin 等扩展目录下存在大量 `PPID=1` 的孤儿进程，其中 QQ 孤儿进程最多。
- QQ token endpoint 能正常返回 access token，gateway endpoint 曾返回频率限制，说明 credentials 不是主因，历史 orphan reconnect 才是持续放大器。
- 代码链路确认 service signal handler 会直接退出，而扩展 SDK 没有父死亡退出策略。

修复方式：

- service signal 退出前注册 gateway shutdown hook，优先执行 `kernel.extensions.stop()`。
- kernel 启动扩展进程时写入 `NEXTCLAW_EXTENSION_PARENT_PID`。
- extension SDK 统一监听父 PID；父进程不存在时关闭 event stream 并 `process.exit(0)`。
- 不给 QQ channel 加特殊分支，避免把生命周期问题伪装修成单渠道 timeout 调参。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/extension-sdk test -- src/extension-sdk.test.ts`：通过，15 个用例。
- `pnpm --filter @nextclaw/kernel test -- src/services/extension-runtime.service.test.ts`：通过，8 个用例。
- `pnpm --filter @nextclaw/service exec vitest run src/services/runtime/service-managed-startup.service.test.ts`：通过，8 个用例。
- `pnpm --filter @nextclaw/extension-sdk tsc`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/service tsc`：通过。
- `pnpm --filter @nextclaw/extension-sdk lint`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过，剩余 3 个 warning 均为既有非本次 touched 面。
- `pnpm --filter @nextclaw/service lint`：通过，剩余 warning 均为既有非本次 touched 面。
- 功能冒烟：使用 `pnpm --filter @nextclaw/extension-sdk exec tsx` 启动真实 SDK 子进程，注入不存在的 `NEXTCLAW_EXTENSION_PARENT_PID=999999999`，结果子进程 `durationMs=1860`、`code=0`、`signal=null`。
- 父死亡冒烟：真实创建父进程与 SDK 扩展子进程，终止父进程后确认扩展子进程 `durationMs=1527` 内退出，未长期残留为 orphan。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 errors，2 warnings。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：未通过；生产代码净增 +81。本次按新增运行时生命周期能力处理，未通过压缩写法伪造纯非功能门禁。

## 发布/部署方式

本次未执行发布或部署。改动需要随下一次 NPM 发布进入运行态包。

## 用户/产品视角的验收步骤

1. 启动 NextClaw service 并启用任一 extension channel。
2. 终止 service 进程。
3. 预期新启动的 extension 子进程不会长期残留为 `PPID=1` 孤儿进程。
4. 对 QQ channel，预期不再因为历史孤儿扩展持续 reconnect 而快速堆出 gateway 频率限制。

## 可维护性总结汇总

本次遵循单一 owner 原则，把扩展生命周期修复分别落到 service signal owner、kernel extension process owner 和 SDK extension process owner，没有在 QQ channel 内部做补丁式特判。

可维护性取舍：

- 正向：父进程退出和子进程自救形成一条共享生命周期合同，后续所有 channel 扩展复用同一逻辑。
- 正向：`ServiceGatewayManager.stop()` 复用既有 cleanup，不新增平行停止路径。
- 风险：生产代码净增 +81，`--non-feature` 行数门禁未通过；原因是新增了可验证的运行时生命周期能力，而不是纯重构或措辞修复。
- 风险：`extension-sdk.test.ts` 接近文件预算，后续继续改 SDK 行为时应优先拆 fixtures/builders。

## NPM 包发布记录

需要随下一次 NPM 发布进入以下包，当前状态为已添加 `.changeset/extension-process-lifecycle.md`，待统一发布：

- `@nextclaw/extension-sdk`：父进程死亡 watchdog。
- `@nextclaw/kernel`：扩展子进程 env 注入 `NEXTCLAW_EXTENSION_PARENT_PID`。
- `@nextclaw/service`：service signal shutdown hook 与 gateway cleanup 收敛。
