# v0.15.96 Maintainability Console Local Dashboard

## 迭代完成说明

- 新增本地研发专用的 `apps/maintainability-console`，在同一个 workspace 包里并置 `src`（Vite React）与 `server`（Hono Node）两层，形成一个可直接本地启动的前后端维护性控制台。
- 后端复用现有 `scripts/metrics/code-volume-metrics-*`、`scripts/governance/maintainability-hotspots.mjs`、`scripts/governance/maintainability-directory-budget.mjs`，没有复制第二套扫描真相源；前端统一消费 `/api/maintainability/overview`，展示总代码量、文件数、模块榜单、大文件排行、目录压力、维护性热点与扫描口径。
- 新增 `source` / `repo-volume` 双口径切换与手动刷新，让同一个入口既能看产品源码体积，也能看更接近工程总体积的仓库口径。
- 根工作区新增 `dev:maintainability:console`、`smoke:maintainability:console`、`validate:maintainability:console`，方便直接从仓库根启动和验证。
- 为了对齐仓库命名治理，把 app 内脚本命名收敛为 `scripts/dev.utils.mjs` 与 `scripts/smoke.test.mjs`，并把共享类型文件收敛为 `shared/maintainability.types.ts`。
- 相关方案文档：[`docs/plans/2026-04-11-maintainability-console-implementation-plan.md`](../../plans/2026-04-11-maintainability-console-implementation-plan.md)

## 测试/验证/验收方式

- `pnpm -C apps/maintainability-console build`
- `pnpm -C apps/maintainability-console lint`
- `pnpm -C apps/maintainability-console tsc`
- `pnpm -C apps/maintainability-console smoke`
- `pnpm lint:maintainability:guard`

结果说明：

- `build` 通过，前端构建产物输出到 `dist/client`，服务端 TypeScript 编译通过。
- `lint` 通过，新增文件的命名、角色后缀和组件拆分已对齐仓库治理要求。
- `tsc` 通过，前后端类型检查通过。
- `smoke` 通过，构建后的服务端成功托管前端，页面能打开、能切换 `Repo Volume` 口径、能触发刷新。
- `pnpm lint:maintainability:guard` 通过；输出里只剩工作区既有 warning，没有新增由本次 `maintainability-console` 引入的治理阻塞。

## 发布/部署方式

- 本次交付定位为纯本地研发工具，不做远程部署、不进入线上发布链路。
- 本地开发：在仓库根运行 `pnpm dev:maintainability:console`，或直接运行 `pnpm -C apps/maintainability-console dev`。
- 本地验证：在仓库根运行 `pnpm validate:maintainability:console`。
- 若只想启动构建后的单进程服务，可先执行 `pnpm -C apps/maintainability-console build`，再执行 `pnpm -C apps/maintainability-console start`。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `pnpm dev:maintainability:console`。
2. 打开 `http://127.0.0.1:5180`。
3. 确认首页可看到“代码行数 / 跟踪文件 / 模块数 / 扫描耗时 / 目录热点 / 维护热点”六张概览卡片。
4. 确认页面可看到“模块榜单”“语言分布”“大文件排行”“目录压力”“维护性热点”“扫描口径”几个面板。
5. 点击 `Repo Volume`，确认顶部口径说明切换为“仓库体积口径”，并看到数据刷新。
6. 点击 `刷新数据`，确认页面进入扫描中状态并重新拉取最新仓库指标。
7. 如需跑完整验证，在仓库根执行 `pnpm validate:maintainability:console`，确认命令全部通过。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是

### 长期目标对齐 / 可维护性推进

- 这次改动不是再堆一个分散的内部工具，而是把已有但分散的维护性认知收拢成一个统一入口，让“看全仓复杂度”这件事从脚本记忆负担变成一个可浏览、可切口径的本地工作台；这顺着“统一入口与能力编排”的长期方向推进了一小步。
- 结构上优先复用现有扫描脚本，只新增一层数据整形服务和前端展示层，没有再造第二套 metrics 逻辑；前端又继续拆成 `console-hero / dashboard-content / overview-stat-grid / volume-panels / governance-panels`，避免把入口堆成单个大组件。

### 代码增减报告

- 新增：2046 行
- 删除：49 行
- 净增：+1997 行

### 非测试代码增减报告

- 新增：1946 行
- 删除：49 行
- 净增：+1897 行

### 可维护性总结

- 本次是否已尽最大努力优化可维护性：是。虽然总代码与文件数净增不可避免，但已经把增长压在单个本地 app 内，并最大化复用了现有扫描脚本，没有再拆新 package、没有引入数据库、没有引入后台定时器或额外配置层。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。能复用的都直接复用，前端入口在 lint 提醒后继续拆分，避免把复杂度只换个地方藏起来。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：没有做到净下降，因为这次本质上是在新增一个本地前后端 app；但新增已压到最小必要范围，并同步偿还了此前阻塞守卫的命名治理债，让这条线从“半成品且会卡治理”变成“可运行且可验证”。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。后端维持 `MaintainabilityDataService` 作为唯一数据 owner，前端只保留一个 API service 和按面板职责拆分的组件，没有额外引入 store、manager 或重复 helper 层。
- 目录结构与文件组织是否满足当前项目治理要求：是。新增内容全部收敛在 `apps/maintainability-console` 单包内，并按 `server / shared / src / scripts` 分层，文件命名与角色后缀已对齐治理规则。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核。
- no maintainability findings
- 保留债务与下一步 watchpoint：当前增长主要来自第一次把完整本地控制台落地；若后续继续扩展更多图表或交互，应继续沿用现有按“概览卡片 / 体积面板 / 治理面板”拆分的缝，不要把业务协调重新卷回单个组件或 effect。
