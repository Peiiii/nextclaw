# Desktop Installed CLI Contract Design

## 1. 背景

NextClaw 的自管理能力依赖一个稳定命令面：AI 在执行命令时按 `nextclaw status --json`、`nextclaw doctor --json`、`nextclaw config ...`、`nextclaw agents ...`、`nextclaw cron ...` 操作产品自身。

这个合同在 NPM 安装形态下天然成立，因为 `nextclaw` 来自 NPM package `bin`。但桌面安装形态下，用户只获得 Electron 桌面应用和桌面托管 runtime，并不天然获得 shell 里的 `nextclaw` 命令。

这会造成一个产品级断裂：桌面版明明承载了 NextClaw 的本地 runtime，AI 自己的 command tool 却可能找不到 `nextclaw`，从而无法无感使用自管理命令。

## 2. 产品目标

目标不是要求用户再安装一份 NPM CLI，也不是让 AI 根据安装形态改写命令。

目标是：

> 任意能承载 NextClaw AI command tool 的安装形态，都必须向该 command tool 暴露同名、同语义的 `nextclaw` 命令。

对 AI 来说，下面命令在 NPM、桌面安装、portable 等形态中都应该无感可用：

```bash
nextclaw --version
nextclaw status --json
nextclaw doctor --json
nextclaw config get providers --json
nextclaw agents list --json
nextclaw cron list --json
```

第一阶段优先保障 NextClaw 自己启动的 AI command tool。人类在系统终端里能否直接 `nextclaw ...` 是第二阶段体验增强，不作为第一阶段阻塞条件。

## 3. 愿景对齐

这个能力直接服务产品愿景中的三条主线：

- `统一入口`：桌面安装不能把自管理能力拆到另一个安装路径里。
- `自感知与自治`：AI 必须能通过标准命令读取状态、诊断、改配置、管理 agent 和 cron。
- `开箱即用`：桌面用户不应该为了让 AI 管理 NextClaw 自己，再学习 Node / NPM / PATH 配置。

如果桌面版不能提供同一命令面，NextClaw 就会出现“UI 能跑，但 AI 自治链路不完整”的硬伤。

## 4. 当前证据

现有 NPM CLI 入口：

- `packages/nextclaw/package.json` 暴露 `bin.nextclaw = dist/cli/launcher/index.js`。
- `packages/nextclaw/src/cli/app/index.ts` 注册 `status`、`doctor`、`config`、`agents`、`cron` 等自管理命令。

现有桌面 runtime 入口：

- `apps/desktop/src/runtime-config.ts` 会解析当前桌面 bundle runtime 或 packaged runtime。
- 桌面验证里已有 `ELECTRON_RUN_AS_NODE=1 <app-binary> <runtime-script> ...` 这类诊断用法，说明桌面二进制可以承载 packaged runtime 命令。
- `apps/desktop/scripts/update/services/build-product-bundle.service.mjs` 已要求 runtime bundle 包含 `runtime/dist/cli/app/index.js` 与 `nextclaw-self-manage/SKILL.md`。

现有 AI command tool 入口：

- `packages/nextclaw-core/src/features/agent/tools/shell.tools.ts` 通过 `createExternalCommandEnv(process.env, {}, { cwd })` 构造命令环境。
- `createExternalCommandEnv` 已集中处理 PATH 增强，这适合作为统一注入点。

结论：现有系统已经具备大部分底层能力，缺的是桌面安装形态对 `nextclaw` 命令面的产品化暴露与验证合同。

## 5. 设计原则

命中的经典设计原则：

- `single-domain-owner`：同一安装形态下，`nextclaw` 命令面只能有一个事实 owner。
- `complete-owner`：桌面命令面 owner 必须覆盖 shim 生成、PATH 注入、runtime 解析、验证和诊断闭环。
- `responsibility-surface-minimization`：AI command tool 不应该知道桌面 app 路径、bundle layout 或 Electron 运行细节。
- `protected-variations`：不同安装形态的差异封装在命令面提供者之后，AI 继续调用稳定命令。
- `no-compatibility-by-default`：不要让桌面版长期要求额外 NPM CLI 作为隐式前提。

一句话架构原则：

**安装形态负责提供 `nextclaw` 命令面，AI command tool 只消费统一命令名。**

## 6. 推荐方案

推荐采用“桌面托管命令面”的方案。

桌面 launcher 在启动时生成一个受 NextClaw 管理的命令目录，例如：

```text
<desktopDataDir>/command-surface/bin/
  nextclaw
  nextclaw.cmd
```

同时生成一个命令面 manifest，例如：

```text
<desktopDataDir>/command-surface/nextclaw-command-surface.json
```

manifest 记录：

