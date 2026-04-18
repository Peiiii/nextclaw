# v0.16.67-linux-cli-systemd-autostart

## 迭代完成说明

- 本次为 npm / CLI 安装链路补上了第一条正式产品化的宿主自启动主路径：Linux `systemd`。
- 相关设计文档见：
  - [NextClaw Host-Native Autostart Strategy Design](../../designs/2026-04-18-host-native-autostart-strategy-design.md)
  - [Host-Native Autostart Implementation Plan](../../plans/2026-04-18-host-native-autostart-implementation-plan.md)
- 本次明确收敛了产品边界：
  - 只实现 Linux `systemd` 主路径，不在这一轮半做 macOS `launchd` 或 Windows Task Scheduler。
  - 继续保留“桌面安装包登录自启”与“npm/CLI 宿主自启动”两套不同 owner，不再混成一个模糊能力。
  - 不把“远程开机 / 远程唤醒机器”混进本轮。
- CLI 新增并接通了以下命令：
  - `nextclaw service install-systemd --user`
  - `sudo nextclaw service install-systemd --system`
  - `nextclaw service uninstall-systemd --user`
  - `sudo nextclaw service uninstall-systemd --system`
  - `nextclaw service autostart status`
  - `nextclaw service autostart doctor`
- 新增了独立的 Linux systemd owner：
  - [packages/nextclaw/src/cli/commands/service-support/autostart/linux-systemd-autostart.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/linux-systemd-autostart.service.ts)
  - [packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.service.ts)
  - [packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.types.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.types.ts)
- 本次实现保持“行为明确、可预测”：
  - `npm i -g nextclaw` 仍只负责安装 CLI，不会静默改宿主启动项。
  - `install-systemd` 必须显式选择 `--user` 或 `--system`，避免猜测作用域。
  - `status` / `doctor` 属于纯读路径，不隐式启停服务。
  - systemd unit 使用显式 Node 路径 + 显式 CLI entry + 显式 `NEXTCLAW_HOME`，避免依赖 cwd 或交互 shell PATH。
- 在交付前复查中又补了一处可靠性收口：
  - 当 `systemctl daemon-reload` / `enable` / `restart` / `disable` 实际失败时，CLI 现在会明确返回失败，而不是误报“安装/卸载成功”。
- 用户文档同步更新：
  - [apps/docs/en/guide/commands.md](/Users/peiwang/Projects/nextbot/apps/docs/en/guide/commands.md)
  - [apps/docs/zh/guide/commands.md](/Users/peiwang/Projects/nextbot/apps/docs/zh/guide/commands.md)
  - [docs/USAGE.md](/Users/peiwang/Projects/nextbot/docs/USAGE.md)
  - [packages/nextclaw/resources/USAGE.md](/Users/peiwang/Projects/nextbot/packages/nextclaw/resources/USAGE.md)

## 测试/验证/验收方式

- 已通过：`pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-support/autostart/tests/linux-systemd-autostart.service.test.ts`
  - 覆盖：user unit 生成、Linux-only 支持边界、scope 解析、doctor 警告合同、`systemctl` 失败路径不再误报成功。
- 已通过：`pnpm lint:new-code:governance -- packages/nextclaw/src/cli/index.ts packages/nextclaw/src/cli/types.ts packages/nextclaw/src/cli/commands/service.ts packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.types.ts packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.service.ts packages/nextclaw/src/cli/commands/service-support/autostart/linux-systemd-autostart.service.ts packages/nextclaw/src/cli/commands/service-support/autostart/tests/linux-systemd-autostart.service.test.ts`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已通过：`node packages/nextclaw/scripts/sync-usage-resource.mjs`
- 已通过：源码态命令级冒烟
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts service autostart status --user --json`
  - 观察点：当前宿主非 Linux 时会稳定返回 `supported: false` 与明确 `reasonIfUnavailable`，而不是误报已安装或尝试写 systemd。
  - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts service install-systemd --user --dry-run --json`
  - 观察点：当前宿主非 Linux 时会稳定返回 unsupported 结果，但 CLI 命令本身已接线成功，能输出 unit path / homeDir / command / reasonIfUnavailable 的统一 JSON 合同。
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：命令执行完成，但本工作区里存在与本次无关的既有热点文件增长，整体 guard 失败。
  - 本次 guard 输出中的 error 主要来自当前工作区其他改动，不是本次 Linux autostart 链路新增文件本身：
    - `packages/nextclaw-server/src/ui/config.ts`
    - `packages/nextclaw-server/src/ui/types.ts`
    - `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx`
    - `packages/nextclaw-ui/src/components/config/ProviderForm.tsx`
    - `packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.test.ts`
    - `packages/nextclaw/src/cli/index.ts` / `packages/nextclaw/src/cli/commands/service.ts` 的热点体量问题
- 全量 `pnpm -C packages/nextclaw exec tsc -p tsconfig.json --pretty false --noEmit` 未能作为完成依据
  - 原因：当前工作区存在与本次无关的既有类型错误，集中在：
    - `packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/index.ts`
    - `packages/nextclaw-server/src/ui/config.ts`
    - `packages/nextclaw/src/cli/commands/ncp/ui-ncp-runtime-registry.ts`
  - 补充检查：针对本次 touched 文件做 grep 过滤时，没有出现指向本次 autostart 文件的 TypeScript 报错。

