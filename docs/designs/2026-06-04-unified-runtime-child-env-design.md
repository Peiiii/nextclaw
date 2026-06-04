# 统一 Runtime Child Env 实现方案

## 背景

当前 NextClaw 的 `serve` 可以由多个入口启动：

- 手动 CLI / 终端启动
- macOS LaunchAgent 自动启动
- Linux systemd 自动启动
- Windows Task Scheduler / Service 自动启动
- 桌面端嵌入 runtime 启动

这些入口启动的是同一个产品运行时，但继承的宿主环境不同。手动终端通常包含用户 shell 初始化后的 `PATH`，而 LaunchAgent / systemd / Task Scheduler 往往只有最小环境。结果是：同一个 `NEXTCLAW_HOME`、同一个配置、同一个 Service App，在手动启动时可用，自动启动后可能不可用。

本方案只解决一个核心问题：**启动入口没有统一 runtime child env**。

暂不处理：

- Service App manifest resolver
- `node` 到 `process.execPath` 的专门映射
- MCP / Service App 错误结构化
- UI 诊断页
- 读取 shell profile、nvm/asdf/fnm 探测等环境猜测

## 设计目标

1. 所有入口进入 `serve` 后，内部子进程使用同一套 runtime child env。
2. 不破坏手动启动下已经可用的工具链和 `PATH` 优先级。
3. 跨平台处理 `PATH` / `Path` / `path` 与路径分隔符。
4. 代码足够清晰，owner 明确，避免每个子进程调用点各自补环境。
5. 只做必要增强，不做过度防御。

## 非目标

- 不重建一个“理想 PATH”覆盖用户原环境。
- 不把 `/usr/local/bin`、`/opt/homebrew/bin`、nvm、asdf、fnm 等写成 runtime 通用规则。
- 不读 `.zshrc`、`.bashrc`、`.profile`。
- 不改变第三方 MCP 的标准合同：第三方 `command` 仍然要么可在 PATH 解析，要么写绝对路径。
- 不把 shell tool 的 external command env 策略直接套到 runtime 子进程。

## 1. 代码的抽象设计

### 1.1 核心职责：createRuntimeChildEnv

本方案不引入 `RuntimeChildEnvProvider` 这类 provider/class 抽象。这里没有独立生命周期、状态缓存、策略切换或多实现替换需求；一个命名明确的工具函数已经足够表达职责。

核心职责只有一个：

> 基于当前入口继承 env 里的 PATH，生成内部 runtime 子进程可使用的 append-only env 覆盖项。

这个函数的边界很窄：

- 它只处理环境对象。
- 它只补当前 Node 可执行文件所在目录。
- 它不决定哪个子进程应该启动。
- 它不解析 manifest。
- 它不做 shell / nvm / asdf / fnm 探测。

### 1.2 核心函数签名

语义：

- 从 `baseEnv` 读取 PATH 事实
- 根据调用方语义决定是否继承 `baseEnv`
- 始终合并调用方显式传入的 `extraEnv`
- 解析平台 PATH key
- 把 `dirname(execPath)` 作为必要路径补进 PATH
- 保持原有 PATH 顺序
- 缺失时追加，不前置
- MCP SDK stdio 这类“env 覆盖项”调用方不继承全量 `baseEnv`
- direct `spawn` 这类“完整 env”调用方保留既有全量 env 继承

推荐签名：

```ts
export function createRuntimeChildEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  extraEnv: NodeJS.ProcessEnv = {},
  options: {
    execPath?: string;
    inheritBaseEnv?: boolean;
  } = {},
): NodeJS.ProcessEnv;
```

调用方通过 `baseEnv` 和 `execPath` 参数做测试注入即可，不需要额外 provider。

`inheritBaseEnv` 的存在不是为了做多策略 provider，而是为了匹配两种真实 transport 语义：

