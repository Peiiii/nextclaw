# v0.15.94-runtime-local-log-foundation

## 迭代完成说明

- 为 NextClaw CLI/runtime 增加一套本地优先、轻量、低侵入的运行时日志基础能力，统一落在 `${NEXTCLAW_HOME}/logs/` 下，删除主目录时可一并清理，不向系统目录额外散落文件。
- 本次没有引入上传接口、前端日志页、多实例隔离或重量级日志平台，只补当前最需要的本地排障链路：
  - `service.log`：当前运行期日志
  - `crash.log`：启动失败、fatal、未捕获异常
  - `archive/*.log`：超阈值后自动归档的历史日志
- 新增 [`RuntimeLogManager`](../../../packages/nextclaw/src/cli/runtime-logging/runtime-log-manager.ts)，把日志目录准备、当前文件初始化、按大小轮转、行格式、console mirror、`uncaughtExceptionMonitor` crash 捕获收口到一个薄 owner class 中。
- `nextclaw service/serve/start` 主链路已接入该 manager：
  - 前台 `serve` 进程会把 `console.debug/info/log/warn/error` 镜像到 `service.log`
  - `console.error` 与未捕获异常会进入 `crash.log`
  - 后台 `start` 不再把 child stdout/stderr 直接重定向到单文件，而是由服务进程内部自行落日志，避免双写与职责分散
- 新增 CLI 排障命令：
  - `nextclaw logs path`
  - `nextclaw logs tail`
  - `nextclaw logs tail --crash`
- 补充文档：
  - [`Runtime Local Log Architecture Design`](../../plans/2026-04-11-runtime-local-log-architecture-design.md)
  - [`Runtime Local Log Implementation Plan`](../../plans/2026-04-11-runtime-local-log-implementation-plan.md)
  - [`docs/USAGE.md`](../../USAGE.md)
  - [`packages/nextclaw/resources/USAGE.md`](../../../packages/nextclaw/resources/USAGE.md)

## 测试/验证/验收方式

- 已执行：`pnpm -C packages/nextclaw exec vitest run src/cli/runtime-logging/runtime-log-manager.test.ts src/cli/commands/logs.test.ts src/cli/commands/service-support/runtime/tests/service-managed-startup.test.ts`
  - 结果：通过，`3` 个测试文件、`5` 个测试全部通过。
- 已执行：`pnpm -C packages/nextclaw exec eslint src/cli/runtime-logging/runtime-log-manager.ts src/cli/runtime-logging/runtime-log-manager.test.ts src/cli/commands/logs.ts src/cli/commands/logs.test.ts src/cli/runtime.ts src/cli/commands/service.ts src/cli/commands/service-support/runtime/service-managed-startup.ts src/cli/utils.ts src/cli/types.ts src/cli/index.ts`
  - 结果：无 error；仅保留仓库既有 warning，包括 `prefer-top-level-context-destructuring` 与 `max-depth`，不属于本次新增问题。
- 已执行：`pnpm -C packages/nextclaw exec tsc -p tsconfig.json --noEmit`
  - 结果：未通过。
  - 阻塞原因：仓库既有无关错误位于 `packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts:230` 与 `packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts:238`，为 `Set<string | undefined>` 不能赋给 `Set<string>`。
- 已执行：`pnpm -C packages/nextclaw exec tsx src/cli/index.ts logs path`
  - 结果：通过，能直接输出 `Logs directory / Service log / Crash log / Archive` 四个本地路径。
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：当前仓库入口命令不存在，`pnpm` 返回 `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` 与 `Command "lint:maintainability:guard" not found`；本次改动未能通过该统一入口完成守卫，只能以定向测试、定向 eslint 与独立 maintainability review 作为收尾验证。

## 发布/部署方式

- 本次不涉及数据库、远端服务配置或迁移脚本。
- 若后续发布，按正常 `nextclaw` CLI/服务端构建链路打包即可；日志目录会在运行时按需创建，无需额外初始化步骤。
- 若已有后台服务在运行，发布新版本后重启 `nextclaw serve` 或重新执行 `nextclaw start` 即可让新的日志链路生效。

## 用户/产品视角的验收步骤

1. 启动服务：执行 `nextclaw serve` 或 `nextclaw start`。
2. 确认路径：执行 `nextclaw logs path`，检查输出里包含 `service.log`、`crash.log` 与 `archive` 目录。
3. 触发正常日志：访问一次服务或执行一次常规操作，再运行 `nextclaw logs tail`，确认能看到最新运行日志。
4. 触发错误日志：制造一个启动失败或运行时错误，再执行 `nextclaw logs tail --crash`，确认能看到 crash/fatal 记录。
5. 若持续运行并让日志超过阈值，检查 `${NEXTCLAW_HOME}/logs/archive/` 下是否出现带时间戳的归档文件。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次没有引入日志平台、上传链路、前端展示或多实例管理，而是只在 CLI/runtime 主链路内补足本地排障闭环，并把日志职责收口到单一 owner class。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。实现上删除了后台服务通过父进程文件描述符重定向 stdout/stderr 的旧做法，改为服务进程内部自主管理日志；同时没有新增额外 daemon、数据库或配置层。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。本次为新增能力，总代码与文件数有净增长，但增长被压在一个新的薄目录 `runtime-logging/` 与一个轻量命令文件内，没有继续把复杂度堆进已有 `service.ts` 热点；同时顺手减少了启动阶段日志写入对默认路径的隐式依赖。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`RuntimeLogManager` 只负责日志文件生命周期与运行时镜像，不接入上传、聚合、查询平台；`LogsCommands` 只负责用户查看入口；`ServiceCommands` 只负责在启动节点调用，不再亲自拼装多套文件写逻辑。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次新增目录仅有 `packages/nextclaw/src/cli/runtime-logging/`，职责明确；未触达前端，也未把日志能力扩散到多个 feature root。仍需关注的是 `service.ts` 本身历史上较大，但这次新增逻辑已尽量外移，没有继续把其推向更重的 orchestrator。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。以下结论基于实现完成后的独立复核，而不是只复述 lint/test 输出。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次改动顺着 NextClaw 作为统一入口、统一运行时体验的方向推进了一小步。用户不需要先猜“日志在哪、还能不能看”，而是可以通过统一 CLI 命令和统一目录快速定位故障。
- 这次没有把排障能力做成一个独立系统，而是以内聚的 runtime owner class 把“可观察性最小闭环”补齐，符合“统一入口、能力编排、不过度堆功能”的产品方向。
- 下一步若继续扩展，优先考虑在现有 `RuntimeLogManager` 上增加轻量 retention 配置或诊断导出，而不是引入第二套日志管线。

代码增减报告：
- 新增：978 行
- 删除：10 行
- 净增：+968 行

非测试代码增减报告：
- 新增：871 行
- 删除：10 行
- 净增：+861 行

可维护性总结：
- no maintainability findings
- 这次实现虽然是新增能力，但抽象保持得足够薄，主要复杂度被限制在日志 owner 内，没有向前端、接口层或更多运行时入口扩散。保留的债务主要是仓库统一 maintainability guard 入口当前不可用，以及 `service.ts` 仍是历史热点文件；本次已经尽量把新增代码外移，并把剩余增长压到最小必要范围。
