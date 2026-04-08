# v0.15.50-cron-interval-restart-recovery

## 迭代完成说明（改了什么）

- 修复 `packages/nextclaw-core/src/cron/service.ts` 中 `every` 周期任务的恢复语义：重启或 `reloadFromStore()` 后，不再把旧任务重算成“当前时间 + interval”，而是沿持久化 cadence 推进到下一次触发点。
- 修复 `every` 任务执行后的下一次调度计算，避免因为执行稍晚、手动 `run` 或重启恢复而持续把节奏往后漂移。
- 补充修复 `reloadFromStore()` 的维护语义：运行中服务因为 watcher 触发 reload 时，不再把“已经到点但还没执行”的 `cron` / `every` 任务静默推进到下一轮，避免出现 `nextRunAtMs` 被跳过、`lastRunAtMs` 仍然是 `null` 的漏跑现象。
- 为 `saveStore()` 增加无变化跳过写盘的保护，避免单实例开发态服务因为自己写回 `jobs.json` 又触发 watcher，再进入 `reload -> save -> reload` 自循环，间接放大漏跑风险。
- 为 UI 服务补齐 `POST /api/cron` 创建接口，并在 `packages/nextclaw-server/src/ui/ui-routes/cron.controller.ts` 中加入新增请求校验，避免把无效 schedule 直接写进 store。
- 调整 CLI `packages/nextclaw/src/cli/commands/cron.ts`：
  - `cron add` 在检测到运行中服务时优先走当前服务 API，而不是继续依赖本地 `jobs.json` watcher 热重载。
  - `cron remove / enable / run` 在运行中服务 API 报错时不再静默回退到本地文件写入，避免“服务明明在跑、CLI 却偷偷改本地文件”的 surprise 行为。
- 修复 `packages/nextclaw/src/cli/commands/shared/ui-bridge-api.service.ts` 的运行中服务地址拼接问题，避免把请求错误地打成 `/api/api/...`。
- 为前台服务链路补齐运行态发现：
  - `nextclaw serve`
  - `pnpm -C packages/nextclaw dev serve`
  - 上述前台服务现在也会写入本地 `service.json`，因此 CLI 可以正确发现当前 API 并立即把定时任务变更应用到运行中的服务实例。
- 新增/补充真实回归覆盖：
  - `packages/nextclaw-core/src/cron/service.test.ts`
  - `packages/nextclaw-server/src/ui/router.cron.test.ts`
  - `packages/nextclaw/src/cli/commands/cron-support/cron-dev-service.integration.test.ts`
- 更新 [中文指南](../../../apps/docs/zh/guide/cron.md) 与 [English guide](../../../apps/docs/en/guide/cron.md)，明确 interval 重启语义，以及“运行中服务优先走 API 即时生效”的行为。

## 测试/验证/验收方式

- 定向单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec vitest run src/cron/service.test.ts`
  - 结果：4/4 通过。
  - 补充覆盖：
    - `reloadFromStore()` 不会再把 past-due cron 任务静默推进到下一轮，而是会在运行中的 scheduler 上真正执行。
    - `reloadFromStore()` 在 store 内容没变时不会重写 `jobs.json`。
- 服务路由测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server exec vitest run src/ui/router.cron.test.ts`
  - 结果：通过。
