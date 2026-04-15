# v0.16.31 Maintainability Console Cloudflare Deploy

## 迭代完成说明

- 为 `apps/maintainability-console` 增加了 Cloudflare 一体式发布链路：新增 `worker/index.ts`、`tsconfig.worker.json`、`wrangler.toml`，把前端静态资源和只读 API 一起发布到 Worker，而不是只发一个纯静态前端壳。
- 新增 `scripts/build-worker-snapshots.mts`，在发布前基于现有 `MaintainabilityDataService` 生成 `source` / `repo-volume` 两份 overview 快照，并写入 `dist/client/_snapshot/`；线上 `/api/maintainability/overview` 改为读取发布快照，而不是伪装成实时扫描。
- 新增 `server/maintainability-console.controller.ts`，把 Hono API 路由从 Node 启动入口中拆出来，让本地 Node 服务和 Cloudflare Worker 各走清晰边界。
- 页面顶部新增运行模式说明：本地仍显示“本地实时扫描”，Cloudflare 线上明确显示“Cloudflare 发布快照”，并提示刷新只会重新获取当前线上快照，不会实时扫描用户机器。
- app 级脚本新增 `build:worker-snapshots`、`smoke:remote`、`deploy`，根脚本新增 `deploy:maintainability:console`；同时补了远程 smoke 所需的“跳过本地 server”能力。
- 发布完成后，公网入口已可访问：
  - 正式域名：`https://maintainability.nextclaw.io`
  - Worker 回退地址：`https://nextclaw-maintainability-console.15353764479037.workers.dev`
- 相关文档：
  - 方案文档：[`docs/plans/2026-04-15-maintainability-console-cloudflare-deploy-plan.md`](../../plans/2026-04-15-maintainability-console-cloudflare-deploy-plan.md)
  - 上一条相关迭代：[`docs/logs/v0.16.29-maintainability-console-rule-dashboard/README.md`](../v0.16.29-maintainability-console-rule-dashboard/README.md)

## 测试/验证/验收方式

- `pnpm -C apps/maintainability-console lint`
- `pnpm -C apps/maintainability-console tsc`
- `pnpm -C apps/maintainability-console build`
- `pnpm -C apps/maintainability-console run build:worker-snapshots`
- `pnpm -C apps/maintainability-console smoke`
- `pnpm -C apps/maintainability-console exec wrangler deploy --config wrangler.toml --dry-run`
- `pnpm -C apps/maintainability-console run deploy`
- Web 打开线上地址：
  - `https://maintainability.nextclaw.io`
  - `https://maintainability.nextclaw.io/health`
  - `https://nextclaw-maintainability-console.15353764479037.workers.dev`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

结果说明：

- `lint / tsc / build / build:worker-snapshots / 本地 smoke / wrangler dry-run` 均通过。
- `pnpm -C apps/maintainability-console run deploy` 成功；后续补上自定义域路由后再次执行 `wrangler deploy`，Cloudflare 返回：
  - Worker：`nextclaw-maintainability-console`
  - 自定义域名：`https://maintainability.nextclaw.io`
  - workers.dev URL：`https://nextclaw-maintainability-console.15353764479037.workers.dev`
  - Version ID：`468402ba-beac-43aa-8ba6-785922512b81`
