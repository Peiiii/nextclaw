# v0.18.37-frontend-status-probe-backoff

## 迭代完成说明

- 根因：前端启动阶段的 `/api/auth/status` 探活使用 400ms 短超时与 250ms 固定重试，慢启动或远端传输稍有抖动就会由前端主动 abort；`/api/runtime/bootstrap-status` 在未 ready / recovering 阶段固定 500ms 轮询，并且恢复 ready 时会全量 invalidate + active refetch，容易放大连续请求与 cancelled 观感。
- 确认方式：沿 `AuthGate -> useAuthStatus -> fetchAuthStatus -> LocalAppTransport.request` 与 `ProtectedApp -> useSystemStatusSources -> SystemStatusManager` 链路定位到超时、轮询与恢复刷新策略。
- 修复：auth status 改为 2s 启动超时、5s 稳态超时、最多 8 次指数退避重试；bootstrap status 改为 5s 请求超时、1s 活跃轮询、错误阶段 2s 起步并最高 5s 退避；恢复 ready 后只 refetch active queries，不再全量 invalidate。
- 同时把瞬时 runtime 连接错误判断收敛到 transport 共享层，避免 auth 与 system-status 各维护一份漂移逻辑。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec vitest run src/features/account/hooks/use-auth.test.ts src/features/system-status/managers/system-status.manager.bootstrap-polling.test.ts src/features/system-status/managers/system-status.manager.test.ts`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/client-sdk tsc`
- `pnpm --filter @nextclaw/ui exec eslint src/features/account/hooks/use-auth.ts src/features/account/hooks/use-auth.test.ts src/features/system-status/hooks/use-system-status.ts src/features/system-status/managers/system-status.manager.ts src/features/system-status/managers/system-status.manager.bootstrap-polling.test.ts src/features/system-status/managers/system-status.manager.test.ts src/features/system-status/index.ts src/shared/lib/api/utils/config.utils.ts src/shared/lib/transport/index.ts src/shared/lib/transport/transport.types.ts --max-warnings=0`
- `pnpm --filter @nextclaw/client-sdk exec eslint src/services/app.service.ts --max-warnings=0`
- `pnpm lint:new-code:governance`：代码改动后通过；补迭代记录后复跑时被无关既有改动 `packages/nextclaw-core/src/features/session/stores/session.store.ts` 的 cross-directory import 阻塞。
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`

全量 `pnpm --filter @nextclaw/ui lint` 被既有无关 lint 债务阻塞；触达文件 targeted ESLint 已通过。全量 `pnpm --filter @nextclaw/client-sdk lint` 被既有 `src/services/request.service.ts` max-statements warning 阻塞；触达文件 targeted ESLint 已通过。

## 发布/部署方式

本轮未执行发布或部署。变更影响 `@nextclaw/ui` 与 `@nextclaw/client-sdk` 源码，后续随统一版本发布进入用户环境。

## 用户/产品视角的验收步骤

1. 启动前端并观察 Network 中 `/api/auth/status`：启动阶段不应再出现 400ms 级别的连续 timeout/cancel 风暴。
2. runtime 未 ready 或恢复中时观察 `/api/runtime/bootstrap-status`：仍会持续探活，但频率降为 1s，错误阶段会退避到最高 5s。
3. runtime 从 recovering 回到 ready 时，页面应恢复可用，且不应由 system-status 触发全量 query invalidate。

## 可维护性总结汇总

- 本次是非功能 bugfix，非测试代码增减为 `+85 / -85 / 净增 0`，满足非功能改动门槛。
- 正向减债动作：简化。删除了 bootstrap pending placeholder、全量 invalidate 与 runtime-control 二次 invalidate，降低 status 链路的自动刷新面。
- 共享瞬时错误判断后，auth 与 system-status 的错误分类不再平行漂移。
- `post-edit-maintainability-guard` 已通过；剩余警告为 `packages/nextclaw-client-sdk/src/services` 既有目录预算超限，本轮未新增该目录文件。

## NPM 包发布记录

不涉及 NPM 包发布。