- 真实开发态端到端集成测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/cron-support/cron-dev-service.integration.test.ts`
  - 覆盖：
    - 运行中服务 `add / list / disable / enable / remove`
    - `at` one-shot 执行后自动禁用
    - 禁用任务 `run` 需要 `--force`
    - 开发态重启后的 interval cadence 恢复
  - 结果：3/3 通过。
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - 结果：通过。
- Lint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec eslint src/cli/commands/cron.ts src/cli/commands/shared/ui-bridge-api.service.ts src/cli/commands/service.ts src/cli/commands/service-support/gateway/service-startup-support.ts src/cli/commands/cron-support/cron-local.service.ts src/cli/commands/cron-support/cron-dev-service.integration.test.ts`
  - 结果：通过；只有仓库既有 warning，无新增 error。
  - 额外说明：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw lint` 仍被仓库既有问题阻塞，当前 error 位于 `packages/nextclaw/src/cli/commands/ncp/session-request/session-request-delivery.service.test.ts:102` 的 `require-yield`，与本次 cron 改动无关。
- 可维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：当前未通过。
  - 阻塞项：`packages/nextclaw-ui/src/components/agents/AgentsPage.tsx` 的并行改动触发了新的 `max-lines-per-function` 维护性错误，与本次 cron 修复无关。
  - 本次 cron 链路未新增新的守卫 error；相关 watchpoint 仍是既有的 `packages/nextclaw/src/cli/commands/service.ts` 与 `packages/nextclaw-server/src/ui/types.ts` 大文件预算。
- 手工开发态冒烟（隔离 `NEXTCLAW_HOME`、纯本地 `Ping`、无任何外发）：
  - 启动：`PATH=/opt/homebrew/bin:$PATH NEXTCLAW_HOME=/tmp/nextclaw-cron-manual.oGhumB/home pnpm -C packages/nextclaw dev serve --ui-port 19231`
  - `cron add -e 2`：返回 `✓ Added job 'manual-interval' (813cf31e)`，随后 `cron/jobs.json` 出现 `lastRunAtMs` 与 `lastStatus=error` 更新，证明任务在前台开发态真实触发。
  - `cron disable 813cf31e`：返回 `✓ Job 'manual-interval' disabled`；随后等待 3 秒，`lastRunAtMs` 保持不变且 `nextRunAtMs=null`。
  - `cron list --enabled-only`：返回 `No scheduled jobs.`，证明 disabled 任务被正确过滤。
  - `cron enable 813cf31e`：返回 `✓ Job 'manual-interval' enabled`；等待后 `lastRunAtMs` 再次推进，证明恢复触发。
  - `cron run 813cf31e`：在 disabled 状态下返回 `Failed to run job 813cf31e`。
  - `cron run 813cf31e --force`：返回 `✓ Job executed`。
  - `cron add --at <3 秒后>`：返回 `✓ Added job 'manual-once' (760df643)`；到点后 `enabled=false`、`nextRunAtMs=null`、`lastRunAtMs` 已更新，证明 one-shot 行为正确。
  - `cron remove 813cf31e` 与 `cron remove 760df643`：均返回成功；最终 `cron/jobs.json` 为空。
  - 全过程未配置 provider、未开启 deliver、未向微信或任何外部渠道发消息。
- 手工开发态 API 同链路补充冒烟（模拟前端页面的 `/api/cron` 调用，隔离 `NEXTCLAW_HOME`、纯本地、无任何外发）：
  - 启动：`PATH=/opt/homebrew/bin:$PATH NEXTCLAW_HOME=/tmp/nextclaw-cron-manual.rQfao1/home pnpm -C packages/nextclaw dev serve --ui-port 19321`
  - `POST /api/cron` 创建 `cron` 任务 `fae86111`，schedule 为 `*/5 * * * * *`。
  - 连续采样 `cron/jobs.json` 14 秒，观察到同一任务真实执行三轮：
    - `lastRunAtMs=1775651390001`，`nextRunAtMs=1775651395000`
    - `lastRunAtMs=1775651395001`，`nextRunAtMs=1775651400000`
    - `lastRunAtMs=1775651400001`，`nextRunAtMs=1775651405000`
  - 同期 `jobs.json` 的 `mtimeMs` 在两次真实执行之间保持不变，只在真正执行时推进，证明已消除 watcher 自循环写盘。
  - `PUT /api/cron/fae86111/enable` 设为 `false` 后，连续 7 秒采样 `lastRunAtMs=1775651415000`、`nextRunAtMs=null`、`mtimeMs=1775651418316` 均保持不变，证明禁用后不会继续触发。
  - `PUT /api/cron/fae86111/enable` 重新设为 `true` 后，再次观察到 `lastRunAtMs` 推进到 `1775651485001`，证明前端同链路启用后会恢复调度。
  - 因本地未配置 provider，`lastStatus=error` 是预期内的本地执行错误，但 `lastRunAtMs` 的推进已证明 scheduler 真实执行；全过程没有向微信或任何外部渠道发消息。

## 发布/部署方式

- 本次改动同时涉及 `@nextclaw/core`、`@nextclaw/server` 与 `nextclaw`，正式发布时需按联动包处理：
  - `pnpm changeset`
  - `pnpm release:version`
  - `pnpm release:publish`
- 若只在本地仓库验证：
  - 使用后台服务：重启 `nextclaw start`
  - 使用前台服务：重启 `nextclaw serve` 或 `pnpm -C packages/nextclaw dev serve`
- 若验证环境里残留旧的 `service.json`，当前 CLI 会在 PID 不存活时自动判定为不可用，不会继续把请求打到失效的旧服务。

## 用户/产品视角的验收步骤

1. 设一个隔离目录：`export NEXTCLAW_HOME=/tmp/nextclaw-cron-acceptance`
2. 启动前台开发态服务：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev serve --ui-port 19231`
3. 新增一个纯本地 interval 任务：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build cron add -n demo -m Ping -e 120`
4. 查看 `"$NEXTCLAW_HOME/run/service.json"` 与 `"$NEXTCLAW_HOME/cron/jobs.json"`：
   - 预期前者存在且指向当前前台服务端口；
   - 预期后者里该任务会在真实运行后更新 `lastRunAtMs`。
5. 依次执行：
   - `cron disable <jobId>`
   - `cron list --enabled-only`
   - `cron enable <jobId>`
   - `cron run <jobId> --force`
   - `cron remove <jobId>`
6. 预期：
   - 新增任务在服务运行中立即生效，不需要等待 watcher 才“看见”；
   - disabled 后不会继续触发；
   - enabled 后恢复触发；
   - disabled 状态下只有 `--force` 才会执行；
   - remove 后任务从 store 中消失；
   - 如果先停服务再重启，interval 任务会沿原 cadence 恢复，而不是按重启时刻重新起算；
   - `cron/jobs.json` 不应在无人操作、也没有真实任务执行时持续改写。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 代码增减报告：
  - 新增：1248 行
  - 删除：80 行
  - 净增：+1168 行
  - 本轮 `reload` 漏跑补丁子集：
    - 新增：255 行
    - 删除：9 行
    - 净增：+246 行
- 非测试代码增减报告：
  - 新增：663 行
  - 删除：80 行
  - 净增：+583 行
  - 本轮 `reload` 漏跑补丁子集：
    - 新增：83 行
    - 删除：9 行
    - 净增：+74 行
- no maintainability findings
- 可维护性总结：
  - 本次核心是“非新增能力”的行为修复，但代码净增较大，原因主要来自两块最小必要投入：一是把运行中服务的新增路径显式收敛到 API，二是补齐真实开发态回归测试与手工验收留痕。为了避免继续把复杂度堆回 `service.ts`，本次已经把前台服务发现、watcher registry 和本地运行态支持抽到 `service-startup-support.ts`，使 `service.ts` 相比中间态净减 6 行，并消除了本次引入的 maintainability guard error。
  - 这次已经到了当前问题域里比较实用的最小收敛点：如果继续压缩代码，最先该删的不是校验和测试，而是后续把 `packages/nextclaw-server/src/ui/types.ts` 的 cron 契约从大文件里再拆出去。当前仍保留的维护性债务是 `service.ts` 与 `ui/types.ts` 都还偏大，但本次没有再让它们继续恶化到触发新的治理错误。
  - 本轮 `reload` 漏跑补丁本身没有新的 maintainability finding。新增的核心非测试代码只放在 `packages/nextclaw-core/src/cron/service.ts`，而且是直接把“reload 维护语义”和“无变化不写盘”收敛到已有 `CronService` 内部，没有再额外铺一层 watcher 适配器、兼容 flag 或备用调度路径；对这个问题域来说，已经是当前更可预测、也更容易验证的最小修复面。
  - 长期目标对齐 / 可维护性推进：
    - 这次顺着“代码更少 surprise、运行态语义更单一、前台/后台服务行为更一致”的方向推进了一小步。
    - 能删的部分已经先删了：没有新增第二套 watcher 兜底方案，也没有保留“API 失败时继续偷偷写本地文件”的写路径。
    - 删不掉的部分主要是新增 API 契约、前台服务发现，以及真实开发态回归覆盖；这些增长是为了把之前分散在 watcher、服务发现和地址拼接里的不确定性收敛掉，属于最小必要增长。
    - 本轮后续补丁里，已经额外删掉了最容易制造 surprise 的隐性行为：相同内容反复写盘触发的假 reload。下一步若继续整理，应优先考虑把 `CronService` 的 store persistence 与 schedule maintenance 边界再拆清，但前提是不能重新引入“读路径偷偷改未来时间”的旧问题。
    - 目录结构方面，本次未新增新的热点平铺目录；`packages/nextclaw-server/src/ui/types.ts` 靠近预算上限，下一步整理入口应是把 cron request/result 类型独立拆分到更聚焦的契约文件。
