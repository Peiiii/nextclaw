# 迭代完成说明

- 删除 `Heartbeat` 作为独立产品/runtime 概念，统一收口到 `cron + session binding + skill`。
- 删除了独立的 `HeartbeatService`、gateway heartbeat wiring、启动日志、专用 handler、`HEARTBEAT_OK` ack 规则，以及 `HEARTBEAT.md` 模板与 bootstrap/config 特例。
- `cron` 保持为唯一后台自动化调度主路径，继续承接定时执行能力；会话连续性则统一通过已有的 `sessionId` 绑定能力表达。
- 新增一个很薄的 [`automation-setup` skill](../../../packages/nextclaw-core/src/agent/skills/automation-setup/SKILL.md)，只负责把“稍后提醒我 / 定期跟进 / 继续这个会话”这类自然语言需求翻译成 `cron` 配置，不新增第二套调度器。
- 同时增强了 [`cron` skill](../../../packages/nextclaw-core/src/agent/skills/cron/SKILL.md) 的说明，明确它是唯一内建自动化调度能力，不再引导用户使用 `Heartbeat` 或 `HEARTBEAT.md`。
- 对外入口文档、CLI 使用说明、UI 会话标签和模板文案已同步收口，不再把 `Heartbeat` 当成正式能力并列展示。
- 根因说明：
  - 根因不是“Heartbeat 实现得还不够完整”，而是产品和运行时长期同时维护了两条语义重叠的自动化路径：一条是通用 `cron`，一条是固定周期文件轮询的 `heartbeat`。
  - 这会让用户心智、文档入口、运行时 wiring 和配置模型都持续存在双轨成本，后续需求也容易继续围绕 `HEARTBEAT.md` 堆特例。
  - 本次改动命中根因的方式，不是给 Heartbeat 再做一层兼容包装，而是直接删除独立 heartbeat 机制，把“调度”与“会话连续性”分别收回到 `cron` 和 `sessionId` 这两个已存在且更通用的能力面上。

## 测试/验证/验收方式

- 已通过：
  - `pnpm -C packages/nextclaw-core exec vitest run src/agent/tests/context.test.ts src/agent/tools/cron.test.ts`
  - `pnpm -C packages/nextclaw exec vitest run src/cli/shared/services/gateway/tests/cron-job-handler.service.test.ts src/cli/shared/services/gateway/tests/service-startup-support.test.ts src/cli/shared/services/workspace/workspace-manager.service.test.ts src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw-server tsc`
- 已确认的定向结果：
  - workspace 初始化不再生成 `HEARTBEAT.md`
  - gateway 启动路径不再打印 Heartbeat 启动信息
  - 活跃文档入口不再并列展示 `Cron & Heartbeat`
  - `cron` 相关能力与测试仍可正常工作
- 未完全通过项：
  - `pnpm -C packages/nextclaw tsc` 失败，失败点位于用户已有改动的 [`nextclaw-agent-session-store.test.ts`](../../../packages/nextclaw/src/cli/commands/ncp/session/nextclaw-agent-session-store.test.ts) 第 175 行附近，为本次改动之外的既有类型错误。
  - `pnpm lint:new-code:governance` 未通过，主要拦在仓库历史文件命名/目录治理债务上；本次没有新增第二套 Heartbeat 相关复杂度，但触达旧文件后会被现有治理规则继续暴露。
  - `post-edit-maintainability-guard` 未完全通过，失败项同样主要来自仓库已有热点目录与旧文件预算问题，而不是本次删除 Heartbeat 后新增的维护性负担。

## 发布/部署方式

- 本次改动随常规 `nextclaw`、`@nextclaw/core`、`@nextclaw/ui`、`@nextclaw/server` 等相关包的统一发版发布，无需单独部署步骤。
- 若进入统一 release 批次，需要确保 CLI/runtime/docs/UI 变更随同一个版本窗口一起发布，避免文档已删除 `Heartbeat` 但旧二进制仍暴露该概念。

## 用户/产品视角的验收步骤

