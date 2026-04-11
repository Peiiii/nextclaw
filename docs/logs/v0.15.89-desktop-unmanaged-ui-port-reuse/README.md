# 迭代完成说明

- 根因不是“当前启动先把 55667 占上，又把自己误判成冲突”，而是本地 UI 运行态存在两个不一致的真相源：
  - 托管后台看 [`service.json`](../../../packages/nextclaw/src/cli/runtime-state/managed-service-state.store.ts)
  - 前台 / 桌面端在启动后只按“是否写出 `service.json`”判断成功
- 这导致“健康 NextClaw 已经在 55667 上运行，但不受当前 managed state 管理”的场景下，CLI 和桌面端都会把它误当成普通端口占用或启动失败。
- 本次最终方案见 [Local UI Startup Contract Unification Implementation Plan](../../plans/2026-04-11-local-ui-startup-contract-unification.md)。
- 在你进一步要求“不要字段级修补，要做整体性删除”后，本批次又补了一轮结构收口，方案见 [Local UI Contract Owner Consolidation Plan](../../plans/2026-04-11-local-ui-contract-owner-consolidation.md)。
- 在 [`packages/nextclaw/src/cli/commands/service-support/runtime/service-port-probe.ts`](../../../packages/nextclaw/src/cli/commands/service-support/runtime/service-port-probe.ts) 抽出统一的 `inspectUiTarget` 合同，把目标端口严格收敛为 `available / healthy-existing / occupied-unhealthy` 三种状态。
- 在 [`packages/nextclaw/src/cli/commands/service.ts`](../../../packages/nextclaw/src/cli/commands/service.ts) 让 `nextclaw start` 共享这份三态合同：
  - `available` 才新起托管后台
  - `healthy-existing` 视为幂等成功并显式复用
  - `occupied-unhealthy` 明确失败
- 在 [`apps/desktop/src/runtime-service.ts`](../../../apps/desktop/src/runtime-service.ts) 继续做整体性删除：桌面端现在完全不再读取 `service.json`，`nextclaw start` 成功后只按 `config.json` 推导目标地址并等待健康检查。`service.json` 回到只表达 managed ownership 的单一职责。
- 在 [`packages/nextclaw-core/src/utils/helpers.ts`](../../../packages/nextclaw-core/src/utils/helpers.ts)、[`packages/nextclaw/src/cli/utils.ts`](../../../packages/nextclaw/src/cli/utils.ts)、[`packages/nextclaw/src/cli/runtime-state/local-ui-discovery.service.ts`](../../../packages/nextclaw/src/cli/runtime-state/local-ui-discovery.service.ts) 收敛“本机客户端访问 UI 地址”的 loopback 归一化逻辑，避免 CLI 内部再保留第二套 host 归一化实现。
- 在 [`packages/nextclaw/src/cli/runtime-state/local-ui-discovery.service.ts`](../../../packages/nextclaw/src/cli/runtime-state/local-ui-discovery.service.ts) 顺手删掉已经无调用价值的 `readKnownRuntimeState()`。
- 在 [`packages/nextclaw/src/cli/commands/service-support/runtime/tests/service-port-probe.test.ts`](../../../packages/nextclaw/src/cli/commands/service-support/runtime/tests/service-port-probe.test.ts) 与 [`apps/desktop/src/runtime-service.test.ts`](../../../apps/desktop/src/runtime-service.test.ts) 更新回归测试，固定“健康复用”和“配置目标地址合同”的行为。

# 测试/验证/验收方式

- 通过：`pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/runtime/tests/service-port-probe.test.ts`
- 通过：`pnpm -C packages/nextclaw-core tsc -p tsconfig.json --noEmit`
- 通过：`pnpm -C apps/desktop tsc -p tsconfig.json --noEmit`
- 通过：`pnpm -C packages/nextclaw exec tsx --test ../../apps/desktop/src/runtime-service.test.ts`
- 通过：`pnpm -C apps/desktop exec eslint src/runtime-service.ts src/runtime-service.test.ts`
- 通过但仍有 warning：`pnpm -C packages/nextclaw exec eslint src/cli/runtime-state/local-ui-discovery.service.ts src/cli/commands/service-support/runtime/service-port-probe.ts src/cli/commands/service-support/runtime/tests/service-port-probe.test.ts src/cli/commands/service.ts src/cli/utils.ts`
  - 当前只剩 [`packages/nextclaw/src/cli/commands/service.ts`](../../../packages/nextclaw/src/cli/commands/service.ts) 的 `prefer-top-level-context-destructuring` warning 与 [`packages/nextclaw/src/cli/utils.ts`](../../../packages/nextclaw/src/cli/utils.ts) 的 `max-depth` warning。
- 未通过但与本次改动直接无关：`pnpm -C packages/nextclaw tsc -p tsconfig.json --noEmit`
  - 本次实现期间曾引入一个 `local-ui-discovery.service.ts` 的类型收窄问题，现已修复。
  - 当前剩余失败只来自 [`packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts`](../../../packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts) 第 230、238 行：`Set<string | undefined>` 不能赋给 `Set<string>`。
- 未通过但与本次改动直接无关：`pnpm lint:maintainability:guard`
  - 当前失败集中在工作区其他已改文件，主要是 [`packages/nextclaw-core/src/providers/openai_provider.ts`](../../../packages/nextclaw-core/src/providers/openai_provider.ts) 的函数预算超标。
  - 与本次直接相关的文件里，守卫关注点仍然是 [`packages/nextclaw/src/cli/commands/service.ts`](../../../packages/nextclaw/src/cli/commands/service.ts) 这个存量超长文件；它还没被彻底拆开，但本轮已经用桌面端整段删减去抵消这条链路的非测试净增长。

