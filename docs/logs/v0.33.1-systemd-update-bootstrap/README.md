# v0.33.1 systemd 更新自举修复

## 迭代完成说明

本批修复 Linux VPS 从旧版 NextClaw 在页面内应用 runtime 更新后，服务停在旧版本并显示“等待重启生效”的问题。

根因是 `0.33.0` 只修正了新生成的 systemd unit，但 `0.32.0 -> 0.33.0` 的更新动作仍由旧进程和旧 unit 执行。旧 unit 使用 `Restart=on-failure` 且没有 `NEXTCLAW_PROCESS_SUPERVISOR=systemd`；应用更新后进程以 `0` 正常退出，systemd 因而把服务视为成功结束，不再拉起稳定 launcher。VPS 上的 unit、journal、运行指针与页面版本共同确认了这条链路，所以修复针对的是旧 unit 的重启合同，而不是只刷新版本展示。

修复让 runtime 在缺少显式 supervisor 标记、但存在 systemd `INVOCATION_ID` 时识别旧 unit，并在应用更新后以专用退出码 `75` 结束。稳定 launcher 原样传递退出码，旧 `Restart=on-failure` 和新 `Restart=always` 都能重新拉起；supervisor 路径不再启动同 cgroup 内的自拉起 helper。显式非 systemd supervisor 仍优先，普通终端 `serve` 的手动重启语义不变。

## 测试/验证/验收方式

- `@nextclaw/service` 定向测试 16 项通过，覆盖 systemd 显式标记、旧 unit 的 `INVOCATION_ID`、显式非 systemd 优先、退出码 `75` 与不启动 helper。
- `@nextclaw/service` 全量 49 个测试文件、184 项测试通过。
- `@nextclaw/service` TypeScript 编译与触达文件定向 ESLint 通过，`git diff --check` 通过。
- 使用已发布且 SHA-256 校验通过的 `0.33.0` 官方 runtime 包作为依赖底座，生成当前源码的本地签名更新通道。
- 隔离实例从 `0.33.0-dev.0` 完成下载、验签、apply 和自动重连；PID 从 `42764` 切换为 `43627`，运行版本变为 `0.33.0`，current pointer 更新，18 个内置 skill 可读取。
- 发布后还需在目标 VPS 上验证真实 systemd PID 切换、版本一致、公网入口和一次真实任务。

## 发布/部署方式

- 计划以 `nextclaw@0.33.1` stable patch 发布 NPM package、runtime update channel、GitHub Release 与 release notes。
- 发布后在 `8.219.57.52` 更新并迁移 systemd unit，启动服务并验证公网访问。

## 用户/产品视角的验收步骤

1. 在主界面左上角或设置页发现 `0.33.1` 更新。
2. 点击下载并应用更新，等待页面自动重连。
3. 确认产品版本与当前内核版本都显示 `0.33.1`，不再长期停在“等待重启生效”。
4. 刷新页面并执行一次真实任务，确认服务与 agent 主链路均可用。

## 可维护性总结汇总

本批复用既有 update host、restart coordinator 和稳定 launcher，没有新增平行更新器、service 或 manager。兼容判断只有一个 owner，显式配置优先，旧 unit 信号有日志、窄触发条件和删除条件。

自动可维护性检查无阻塞项；唯一警告是 `services/runtime` 目录已有 15 个文件、超过历史预算，本次没有新增文件。该警告触发主观复核，结论为无可维护性发现：兼容逻辑放回既有 update host 比拆出新文件更清楚，也没有用 wrapper 或无关删改隐藏复杂度。

## NPM 包发布记录

- `nextclaw`：需要 patch，计划发布 `0.33.1`，当前状态为 `待统一发布`。
- `@nextclaw/service`：需要 patch，当前版本 `0.3.27`，目标版本由 Changesets 发布闭包确定，当前状态为 `待统一发布`。
