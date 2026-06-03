# v0.20.20 Adaptive Cadence Runtime Probe

## 迭代完成说明

本次为 runtime readiness 探测引入业务无关的 `AdaptiveCadence` 节奏策略，并将 `SystemStatusManager` 原先内联的固定轮询/简单失败退避逻辑迁移到该通用策略。

根因：restart、服务未启动、端口不可达和彻底失败在前端请求层都表现为 bootstrap/status 不可达或未 ready，业务层无法可靠识别“这是不是 restart”。原逻辑把状态判断和探测节奏写在同一个 manager 方法里，恢复窗口和长期失败窗口缺少清晰分层。

确认方式：沿 `useSystemStatusSources -> SystemStatusManager.getRuntimeBootstrapPollInterval -> chat availability` 链路确认发送禁用来源是 runtime readiness，而轮询节奏 owner 位于 system status probe 路径。本次修复把“节奏策略”作为通用 owner 抽出，`SystemStatusManager` 只负责把 success/failure 信号喂给策略并维护 runtime 状态。

修复方式：新增 `AdaptiveCadence`，支持可配置 stage、idle delay、success stop、manual trigger；runtime readiness 使用 `1s idle -> 30s 热恢复 -> 5min 低频恢复 -> 60s 长期失败` 的探测节奏。右下角非健康 runtime 状态入口点击会触发一次 immediate probe；Chat 发送禁用逻辑保持只消费 readiness，不耦合 cadence。

设计文档：`docs/designs/2026-06-03-adaptive-cadence-runtime-probe-design.md`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/shared/lib/cadence/services/adaptive-cadence.service.test.ts src/features/system-status/managers/system-status.manager.bootstrap-polling.test.ts src/features/system-status/managers/system-status.manager.test.ts src/features/chat/utils/ncp-chat-input-availability.utils.test.ts src/app/components/layout/runtime-status-entry.test.tsx`
  - 结果：通过，5 个测试文件，27 个测试。
- `pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui exec eslint src/shared/lib/cadence/index.ts src/shared/lib/cadence/services/adaptive-cadence.service.ts src/shared/lib/cadence/services/adaptive-cadence.service.test.ts src/features/system-status/managers/system-status.manager.ts src/features/system-status/managers/system-status.manager.bootstrap-polling.test.ts src/features/system-status/hooks/use-system-status.ts src/app/components/layout/runtime-status-entry.tsx src/app/components/layout/runtime-status-entry.test.tsx`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui lint`
  - 结果：失败，失败点为既有无关 lint 债，不在本次触达文件内；本次触达文件 targeted ESLint 已通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：通过，1 个预算警告。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。

## 发布/部署方式

本次未执行发布/部署。改动位于 UI 源码、测试和设计文档，等待后续常规发布批次携带。

## 用户/产品视角的验收步骤

1. 触发 runtime bootstrap/status 连续失败。
2. 观察 readiness probe 在 30 秒内保持快速探测，并逐步退避到最高 5 秒。
3. 持续失败超过 30 秒后，观察探测降频到 10 秒、15 秒、30 秒阶段。
4. 持续失败超过 5 分钟后，观察长期不可达探测最高 60 秒。
5. runtime ready 后，观察轮询停止，chat 发送禁用随 `ncpAgent.state === "ready"` 自动解除。

本地以 assembled manager + cadence 单测完成上述功能验证。

## 可维护性总结汇总

本次遵守“节奏策略与业务状态解耦”原则：通用 `AdaptiveCadence` 不感知 runtime/chat/restart，`SystemStatusManager` 保持 runtime 状态 owner，chat 只消费 readiness。

Maintainability guard 通过；提示 `system-status.manager.ts` 接近 600 行预算。本次已把轮询节奏公式移出 manager，后续若继续触达 system status，可进一步拆分 runtime control 与 readiness probe 子 owner。

代码增减：总计新增 414 行，删除 124 行，净增 290 行；非测试新增 176 行，删除 24 行，净增 152 行。增长主要来自新增通用策略、设计文档和功能验证测试，属于本次用户可见可靠性能力的必要实现与验证成本。

## NPM 包发布记录

不涉及 NPM 包发布。
