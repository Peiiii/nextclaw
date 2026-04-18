# NextClaw Host-Native Autostart Strategy Design

日期：2026-04-18

相关文档：

- [NextClaw 产品愿景](../VISION.md)
- [Unified Desktop and Web Presence Lifecycle Design](../plans/2026-04-14-unified-desktop-web-presence-lifecycle-design.md)
- [v0.16.13-desktop-web-presence-lifecycle-v1](../logs/v0.16.13-desktop-web-presence-lifecycle-v1/README.md)
- [v0.16.18-unified-release-0-17-11](../logs/v0.16.18-unified-release-0-17-11/GITHUB_RELEASE.md)
- [CLI Commands](../../apps/docs/zh/guide/commands.md)

若现状代码、文档与本文冲突，以本文作为后续一轮“自启动 / 开机恢复能力”收敛的目标契约。

## 1. 背景

NextClaw 想成为 AI 时代的个人操作层，就不能只在“用户手动点开它时”才勉强存在。对很多真实场景来说，用户真正关心的是：

- 机器重启后，NextClaw 能不能自己回来
- 我关掉窗口后，它是不是还在后台活着
- npm 安装版和桌面安装包版，到底谁支持自启动，谁不支持
- 自启动这件事，是产品自己偷偷做掉，还是用户明确授权后才做
- Web 页面为什么不能假装自己能“开机自启”

目前仓库里已经有两部分事实，但产品语义仍不够统一：

1. 桌面安装包链路
   - 已经实现托盘常驻、关窗后台运行、登录自启、显式 Quit 语义。
   - 该能力由 Electron launcher owner 承担，符合既有 presence 设计。

2. CLI / npm 链路
   - 文档已经暴露 `nextclaw service install-systemd` / `uninstall-systemd`，说明 Linux 方向已经有“受管服务自启动”的产品语义。
   - 但 npm 安装版的跨平台自启动能力仍未形成统一矩阵，也没有把权限边界、宿主 owner、命令合同、明确不做项一次写清楚。

这导致团队和用户容易把几件不同的事情混成一句模糊的话：

- “开机自启”
- “登录自启”
- “服务随系统恢复”
- “彻底关机后被远程开机”
- “npm 安装后一键自动改宿主启动项”

本文的目标，就是把这些语义一次性拆开，并给出面向 NextClaw 的最小 PRD + 命令设计草案。

## 2. 问题定义

当前需要解决的不是单点实现缺口，而是一个跨安装方式、跨平台、跨宿主层的产品合同问题。

至少存在以下 6 个不清晰点：

1. 安装方式语义不清
   - 桌面安装包支持的“登录自启”，不能自动代表 npm 安装版也支持。

2. 自启动触发时机不清
   - “系统启动即恢复”
   - “用户登录后启动”
   - “窗口关闭后继续后台运行”
   这三件事不是同一件事。

3. 宿主 owner 不清
   - 自启动究竟由 Electron、systemd、launchd、Task Scheduler，还是 Web 页面负责。

4. 权限模型不清
   - 哪些动作必须 sudo / 管理员权限。
   - 哪些动作应该优先采用用户级启动项，而不是系统级启动项。

5. 可预期性不够
   - 用户可能误以为 `npm install -g nextclaw` 本身就会改系统启动项。
   - 用户也可能误以为 Web 页面的“开机自启”开关有意义。

6. 产品边界不清
   - “自启动 / 恢复服务”与“远程把一台已关机机器开机”不是同一能力。

## 3. 上位目标对齐

这轮设计必须服务以下长期目标：

- 让 NextClaw 作为统一入口更可靠，而不是每次重启机器后都要重新手动拉起。
- 让系统管理能力更可理解、更可预测，不靠隐式魔法制造 surprise success。
- 让不同安装方式的能力边界明确，不把桌面能力错误投射到 npm/CLI。
- 让 Web 继续保持“控制面”定位，而不谎称自己是宿主 owner。
- 让用户通过最少权限、最少一次性初始化动作，获得稳定的自启动能力。

换句话说：

**NextClaw 可以编排和暴露“自启动能力”，但不应该掩盖宿主平台的真实机制。**

## 4. 术语与能力边界

后续所有产品文案、CLI 命令、UI 说明都必须严格区分以下术语。

### 4.1 登录自启

指用户登录桌面会话后，NextClaw 自动启动。

典型 owner：

- Electron login item
- macOS LaunchAgent
- Windows Scheduled Task（logon trigger）

### 4.2 系统启动后恢复服务

指机器开机后，无需打开桌面窗口，后台服务自己恢复。

典型 owner：

- Linux systemd system service
- macOS LaunchDaemon
- Windows Service

### 4.3 关窗后台运行

指桌面窗口消失，但宿主应用和 runtime 继续运行。