1. 初始化一个新的 workspace，确认目录中不再自动出现 `HEARTBEAT.md`。
2. 启动服务或相关 runtime，确认启动输出中不再出现 `Heartbeat: every 30m`。
3. 通过 `nextclaw cron add ... --session-id <sessionId>` 创建一个绑定现有会话的定时任务，确认命令仍然可用。
4. 在 AI 对话里使用 `automation-setup` 或 `cron` skill 表达“稍后继续这个会话 / 定期跟进这件事”，确认 AI 会创建 cron job，而不是引用 Heartbeat。
5. 浏览 README、USAGE 和 docs guide，确认当前对外入口只介绍 `Cron` / automation，不再把 `Heartbeat` 当成正式功能。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
  - 这次没有保留兼容空壳、过渡开关或隐藏 fallback，而是把重复概念直接删掉，避免后续继续围绕 `Heartbeat` 堆补丁。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。
  - 这次的核心动作是删除和收口，而不是新增另一条 automation 抽象；新增的 `automation-setup` skill 也保持为极薄包装，底层只调用已有 `cron`。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 是。按本次实际触达文件统计，总代码增减报告为：新增 `143` 行、删除 `414` 行、净增 `-271` 行。
  - 排除测试文件后的非测试代码增减报告为：新增 `136` 行、删除 `293` 行、净增 `-157` 行。
  - 这说明本次不是把复杂度搬家，而是实际减少了运行时分支、配置特例和模板文件。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。后台自动化只剩 `CronService` 一条调度主路径；“继续某个会话”则明确由 `sessionId` 表达；skill 只负责配置，不负责执行。
  - 这比保留 `HeartbeatService + CronService + HEARTBEAT.md` 的三件套边界更清晰，也避免了再造第二套 orchestrator。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 部分满足。本次删除后的目标结构更简洁，但仓库现有治理规则仍会在若干历史文件上报旧命名/热点目录债务；这些债务不是本次引入，且本次已尽量避免扩大触面。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 已基于独立复核填写。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次改动顺着“NextClaw 作为统一入口与能力编排层”的方向前进了一步。我们去掉了一个并列但不必要的产品概念，让自动化能力回到统一入口，而不是继续让用户理解两套近似机制。
- 在可维护性上，这次最关键的推进是删除旧特例、统一调度语义，并把快捷体验放回 skill 层，而不是继续在 runtime 中保留第二条路径。

代码增减报告：
- 新增：143 行
- 删除：414 行
- 净增：-271 行

非测试代码增减报告：
- 新增：136 行
- 删除：293 行
- 净增：-157 行

no maintainability findings

正向减债动作：删除

质量与可维护性提升证明：
- 删除了独立 heartbeat runtime、模板文件、配置项和文案入口，系统里不再存在一条功能重叠但实现方式不同的后台调度路径。
- 会话连续性与定时调度重新回到 `sessionId + cron` 这一套更通用的表达上，减少了后续需求演化时继续加特例的空间。

为何不是单纯压缩行数：
- 本次净删代码不是通过压缩表达或把复杂度转移到别处实现的，而是实际删除了一整条 heartbeat 子系统，并只保留一个很薄的配置型 skill 作为用户体验承接。
- runtime、bootstrap、template、docs、UI 文案都同步收口，说明减少的是概念和分支，而不只是行数。

可维护性总结：
- 这次改动让自动化能力面更统一、运行时更少特例、文档心智更一致，属于明确的正向减债。
- 仍保留的债务主要是仓库既有治理热点与个别历史文件命名问题，但本次没有继续扩大这笔债。
- 后续观察点是把更多“提醒我 / 定期检查 / 稍后继续”场景继续沉淀到 `cron` 与薄 skill 的统一表达里，不再回到内建文件轮询思路。

## NPM 包发布记录

- 本次是否需要发包：待统一发布。
- 需要发布哪些包：
  - `nextclaw`
  - `@nextclaw/core`
  - `@nextclaw/ui`
  - `@nextclaw/server`
- 每个包当前是否已经发布：
  - `nextclaw`：未发布，待统一发布
  - `@nextclaw/core`：未发布，待统一发布
  - `@nextclaw/ui`：未发布，待统一发布
  - `@nextclaw/server`：未发布，待统一发布
- 未发布原因：
  - 当前改动已完成实现与定向验证，但尚未进入统一 release 批次。
- 后续触发条件：
  - 随下一次包含 CLI/runtime/docs/UI 收口的统一版本一并发布。

## 相关文档

- [实现方案：Remove Heartbeat And Unify Automation](../../plans/2026-05-05-remove-heartbeat-and-unify-automation.md)