- installation kind：`installed` / `portable`
- desktop data dir
- runtime home
- app executable path
- desktop command bridge script path
- command surface schema version
- generated desktop launcher version

`nextclaw` / `nextclaw.cmd` 本身只做一件事：调用当前桌面 app binary，让 Electron bundled Node 执行桌面命令桥：

```bash
ELECTRON_RUN_AS_NODE=1 \
"<appExecutable>" \
"<desktopCommandBridgeScript>" \
"--manifest" "<commandSurfaceManifest>" \
"--" "$@"
```

Windows `.cmd` 使用同样语义：

```bat
set ELECTRON_RUN_AS_NODE=1
"<appExecutable>" "<desktopCommandBridgeScript>" --manifest "<commandSurfaceManifest>" -- %*
```

桌面命令桥再动态解析当前 active bundle runtime，并把原始参数转交给真正的 NextClaw CLI app：

```text
AI command tool
  -> PATH 命中 command-surface/bin/nextclaw
  -> desktop app binary with ELECTRON_RUN_AS_NODE=1
  -> desktop command bridge
  -> current bundle runtime/dist/cli/app/index.js
  -> nextclaw status/config/agents/cron...
```

## 7. 为什么需要 bridge，而不是静态写死 runtime script

不推荐在 shim 里直接写死当前 `runtime/dist/cli/app/index.js` 路径。

原因：

- 桌面 bundle 更新后，`current.json` 会指向新 bundle；静态 shim 容易变成旧 runtime。
- portable 路径、安装路径、bundle state 都可能变化，shell 脚本不适合自己解析这些状态。
- 动态 bridge 可以复用桌面 bundle layout 合同，并集中处理 fallback、错误信息和诊断。

bridge 的职责是完整的，但仍然很小：

- 读取 command surface manifest。
- 读取桌面 bundle `current.json`。
- 校验当前 bundle manifest 和 runtime entrypoint。
- 设置 `NEXTCLAW_HOME` / desktop data env。
- 使用当前 app binary 的 Electron bundled Node 执行 runtime CLI。
- 原样透传 stdout / stderr / exit code。

它不负责：

- 管理 UI 窗口。
- 下载或应用更新。
- 修改用户配置。
- 自己实现任何 `nextclaw` 子命令。

## 8. AI command tool 如何无感使用

桌面 runtime 启动时，把命令面 bin 目录注入 runtime 进程环境：

```text
NEXTCLAW_COMMAND_SURFACE_BIN=<desktopDataDir>/command-surface/bin
```

然后在通用命令环境构造里扩展一个规则：

```text
createExternalCommandEnv(...)
  -> 如果 NEXTCLAW_COMMAND_SURFACE_BIN 存在且是目录
  -> 将它 prepend 到 PATH
```

这样 `ExecTool` 不需要知道桌面版：

```ts
const env = createExternalCommandEnv(process.env, {}, { cwd });
```

AI 调用：

```bash
nextclaw status --json
```

最终会命中桌面托管的 shim。NPM 安装形态下没有 `NEXTCLAW_COMMAND_SURFACE_BIN` 时，仍然沿用系统 PATH 里的 NPM `nextclaw`。

这也是最关键的“无感”点：**AI 不改命令，安装形态补齐命令面。**

## 9. Owner 设计

### 9.1 DesktopInstallationProfile

现有 `DesktopInstallationProfile` 继续作为安装形态事实源。

它负责：

- 判断 `installed` / `portable`。
- 派生 desktop data dir。
- 派生 runtime home。
- 给 runtime 注入安装形态相关 env patch。

它不直接写 shim。否则 profile 会从“事实建模”膨胀成“文件副作用 owner”。

### 9.2 DesktopCommandSurfaceManager

新增桌面命令面 owner，建议文件：

```text
apps/desktop/src/managers/desktop-command-surface.manager.ts
apps/desktop/src/managers/desktop-command-surface.manager.test.ts
```

它负责：

- 根据 `DesktopInstallationProfile` 派生命令面目录。
- 原子写入 manifest。
- 原子写入 POSIX shim 和 Windows `.cmd` shim。
- 设置 POSIX shim 可执行权限。
- 返回 runtime env patch：`NEXTCLAW_COMMAND_SURFACE_BIN=<binDir>`。
- 记录当前命令面状态用于日志和诊断。

它不负责：

- 解析 current bundle。
- 启动 runtime。
- 注入 AI tool 的具体上下文。

### 9.3 DesktopCommandBridge

新增桌面命令桥，建议文件：

```text
apps/desktop/src/utils/desktop-command-bridge.utils.ts
apps/desktop/src/utils/desktop-command-bridge.utils.test.ts
```

它负责：