典型 owner：

- Electron desktop launcher

### 4.4 远程开机 / 远程唤醒

指机器当前并未运行，需要通过 WOL、IPMI、智能插座等外部能力让机器通电或唤醒。

这不是本文要解决的能力。

## 5. 产品结论

### 5.1 总结论

NextClaw 的自启动能力必须采用“宿主原生、自愿启用、显式权限、可卸载、可观测”的路线，而不是“安装即偷偷改系统启动项”的路线。

### 5.2 核心原则

1. 默认不自动启用
   - `npm install`、桌面安装包安装、本地 Web 首次打开，都不应默认改宿主启动项。

2. 优先用户级，再系统级
   - 能用 user-level owner 解决的，不先要求 root / admin。

3. 自启动不等于远程开机
   - 文案与功能必须拆开。

4. Web 不拥有宿主自启动
   - Web 只能展示状态、提示宿主 owner、必要时调用已授权的 host control；不能假装浏览器自己能实现自启动。

5. 桌面与 CLI 走不同 owner
   - 桌面安装包继续走 Electron 原生 login item。
   - npm/CLI 走各平台原生服务管理机制。

6. 同一平台的实现应可安装、可卸载、可检查、可诊断
   - 至少配套 install / uninstall / status / doctor。

## 6. 平台能力矩阵

| 分发方式 | 平台 | 推荐 owner | 目标语义 | 是否需要显式安装动作 | 是否需要高权限 |
| --- | --- | --- | --- | --- | --- |
| Desktop packaged app | macOS | Electron login item | 登录自启 + 后台托盘 | 是 | 否 |
| Desktop packaged app | Windows | Electron login item | 登录自启 + 后台托盘 | 是 | 否 |
| Desktop packaged app | Linux | 暂不在 v1 承诺统一实现 | 发行版差异过大 | 是 | 视实现而定 |
| npm / CLI | Linux user mode | `systemd --user` | 登录后恢复服务 | 是 | 否 |
| npm / CLI | Linux system mode | `systemd` system service | 开机后恢复服务 | 是 | 是 |
| npm / CLI | macOS user mode | LaunchAgent | 登录后恢复服务 | 是 | 否 |
| npm / CLI | macOS system mode | LaunchDaemon | 开机后恢复服务 | 是 | 是 |
| npm / CLI | Windows user mode | Scheduled Task | 登录后恢复服务 | 是 | 通常否 |
| npm / CLI | Windows system mode | Windows Service | 开机后恢复服务 | 是 | 是 |

## 7. 分阶段范围

为了保证行为可预测、实现范围不过度膨胀，建议分三期推进。

### 7.1 Phase 0：收口现有事实与文案

目标：

- 把“桌面安装包已支持登录自启”和“npm/CLI 只在 Linux 有受管服务语义”写清楚。
- 修正文案里“开机自启”与“登录自启”的混用。
- 明确 `npm install` 本身不会改宿主启动项。

### 7.2 Phase 1：正式产品化 CLI 宿主自启动

优先级：

1. Linux `systemd --user` / `systemd --system`
2. macOS LaunchAgent
3. Windows Scheduled Task

这三条优先于 macOS LaunchDaemon / Windows Service，因为它们更符合“个人操作层”的默认场景：用户登录后可用，而不是先把 NextClaw 做成企业后台守护进程。

### 7.3 Phase 2：高级模式

后续按需追加：

- Linux linger
- macOS LaunchDaemon
- Windows Service
- Web 控制面上的 host-autostart 状态展示与只读提示

## 8. 推荐机制与明确不做项

### 8.1 Linux npm / CLI

推荐：

- 用户级默认采用 `systemd --user`
- 需要“用户退出后仍继续运行”时，显式提示是否启用 `linger`
- 需要真正机器级服务时，再使用 `--system`

不推荐作为默认方案：

- `@reboot` crontab
- shell profile 自启动
- `nohup` + 自写 pid 文件
- PM2 作为默认宿主 owner
- 桌面环境自启动 `.desktop` 文件作为唯一主路径

原因：

- 不够标准
- 生命周期管理和日志收敛差
- 可观测性差
- 容易制造隐藏状态

### 8.2 macOS npm / CLI

推荐：

- 默认采用 LaunchAgent

不推荐第一版默认采用：

- LaunchDaemon

原因：

- LaunchDaemon 更适合系统级长期后台服务，而不是个人登录场景。
- 权限、环境变量、路径继承、文件权限问题更复杂。

### 8.3 Windows npm / CLI

推荐：

- 默认采用 Scheduled Task（logon trigger）

不推荐第一版默认采用：

- Windows Service

原因：

