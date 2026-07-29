---
name: codex-narp-runtime
description: 当用户希望把 Codex 或 Codex CLI/SDK 作为 NextClaw 正式会话类型接入，或要求安装、更新/升级 Codex NARP runtime、修复、doctor、排查版本或真实冒烟时使用。
metadata: {"nextclaw":{"emoji":"C"}}
---

# Codex NARP Runtime

使用这个 skill 时，目标不是让用户自己准备 PATH 或手改配置，而是把 Codex 接成 NextClaw 统一 runtime registry 里的正式会话类型。

首选产品路径固定为：

- runtime entry id: `codex`
- runtime entry label: `Codex`
- runtime type: `narp-stdio`
- wire dialect: `acp`
- runtime launcher: `nextclaw-codex-narp`
- route ownership: `NextClaw -> RuntimeRoute(model/apiBase/apiKey/headers) -> Codex NARP wrapper -> Codex SDK/CLI`

不要把 Codex 做成核心系统里的 provider 特判。NextClaw 核心、kernel、service 只感知 `narp-stdio`，不感知 `codex`。

## 安装边界

始终区分三层：

- 这个 NextClaw marketplace skill：负责用户接入流程、检查、修复和冒烟。
- Codex NARP wrapper：`@nextclaw/nextclaw-narp-runtime-codex-sdk`，提供 `nextclaw-codex-narp`。
- Codex SDK/CLI：由 wrapper 调用，真实执行 agent loop。

安装这个 skill 不等于 Codex runtime 已经可用。skill 必须自己检测 launcher，缺失时安装或修复 wrapper，并生成 NextClaw 可稳定调用的绝对路径 shim。

## 这个 Skill 负责什么

- 解释 Codex 通过 NARP stdio 接入的正确心智模型。
- 发现、安装、显式更新或修复 `nextclaw-codex-narp`。
- 在 `${NEXTCLAW_HOME:-~/.nextclaw}/bin` 下生成稳定 shim。
- 写入或修复 `agents.runtimes.entries.codex`。
- 运行 runtime probe。
- 运行真实 Codex 首条消息冒烟；需要能力验收时继续覆盖工具调用和思考事件。
- 对常见失败给出有界诊断，不把问题推给用户自己猜。

## 禁止事项

- 不要告诉用户“先把 `nextclaw-codex-narp` 放到 PATH 里”作为完成条件。
- 不要要求用户手工编辑 `config.json`，除非当前 agent 没有文件写权限。
- 不要修改通用 NARP stdio client 来识别 Codex。
- 不要在 core/kernel/service 注入 Codex 默认 entry 或 provider 分支。
- 用户没有明确要求“更新”“升级”或指定目标版本时，不要查询最新版或改动一个已经可用的 wrapper。
- 显式更新不能用“现有 launcher 能运行”或“源码仓库里有 dist”代替版本升级。
- 没有 probe 和真实模型回复时，不要声称已经完成接入。

## Setup 流程

当用户要求“接入 Codex”“安装 Codex runtime”“doctor Codex runtime”或类似目标时，按下面顺序执行。

### 1. 确认工作目录和数据目录

先确定 NextClaw 数据目录：

```bash
NEXTCLAW_HOME="${NEXTCLAW_HOME:-$HOME/.nextclaw}"
```

需要写入：

- `$NEXTCLAW_HOME/bin/nextclaw-codex-narp`
- `$NEXTCLAW_HOME/config.json`

如果这是首次接入，先说明 Codex runtime 会读取本机工作区并可能执行本地工具；涉及删除、发送、提交、发布等外部可见动作时仍需用户确认。

### 2. 解析可用 launcher

按优先级解析真实 launcher：

1. 如果当前在 NextClaw 源码仓库，并且存在已构建文件：
   `packages/extensions/nextclaw-narp-runtime-codex-sdk/dist/controllers/codex-narp.controller.js`
2. 如果源码存在但 dist 不存在，先构建：
   `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk build`
3. 如果系统已有 `nextclaw-codex-narp`，可作为真实 launcher 来源。
4. 否则安装 wrapper 包到 NextClaw 管理目录：

```bash
mkdir -p "$NEXTCLAW_HOME/runtime/codex-narp-runtime"
npm install --prefix "$NEXTCLAW_HOME/runtime/codex-narp-runtime" @nextclaw/nextclaw-narp-runtime-codex-sdk@latest
```

