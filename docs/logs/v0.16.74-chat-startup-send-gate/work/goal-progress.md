当前目标
- 让 `pnpm dev start` 后主前端和 `/api/auth/status` 尽快可用，并继续用统一口径量化启动瀑布流。

明确非目标
- 不把插件/渠道发现重新放回主启动链路。
- 不为了后台插件优化牺牲主前端可用性。

冻结边界 / 不变量
- 先有基线，再谈优化。
- 指标必须可重复、可多轮跑、可比较。
- 用户真实问题默认用 `pnpm dev start + /Users/peiwang/.nextclaw + frontend-auth-status` 复测。

已完成进展
- 已撤回上一轮未经量化支撑的前端启动改动。
- 已确认可复用的观测点有 `/api/auth/status`、`/api/health`、`/api/runtime/bootstrap-status`、`NEXTCLAW_STARTUP_TRACE=1`。
- 已新增可重复冷启动基线脚本 `pnpm smoke:startup-readiness`。
- 已完成第一刀：`bootstrap ready` 改为 core app 可用口径，不再等待插件水合。
- 已跑出最新真实基线：`auth/status`、`health`、`ncpAgent.ready`、`bootstrap ready` 均约 `1.6s~2.4s`，后台 `pluginHydrationReady/channelsReady` 约 `25.1s`。
- 已纠正用户真实链路口径：`pnpm dev start` + 默认 `~/.nextclaw` 下，frontend server 约 `4.8s` ready，`/api/auth/status` 约 `32.9s` 才 OK，红色窗口约 `28.0s`。
- 已完成第二刀：UI 启动场景下插件/渠道改为 core ready 后延迟激活；复测 `frontendAuthStatusOkMs=2475ms`、失败次数 `0`、后台 `pluginHydrationReadyMs=23646ms`。
- 已补充 smoke 脚本瀑布流输出，后续能直接看到 observed milestones 与 startup trace spans。

当前下一步
- 继续优化后台插件激活耗时，重点看 `hydrate_capabilities`、按需 activation event、并行/隔离加载；同时防止 status 红色窗口回归。

锚点计数器
- 5/20