- 从 manifest 解析 app executable、desktop data dir、runtime home。
- 解析当前 bundle runtime script。
- fallback 到 packaged runtime script，仅限 current bundle 不存在但 packaged runtime 存在的恢复场景。
- 通过 `spawnSync(appExecutable, [runtimeScript, ...args])` 执行 CLI。
- 保持 stdout / stderr / exit code 一致。

它不负责任何业务命令语义。

### 9.4 createExternalCommandEnv

修改：

```text
packages/nextclaw-core/src/shared/lib/core-utils/utils/child-process-env.utils.ts
```

增加一个通用 env key：

```text
NEXTCLAW_COMMAND_SURFACE_BIN
```

如果该目录存在，则在 PATH 增强列表中优先加入。这个规则是通用命令环境能力，不是桌面专属逻辑；未来其他安装形态也可以复用。

## 10. 路径策略

安装版：

```text
<desktopDataDir>/command-surface/
  nextclaw-command-surface.json
  bin/
    nextclaw
    nextclaw.cmd
```

portable：

```text
<portableRoot>/data/desktop/command-surface/
  nextclaw-command-surface.json
  bin/
    nextclaw
    nextclaw.cmd
```

不写入：

- `/usr/local/bin`
- `/opt/homebrew/bin`
- 用户 shell rc 文件
- Windows 系统 PATH
- Windows 用户 PATH

原因：第一阶段目标是 AI command tool 无感，不是修改宿主系统命令环境。这样不需要管理员权限，也不会污染用户 shell。

## 11. 多安装形态与优先级

AI command tool 内部优先级：

1. `NEXTCLAW_COMMAND_SURFACE_BIN` 指向的托管命令面。
2. 当前 Node bin / local `node_modules/.bin`。
3. 用户原始 PATH。
4. 常见 POSIX bin 目录。

这保证桌面 runtime 内的 AI 优先使用当前桌面安装形态的 `nextclaw`，而不是误命中用户机器上旧的全局 NPM CLI。

人类系统终端第一阶段不修改 PATH，所以如果用户终端里已有 NPM `nextclaw`，仍按用户自己的 PATH 解析。后续可以在 UI 中提供“复制 PATH 配置”或“安装 shell command”动作，但不作为本阶段要求。

## 12. 更新语义

桌面安装形态下：

- `nextclaw --version` 返回当前 active bundle runtime 版本。
- `nextclaw status --json` 返回当前桌面 runtime 使用的同一 `NEXTCLAW_HOME` 状态。
- `nextclaw update` 不应走 NPM 更新语义；应返回桌面安装形态下的明确语义，或委托桌面 update channel。

第一阶段可先把 `update` 语义收敛为可诊断状态：

```text
desktop installation detected; use desktop update channel
```

后续再扩展为 CLI 触发桌面 update check / download / apply。

关键原则：不要让桌面 shim 调到一份 NPM launcher，也不要让 `nextclaw update` 在桌面版里悄悄改 NPM global package。

## 13. 错误与诊断

命令面失败时必须输出可行动错误，而不是静默退回错误路径。

典型错误：

- command surface manifest 缺失或损坏。
- app executable path 不存在。
- current bundle pointer 缺失。
- current bundle runtime script 缺失。
- Electron bundled Node 执行失败。

推荐错误格式：

```text
NextClaw desktop command surface is unavailable.
reason: current bundle runtime script missing
manifest: <path>
recovery: open NextClaw Desktop once, or run desktop package repair/update
```

桌面启动日志应记录：

```text
desktop.commandSurface.ready binDir=... manifest=... installationKind=...
```

`nextclaw doctor --json` 后续也应能暴露 command surface 状态。

## 14. 验收标准

### 14.1 单元测试

- `DesktopCommandSurfaceManager`：
  - 为 installed profile 生成 manifest 和 shim。
  - 为 portable profile 生成 portable 数据目录下的 manifest 和 shim。
  - POSIX shim 包含 `ELECTRON_RUN_AS_NODE=1`、app executable、bridge、manifest。
  - Windows `.cmd` shim 正确转发 `%*`。
  - 重复 ensure 幂等。

- `DesktopCommandBridge`：
  - 能从 current pointer 解析 runtime script。
  - current bundle 缺失时给出明确错误。
  - 执行子进程时透传 args、env、stdout、stderr、exit code。

- `createExternalCommandEnv`：
  - `NEXTCLAW_COMMAND_SURFACE_BIN` 存在时 prepend 到 PATH。
  - 该目录不存在时不污染 PATH。
  - Windows PATH key 大小写保持现有行为。

### 14.2 桌面验证

桌面 package smoke 增加命令面检查：

