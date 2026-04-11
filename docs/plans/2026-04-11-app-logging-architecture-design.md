# App Logging Architecture Design

**Goal:** 为 NextClaw 建立一套轻量、长期可维护、跨模块可复用的应用级日志方案，让服务崩溃、启动失败、运行异常都能稳定落到 `NEXTCLAW_HOME/logs/`，同时不把日志能力错误地绑死在 CLI 包里。

**Architecture:** 采用 `@nextclaw/core` 提供通用 `logging` 模块、`packages/nextclaw` 负责 CLI 宿主接入的分层设计。日志核心抽象统一命名为 `AppLogger`，本地文件落盘由 `FileLogSink` 承担，进程启动阶段的日志初始化由 `LoggingRuntime` 承担，CLI 只负责调用和暴露 `logs` 命令，不拥有日志系统本身。

**Tech Stack:** TypeScript、Node.js、`@nextclaw/core`、`NEXTCLAW_HOME` 数据目录、CLI Runtime、Vitest。

---

## 为什么要重做

上一版思路的核心问题不是“有没有日志文件”，而是“日志 owner 放错层了”。

如果把日志 owner 放在 `packages/nextclaw` 的 CLI 包里，会直接带来两个结构性问题：

1. 其它模块无法正当复用
   `nextclaw-server`、`nextclaw-remote`、未来更多 runtime 模块，不应该反向依赖 CLI 壳层才能写日志。
2. “写日志”和“看日志”被混成一件事
   写日志是基础运行时能力；看日志才是 CLI 用户入口。两者需要分层，而不是揉进同一个包。

因此，这次方案的第一优先级不是补更多功能，而是把边界放对。

## 设计目标

这次方案只追求四件事：

1. 任何模块都能通过同一个 `AppLogger` 抽象写日志。
2. 所有本地日志统一落在 `NEXTCLAW_HOME/logs/`。
3. 用户可以通过 CLI 快速找到并查看日志。
4. 抽象足够薄，后面能扩展，但现在不做成重型系统。

## 明确不做什么

当前阶段明确不做：

- 不叫 `observability`
- 不做 metrics / tracing / dashboard
- 不做日志上传接口
- 不做前端日志页
- 不做多实例隔离
- 不强推全仓一次性把所有 `console.*` 全部替换完
- 不让下层模块依赖 CLI 包

一句话：现在做的是 `app logging`，不是“大而全可观测性平台”。

## 正式命名

为避免词义漂移，这次统一采用下面这组名字：

- 模块目录名：`logging`
- 主抽象：`AppLogger`
- 本地文件落盘：`FileLogSink`
- 进程级日志初始化：`LoggingRuntime`
- CLI 查看入口：`logs` commands

明确不再使用：

- `observability`
- `RuntimeLogManager`
- 容易误导的“全局安装”

“全局安装”这个词不准确。这里真正发生的事情只是：

- 在 `nextclaw serve` 这样的进程启动时，
- 做一次进程级日志初始化，
- 让当前进程后续的日志有统一出口。

所以后续统一叫“进程级日志初始化”或 `LoggingRuntime`。

## 正确的分层

推荐分为三层。

### 第一层：`@nextclaw/core` 的日志抽象层

这一层负责给所有模块提供统一写日志的能力。

它应该回答的问题是：

- 怎么获取 logger
- logger 长什么样
- 日志记录字段最小合同是什么
- scope、level、startupId、pid 怎么统一表达

它不应该关心：

- CLI 命令
- 终端展示
- 具体是哪个进程入口装配的

### 第二层：`@nextclaw/core` 的本地文件 sink 层

这一层负责本地文件落盘。

它应该回答的问题是：

- 日志写到哪里
- `service.log` / `crash.log` 怎么分流
- `archive/` 怎么轮转
- 如何读取 path / tail

它不应该关心：

- commander 命令定义
- CLI 输出文案
- 具体哪个业务模块调用它

### 第三层：`packages/nextclaw` 的 CLI 宿主层

这一层只负责两件事：

1. 在服务进程入口初始化日志运行时
2. 暴露 `nextclaw logs path` / `nextclaw logs tail`

它不拥有日志系统本身。

所以正确关系是：

- `core/logging` 提供“能写”
- `nextclaw/cli` 提供“能看”和“在进程入口接起来”

## 推荐目录结构

日志核心应该放在 `@nextclaw/core`，目录建议如下：

```text
packages/nextclaw-core/src/
  logging/
    app-logger.ts
    file-log-sink.ts
    logging-runtime.ts
    index.ts
```

CLI 层只保留非常薄的接入点：

```text
packages/nextclaw/src/cli/
  commands/
    logs.ts
  logging/
    logging-bootstrap.ts
```

如果后面发现 `logging-bootstrap.ts` 过薄，也可以不单独建目录，直接在 service/runtime 入口里调用 `@nextclaw/core/logging`。

## 每个文件的职责

### `app-logger.ts`

职责：

- 定义 `AppLogger`
- 定义 `AppLogLevel`
- 定义 `AppLogRecord`
- 定义 `getAppLogger(scope)`
- 定义 `createChildLogger(...)` 这类作用域扩展能力

建议这里对外暴露的 API 保持很小，例如：

```ts
type AppLogger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
  child: (scope: string) => AppLogger;
};
```

关键点：

- 对调用方暴露 message-first、接近 `console.*` 的使用方式，迁移 `console.log(...)` 成本更低
- 若最后一个参数是普通对象，可自动收为结构化 `context`
- 若最后一个参数是 `Error`，可自动收为结构化 `error`
- `scope` 是结构化字段，不是 message 前缀技巧

