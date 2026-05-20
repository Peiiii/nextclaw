# v0.18.94 Gateway Config Kernel Mutation

## 迭代完成说明

本轮继续推进 service 到 kernel 的低冲突重构，完成 `Gateway Config Mutation 子域拆分`：

- `ConfigManager` 承接 gateway config snapshot、schema、apply、patch 的领域规则。
- hash 校验、JSON 解析、inline secret ref normalization、schema 校验、deep merge、reload plan、redacted mutation result 都收敛到 kernel。
- `GatewayControllerImpl` 删除 config 读写/patch/merge/reload plan 逻辑，只保留 gateway status、reload、restart、update、restart sentinel 等 service host 行为。
- `NextclawGatewayRuntime` 不再给 controller 注入 `saveConfig`；配置保存由 kernel `ConfigManager` 使用自身 `configPath` 完成。

根因：gateway controller 同时持有配置领域规则与 service host 行为，导致 gateway tool 的 config mutation 语义长期依赖 service。`ConfigManager` 已是配置事实 owner，因此本轮不新增平行 service，而是把 mutation 读写规则收回已有 owner。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service test -- --run src/shared/controllers/gateway.controller.test.ts src/commands/service/gateway-manual-restart-contract.controller.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/managers/config.manager.ts`
- `pnpm -C packages/nextclaw-service exec eslint src/shared/controllers/gateway.controller.ts src/shared/controllers/gateway.controller.test.ts src/commands/service/gateway-manual-restart-contract.controller.test.ts src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-service lint`（通过，保留 19 个既存 warning）
- `node scripts/governance/lint-new-code-governance.mjs -- <本轮文件>`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本轮文件>`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

未执行发布或部署。本轮是 kernel/service 内部职责收敛，需随项目后续统一发布闭环进入 NPM/桌面交付。

## 用户/产品视角的验收步骤

- gateway tool `config.get` 应继续返回 redacted config、hash、path、valid 状态。
- gateway tool `config.schema` 应继续返回当前版本 schema。
- gateway tool `config.patch` 对热更新路径应保存并立即应用，不自动重启。
- gateway tool `config.patch` 对需要重启的路径应返回 pending restart contract，并等待用户显式 restart。

## 可维护性总结汇总

- 使用了 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`。
- 正向减债动作：职责收敛、删除、复用已有 owner。
- 维护性收益：配置 mutation 规则从 service controller 回到 kernel `ConfigManager`；service controller 删除大量纯配置算法，边界更薄。
- 非新增用户能力，满足非测试代码净增不为正：total +237 / -238 / net -1，non-test +222 / -224 / net -2。
- maintainability guard 仅提示 `ConfigManager` 本次增长较多；这是本轮把配置 mutation owner 收回 kernel 的直接结果，后续若继续扩展配置子域，应再拆更细的 domain-focused manager/module。
- new-code governance 通过；仅提示本轮触达 legacy `shared/controllers`，本次改动方向是从该 legacy controller 删除配置领域规则，属于朝目标结构收敛。

## NPM 包发布记录

不涉及 NPM 包发布。
