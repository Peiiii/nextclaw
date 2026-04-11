# Runtime Local Log Architecture Design

**Goal:** 为 NextClaw 主运行时建立一套轻量、本地优先、可长期维护的日志体系，让“前端打不开 / 服务崩溃 / 启动失败”这类问题在没有额外平台与上传接口的前提下，仍能通过 `NEXTCLAW_HOME` 内的日志文件被稳定定位。

**Architecture:** 采用“稳定当前日志文件 + 崩溃专用文件 + 时间戳归档文件”的组合，而不是纯单文件、纯按天切分或纯按启动切分。当前阶段明确按单主实例思路设计，不为少见的多实例场景引入额外目录与抽象；当日志达到阈值时，把旧文件归档为带时间戳的文件名，既保留稳定入口，又保留清晰的故障时间窗口。

**Tech Stack:** TypeScript、Node.js、`pino` 风格结构化日志、`NEXTCLAW_HOME` 数据目录、CLI、Desktop、现有 `@nextclaw/core` 路径工具。

---

## 背景

当前真正缺的不是“能打印日志”，而是下面这条产品能力：

1. 出故障时一定有日志文件可看；
2. 日志文件始终落在 `NEXTCLAW_HOME` 下，随主目录统一清理，不往用户系统目录四散留垃圾；
3. 用户能被明确告知去哪里找日志；
4. 日志足以排查启动失败、后台崩溃、端口冲突、连接异常，而不是只有零散 `console.*` 输出；
5. 方案不能把项目拖成一套很重的 observability 平台。

因此，本方案只覆盖 **主运行时本地日志**，不覆盖前端日志上报、不覆盖远端采集平台、不覆盖审计日志系统。

## 设计原则

1. **本地优先**
   所有主运行时日志默认写入 `NEXTCLAW_HOME/logs/`。
2. **轻量优先**
   不引入数据库、HTTP 上传接口、集中式日志平台。
3. **稳定入口优先**
   默认场景必须有固定、好记、可直接支持用户查看的日志路径。
4. **崩溃信息优先**
   fatal / uncaught exception / startup failed 必须有专用落点，不被普通噪音淹没。
5. **默认单主实例优先**
   当前阶段不为少见的多实例场景引入实例目录、owner 竞争或复杂隔离策略。
6. **可删除性优先**
   删除 `NEXTCLAW_HOME` 时，日志随主目录一起清理。

## 不采用的方案

### 方案 A：只有一个无限增长的日志文件

不采用。

原因：

- 很快变大，用户难以发送，排障体验差；
- 崩溃信息容易被普通日志淹没；
- 无法优雅处理轮转与保留；
- 长时间运行后会越来越难看，定位某次故障的时间窗口也不清晰。

### 方案 B：默认每次启动都单独一个日志文件

不采用。

原因：

- 目录会迅速堆积很多碎文件；
- 用户与支持侧很难知道“该看哪个”；
- 频繁正常重启会制造大量低价值文件；
- 实现会被迫引入更多索引、清理、展示逻辑。

### 方案 C：纯按天切文件

不采用作为主策略。

原因：

- 故障定位的边界通常是“某次启动 / 某个进程 / 某个崩溃”，不是自然日；
- 跨午夜问题会被拆散；
- 对本地桌面/CLI 产品来说，时间切分不如实例与轮转更有诊断价值。

## 推荐方案

采用 **轻量归档方案**：

1. 默认使用稳定当前文件：
   - `NEXTCLAW_HOME/logs/service.log`
   - `NEXTCLAW_HOME/logs/crash.log`
2. 达到阈值后，将旧文件移动到归档目录：
   - `NEXTCLAW_HOME/logs/archive/service-<timestamp>.log`
   - `NEXTCLAW_HOME/logs/archive/crash-<timestamp>.log`

一句话解释：

- **稳定路径** 解决“用户/开发者不知道去哪看”的问题；
- **崩溃专用文件** 解决“关键错误被日常日志淹没”的问题；
- **时间戳归档** 解决“长时间运行后文件过大、旧问题难回看”的问题。

## 文件布局

推荐目录结构：

```text
NEXTCLAW_HOME/
  logs/
    service.log
    crash.log
    archive/
      service-2026-04-11T17-32-33Z.log
      crash-2026-04-11T17-32-33Z.log
```

### 文件职责

- `service.log`
  - 主托管服务当前日志。
  - 用户报“用着用着崩了”，优先先看这个。