- MCP SDK stdio transport 会把传入 env 与 SDK 的安全默认 env 合并，所以 Service App 只需要传 PATH 覆盖项；这样可以避免宿主 `NODE_OPTIONS` 污染 Service App 子 Node。
- NARP stdio direct `spawn` 的 `env` 是完整子进程环境，所以必须保留原来的全量 env 继承，只统一 PATH append 规则。

### 1.3 和现有 `createExternalCommandEnv` 的关系

仓库已经有：

```ts
packages/nextclaw-core/src/shared/lib/core-utils/utils/child-process-env.utils.ts
```

里面的 `createExternalCommandEnv` 用于 AI shell / external command 场景。它会收集 command surface、当前 Node bin、`node_modules/.bin`、常见 POSIX bin，并把 additions 放到 PATH 前面。

这不适合作为 runtime child env 的直接实现，因为 runtime child env 的约束更保守：

- 不改变手动启动时已有 PATH 优先级。
- 不把开发工作区 `node_modules/.bin` 注入所有内部 runtime 子进程。
- 不把常见 POSIX bin 当成产品运行合同。

因此不要直接复用 `createExternalCommandEnv`。`createExternalCommandEnv` 的职责是“外部命令执行环境”，而 `createRuntimeChildEnv` 的职责是“内部 runtime 子进程环境”。两个函数可以放在同一个 `child-process-env.utils.ts` owner 里，但必须保持两个明确入口，避免把 external command 的 PATH 前置策略误带进 runtime。

本方案最终推荐把 `createRuntimeChildEnv` 放在 `@nextclaw/core` 的 `core-utils` 中，因为 Service App MCP runtime 位于 kernel，而 NARP stdio runtime client 位于 kernel 依赖的下游 package；放在 kernel 会导致 NARP stdio 无法复用，无法真正统一。

## 2. 代码组织

推荐组织如下：

```text
packages/nextclaw-core/src/shared/lib/core-utils/utils/
  child-process-env.utils.ts

packages/nextclaw-kernel/src/services/
  mcp-service-app-runtime.service.ts

packages/nextclaw-ncp-runtime-stdio-client/src/
  stdio-runtime-config.utils.ts
```

### 2.1 工具 owner

复用并扩展 core 工具 owner：

```text
packages/nextclaw-core/src/shared/lib/core-utils/utils/child-process-env.utils.ts
```

它的职责是 Node 子进程 env 构造。该文件已有 `createExternalCommandEnv`，但 runtime 子进程必须使用独立的 `createRuntimeChildEnv` 入口，不复用 external command 的 PATH 前置和 `node_modules/.bin` 注入逻辑。

新增内容：

- `createRuntimeChildEnv`
- `RuntimeChildEnvOptions`

跨 package 使用时通过 `@nextclaw/core/child-process-env` 这个 `package.json exports` 显式公共子入口导入，避免消费者 deep import core 内部路径，也避免要求所有消费者先依赖 stale dist 根入口。

### 2.2 Runtime host 注入点

推荐优先从使用 `spawn` / MCP stdio transport 的 owner 开始接入：

1. `McpServiceAppRuntimeService`
   - 当前 `toMcpServerRecord` 里 stdio env 是 `{}`。
   - 应改为注入 runtime child env。

2. `buildStdioRuntimeLaunchEnv`
   - NARP stdio direct spawn 保留既有全量 env 继承。
   - PATH append 规则统一走 `createRuntimeChildEnv(..., { inheritBaseEnv: true })`。

3. Extension lifecycle
   - 当前 `command: "node"` 已显式转成 `process.execPath`，不是同一个 `spawn node ENOENT` 风险点。
   - 如果后续 extension 允许依赖 PATH 解析 `node` / `npx`，再接入同一个 env owner。

4. Runtime command / supervisor
   - 已有 `createTopLevelNextclawCommandEnv` 的地方，保持现状或确认是否已经满足该合同。
   - 不要为了本问题把所有 spawn 一次性大改；先覆盖 stdio runtime 子进程 owner。

### 2.3 Launch Env Owner Map

