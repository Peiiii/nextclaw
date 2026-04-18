# v0.16.69-cli-host-autostart-cross-platform

## 迭代完成说明

- 本次把 npm / CLI 安装链路的宿主自启动能力从“只有 Linux `systemd`”扩成了三平台用户级主路径：
  - Linux：`systemd --user` / `systemd --system`
  - macOS：LaunchAgent
  - Windows：Scheduled Task
- 本次不是对 [v0.16.67-linux-cli-systemd-autostart](../v0.16.67-linux-cli-systemd-autostart/README.md) 的小修，而是明确扩大了交付目标，所以按规则新开迭代。
- 相关文档：
  - [NextClaw Host-Native Autostart Strategy Design](../../designs/2026-04-18-host-native-autostart-strategy-design.md)
  - [Host-Native Autostart Implementation Plan](../../plans/2026-04-18-host-native-autostart-implementation-plan.md)
  - [Host-Native Autostart Cross-Platform Implementation Plan](../../plans/2026-04-18-host-native-autostart-cross-platform-implementation-plan.md)
- 本次新增并接通的 CLI 命令：
  - `nextclaw service install-launch-agent`
  - `nextclaw service uninstall-launch-agent`
  - `nextclaw service install-task`
  - `nextclaw service uninstall-task`
  - 既有 `nextclaw service autostart status`
  - 既有 `nextclaw service autostart doctor`
- 结构上不再让 Linux 一家独占全部宿主逻辑，而是收敛成：
  - 共享运行时解析 owner：
    - [host-autostart-runtime.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart-runtime.service.ts)
  - 平台 owner：
    - [linux-systemd-autostart.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/linux-systemd-autostart.service.ts)
    - [macos-launch-agent-autostart.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/macos-launch-agent-autostart.service.ts)
    - [windows-task-autostart.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/windows-task-autostart.service.ts)
  - 命令输出 owner：
    - [host-autostart-command.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart-command.service.ts)
- 本次也顺手收了一笔结构债：
  - 自启动命令注册从 [index.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/index.ts) 中拆到 [service-command-registration.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/service-command-registration.service.ts)，避免 CLI 根入口继续线性膨胀。
- 行为边界保持不变：
  - 不新增黑盒 `install-autostart`
  - `npm i -g nextclaw` 不会静默注册启动项
  - `status` / `doctor` 继续保持只读
  - 不把 macOS LaunchDaemon 或 Windows Service 混进本轮

## 测试/验证/验收方式

- 已通过：`pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-support/autostart/tests/linux-systemd-autostart.service.test.ts src/cli/commands/service-support/autostart/tests/macos-launch-agent-autostart.service.test.ts src/cli/commands/service-support/autostart/tests/windows-task-autostart.service.test.ts`
  - 覆盖：Linux unit 生成与失败路径、macOS LaunchAgent plist/状态、Windows Scheduled Task 注册脚本与状态 JSON 合同。