```bash
PATH="<command-surface-bin>:$PATH" nextclaw --version
PATH="<command-surface-bin>:$PATH" nextclaw status --json
PATH="<command-surface-bin>:$PATH" nextclaw doctor --json
```

对于 macOS / Linux，需要验证不依赖系统 Node：

```bash
env -u NODE -u npm_config_user_agent PATH="<command-surface-bin>:/usr/bin:/bin" nextclaw --version
```

对于 Windows，需要验证 `.cmd` 入口并保持 `windowsHide`，避免命令面触发可见控制台闪窗。

### 14.3 AI command tool 验收

在桌面 runtime 启动后的真实 AI command tool 环境中执行：

```bash
command -v nextclaw || where nextclaw
nextclaw --version
nextclaw status --json
nextclaw doctor --json
```

成功标准：

- 命中的 `nextclaw` 位于 desktop command surface bin 目录。
- `status --json` 指向当前桌面 runtime home。
- 不要求系统全局安装 Node。
- 不要求系统全局安装 NPM `nextclaw`。

## 15. 实施步骤

### 阶段一：命令面 owner

1. 新增 `DesktopCommandSurfaceManager` 及单测。
2. 新增 command surface manifest 类型。
3. 在桌面 main 启动链路中，在 runtime 启动前 ensure command surface。
4. 将 `NEXTCLAW_COMMAND_SURFACE_BIN` 注入 desktop runtime env。

### 阶段二：命令桥

1. 新增 `desktop-command-bridge.ts`。
2. 让 bridge 不依赖 Electron `app` API，只依赖 manifest 和文件系统状态。
3. 通过 Electron bundled Node 执行 active bundle runtime。
4. 覆盖错误路径和 exit code 透传测试。

### 阶段三：AI command tool PATH 注入

1. 扩展 `createExternalCommandEnv` 支持 `NEXTCLAW_COMMAND_SURFACE_BIN`。
2. 更新 `ExecTool` 相关测试，固定 `nextclaw ...` 命令优先命中托管 bin。
3. 确保 NPM 安装形态不受影响。

### 阶段四：验证与文档

1. 扩展 desktop package verify / smoke，加入 command surface 验收。
2. 更新 `desktop-release-contract-guard`：桌面包必须验证 AI self-management command surface。
3. 更新 `docs/USAGE.md` 与 `packages/nextclaw/resources/USAGE.md`，说明桌面 AI command tool 内置 `nextclaw` 命令面；如触达自管理命令语义，运行 `packages/nextclaw/scripts/sync-usage-resource.mjs`。
4. 视变更范围更新 docs/logs 迭代记录。

## 16. 不推荐方案

### 16.1 要求桌面用户额外 `npm i -g nextclaw`

不推荐。

这会让桌面安装形态依赖 Node/NPM，并产生两个 runtime 事实源：桌面 bundle 与 NPM CLI。AI 可能命中旧 NPM CLI，造成版本、配置、更新语义漂移。

### 16.2 桌面安装器写入系统 PATH

不推荐作为第一阶段。

它需要处理管理员权限、卸载清理、shell 配置差异、Windows 用户 PATH 长度、macOS shell rc 多样性。对“AI command tool 无感”不是必要条件。

### 16.3 AI command tool 特判桌面版

不推荐。

这会把安装形态细节泄漏到工具层，破坏 `nextclaw` 统一命令合同。后续 Docker、portable、系统包安装也会继续长出分支。

### 16.4 shim 写死当前 runtime script

不推荐。

桌面 bundle 更新后容易 stale，且 shell 脚本不适合承担 bundle state 解析和错误诊断职责。

## 17. 开放问题

1. `nextclaw update` 在桌面形态下第一阶段是返回明确提示，还是直接接入桌面 update check？
   - 推荐第一阶段先返回明确提示，避免把 update apply 的高风险路径塞进命令面首版。
2. 人类终端是否需要 UI 提供“一键安装 shell command”？
   - 推荐第二阶段再做，并且必须让用户明确确认，不自动改 PATH。
3. 桌面 app 移动路径后，旧 shim 何时修复？
   - 推荐桌面每次启动都重写 command surface；AI command tool 在运行中的桌面 runtime 内始终使用当前启动生成的路径。

## 18. 推荐结论

这套方案可以比较优雅地实现，因为它把变化点放在正确 owner 上：

- AI command tool 继续执行稳定的 `nextclaw ...`。
- `createExternalCommandEnv` 只增加通用 PATH 注入能力。
- 桌面安装形态自己提供 command surface。
- 桌面 bundle 更新通过 bridge 动态解析 current runtime，避免 stale shim。
- 不要求系统 Node / NPM。
- 不修改用户全局 PATH。

推荐按本方案进入实现。