- `crash.log`
  - 仅记录 fatal、未捕获异常、未处理拒绝、启动失败摘要。
  - 用于快速定位“为什么直接挂掉”。
- `archive/*.log`
  - 达到轮转阈值后沉淀的历史日志。
  - 文件名带时间戳，方便人工按故障窗口回看。

## 为什么不默认按天切

成熟产品更常见的做法并不是“只按天”，而是：

- 活跃日志文件固定；
- 按大小轮转；
- 归档文件带时间戳；
- 崩溃单独落点。

对 NextClaw 这种本地 runtime 产品，真正重要的是：

- 这次启动发生了什么；
- 当前服务为什么挂；
- 最近一次 fatal 是什么。

这些都更适合 **稳定文件 + 大小轮转 + 时间戳归档**，不适合纯日期边界。

## 轮转策略

第一阶段建议非常克制：

- `service.log` 达到大小阈值后，重命名为 `archive/service-<timestamp>.log`
- `crash.log` 达到大小阈值后，重命名为 `archive/crash-<timestamp>.log`
- 新的 `service.log` / `crash.log` 立即重新创建并继续写入

推荐初始阈值：

- `service.log`: 10 MB
- `crash.log`: 5 MB

推荐保留策略：

- `archive/service-*.log` 只保留最近 7 天或最近 20 份
- `archive/crash-*.log` 只保留最近 14 天或最近 50 份
- `service.log` / `crash.log` 永远保留为当前入口文件

这样足够轻，也足够覆盖常见排障。

## 日志记录结构

所有文件都写结构化 JSON 行，避免再发明字符串协议。

推荐最小字段：

```ts
type RuntimeLogRecord = {
  ts: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  event: string;
  service: "nextclaw-runtime" | "nextclaw-desktop";
  scope: string;
  startupId: string;
  pid: number;
  release: string;
  sessionId?: string;
  requestId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  fields?: Record<string, unknown>;
};
```

重点：

- 用 `event` 查询，不靠 message 文案；
- 每条记录必须带 `startupId` 和 `pid`，即使当前阶段不做多实例隔离，也能辅助推断“这条错误属于哪次启动”；
- 敏感信息必须统一脱敏；
- `crash.log` 只收 `error` / `fatal` 级别中的高价值事件。

## CLI / Desktop 用户体验

为了让用户真能找到日志，方案必须同时补三类入口：

1. CLI
   - `nextclaw logs path`
   - `nextclaw logs tail`
2. 启动失败提示
   - 错误提示里直接打印 `NEXTCLAW_HOME/logs/...`
3. Desktop
   - 继续保留并强化 `Open Logs`
   - 打开 `NEXTCLAW_HOME/logs/` 而不是系统日志目录

这样用户和开发者都不需要猜路径。

## 最佳实践结论

从成熟桌面软件、IDE、浏览器、多进程本地服务的一般模式看，最值得借鉴的不是某个产品的具体文件名，而是这几个原则：

1. 默认有一个稳定“当前日志”入口；
2. 崩溃/致命错误单独存；
3. 用大小轮转，并让归档文件带时间戳；
4. 不把“按天切分”当主诊断策略；
5. 日志目录属于产品自己的数据目录，而不是散落到系统各处。

本方案正是沿着这条线来定的。

## 实施建议

### Phase 1

- 建立统一 runtime logger 封装
- 接 `service.log` / `crash.log`
- 增加 `startupId`
- 增加日志路径 CLI
- Desktop 打开 `NEXTCLAW_HOME/logs`

### Phase 2

- 增加 `archive/` 归档目录
- 接入大小轮转与历史清理
- 让启动失败与 fatal 明确写入 `crash.log`

### Phase 3

- 补轻量诊断导出能力
- 输出当前主日志 + crash 日志 + 最近归档摘要

## 最终决策

本次实现按以下结论推进：

1. 日志统一放在 `NEXTCLAW_HOME/logs/`
2. 不采用“只有一个文件”
3. 不采用“默认每次启动一个文件”
4. 不采用“纯按天切文件”
5. 默认使用稳定主文件：
   - `service.log`
   - `crash.log`
6. 历史日志归档为带时间戳的文件：
   - `archive/service-<timestamp>.log`
   - `archive/crash-<timestamp>.log`
7. 当前阶段不为少见的多实例场景引入额外隔离设计；如果真的混写，依赖 `startupId`、`pid` 与事件上下文辅助推断

这套组合是当前最轻、最优雅、最可维护，也最符合 NextClaw 当前问题域的方案。
