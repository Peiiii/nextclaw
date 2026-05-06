# Goal Progress

## 当前目标

修复并验证“`nextclaw restart` 会把我们自己的前台 `serve` 误判成 healthy unmanaged instance”。

## 明确非目标

- 不改 runtime update 的 `check / download / apply` 语义。
- 不把公网 `sha256 mismatch` 发布物问题混进这次 restart 根因修复。
- 不为了解一个重启判定问题新增环境探测 fallback。

## 冻结边界 / 不变量

- `restart` 的 owner 仍是 `RestartCommands`。
- 只有确认目标端口就是 NextClaw 自己的前台 runtime 时，才允许 stop + restart。
- 真正的外部健康 listener 仍必须拒绝重启。

## 已完成进展

- 已现场确认占用端口的不是外部服务，而是 `node ... nextclaw ... serve` 前台实例。
- 已命中根因：`RestartCommands` 只认 `managedServiceStateStore`，完全忽略 `localUiRuntimeStore`。
- 已修复：当目标端口命中仍存活的本地前台 runtime 时，`restart` 会先停止该 PID，再拉起受管后台 service。
- 已补定向测试并通过。
- 已完成真实前台重启 smoke：隔离 `NEXTCLAW_HOME` 下先起 `serve`，再执行 `restart`，最终健康检查恢复为 `200`。

## 当前下一步

提交本次修复，并明确 beta 统一发布入口。

## 锚点计数器

19/20