本仓库允许存在多个 env builder，但必须按职责归属，不能按调用点散补。

| Owner | 位置 | 职责 | 是否迁入 core child env |
| --- | --- | --- | --- |
| External command env | `@nextclaw/core/child-process-env` / `createExternalCommandEnv` | AI shell、CLI lookup、打开外部命令；允许 command surface、Node bin、`node_modules/.bin`、常见 POSIX bin 前置 | 已统一 |
| Runtime child env | `@nextclaw/core/child-process-env` / `createRuntimeChildEnv` | Service App、NARP stdio 等内部 runtime 子进程；只做 append-only 当前 Node bin | 已统一 |
| Desktop runtime env | `apps/desktop/src/utils/desktop-paths.utils.ts` / `createDesktopRuntimeEnv` | Electron 桌面安装态启动产品 runtime，设置 `ELECTRON_RUN_AS_NODE`、runtime home、packaged extension 等产品 env | 不迁，属于 desktop 产品安装态 owner |
| Top-level NextClaw command env | `packages/nextclaw-service/src/shared/utils/top-level-nextclaw-command-env.utils.ts` | 基于 external command env，并删除 runtime bundle child 标记，用于重启/自启动新顶层 `nextclaw` 命令 | 保留 service wrapper，底层已统一 |
| Hermes ACP bridge env | `packages/nextclaw-hermes-acp-bridge/src/hermes-acp-route-bridge.utils.ts` | Python/Hermes 专属 `PYTHONPATH` 与 bridge route 注入 | 暂不迁，属于 adapter-specific env；后续可复用 core string-env helper |
| Codex CLI env | `packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/codex-cli-env.ts` | Codex CLI 专属 `OPENAI_API_KEY` / `OPENAI_BASE_URL` 注入 | 暂不迁，属于 extension-specific env；后续可复用 core string-env helper |

判断规则：

- 只要是通用 PATH / Node child process 启动合同，应优先进入 `@nextclaw/core/child-process-env`。
- 产品安装态 env 留在对应产品 owner，例如 desktop。
- adapter / extension 专属协议 env 留在 adapter / extension，但必须有明确函数 owner，不要在 spawn 调用点临时拼对象。
- 常量如果被 core env owner 消费，例如 `NEXTCLAW_COMMAND_SURFACE_BIN`，优先由 core env owner 定义并导出；但不能为了消除重复字符串去改动不相关 package 的 module resolution 或运行边界。无法稳定引用时，产品侧可以保留局部常量，并在 owner map 中保持语义对齐。

### 2.4 不建议的组织

不建议在这些地方各自补：

- Service App manifest reader
- Panel App bridge
- Service App controller
- 单个 panel / app 的 manifest
- MCP client factory 内部直接读 `process.env`

原因：这些位置不是启动入口环境 owner。放在这里会导致补丁散落，后续仍可能出现“某类子进程修了，另一类没修”的能力漂移。

## 3. 代码大概怎么写

### 3.1 PATH key 解析

跨平台必须保留原 PATH key：

```ts
function resolvePathKey(
  primaryEnv: NodeJS.ProcessEnv,
  fallbackEnv: NodeJS.ProcessEnv,
): "PATH" | "Path" | "path" {
  for (const env of [primaryEnv, fallbackEnv]) {
    if (typeof env.PATH === "string") {
      return "PATH";
    }
    if (typeof env.Path === "string") {
      return "Path";
    }
    if (typeof env.path === "string") {
      return "path";
    }
  }
  return "PATH";
}
```

Windows 下不要强行写成 `PATH`，否则可能和既有 `Path` 并存，造成不可预测行为。

### 3.2 append-only PATH 合并

关键点：保留原顺序，只追加缺失项；是否复制整个宿主 env 由调用方 transport 语义决定。

