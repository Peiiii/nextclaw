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
- 已完成已发布包安装验证：全新安装 `nextclaw@0.33.1` 后，CLI、launcher、app、更新公钥和 UI 资源齐全；公开 stable 通道从 `0.33.0` 完成 check、download、apply 和重启后版本切换，download-only 不提前切换指针。
- 已在目标 VPS `8.219.57.52` 完成真实部署验收：systemd MainPID 从 `994055` 切换为 `1002378`，`nextclaw --version`、全局 package 与 update check 的 host/current version 均为 `0.33.1`，页面显示 `v0.33.1 / 已连接`。
- VPS 本机 `/` 与 `/api/health` 均返回 `200`，`18791` 正常监听；最近 20 分钟 journal 无 crash loop、未处理异常或连续重启。
- 在升级后的实例内实际执行 agent 任务并运行 Node 命令，成功返回 `NEXTCLAW_VPS_0331_OK`，证明页面、模型、agent、工具执行与服务主链路可用。
- 真实任务运行期间两个 NextClaw Node 进程 RSS 合计约 `482.7 MiB`，systemd cgroup `MemoryCurrent` 约 `625 MiB`（包含 page cache）；这是任务运行态采样，不作为空闲基线。

## 发布/部署方式

- 已发布 `nextclaw@0.33.1` 与 `@nextclaw/service@0.3.28`，npm `latest`、stable runtime channel、GitHub Release 和 release notes 均完成。
- stable release commit 为 `b4d29b67019c5d6908b57b2a86c87ff8d0f71215`；runtime workflow `31661406009` 的四个平台构建与 channel publish 全部通过。
- 文档部署 workflow `31661954477` 首次因 Electron 下载 `socket hang up` 失败；对同一提交重跑后，构建、全球站、国内站和双站同产物验证全部通过。
- VPS 已更新全局包、将 systemd unit 迁移为稳定 `/usr/bin/nextclaw serve` 入口，写入 `NEXTCLAW_PROCESS_SUPERVISOR=systemd` 与 `Restart=always`，并完成一次受控重启。
- 旧 unit 已备份为 `/etc/systemd/system/nextclaw.service.bak-20260813-0331`；验收确认备份与当前 unit 不同且可用于人工追溯。
- `/home/admin/.nextclaw/launcher/runtime-bundles/current.json` 仍保留旧 override 指针 `0.33.0`，但当前服务直接运行全局 `0.33.1` app，公开 update check 返回 `hostVersion=currentVersion=0.33.1`、`status=up-to-date`；该旧指针未参与当前运行版本选择。

## 用户/产品视角的验收步骤

1. 在主界面左上角或设置页发现 `0.33.1` 更新。
2. 点击下载并应用更新，等待页面自动重连。
3. 确认产品版本与当前内核版本都显示 `0.33.1`，不再长期停在“等待重启生效”。
4. 刷新页面并执行一次真实任务，确认服务与 agent 主链路均可用。

## 可维护性总结汇总

本批复用既有 update host、restart coordinator 和稳定 launcher，没有新增平行更新器、service 或 manager。兼容判断只有一个 owner，显式配置优先，旧 unit 信号有日志、窄触发条件和删除条件。

自动可维护性检查无阻塞项；唯一警告是 `services/runtime` 目录已有 15 个文件、超过历史预算，本次没有新增文件。该警告触发主观复核，结论为无可维护性发现：兼容逻辑放回既有 update host 比拆出新文件更清楚，也没有用 wrapper 或无关删改隐藏复杂度。

## NPM 包发布记录

- `nextclaw`：已发布 `0.33.1`，npm `latest` 与公开 stable runtime channel 均已验证。
- `@nextclaw/service`：已发布 `0.3.28`，作为 `nextclaw@0.33.1` 发布闭包的一部分完成真实安装验证。
