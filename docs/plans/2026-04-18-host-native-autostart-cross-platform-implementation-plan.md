# Host-Native Autostart Cross-Platform Implementation Plan

日期：2026-04-18

相关文档：

- [NextClaw Host-Native Autostart Strategy Design](../designs/2026-04-18-host-native-autostart-strategy-design.md)
- [Host-Native Autostart Implementation Plan](./2026-04-18-host-native-autostart-implementation-plan.md)
- [v0.16.67-linux-cli-systemd-autostart](../logs/v0.16.67-linux-cli-systemd-autostart/README.md)

## Goal

把 npm / CLI 安装链路的宿主自启动能力从“只有 Linux `systemd` 主路径”扩成三平台用户级主路径：

- Linux `systemd`
- macOS LaunchAgent
- Windows Scheduled Task

同时保持以下契约不变：

- 不新增黑盒 `install-autostart`
- 不在安装时静默注册启动项
- `status` / `doctor` 继续保持只读
- 平台 owner 显式可见、可卸载、可诊断

## Architecture

在 `packages/nextclaw/src/cli/commands/service-support/autostart/` 下把宿主自启动收敛成一个真正的 owner 层：

1. `HostAutostartRuntimeService`
   - 统一解析稳定的 Node 路径、CLI entry 和 `NEXTCLAW_HOME`
   - 避免三平台重复实现 `tsx` / `dist` 入口解析

2. 平台 owner
   - `LinuxSystemdAutostartService`
   - `MacosLaunchAgentAutostartService`
   - `WindowsTaskAutostartService`

3. `HostAutostartService`
   - 负责按当前宿主平台路由 `status` / `doctor`
   - 保持平台专属 install/uninstall 入口显式存在

4. `HostAutostartCommandService`
   - 从 `service.ts` 中抽离 CLI 输出、scope 校验和 JSON/plain-text 合同
   - 避免 `service.ts` 继续堆积平台输出分支

## Tasks

### Task 1: Generalize the runtime contract

- 新增共享运行时解析 owner，统一 `node + cli entry + serve + NEXTCLAW_HOME` 合同
- 让 Linux、macOS、Windows 共用同一套 foreground serve 启动语义

### Task 2: Add macOS LaunchAgent owner

- 写 `~/Library/LaunchAgents/<label>.plist`
- 在 GUI login domain 可用时执行 `launchctl bootstrap / enable / kickstart`
- 通过 `launchctl print-disabled` 和 `launchctl print` 暴露 `enabled / active`

### Task 3: Add Windows Scheduled Task owner

- 生成稳定 launcher `.cmd`
- 用 PowerShell ScheduledTasks cmdlet 注册 logon task
- 通过 `Get-ScheduledTask` / `Get-ScheduledTaskInfo` 暴露 `enabled / active / lastTaskResult`

### Task 4: Wire CLI commands and docs

- 新增：
  - `nextclaw service install-launch-agent`
  - `nextclaw service uninstall-launch-agent`
  - `nextclaw service install-task`
  - `nextclaw service uninstall-task`
- 更新命令文档和 `USAGE`

### Task 5: Validate and record

- 运行三平台 owner 单测
- 运行 touched-file governance 检查
- 在当前 macOS 主机上执行命令级冒烟
- 记录到新的 `docs/logs` 迭代目录