```ts
import { delimiter, dirname } from "node:path";

function splitPathEntries(rawPath: string): string[] {
  return rawPath
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function copyStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;
}

export type RuntimeChildEnvOptions = {
  execPath?: string;
  inheritBaseEnv?: boolean;
};

export function createRuntimeChildEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  extraEnv: NodeJS.ProcessEnv = {},
  options: RuntimeChildEnvOptions = {},
): Record<string, string> {
  const env = options.inheritBaseEnv
    ? { ...copyStringEnv(baseEnv), ...copyStringEnv(extraEnv) }
    : copyStringEnv(extraEnv);
  const pathKey = resolvePathKey({ ...baseEnv, ...extraEnv });
  env[pathKey] = Array.from(new Set([
    ...splitPathEntries(baseEnv[pathKey] ?? ""),
    ...splitPathEntries(extraEnv[pathKey] ?? ""),
    dirname(options.execPath ?? process.execPath),
  ])).join(delimiter);
  return env;
}
```

这里不检查 `existsSync(nodeBinDir)` 也可以，因为 `process.execPath` 已经指向当前可执行文件，`dirname(process.execPath)` 理论上是存在的。若为了防御可读性，可以保留存在性检查，但不要加入额外猜测。

### 3.3 Service App runtime 接入

当前逻辑大概是：

```ts
private toMcpServerRecord = (
  app: ServiceAppRecord,
  manifest: ServiceAppManifest,
): McpServerRecord => ({
  name: app.id,
  definition: {
    transport: {
      type: "stdio",
      command: manifest.command,
      args: manifest.args,
      cwd: app.dirPath,
      env: {},
      stderr: "pipe",
    },
  },
});
```

推荐改成：

```ts
private toMcpServerRecord = (
  app: ServiceAppRecord,
  manifest: ServiceAppManifest,
): McpServerRecord => ({
  name: app.id,
  definition: {
    transport: {
      type: "stdio",
      command: manifest.command,
      args: manifest.args,
      cwd: app.dirPath,
      env: createRuntimeChildEnv(process.env),
      stderr: "pipe",
    },
  },
});
```

如果调用点需要额外 env，直接通过第二个参数传入：

```ts
env: createRuntimeChildEnv(process.env, manifest.env ?? {}),
```

NARP stdio direct spawn 使用完整 env 模式，以保持原有环境继承合同：

```ts
env: createRuntimeChildEnv(process.env, config.env, {
  inheritBaseEnv: true,
});
```

测试时不需要 mock provider，直接测试纯函数；Service App runtime 的单元测试可以通过构造 fake runtime env 结果或直接断言 `toMcpServerRecord` 产出的 transport env。若 `toMcpServerRecord` 目前是 private，不必为了测试它而引入新抽象，优先通过公开的 `listActions` / `invokeAction` fake lifecycle 入口验证 env 传递。

除非后续出现真实变化点，例如不同 runtime 需要不同 env 策略、env 需要缓存健康状态、或运行时需要暴露诊断快照，否则不要升级成 class/provider。

### 3.4 测试设计

最小测试应覆盖：

1. POSIX minimal PATH

```ts
const env = createRuntimeChildEnv(
  { PATH: "/usr/bin:/bin" },
  {},
  { execPath: "/Users/alice/.nvm/versions/node/v22.16.0/bin/node" },
);

expect(env.PATH?.split(":")).toEqual([
  "/usr/bin",
  "/bin",
  "/Users/alice/.nvm/versions/node/v22.16.0/bin",
]);
```

2. 手动启动 PATH 不重排

```ts
const env = createRuntimeChildEnv(
  { PATH: "/opt/homebrew/bin:/usr/bin:/bin" },
  {},
  { execPath: "/Users/alice/.nvm/versions/node/v22.16.0/bin/node" },
);

expect(env.PATH?.split(":").slice(0, 3)).toEqual([
  "/opt/homebrew/bin",
  "/usr/bin",
  "/bin",
]);
```

3. 已存在时不重复追加