- Windows Service 更像系统基础设施，不像个人 agent 的默认宿主。
- 服务用户、权限、交互桌面限制、日志和升级链路复杂度更高。

### 8.4 Web

明确不做：

- 不把“恢复浏览器标签页”包装成“网页端开机自启”
- 不提供伪能力开关让用户误以为浏览器能拥有服务生命周期

### 8.5 远程开机

明确不做：

- 不把 WOL、IPMI、智能插座类能力与“自启动”混在一套 PRD 中
- 不在没有硬件/网络前提的情况下对外承诺“NextClaw 能开机一台已关机机器”

## 9. 命令行设计草案

### 9.1 设计原则

命令命名应优先满足：

- 显式表达宿主 owner
- 不隐藏平台差异
- 保持可预测
- 避免“一条神奇命令自动猜平台并神改系统”的黑盒体验

### 9.2 推荐命令集

#### Linux

```bash
nextclaw service install-systemd --user
nextclaw service install-systemd --system
nextclaw service uninstall-systemd --user
nextclaw service uninstall-systemd --system
nextclaw service autostart status
nextclaw service autostart doctor
```

推荐扩展参数：

- `--enable-linger`
- `--name <service-name>`
- `--force`
- `--dry-run`

说明：

- `--user` 是个人机器默认推荐路径。
- `--system` 面向服务器、NAS、长期后台驻留场景。

#### macOS

```bash
nextclaw service install-launch-agent
nextclaw service uninstall-launch-agent
nextclaw service autostart status
nextclaw service autostart doctor
```

高级模式预留，不在第一版默认暴露：

```bash
nextclaw service install-launch-daemon
nextclaw service uninstall-launch-daemon
```

#### Windows

```powershell
nextclaw service install-task
nextclaw service uninstall-task
nextclaw service autostart status
nextclaw service autostart doctor
```

高级模式预留，不在第一版默认暴露：

```powershell
nextclaw service install-windows-service
nextclaw service uninstall-windows-service
```

### 9.3 为什么不推荐单一 `install-autostart`

不推荐把第一版设计成：

```bash
nextclaw service install-autostart
```

再由程序偷偷猜测并决定 systemd / launchd / Task Scheduler。

原因：

- 会掩盖真实宿主 owner
- 会让错误排查变难
- 会让文档与权限边界变模糊
- 不符合“行为明确、可预测”的治理原则

如果后续要提供更高层的便捷入口，也应作为显式封装：

```bash
nextclaw service install-autostart --mode user
```

并在输出中明确打印它实际落到哪种宿主机制，而不是静默处理。

## 10. 命令行为合同

### 10.1 install

安装命令必须做到：

- 输出将要创建的宿主资源名称
- 输出目标命令、目标工作目录、日志位置
- 输出是否需要额外权限
- 支持 `--dry-run`
- 支持重复执行时幂等

示例输出：

```text
Preparing to install NextClaw autostart:
- host owner: systemd user service
- unit: nextclaw.service
- command: /usr/bin/env nextclaw start --open false
- logs: journalctl --user -u nextclaw.service
- permission: no sudo required
Installed successfully.
```

### 10.2 uninstall

卸载命令必须做到：

- 停用启动项
- 删除受控宿主资源
- 不删除用户数据目录
- 不删除 npm 包本身

### 10.3 status

统一返回以下核心字段：

- `supported`
- `installed`
- `enabled`
- `scope`
- `hostOwner`
- `resourceName`
- `command`
- `logHint`
- `reasonIfUnavailable`

示例：

```json
{
  "supported": true,
  "installed": true,
  "enabled": true,
  "scope": "user",
  "hostOwner": "systemd-user-service",
  "resourceName": "nextclaw.service",
  "command": "nextclaw start --open false",
  "logHint": "journalctl --user -u nextclaw.service -f",
  "reasonIfUnavailable": null
}
```

### 10.4 doctor

`doctor` 应重点检查：

- owner 是否存在
- owner 是否 enabled
- 指向的 Node / nextclaw 命令是否仍可解析
- `NEXTCLAW_HOME` / 工作目录是否稳定
- 日志目标是否可访问
- 启动失败的最后错误提示

## 11. 权限与安全模型

### 11.1 权限原则

默认遵循“最小权限”：

- Linux `systemd --user`：默认不需要 sudo
- Linux `--system`：需要 sudo
- macOS LaunchAgent：默认不需要 sudo
- macOS LaunchDaemon：需要 sudo
- Windows Scheduled Task（当前用户）：默认不要求 admin
- Windows Service：需要 admin

### 11.2 用户确认

所有 install 命令都必须让用户明确知道：

- 将注册哪个宿主资源
- 是否会在登录后自动启动
- 是否在后台运行
- 如何卸载
- 如何看日志

### 11.3 不做静默持久化

明确禁止：