- 已通过：`pnpm lint:new-code:governance -- packages/nextclaw/src/cli/index.ts packages/nextclaw/src/cli/service-command-registration.service.ts packages/nextclaw/src/cli/types.ts packages/nextclaw/src/cli/commands/service.ts packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.types.ts packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.service.ts packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart-runtime.service.ts packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart-command.service.ts packages/nextclaw/src/cli/commands/service-support/autostart/linux-systemd-autostart.service.ts packages/nextclaw/src/cli/commands/service-support/autostart/macos-launch-agent-autostart.service.ts packages/nextclaw/src/cli/commands/service-support/autostart/windows-task-autostart.service.ts packages/nextclaw/src/cli/commands/service-support/autostart/tests/linux-systemd-autostart.service.test.ts packages/nextclaw/src/cli/commands/service-support/autostart/tests/macos-launch-agent-autostart.service.test.ts packages/nextclaw/src/cli/commands/service-support/autostart/tests/windows-task-autostart.service.test.ts`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已通过：`node packages/nextclaw/scripts/sync-usage-resource.mjs`
- 已通过：当前 macOS 主机上的命令级冒烟
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts service autostart status --json`
    - 观察点：当前宿主稳定识别为 `launchd-launch-agent`，返回 `supported: true`、`scope: "user"`、`installed: false`。
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts service install-launch-agent --dry-run --json`
    - 观察点：稳定返回 `ok: true`，包含 LaunchAgent plist 路径、命令、日志提示和 `bootstrap / enable / kickstart` 动作列表。
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts service autostart doctor --json`
    - 观察点：在未安装 LaunchAgent 的当前主机上返回 `plist-file: warn`，同时 `platform/gui-domain/exec-path/home-dir` 正常通过。
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts service install-task --dry-run --json`
    - 观察点：在非 Windows 宿主上稳定返回 `ok: false` 与 `reasonIfUnavailable: "windows task autostart currently supports Windows only."`，不尝试执行计划任务写入。
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts service install-systemd --user --dry-run --json`
    - 观察点：在非 Linux 宿主上稳定返回 `systemd autostart currently supports Linux only.`，不误写 systemd。
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：本次自启动链路新增的治理阻断已清掉，但整仓 guard 仍因当前工作区其他既有改动失败。
  - 当前 guard 剩余 error 不在本次自启动链路，而在：
    - `packages/nextclaw-core/src/agent`
    - `packages/nextclaw-server/src/ui/config.ts`
    - `packages/nextclaw-server/src/ui/types.ts`
- 已执行：`pnpm -C packages/nextclaw exec tsc -p tsconfig.json --pretty false --noEmit`
  - 结果：无法作为本次完成依据，因为当前工作区存在与本次无关的既有类型错误，集中在：
    - `packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/index.ts`
    - `packages/nextclaw-server/src/ui/config.ts`
    - `packages/nextclaw/src/cli/commands/ncp/ui-ncp-runtime-registry.ts`

## 发布/部署方式

- 代码发布：
  - 合并后随正常 `nextclaw` CLI 发布链路发布即可。
- Linux 用户：
  - 登录级自启动：`nextclaw service install-systemd --user`
  - 机器级自启动：`sudo nextclaw service install-systemd --system`
- macOS 用户：
  - 登录级自启动：`nextclaw service install-launch-agent`
  - 卸载：`nextclaw service uninstall-launch-agent`
- Windows 用户：
  - 登录级自启动：`nextclaw service install-task`
  - 卸载：`nextclaw service uninstall-task`
- 当前不涉及：
  - Electron 打包桌面的 `launch at login`
  - macOS LaunchDaemon
  - Windows Service

## 用户/产品视角的验收步骤

- Linux：
  1. `npm i -g nextclaw`
  2. 运行 `nextclaw service install-systemd --user` 或 `sudo nextclaw service install-systemd --system`
  3. 运行 `nextclaw service autostart status --json`
  4. 确认 `hostOwner` 为 `systemd-user-service` 或 `systemd-system-service`
  5. 重新登录或重启后确认服务恢复
- macOS：
  1. `npm i -g nextclaw`
  2. 运行 `nextclaw service install-launch-agent`
  3. 运行 `nextclaw service autostart status --json`
  4. 确认 `hostOwner: "launchd-launch-agent"` 且 `resourcePath` 指向 `~/Library/LaunchAgents/io.nextclaw.host-agent.plist`
  5. 重新登录桌面会话后确认服务恢复
- Windows：
  1. `npm i -g nextclaw`
  2. 运行 `nextclaw service install-task`
  3. 运行 `nextclaw service autostart status --json`
  4. 确认 `hostOwner: "windows-logon-task"` 且 `resourceName: "NextClaw Host Autostart"`
  5. 注销并重新登录后确认服务恢复
- 非对应平台：
  1. 运行平台专属 install 命令的 `--dry-run --json`
  2. 预期返回明确 `reasonIfUnavailable`
  3. 预期不会尝试写入不属于当前宿主的平台资源

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
  - 这轮不是简单往 Linux owner 外面再包两层 if/else，而是把运行时入口解析、平台 owner、命令输出 owner 拆开，避免三平台逻辑互相污染。
- 是否优先遵循删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好：是。
  - 这次虽然新增了 macOS / Windows owner，但同时把 `service.ts` 和 `index.ts` 中与宿主自启动相关的堆积逻辑拆薄，最终总代码和非测试代码都实现了净下降。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。
  - 文件数净增长不可避免，但总代码量下降了。
  - 目录平铺有小幅增加，主要是 `packages/nextclaw/src/cli` 新增了命令注册文件；同时换来了 `index.ts` 净减 32 行、`service.ts` 净减 133 行。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。
  - `HostAutostartRuntimeService` 统一稳定入口解析；
  - 三个平台各自一个 owner；
  - `HostAutostartService` 负责平台路由；
  - `HostAutostartCommandService` 负责 CLI 输出合同；
  - 没有做“一条 install-autostart 猜平台”的黑盒。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。
  - 新增文件名、目录命名、角色边界都满足 touched-file 治理。
  - 整仓 `maintainability guard` 仍受其它既有热点拖累，但本次自启动链路自己的新增阻断已经清掉。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核，结论如下。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次把“npm 安装版也要具备宿主级恢复能力”真正推进到三平台主路径，符合 NextClaw 作为个人操作层必须在宿主重启/重登录后可靠恢复的长期方向。
- 更重要的是，这次没有用黑盒自动猜平台，而是把宿主 owner 明确暴露给用户，保持系统管理行为可理解、可预测。

代码增减报告：
- 新增：224 行
- 删除：308 行
- 净增：-84 行

非测试代码增减报告：
- 新增：198 行
- 删除：291 行
- 净增：-93 行

可维护性总结：
- no maintainability findings
- 本次即使新增了 macOS / Windows 两条宿主主路径，非测试代码仍实现净减，说明这轮扩能力不是单纯堆代码，而是伴随结构收敛完成的。
- 主要减债来自把 autostart 输出与命令注册从既有热点 [service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service.ts) / [index.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/index.ts) 拆开。
- 下一步最值得继续切的 seam，是把 [macos-launch-agent-autostart.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/macos-launch-agent-autostart.service.ts) 和 [windows-task-autostart.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/windows-task-autostart.service.ts) 的 IO 编排再各抽一层，降低单文件体量预警。

## NPM 包发布记录

- 本次是否需要发包：需要。
  - 原因：`nextclaw` 公共 CLI 包新增了 macOS / Windows 宿主自启动命令，同时更新了跨平台命令文档与内置 `USAGE.md`。
- 需要发布的包：
  - `nextclaw`
- 每个包当前是否已经发布：
  - `nextclaw`：未发布，待统一发布。
- 未发布原因：
  - 本轮只完成了代码、文档与验证，没有在本轮直接执行发包流程。
- 后续补发/统一发布说明：
  - `nextclaw` 需要在下一次 CLI 发布批次里统一发布，确保 npm 实际命令能力与文档同时生效。
- 当前已知阻塞或触发条件：
  - 发包前仍应按发布批次标准再做一轮统一校验；当前整仓类型与维护性 guard 里仍有与本次无关的既有热点，需要按发布窗口统一判断。
