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
- kernel 启动扩展前清理历史遗留的 NextClaw channel extension 孤儿进程，避免旧版本残留污染新实例。
- QQ channel 创建 websocket 前预检 `session_start_limit`；quota 为 0 时直接输出 reset 时间，不再继续创建 websocket session。
- QQ channel 监听 ready 前的 `receiver.close`、`receiver.error`、`session.error` 和 `session DISCONNECT`，把 QQ gateway 的 close code/reason 直接暴露出来，不再只显示 90 秒 timeout。

纠偏说明：

- 初次验收只验证了新 SDK watchdog 和父进程死亡退出，没有验证干净单实例下 QQ 能否 ready，也没有按 cwd 维度检查历史孤儿；这导致“充分验证”的判断过早。
- 追加验证中，按命令行匹配漏掉了大量 `node dist/main.js` 旧孤儿；改为 cwd 维度后确认存在 68 个 Feishu、36 个 Weixin、3 个 QQ 的源码扩展孤儿，以及全局安装版 channel extension 孤儿。
- 清理这些孤儿后，用裸 `qq-official-bot` 复现确认：QQ gateway 能连上并返回 `HELLO`，但 `IDENTIFY` 后返回 `op=9 INVALID_SESSION`，随后 close `4903 create session error`。进一步查询 gateway 返回 `session_start_limit.remaining=0`、`reset_after≈3515927ms`。因此 QQ timeout 的直接原因是历史孤儿打空 session start quota，同时 SDK 不 reject ready 前的 close/error，外层缺少早失败诊断。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/extension-sdk test -- src/extension-sdk.test.ts`：通过，15 个用例。
- `pnpm --filter @nextclaw/kernel test -- src/services/extension-runtime.service.test.ts`：通过，9 个用例。
- `pnpm --filter @nextclaw/service exec vitest run src/services/runtime/service-managed-startup.service.test.ts`：通过，8 个用例。
- `pnpm --filter @nextclaw/channel-extension-qq test -- src/tests/qq-channel.service.test.ts`：通过，9 个用例；追加 QQ quota 预检和 ready 前 close/error 诊断用例。
- `pnpm --filter @nextclaw/extension-sdk tsc`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/service tsc`：通过。
- `pnpm --filter @nextclaw/channel-extension-qq tsc`：追加 QQ channel 类型验证。
- `pnpm --filter @nextclaw/extension-sdk lint`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过，剩余 3 个 warning 均为既有非本次 touched 面。
- `pnpm --filter @nextclaw/service lint`：通过，剩余 warning 均为既有非本次 touched 面。
- 历史孤儿清理冒烟：停止所有 NextClaw runtime 后，按 cwd 精确清理 `PPID=1` 的 channel extension 进程，复查 `REMAINING_CHANNEL_EXTENSION_ORPHANS=0`。
- QQ 裸 SDK 探针：不打印密钥，确认 access token 可获取、websocket 收到 `HELLO`，`IDENTIFY` 后收到 `op=9 INVALID_SESSION`，close code `4903`、reason `create session error`。
- 真实 dev 冒烟：最终 dist 构建后执行 `pnpm dev start --package-watch`，QQ 在数秒内输出 `QQ gateway session start limit exhausted; reset_after_ms=3105274, total=1500, max_concurrency=1`，不再等待 90 秒 timeout；停止 dev 后复查 `REMAINING_CHANNEL_EXTENSION_PROCESSES=0` 且相关端口清空。
- 功能冒烟：使用 `pnpm --filter @nextclaw/extension-sdk exec tsx` 启动真实 SDK 子进程，注入不存在的 `NEXTCLAW_EXTENSION_PARENT_PID=999999999`，结果子进程 `durationMs=1860`、`code=0`、`signal=null`。
- 父死亡冒烟：真实创建父进程与 SDK 扩展子进程，终止父进程后确认扩展子进程 `durationMs=1527` 内退出，未长期残留为 orphan。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 errors，1 warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：未通过；非测试代码净增 +277。本次按新增运行时生命周期能力和 QQ gateway quota 防护处理，未通过压缩写法伪造纯非功能门禁。

## 发布/部署方式

本次未执行发布或部署。改动需要随下一次 NPM 发布进入运行态包。

## 用户/产品视角的验收步骤

1. 启动 NextClaw service 并启用任一 extension channel。
2. 终止 service 进程。
3. 预期新启动的 extension 子进程不会长期残留为 `PPID=1` 孤儿进程。
4. 对 QQ channel，预期不再因为历史孤儿扩展持续 reconnect 而快速堆出 gateway 频率限制。

## 可维护性总结汇总

本次遵循单一 owner 原则，把扩展生命周期修复分别落到 service signal owner、kernel extension process owner 和 SDK extension process owner；QQ channel 只处理 QQ gateway quota 与 SDK ready 前错误诊断。

可维护性取舍：

- 正向：父进程退出和子进程自救形成一条共享生命周期合同，后续所有 channel 扩展复用同一逻辑。
- 正向：`ServiceGatewayManager.stop()` 复用既有 cleanup，不新增平行停止路径。
- 正向：QQ gateway quota 预检抽到 `QQGatewayStartupProbeService`，`QQChannel` 保持在文件预算内。
- 风险：`QQChannel` 当前 566 行，接近 600 行文件预算；后续继续扩展 QQ 行为时应优先继续拆出 IO/状态协作 owner。
- 风险：生产代码净增较多，`--non-feature` 行数门禁未通过；原因是新增了可验证的运行时生命周期能力和 QQ gateway quota 防护，而不是纯重构或措辞修复。
- 风险：`extension-sdk.test.ts` 接近文件预算，后续继续改 SDK 行为时应优先拆 fixtures/builders。

## NPM 包发布记录

需要随下一次 NPM 发布进入以下包，当前状态为已添加 `.changeset/extension-process-lifecycle.md`，待统一发布：

- `@nextclaw/extension-sdk`：父进程死亡 watchdog。
- `@nextclaw/kernel`：扩展子进程 env 注入 `NEXTCLAW_EXTENSION_PARENT_PID`。
- `@nextclaw/service`：service signal shutdown hook 与 gateway cleanup 收敛。
- `@nextclaw/channel-extension-qq`：QQ gateway quota 预检与 ready 前 websocket/session 错误显式诊断。