安装后解析：

```bash
"$NEXTCLAW_HOME/runtime/codex-narp-runtime/node_modules/.bin/nextclaw-codex-narp" --help
```

解析系统 launcher 时必须解析真实路径，并排除 `$NEXTCLAW_HOME/bin/nextclaw-codex-narp` 自身，禁止生成指回自己的递归 shim。

如果包未发布、npm 不可用或安装失败，报告具体 blocker。不要退化成要求用户手动放 PATH。

### 3. 生成稳定 shim

把 runtime entry 的 `command` 固定成绝对 shim 路径，而不是裸命令名。

Unix shim 内容形态：

```sh
#!/usr/bin/env sh
exec "/absolute/path/to/nextclaw-codex-narp-or-js" "$@"
```

如果真实 launcher 是 `.js` 文件或没有执行位，则 shim 应改为：

```sh
#!/usr/bin/env sh
exec node "/absolute/path/to/codex-narp.controller.js" "$@"
```

写入后执行：

```bash
chmod +x "$NEXTCLAW_HOME/bin/nextclaw-codex-narp"
```

### 4. 写入 runtime entry

用 JSON parser 读写 `$NEXTCLAW_HOME/config.json`，保留现有配置，只补齐或修复 `agents.runtimes.entries.codex`：

```json
{
  "enabled": true,
  "label": "Codex",
  "icon": {
    "kind": "image",
    "src": "app://runtime-icons/codex-openai.svg",
    "alt": "Codex"
  },
  "type": "narp-stdio",
  "config": {
    "wireDialect": "acp",
    "processScope": "per-session",
    "command": "/absolute/NEXTCLAW_HOME/bin/nextclaw-codex-narp",
    "args": [],
    "env": {},
    "startupTimeoutMs": 10000,
    "probeTimeoutMs": 3000,
    "requestTimeoutMs": 120000
  }
}
```

不要把 provider route、api key、model 写进 runtime entry。模型和 provider 仍由 NextClaw 的 provider/route 配置决定。

### 5. Probe 和真实冒烟

接入完成必须同时满足：

1. `agents.runtimes.entries.codex.type` 是 `narp-stdio`。
2. `wireDialect` 是 `acp`。
3. `command` 是可执行的绝对 shim 路径。
4. NextClaw runtime probe 能看到 `Codex` ready。
5. 真实模型首条消息能通过 Codex NARP 链路返回。

开发仓库里优先使用已有 smoke 脚本或 NCP chat smoke；不在源码仓库时，使用当前 NextClaw 实例或 CLI 能提供的最近真实会话路径。验证不是看配置文件长得对，而是看真实会话返回。

能力验收至少分三档：

- 文本：要求模型回复固定 marker。
- 工具：要求执行一个安全、可控的本地命令，并确认有 tool-call start/result。
- 思考：启用对应模型的 thinking/reasoning 参数，确认 NCP stream 有非空 reasoning。

如果用户说“跑通”或“完成”，默认至少跑文本；如果用户明确要求工具/思考或这是 agent runtime 新接入，必须覆盖“思考 + 工具 + 最终文本”的同轮冒烟。

## 显式更新流程

只在用户明确提出“更新/升级 Codex runtime”“更新到最新版”或指定 wrapper 版本时进入本流程。普通接入、启动、doctor 和故障排查不得顺带升级。

这里的更新对象是 `@nextclaw/nextclaw-narp-runtime-codex-sdk` 及其 NPM 依赖闭包，不是重新安装 NextClaw，也不是擅自更新系统全局 Codex CLI。

1. 读取当前 shim 的真实目标和对应 package version；不能用 `--help` 成功代替版本识别。
2. 用户指定版本时以该版本为目标；用户要求最新版时，通过 `npm view @nextclaw/nextclaw-narp-runtime-codex-sdk@latest version` 查询目标，并校验返回值是合法 semver。
3. 无论当前是否存在全局 launcher 或源码 dist，都把目标发布版本安装到 NextClaw 管理的独立版本目录：

```bash
CODEX_NARP_PACKAGE="@nextclaw/nextclaw-narp-runtime-codex-sdk"
CODEX_NARP_TARGET_VERSION="<validated-target-version>"
CODEX_NARP_RELEASE_DIR="$NEXTCLAW_HOME/runtime/codex-narp-runtime/releases/$CODEX_NARP_TARGET_VERSION"
npm install --prefix "$CODEX_NARP_RELEASE_DIR" "$CODEX_NARP_PACKAGE@$CODEX_NARP_TARGET_VERSION"
```

