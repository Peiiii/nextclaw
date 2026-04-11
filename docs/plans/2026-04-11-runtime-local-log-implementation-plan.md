# Runtime Local Log Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 NextClaw 主运行时接入本地日志文件、崩溃日志、时间戳归档与最小 CLI 日志入口，让用户在前端不可用时仍能通过 `NEXTCLAW_HOME/logs/` 排查问题。

**Architecture:** 保持现有 `console.*` 输出与 service 启动链路不大改，在 CLI runtime 的前台服务入口安装一个很薄的文件日志镜像层，并把既有 `service.log` 路径升级为“固定当前文件 + 归档目录”的模型。后台托管启动继续围绕既有 `service.log` 合同工作，但补统一路径解析、轮转与 crash 文件支持，不引入前端、不引入上传接口、不做多实例隔离。

**Tech Stack:** TypeScript、Node.js、NextClaw CLI runtime、`@nextclaw/core` 路径工具、Vitest。

---

## 长期目标对齐 / 可维护性推进

- 这次不是做“大日志平台”，而是顺着“本地优先、主链路可诊断、删除时可统一清理”的方向补一条长期稳定的运行时能力。
- 优先删减复杂度：
  - 不做多实例隔离目录
  - 不做日志上传接口
  - 不做 tracing / metrics / dashboard
  - 不在全仓铺一层新 logger API 再强行替换所有 `console.*`
- 本次最小维护性推进点：
  - 把日志路径与归档规则收敛成单一 owner
  - 把 `service.log` 从“随手 append 的路径”提升成“有轮转、有 crash 文件、有 CLI 入口”的稳定合同

## Task 1: 收敛日志路径与归档规则

**Files:**
- Modify: `packages/nextclaw-core/src/utils/helpers.ts`
- Modify: `packages/nextclaw/src/cli/utils.ts`
- Create: `packages/nextclaw/src/cli/runtime-logging/runtime-log-manager.ts`
- Test: `packages/nextclaw/src/cli/runtime-logging/runtime-log-manager.test.ts`

**Step 1: 在 core helper 中补 logs 目录路径工具**

- 新增：
  - `getLogsPath()`
  - `getLogsArchivePath()`
- 统一基于 `NEXTCLAW_HOME` 解析，不允许 CLI 和 Desktop 自己再手拼 `logs/` 子目录。

**Step 2: 在 CLI utils 中复用新 helper**

- `resolveServiceLogPath()` 改成调用统一路径 helper。
- 同时补 `resolveCrashLogPath()`，避免路径拼接散落。

**Step 3: 新建 `RuntimeLogManager`**

- 职责只保留：
  - 解析日志路径
  - 按大小轮转到 `logs/archive/*.log`
  - 追加写入 service / crash 文件
  - 提供 tail/path 查询
- 不负责业务语义，不做全局 telemetry。

**Step 4: 用测试固定归档规则**

- 覆盖：
  - 日志目录会自动创建
  - 超过阈值时当前文件被移动到带时间戳的 `archive/`
  - 新 current 文件被重新创建
  - `crash.log` 与 `service.log` 分别独立

## Task 2: 接入运行时入口的本地文件镜像

**Files:**
- Modify: `packages/nextclaw/src/cli/runtime.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-support/runtime/service-managed-startup.ts`
- Modify: `packages/nextclaw/src/cli/commands/service.ts`
- Test: `packages/nextclaw/src/cli/commands/service-support/runtime/tests/service-managed-startup.test.ts`

**Step 1: 在 `serve/gateway/ui` 入口安装日志镜像**

- 只在主运行时入口安装，不对所有 CLI 子命令生效。
- 镜像策略：
  - 保留原始 stdout/stderr 行为
  - 同步将输出写入 `service.log`
  - `console.error` 与 fatal 事件额外写入 `crash.log`

**Step 2: 为后台托管启动补轮转**

- 在 `spawnManagedService(...)` 打开 `service.log` 前先执行轮转检查。
- 暂不在 parent 进程维持长时间 file tee；后台子进程依赖 runtime 入口内安装的文件镜像。

**Step 3: 为启动失败补 crash 记录**

- `startNewManagedServiceTarget(...)` 与启动诊断失败路径除打印控制台外，还要写 `crash.log`。
- 记录内容至少包括：
  - health probe
  - UI/API URL
  - log path
  - last probe detail

**Step 4: 为前台运行补 crash handler**

- 在日志镜像层内注册：
  - `unhandledRejection`
  - `uncaughtException`
- 只负责 best-effort 追加写入 `crash.log`，不引入复杂恢复逻辑。

## Task 3: 提供最小 CLI 日志入口

**Files:**
- Create: `packages/nextclaw/src/cli/commands/logs.ts`
- Modify: `packages/nextclaw/src/cli/runtime.ts`
- Modify: `packages/nextclaw/src/cli/index.ts`
- Modify: `packages/nextclaw/src/cli/types.ts`
- Test: `packages/nextclaw/src/cli/commands/logs.test.ts`

**Step 1: 新增 `logs path`**

- 输出：
  - `logs/` 目录
  - `service.log`
  - `crash.log`
  - `archive/`

**Step 2: 新增 `logs tail`**

- 默认 tail `service.log`
- 支持 `--crash`
- 支持 `--lines <n>`
- 当前阶段不做复杂过滤，不做 grep，不做人类格式美化

**Step 3: 让 runtime 暴露新命令**

- 只做很薄的命令转发，不把日志逻辑塞进 `CliRuntime`。

## Task 4: 更新文档、验证与留痕

**Files:**
- Modify: `packages/nextclaw/resources/USAGE.md`
- Modify: `docs/plans/2026-04-11-runtime-local-log-architecture-design.md`
- Create or Modify: `docs/logs/<iteration>/README.md`

**Step 1: 更新用户文档**

- 写清：
  - 日志目录位于 `NEXTCLAW_HOME/logs/`
  - 当前文件与归档文件的关系
  - `nextclaw logs path`
  - `nextclaw logs tail`

**Step 2: 运行最小充分验证**

- 重点验证：
  - `logs path`
  - `logs tail`
  - 轮转测试
  - 相关 TypeScript / Vitest

**Step 3: 做迭代留痕**

- 本次触达代码，收尾必须按 `docs/logs` 规则新增或更新迭代记录。

## 预期非目标

- 不做前端日志
- 不做上传接口
- 不做数据库
- 不做多实例隔离
- 不做统一 observability 平台
- 不强推全仓 `console.* -> logger.*` 替换
