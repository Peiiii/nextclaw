# v0.17.25-nextclaw-client-sdk-integration

## 迭代完成说明

本轮完成了 `@nextclaw/client-sdk` 的正式收口与真实接入，不再把它停留在 companion 专用能力层，而是把它做成 NextClaw 上层前端访问后端的统一 client contract。

本次交付同时覆盖了三部分：

1. `packages/nextclaw-client-sdk`
   - 补全 `app / auth / agents / channelAuth / config / marketplace / mcpMarketplace / remote / runtimeControl / runtimeUpdate / serverPaths / sessions / realtime` 领域 service。
   - 引入统一 `request / upload / subscribe` transport contract。
   - 让 contract type 尽量回到 `@nextclaw/server` 和 `@nextclaw/kernel`，删除 SDK 内部平行类型副本。
2. `packages/nextclaw-ui`
   - 让 `shared/lib/api` 退化为 SDK 薄适配层。
   - 把原先平铺在 `shared/lib/api` 根目录的多份 endpoint wrapper 收进 `shared/lib/api/services/`。
   - 让 realtime 消费方开始经由 SDK 工作。
3. `apps/companion`
   - 保持通过 `@nextclaw/client-sdk` 动态接入运行时，不再依赖 companion 专用 API 设计。

这轮的核心减债动作不是“再包一层”，而是删除旧的平行 API owner、压缩重复 contract、把 request/realtime/upload 访问语义收进同一个 SDK owner。

## 测试/验证/验收方式

已通过：

- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-server build`
- `pnpm -C packages/nextclaw-client-sdk tsc`
- `pnpm -C packages/nextclaw-client-sdk test`
- `pnpm -C packages/nextclaw-client-sdk build`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui test src/shared/lib/api/raw-client.test.ts src/shared/lib/transport/app-client.test.ts src/shared/lib/transport/remote.transport.test.ts src/shared/lib/transport/sse-stream.test.ts src/shared/lib/api/client.test.ts src/shared/lib/api/ncp-session.test.ts src/shared/lib/api/ncp-session-query-cache.test.ts`
- `pnpm -C apps/companion tsc`
- `pnpm -C apps/companion test`
- `pnpm -C apps/companion smoke`
- `pnpm lint:new-code:governance -- --files packages/nextclaw-client-sdk/package.json packages/nextclaw-client-sdk/src packages/nextclaw-server/src/ui/marketplace.types.ts packages/nextclaw-ui/package.json packages/nextclaw-ui/src/app/hooks/use-realtime-query-bridge.ts packages/nextclaw-ui/src/features/channels/components/config/channel-form.tsx packages/nextclaw-ui/src/shared/lib/api packages/nextclaw-ui/src/shared/lib/transport apps/companion/src/services/companion-runtime-client.service.ts pnpm-lock.yaml`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-client-sdk packages/nextclaw-server/src/ui/marketplace.types.ts packages/nextclaw-ui apps/companion/src/services/companion-runtime-client.service.ts`

已知仓库级既有项：

- `pnpm check:governance-backlog-ratchet` 失败，原因是 `docFileNameViolations current 13 > baseline 11`，属于仓库既有 backlog，不是本次 SDK 接入引入的新回归。

验证时遇到过一次假红：

- 我把 `packages/nextclaw-client-sdk build --clean` 和 `apps/companion tsc/smoke` 并行跑了，`dist` 在中途被清空，导致 companion 临时无法解析 SDK。
- 顺序重跑后，`apps/companion tsc` 与 `smoke` 均通过。
- 该问题已确认属于验证并发顺序，不属于实现缺陷。

## 发布/部署方式

本轮未执行发布或部署。

- 后端部署：不适用，本轮未改动后端运行逻辑，只补了服务端 UI contract type 导出。
- 前端部署：不适用，本轮未执行线上发布。
- companion 分发：不适用，本轮只完成源码实现与本地验证。

## 用户/产品视角的验收步骤

1. 在前端中进入依赖 `shared/lib/api` 的既有页面，确认数据读取、状态刷新、以及 websocket 驱动的更新行为正常。
2. 在 channel 配置界面触发需要订阅实时事件的交互，确认前端仍能收到实时更新。
3. 在涉及 NCP 会话读取、附件上传、runtime/config/marketplace 等页面或流程中，确认行为没有因为 SDK 收口而退化。
4. 启动 companion，确认：
   - 能连接到 NextClaw runtime；
   - 能读取 agent 列表和 session 列表；
   - 在本地 smoke 中能正常形成视图。
5. 确认代码组织上，`shared/lib/api` 不再维持第二套业务 owner，而是 SDK 薄适配层。

## 可维护性总结汇总

可维护性复核结论：通过

本次顺手减债：是

代码增减报告：

- 新增：522 行
- 删除：1462 行
- 净增：-940 行

非测试代码增减报告：

- 新增：505 行
- 删除：1444 行
- 净增：-939 行

正向减债动作：删除 / 职责收敛 / 必要解耦抽象

质量与可维护性提升证明：

- 删除了 `packages/nextclaw-ui/src/shared/lib/api` 下大量平行 endpoint wrapper 文件，把访问 owner 收口到 SDK。
- 删除了 `packages/nextclaw-client-sdk` 内部多份平行类型副本，让 contract type 回到 server/kernel owner。
- 让 UI 的 request/realtime/upload 通过统一 transport contract 接到 SDK，不再散落在多套访问层中。
- 新增的 service 层不是额外套娃，而是把原先分散在 UI facade 和 companion 里的访问语义收拢成一个稳定 owner。

为何不是单纯压缩行数：

- 本次不是把代码挤到更密，而是把重复 API wrapper、平行类型、散落 owner 真正删掉并换成统一 SDK 边界。
- SDK 增长对应的是 owner 收口；与此同时 UI 侧历史 facade 和重复实现显著减少，整体维护面更小。

no maintainability findings

剩余观察点：

- `packages/nextclaw-ui/src/shared/lib/api` 目录仍有 recorded exception，说明它还带着历史混合职责；但这轮已经把最重的 endpoint wrapper 平铺层收掉，后续适合单独做结构治理批次，而不是在本轮强拆。
- `packages/nextclaw-server/src/ui` 目录文件数仍超过预算，但这也是既有异常，本轮未恶化。

## NPM 包发布记录

不涉及 NPM 包发布。