## 发布/部署方式

- 代码发布：
  - 合并后随正常 `nextclaw` CLI 发布链路发布即可。
- Linux npm / CLI 用户使用方式：
  - 登录级自启动：
    - `nextclaw service install-systemd --user`
  - 机器级自启动：
    - `sudo nextclaw service install-systemd --system`
  - 卸载：
    - `nextclaw service uninstall-systemd --user`
    - `sudo nextclaw service uninstall-systemd --system`
- 文档发布：
  - 本次同时更新了 docs 命令页与打包内置 `USAGE.md`，需要随下一次 CLI 包发布一起生效。
- 当前不涉及桌面安装包行为变更：
  - Electron login item 语义保持不变。

## 用户/产品视角的验收步骤

- Linux user 模式：
  1. 通过 `npm i -g nextclaw` 安装 CLI。
  2. 运行 `nextclaw service install-systemd --user`。
  3. 运行 `nextclaw service autostart status --user`，确认：
     - `supported: true`
     - `scope: user`
     - `resourceName: nextclaw.service`
  4. 运行 `nextclaw service autostart doctor --user`，确认没有新的 fail。
  5. 重新登录桌面会话后，确认 NextClaw 服务可恢复。
- Linux system 模式：
  1. 以管理员权限运行 `sudo nextclaw service install-systemd --system`。
  2. 运行 `nextclaw service autostart status --system` 或 `sudo systemctl status nextclaw.service`。
  3. 重启机器，确认 NextClaw 服务会在系统启动后恢复。
- 非 Linux 宿主：
  1. 运行 `nextclaw service autostart status --json`。
  2. 预期返回 `supported: false`，并明确说明当前仅支持 Linux systemd。
  3. 运行 `nextclaw service install-systemd --user --dry-run --json`。
  4. 预期不会尝试写入宿主启动项，而是返回 unsupported 原因。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
  - 这轮没有把 Linux systemd 逻辑继续塞进 `service.ts` 主流程里，而是新增了独立 owner `host-autostart.service.ts` 与 `linux-systemd-autostart.service.ts`，把平台宿主行为和现有 runtime 启停编排分开。
- 是否优先遵循删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好：是。
  - 没有引入跨平台“万能 autostart backend”或隐式平台 fallback，只做 Linux 主路径，并把 macOS / Windows 明确保留在方案层。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。
  - 为了把 npm / CLI 的 Linux systemd 能力补成完整交付，本次新增了 owner class、类型合同、测试和文档，总代码净增长不可避免。
  - 但增长集中在新建 `service-support/autostart/` 子目录，没有继续向历史热点 `service.ts` 注入平台细节分支。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。
  - `service.ts` 只负责命令入口与输出；
  - `HostAutostartService` 负责宿主级能力入口；
  - `LinuxSystemdAutostartService` 负责 Linux systemd 细节；
  - 没有增加第二套运行时 owner，也没有把观察路径和执行路径混在一起。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。
  - 新目录 `packages/nextclaw/src/cli/commands/service-support/autostart/` 采用单一职责命名，文件名与角色边界符合当前治理。
  - 仍存在的主要维护性观察点不在新目录，而在既有热点文件 [service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service.ts) 与 [index.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/index.ts) 的体量继续偏大。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核，结论如下。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次把“npm / CLI 版也应该拥有宿主级自启动能力，但必须按宿主原生方式做”从模糊认知变成了明确产品合同，向“统一入口 + 宿主管理可理解 + 行为可预测”的长期方向推进了一步。
- 本次没有把桌面 login item、Web 控制面、远程开机三套语义继续搅在一起，而是明确只做 Linux systemd 主路径，减少未来继续补丁式加例外的空间。

代码增减报告：
- 新增：1019 行
- 删除：14 行
- 净增：1005 行

非测试代码增减报告：
- 新增：880 行
- 删除：14 行
- 净增：866 行

可维护性总结：
- no maintainability findings
- 本次净增长主要来自新增 Linux systemd owner、CLI 命令接线、失败路径收口和文档同步，属于新增用户可见能力的最小必要增长。
- 已尽量把复杂度收敛在新建 `autostart` 子目录，而不是继续扩张 `service.ts` 的平台细节分支。
- 下一步最值得继续切的 seam 是把 [service.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/service.ts) 里这次新增的 autostart 命令输出层继续抽薄，避免该历史热点文件继续增长。

## NPM 包发布记录

- 本次是否需要发包：需要。
  - 原因：`nextclaw` 公共 CLI 包新增了 Linux systemd 自启动命令与对应内置 `USAGE.md`。
- 需要发布的包：
  - `nextclaw`
- 每个包当前是否已经发布：
  - `nextclaw`：未发布，待统一发布。
- 未发布原因：
  - 本次只完成代码、文档与验证，没有在本轮直接执行发包流程。
- 后续补发/统一发布说明：
  - `nextclaw` 需在下一次 CLI 正式发布批次中一起发布，避免文档先于 npm 实际可用命令生效。
- 当前已知阻塞或触发条件：
  - 需要后续统一 release / 发包动作；若发包前仍存在工作区里与本次无关的类型或维护性热点问题，应先按发布批次标准再做一轮统一校验。