- 远程 smoke 脚本在当前终端网络环境下未跑通，失败形态是到 `workers.dev` 的连接超时；但通过外部打开线上根路径与 `/health` 已确认服务可达，因此当前更像是执行环境到 `workers.dev` 的网络限制，而不是部署失败。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs` 未全绿，但剩余 error 仍来自并行改动中的 `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx`，本次 `maintainability-console` 没有新增新的守卫错误。
- `pnpm lint:new-code:governance` 仍被工作区其它已触达文件的历史命名问题阻塞：`ChatConversationPanel*.tsx`、`ChatSidebar*.tsx` 不是 kebab-case；本次新增的 `maintainability-console` 文件未新增此类命名错误。
- `pnpm check:governance-backlog-ratchet` 仍因历史文档命名 backlog `13 > 11` 失败，与本次部署改动无直接关系。

## 发布/部署方式

- 直接在仓库根执行 `pnpm deploy:maintainability:console`，内部会执行：
  1. `pnpm -C apps/maintainability-console build`
  2. `pnpm -C apps/maintainability-console run build:worker-snapshots`
  3. `pnpm -C apps/maintainability-console exec wrangler deploy --config wrangler.toml`
- 若只想做部署前自检，可先跑 `pnpm -C apps/maintainability-console exec wrangler deploy --config wrangler.toml --dry-run`
- 若只想验证线上站点，可执行：
  - `MAINTAINABILITY_CONSOLE_BASE_URL='https://maintainability.nextclaw.io' pnpm -C apps/maintainability-console run smoke:remote`

## 用户/产品视角的验收步骤

1. 打开 `https://maintainability.nextclaw.io`
2. 确认页面能正常加载 `Maintainability Console`，而不是只返回静态资源或 404。
3. 确认顶部能看到“运行模式：Cloudflare 发布快照”之类的模式提示。
4. 确认仍能看到“治理规则”“项目规则”“规则总览”“规则字典”“目录压力”“维护性热点”等面板。
5. 点击 `Repo Volume`，确认页面能切到仓库口径而不是报错。
6. 点击 `刷新数据`，确认页面会重新拉取当前线上快照，而不是挂死或返回 500。
7. 打开 `https://maintainability.nextclaw.io/health`，确认能返回健康状态 JSON。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是

### 长期目标对齐 / 可维护性推进

- 这次把 maintainability console 从“只能在本地这台机器上看”的工具，推进成了“可从统一公网入口访问的研发 dashboard”，更接近 NextClaw 想成为统一入口的产品方向；同时又没有为了上线去伪造一套“云端实时扫描”的误导行为，而是明确固化成“发布快照”。
- 架构上优先选择“Worker + Assets + 构建时快照”的最小明确模型，没有引入数据库、计划任务、额外后端服务，也没有把本地扫描逻辑硬塞进 Cloudflare 运行时。
- 实现中顺手做了两笔减债：一是把 Node API 路由抽成独立 controller，二是把线上行为显式命名为 `published-snapshot`，避免未来在 UI 或 API 上继续制造“看起来能实时刷新”的 surprise success。

### 代码增减报告

- 新增：1018 行
- 删除：79 行
- 净增：+939 行

### 非测试代码增减报告

- 新增：1001 行
- 删除：67 行
- 净增：+934 行

### 可维护性总结

- 本次是否已尽最大努力优化可维护性：是。虽然总代码增加，但新增被压在“Worker 入口 + 快照脚本 + 少量契约/文案调整 + 发布配置”这条最小链路里，没有因为上云就扩出第二套后端体系。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。核心决策是明确放弃“线上实时扫描”这条复杂而失真的路线，直接采用发布快照；这实际上删掉了大量潜在的补丁式复杂度。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：总代码量和文件数净增，这是因为新增了真实部署链路与 Worker 运行时；但结构仍保持在 `apps/maintainability-console` 单 app 内，没有新建额外 workspace 包，也没有把复杂度分裂到 repo 的多个角落。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`MaintainabilityDataService` 继续只负责实时扫描；`maintainability-console.controller` 只负责本地 API；`build-worker-snapshots` 只负责发布时固化数据；`worker/index.ts` 只负责 Cloudflare 托管与快照分发，边界比较清楚。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。新增文件全部收敛在 `apps/maintainability-console` 内部，并继续沿 `server / worker / scripts / shared / src` 分层；剩余治理阻塞来自工作区其它并行改动，不在本次新增文件里。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核。
- no maintainability findings
- 保留债务与下一步入口：当前线上版仍是发布快照，不会自动刷新仓库状态；如果后续确实需要历史趋势或自动更新，应优先沿“显式快照产物 / 显式刷新入口 / 明确数据时点”继续演进，而不是回头引入隐式后台扫描。