# 发布/部署方式

- CLI / 桌面端常规构建发布即可，无需额外迁移。
- 对桌面包，确保打包产物包含本次更新后的 [`apps/desktop/src/runtime-service.ts`](../../../apps/desktop/src/runtime-service.ts) 行为。
- 对 CLI 包，确保发布包含 [`service-port-probe.ts`](../../../packages/nextclaw/src/cli/commands/service-support/runtime/service-port-probe.ts) 的三态合同与 [`service.ts`](../../../packages/nextclaw/src/cli/commands/service.ts) 的幂等复用逻辑。

# 用户/产品视角的验收步骤

1. 先启动一个现有 NextClaw UI 实例占用 `55667`，并确认 `curl http://127.0.0.1:55667/api/health` 返回 `ok`.
2. 再启动 MAS 桌面端。
3. 预期结果：桌面端不再弹出“55667 被占用”的启动失败，而是直接复用现有健康 UI 打开。
4. 观察 CLI 输出，应明确提示“复用了现有健康实例，但它未受 managed state 管理”，而不是伪装成已经纳入托管。
5. 再准备一个“端口被非 NextClaw 进程占用”的场景。
6. 预期结果：`nextclaw start` / 桌面端仍然显式失败，并提示这是非健康 NextClaw 监听，不能复用。

# 可维护性总结汇总

- 可维护性复核结论：通过
- 长期目标对齐 / 可维护性推进：
  - 这次顺着“统一入口、统一体验、行为更可预测”的长期方向推进了一小步，把“健康 NextClaw 已存在”从端口冲突误判改成显式产品状态。
  - 这次没有再加 incident-specific fallback；相反，继续删掉了桌面端对 `service.json` 的依赖，把成功条件进一步收敛成“`nextclaw start` 成功后，配置目标地址健康可达”。
- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循删减优先、简化优先、代码更少更好：是
  - 删掉了桌面端解析 `UI:` 文本输出这条过渡路径。
  - 删掉了桌面端整段 `service.json` 读取、状态解析和对应测试。
  - 顺手删掉了 `local-ui-discovery.service.ts` 中已经无价值的 `readKnownRuntimeState()`。
  - 没有再新增第三套“端口发现”实现，而是把目标端口探测留在 `service-port-probe.ts`，并让桌面端只依赖配置目标地址合同。
- 代码增减报告：
  - 统计口径：按本次直接触达文件的当前工作树 diff 统计；若同一文件中存在本次之前的存量未提交改动，文件级统计会一并反映。
  - 新增：233 行
  - 删除：206 行
  - 净增：+27 行
- 非测试代码增减报告：
  - 统计口径同上，测试文件排除 `*.test.*`
  - 新增：183 行
  - 删除：183 行
  - 净增：+0 行
- 本次是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 文件数未增加。
  - 分支语义更清晰：以前是“端口占用 / service state 是否存在 / 桌面端能否猜到地址”三套拼接判断；现在桌面端只认配置目标地址合同，CLI 只认端口三态合同和 ownership 状态。
  - 这批直接相关文件的非测试代码已做到净零增长，说明本轮不是继续把复杂度往代码库里加，而是在做等量置换下的结构收口。
  - 本轮最重要的整体性删除：
    - 桌面端不再读取 `service.json`
    - `service.json` 不再兼任桌面端启动成功判定的真相源
    - `local-ui-discovery.service.ts` 删除了无调用价值接口
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：
  - 更合适的部分：
    - “目标端口三态判断”的 owner 现在是 `service-port-probe.ts`
    - “本机客户端该访问哪个 UI 地址”的 owner 现在收敛到了共享 helper / 统一合同
    - 桌面端 `runtime-service.ts` 不再参与 ownership 语义解释，只负责“start 成功后按配置目标地址等健康”
    - `service.ts` 不再自己同时承担 preflight 判定和所有输出分叉
  - 仍需继续处理的部分：
    - `service.ts` 仍然承载过多 orchestration 责任，后续应继续拆出 `startService` 的 preflight / reuse / spawn seam
    - `service-port-probe.ts` 和 `service.ts` 仍然分处两个文件协作，这已经比之前清晰，但还没收口到单一 orchestration owner
- 目录结构与文件组织是否满足当前项目治理要求：
  - 本次未新增目录平铺债务；仍存在 `packages/nextclaw/src/cli` 与若干存量大文件治理问题，已由守卫报告暴露。
- 若本次涉及代码可维护性评估，是否基于一次独立于实现阶段的 `post-edit-maintainability-review`：
  - 是。本节基于实现后独立复核填写，而不是只复述守卫结果。
- 本次顺手减债：是
  - 把 CLI 与桌面端对目标 UI 启动成功的分叉判断继续收敛，并完成了桌面端整层 `service.json` 依赖删除。
- 可维护性总结：
  - 这次修复没有停留在“告诉用户去杀端口/换端口”的补丁式处理，而是删掉了桌面端一整层不该存在的状态真相源，把 `service.json` 退回到 ownership 单一职责。
  - 是，之前的问题本质上就是所有权和抽象边界不够清晰；这一轮已经做到直接相关文件的非测试净零增长，但 `service.ts` 仍偏大，下一步最值得继续切的 seam 是 `startService` 的 preflight / reuse / spawn 拆分。