```ts
const env = createRuntimeChildEnv(
  { PATH: "/Users/alice/.nvm/versions/node/v22.16.0/bin:/usr/bin" },
  {},
  { execPath: "/Users/alice/.nvm/versions/node/v22.16.0/bin/node" },
);

expect(env.PATH?.split(":")).toEqual([
  "/Users/alice/.nvm/versions/node/v22.16.0/bin",
  "/usr/bin",
]);
```

4. Windows `Path` key

```ts
const env = createRuntimeChildEnv(
  { Path: "C:\\Windows\\System32" },
  {},
  { execPath: "C:\\Users\\alice\\AppData\\Local\\Programs\\nodejs\\node.exe" },
);

expect(env.PATH).toBeUndefined();
expect(env.Path).toContain("C:\\Windows\\System32");
expect(env.Path).toContain("C:\\Users\\alice\\AppData\\Local\\Programs\\nodejs");
```

5. `extraEnv` 可显式增加变量，但 `baseEnv` 的非 PATH 变量不会被整包继承

```ts
const env = createRuntimeChildEnv(
  { PATH: "/usr/bin", KEEP: "base" },
  { KEEP: "extra", NEXTCLAW_HOME: "/tmp/home" },
);

expect(env.KEEP).toBe("extra");
expect(env.NEXTCLAW_HOME).toBe("/tmp/home");
expect(env.PATH?.split(":")).toEqual([
  "/usr/bin",
  "/Users/alice/.nvm/versions/node/v22.16.0/bin",
]);
```

6. 不继承宿主 `NODE_OPTIONS`

```ts
const env = createRuntimeChildEnv({
  NODE_OPTIONS: "--require=/tmp/missing-hook.cjs",
  PATH: "/usr/bin:/bin",
});

expect(env.NODE_OPTIONS).toBeUndefined();
```

7. Service App runtime 使用 enhanced env

用 minimal PATH 和会破坏子 Node 的宿主 `NODE_OPTIONS` 构造真实 Service App manager 测试，断言 `command: "node"` 的 MCP Service App 仍能启动并返回工具结果。

### 3.5 验收方式

本改动完成后，至少验收：

1. 手动启动 `nextclaw serve` 后，原 PATH 既有顺序不被重排。
2. LaunchAgent / minimal env 场景下，Service App `command: "node"` 能启动。
3. Windows 测试确认 `Path` key 不被错误改成 `PATH`。
4. `McpServiceAppRuntimeService` 不再传空 env 给 stdio MCP transport。
5. `buildStdioRuntimeLaunchEnv` 在 direct spawn 场景保留既有 base env，同时补齐当前 Node bin。
6. 宿主 `NODE_OPTIONS` 不会污染 Service App 子 Node。
7. 不新增 shell profile 读取、不新增 nvm/asdf/fnm 探测。

## 推荐实施顺序

1. 在 `packages/nextclaw-core/src/shared/lib/core-utils/utils/child-process-env.utils.ts` 增加 append-only 的 `createRuntimeChildEnv`。
2. 补齐 core 跨平台单元测试。
3. 在 `McpServiceAppRuntimeService` 接入该 env。
4. 在 `buildStdioRuntimeLaunchEnv` 接入该 env，并保持 direct spawn 既有全量 env 继承。
5. 只在确认 extension lifecycle 有同类裸 env / 空 env 问题时再接入，不要一次性扩大改动面。
6. 用 minimal PATH 的定向测试验证 `skill-scanner` 类 Service App 能启动。

## 取舍结论

推荐方案是 **append-only runtime child env**。

它比“让 LaunchAgent 写更完整 PATH”更可靠，因为同一问题也会出现在 systemd / Windows Task / 桌面 runtime。它也比“把 `node` 特判成 `process.execPath`”更通用，因为它先修复入口环境漂移这个主问题，不改变 manifest 合同。

本阶段不要引入更大 resolver 或诊断系统。先保证同一个 NextClaw 从不同启动入口进入后，内部子进程看到的基础环境尽可能一致，同时不破坏手动启动已经工作的环境。