### `file-log-sink.ts`

职责：

- 解析日志目录与文件路径
- 创建 `logs/` 与 `archive/`
- 管理 `service.log` / `crash.log`
- 按大小轮转
- 提供 `tail()` / `getPaths()`
- 只做本地文件写入，不做业务判断

建议这里把当前文件布局固定为：

```text
NEXTCLAW_HOME/
  logs/
    service.log
    crash.log
    archive/
      service-2026-04-11T17-32-33Z.log
      crash-2026-04-11T17-32-33Z.log
```

### `logging-runtime.ts`

职责：

- 初始化当前进程的日志环境
- 生成 `startupId`
- 把 `AppLogger` 与 `FileLogSink` 绑起来
- 可选接入 `console.*` 镜像
- 可选接入 `uncaughtExceptionMonitor`

这层的定位是 runtime bootstrap，不是用户 API。

所以它更像：

```ts
configureAppLogging(...)
installConsoleMirror(...)
installProcessCrashMonitor(...)
getAppLogPaths()
```

### `commands/logs.ts`

职责非常简单：

- `nextclaw logs path`
- `nextclaw logs tail`
- `nextclaw logs tail --crash`

它只调用 core 的 logging 能力，不拥有任何底层文件逻辑。

## 依赖方向

这是这次最重要的一条。

正确依赖方向必须是：

```text
nextclaw-server / nextclaw-remote / nextclaw / future modules
                  ↓
            @nextclaw/core/logging
                  ↑
        CLI 只是一个 host，不是 owner
```

错误方向是：

```text
other modules -> packages/nextclaw/cli/logging
```

这条必须避免。

## 日志文件策略

本地文件策略保持克制，不因为抽象升级而变重。

### 当前文件

- `service.log`
  当前运行期主日志
- `crash.log`
  启动失败、fatal、未捕获异常

### 历史文件

- `archive/service-<timestamp>.log`
- `archive/crash-<timestamp>.log`

### 不采用的策略

- 不只保留一个无限增长文件
- 不默认每次启动一个独立文件
- 不纯按天切文件

### 原因

最佳实践不是“按天”本身，而是：

- 当前入口稳定
- 历史归档可回看
- 崩溃单独可查

这对本地桌面/CLI 产品更实用。

## 建议的最小记录结构

当前阶段不必做得很花，但至少保证结构化。

```ts
type AppLogRecord = {
  ts: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  scope: string;
  message: string;
  startupId: string;
  pid: number;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};
```

这已经足够支撑：

- 按 scope 排查
- 按 startupId 排查
- 混写场景下辅助推断
- 后续扩展而不推翻格式

## 典型使用方式

以后任何模块写日志，都应该类似这样：

```ts
import { getAppLogger } from "@nextclaw/core";

const logger = getAppLogger("remote.connector");

logger.info("remote connection started", { endpoint });
logger.error("remote connection failed", { endpoint, code: "ECONNREFUSED" });
```

这意味着调用方：

- 不依赖 CLI
- 不知道日志文件路径
- 不知道归档细节
- 不需要自己判断该写 `service.log` 还是 `crash.log`
- 不需要每条日志手动传 `event`

这些都由 logging 模块统一处理。

## CLI 入口该做什么

CLI 层要做的事情非常有限。

### 在服务入口初始化

例如：

- `nextclaw serve`
- 后台 service 子进程启动入口

在这里做一次：

- 初始化 `LoggingRuntime`
- 初始化本地文件 sink
- 按需要安装 console mirror / crash monitor

### 在命令层提供查看能力

例如：

- `nextclaw logs path`
- `nextclaw logs tail`

用户排障只需要记住 CLI，不需要自己去猜隐藏目录。

## 为什么不用 `observability`

不是说这个词永远不能用，而是现阶段没必要。

因为现在我们做的能力边界非常明确：

- 应用日志
- 本地文件落盘
- CLI 查看入口

这就是 `logging`，不是完整 `observability`。

如果现在就用 `observability`，名字会比能力大，后面很容易把 metrics、trace、event、diagnostics 全往里塞，反而破坏可维护性。

所以当前阶段最合适的名字就是 `logging`。

## 实施上的迁移原则

等真正开始改代码时，建议按下面原则推进：

1. 先把日志核心迁到 `@nextclaw/core/logging`
2. 再让 CLI 改成只调用 core
3. 再逐步把少量现有 ad-hoc logger 迁到 `AppLogger`
4. 不做全仓一次性替换

也就是说：

- 先把 owner 放对
- 再慢慢扩大使用面

而不是一开始就搞一场全仓日志重写

## 最终决策

本次方案确认如下：

1. 不使用 `observability` 作为模块名
2. 统一使用 `logging` 作为目录与能力命名
3. 主抽象统一命名为 `AppLogger`
4. 日志核心放在 `packages/nextclaw-core/src/logging/`
5. `packages/nextclaw` 只负责 CLI 宿主接入与 `logs` 命令
6. 日志文件继续统一落在 `NEXTCLAW_HOME/logs/`
7. 继续采用：
   - `service.log`
   - `crash.log`
   - `archive/*.log`
8. 当前阶段仍然坚持轻量化：
   - 不做前端
   - 不做上传
   - 不做多实例隔离
   - 不做重型平台

这条线既保住了你要的“合理抽象、长期可维护、模块边界正确”，也没有把系统做重。