- 安装时默认自动启用宿主启动项
- 应用首次运行时偷偷写系统启动项
- 在没有用户显式命令或明确 UI 操作的情况下提升权限

## 12. Desktop 与 CLI 的关系

### 12.1 Desktop packaged app

继续维持当前事实：

- Desktop presence owner 负责关窗后台运行、托盘、登录自启、显式退出。
- 桌面端的“登录自启”属于 packaged desktop 能力，不应被误写成 npm/CLI 通用能力。

### 12.2 npm / CLI

npm/CLI 版不复用 Electron login item，而是走宿主原生服务管理路径。

这两条链路在产品文案上必须明确区分：

- `Desktop`: 登录自启
- `CLI`: 宿主级自启动 / 服务恢复

### 12.3 未来统一展示

后续 UI 可以统一展示一张“Runtime Presence / Host Autostart”卡片，但展示逻辑必须按环境分流：

- `desktop-embedded`：显示 Electron presence 状态
- `managed-local-service`：显示 host autostart 状态
- `self-hosted-web`：显示宿主提示或只读状态
- `shared-web`：不对终端用户暴露

## 13. 失败模式与防呆

### 13.1 Node / npm shim 路径漂移

自启动 owner 指向的命令不能依赖脆弱的 cwd 或临时 shell 环境。

要求：

- 安装时解析稳定的 Node / CLI 入口
- 在 `doctor` 中验证路径仍然存在

### 13.2 用户以为 `npm install` 就自动启用

要求：

- 文档和 CLI 输出明确说明：安装包本身不改宿主启动项
- 必须额外执行 install 命令

### 13.3 用户没有权限

要求：

- 明确区分“无需权限的用户级模式”和“需要管理员权限的系统级模式”
- 命令失败时给出下一步建议，而不是只报权限 denied

### 13.4 关闭浏览器后误以为服务死了

要求：

- Web 页面明确说明页面不是 service owner
- `status` / `doctor` / runtime page 能展示宿主状态

### 13.5 误把远程开机当成自启动

要求：

- 文档里单独列出“不包含远程开机”
- 后续如果真做远程唤醒，也必须单独开题

## 14. 验收标准

本方案完成后，至少应满足以下验收点。

### 14.1 文档与文案

- 用户能明确区分 Desktop 登录自启与 CLI 宿主自启动
- 用户能明确知道 `npm install` 本身不会自动改宿主启动项
- Web 文案不再暗示浏览器拥有自启动能力

### 14.2 CLI 合同

- install / uninstall / status / doctor 成套存在
- 输出可理解、可排障
- 重复执行 install / uninstall 不产生脏状态

### 14.3 宿主行为

- Linux user mode：用户登录后服务恢复
- Linux system mode：机器重启后服务恢复
- macOS user mode：登录后恢复
- Windows user mode：登录后恢复

### 14.4 失败可诊断

- 路径错误、权限不足、owner 不存在、owner disabled、启动命令失效，都能通过 `doctor` 给出明确提示

## 15. 发布与实现建议

### 15.1 建议的落地顺序

1. 收口文档与产品边界
2. 核对并补齐 Linux `install-systemd` 现有实现/合同
3. 增加 `autostart status` / `autostart doctor`
4. 增加 macOS LaunchAgent
5. 增加 Windows Scheduled Task
6. 最后再考虑高级系统级模式

### 15.2 建议的代码边界

建议新增独立 host owner，而不是把平台分支继续塞进现有 `service.ts` 巨型命令文件：

- `service-support/autostart/host-autostart.service.ts`
- `service-support/autostart/linux-systemd-autostart.service.ts`
- `service-support/autostart/macos-launch-agent-autostart.service.ts`
- `service-support/autostart/windows-task-autostart.service.ts`
- `service-support/autostart/host-autostart.types.ts`

这样更符合“宿主能力单独 owner”的长期方向。

## 16. 明确不做项

本方案明确不包含以下内容：

1. 远程开机 / 远程唤醒
2. 浏览器标签页级“伪自启动”
3. 安装后静默改宿主启动项
4. 以 PM2、shell profile、cron `@reboot` 作为官方默认主路径
5. 第一版就统一抽象成一个不透明的“万能 autostart backend”
6. 第一版就同时把 LaunchDaemon / Windows Service 做成默认路径

## 17. 最终建议

对 NextClaw 来说，最合适的路线不是“再发明一套自启动框架”，而是：

- Desktop 保持 Electron 原生登录自启
- npm / CLI 按平台走原生宿主机制
- 默认优先用户级模式
- 用户显式执行 install
- 产品和文档严禁把“登录自启”“系统恢复”“远程开机”混成一句话

这是最符合 NextClaw 产品愿景、权限边界、平台现实和可维护性的方案。