4. 切换前验证安装目录里的 wrapper package version 与目标完全相等，并对该目录的 `node_modules/.bin/nextclaw-codex-narp` 执行 `--help`。同时记录实际安装的 `@nextclaw/nextclaw-ncp-runtime-codex-sdk` 版本，确认依赖闭包已经落盘。
5. 只有上述验证通过后，才把稳定 shim 原子替换为指向这个版本目录；保留原 shim 目标和旧安装，不要先删除可工作的版本。runtime entry 仍只指向 `$NEXTCLAW_HOME/bin/nextclaw-codex-narp`。
6. `processScope` 是 `per-session`，已运行的子进程不会热替换。不要擅自中断现有会话；通过新建 Codex 会话启动新进程，完成 runtime probe 和真实回复冒烟。
7. 最终报告 `原版本 -> 目标版本`、shim 真实目标、probe 与冒烟结果。只有最终 package version 等于目标版本，才能说“更新完成”。

如果当前已经是目标版本但 shim 仍指向全局安装或源码 dist，仍要安装/复用受管版本目录并切换 shim；只有“版本相等 + shim 已指向该受管版本 + 验证通过”时才可以跳过安装。

任何查询、安装或切换前验证失败，都必须保留原 shim，不得报告更新成功。可以明确报告“旧版本仍可用，更新失败在第 N 步”，但不要自动回退到全局 launcher、源码 dist 或另一个版本。

## Doctor

当用户要求 doctor 或报错时，按顺序检查：

1. `$NEXTCLAW_HOME/config.json` 是否存在且 JSON 可解析。
2. `agents.runtimes.entries.codex` 是否存在、enabled 是否为 true。
3. `type`、`wireDialect`、`processScope` 是否符合合同。
4. `command` 是否是绝对路径、文件是否存在且可执行。
5. shim 指向的真实 launcher 是否存在，`--help` 是否能启动。
6. NextClaw runtime list/probe 是否显示 Codex ready。
7. provider route 是否能解析出模型、apiBase、apiKey、headers。
8. 真实 Codex NARP 会话是否能回复。

根据第一个失败点修复。不要在下游事件层伪造成功。

Doctor 可以报告当前 wrapper 版本；除非用户同时明确要求更新，否则不要查询最新版或安装新版本。发现已知版本问题时先建议更新并等待用户确认。

## 常见问题

- `command_missing`：重新生成 shim；如果真实 launcher 缺失，安装 wrapper 包。
- 用户要求更新但版本未变化：检查是否错误复用了全局 launcher、源码 dist 或稳定 shim 自身；按“显式更新流程”重新解析目标版本和受管安装目录。
- npm 安装失败或包未发布：说明这是 wrapper 分发 blocker，给出当前源码构建方案或等待发布，不要说接入已完成。
- provider 鉴权失败：修复 NextClaw provider/route 配置，不要改 runtime entry。
- 只有文本没有 reasoning：先做 provider 直连、bridge 直测、Codex raw event 三段对照，再判断是 provider 参数、bridge 字段形状还是 Codex SDK/CLI 暴露问题。
- vendored Codex binary 被 SIGKILL：优先升级 wrapper 依赖的 Codex SDK/CLI；若本机全局 codex 可用，仍要定位 vendored binary 版本、架构、签名或运行权限差异。

## 移除

删除 runtime entry、shim 或 wrapper 安装目录属于破坏性配置变更。除非用户明确要求“移除 Codex runtime”，否则只做 disable/repair，不删除文件。

## 完成标准

只有在以下条件全部满足后，才能说 Codex NARP runtime 已可用：

- `Codex` 是统一 runtime registry 里的正式 session type。
- runtime entry 只通过 `narp-stdio(acp)` 接入。
- launcher 不依赖用户手动 PATH，而是 NextClaw 管理的绝对 shim。
- 真实模型回复通过。
- 如本次目标包含工具或思考，则对应真实冒烟也通过。
- 如本次目标是更新，最终 wrapper version 必须等于目标版本，稳定 shim 必须指向对应受管版本目录，并使用新启动的 per-session 进程完成验证。
