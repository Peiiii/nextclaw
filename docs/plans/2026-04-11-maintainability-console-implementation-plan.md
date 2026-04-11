# Maintainability Console Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `apps/maintainability-console` 落成一个仅供本地研发使用的只读 maintainability console，用统一前后端入口展示项目级文件数、代码行数、模块体积、目录预算压力与维护性热点。

**Architecture:** 继续沿用仓库里已经存在的 `apps/maintainability-console` 半成品，不重起新 app。后端基于 Hono 聚合现有 `scripts/code-volume-metrics-*`、`maintainability-hotspots`、`maintainability-directory-budget` 的统计结果，对外暴露单一只读概览接口；前端基于 Vite React 消费该接口，渲染本地单页大盘。

**Tech Stack:** TypeScript、React、Vite、Hono、`@hono/node-server`、`@tanstack/react-query`、原生 CSS、Node `tsx`、Playwright（smoke）。

---

## 背景与目标

这个需求的本质不是“再加一个内部工具”，而是把仓库里已经存在但分散的可维护性认知收敛成一个统一入口，让研发在做实现、重构和收债决策前，先看到项目体积、热点和目录压力的大盘。

它服务的是 NextClaw 的统一入口目标，只是这次入口对象不是最终用户工作流，而是项目自身的维护性状态。第一版只做只读、单机、本地研发使用，不做账号、历史数据库、远程部署和告警通道。

## 当前仓库现状

### 已存在，可直接延续

- `apps/maintainability-console/package.json`
- `apps/maintainability-console/tsconfig.json`
- `apps/maintainability-console/tsconfig.backend.json`
- `apps/maintainability-console/vite.config.ts`
- `apps/maintainability-console/index.html`
- `apps/maintainability-console/scripts/dev.utils.mjs`
- `apps/maintainability-console/server/index.ts`
- `apps/maintainability-console/server/maintainability-data.service.ts`
- `apps/maintainability-console/shared/maintainability.types.ts`
- `scripts/code-volume-metrics-snapshot.mjs`

### 已经完成的方向判断

- 应继续复用现有统计脚本，而不是复制一套扫描逻辑到 app 内。
- app 形态应保持为单 workspace 包，前后端同包内聚实现。
- 数据模型应围绕一个只读概览接口展开，而不是拆成很多细碎 API。

### 还缺失的部分

- `src/` 前端页面尚未落成。
- `apps/maintainability-console/eslint.config.mjs` 缺失。
- `apps/maintainability-console/scripts/smoke.test.mjs` 缺失。
- 根工作区尚无可直接启动/验证该 app 的脚本。
- 本 app 的启动和构建链路还存在接线问题，需要在实现阶段一起修掉。

### 已知实现缺口 / 风险点

- `scripts/dev.utils.mjs` 当前错误地假设 app 自己的 `node_modules/.bin` 中存在 `pnpm`。
- 当前后端构建产物路径与 `start` 路径约定需要重新对齐。
- app 的 lint 运行方式应和仓库现有模式对齐，避免依赖本地未安装的 `eslint` 可执行文件。
- 当前 app 仍是未完成状态，不能直接作为“已有可用实现”交付。

## 本次范围

### 必须完成

- 在 `apps/maintainability-console` 内补齐前端、lint、smoke 与运行接线。
- 保持现有后端聚合层思路，完善到可直接供前端消费。
- 单页展示以下核心信息：
  - 总文件数
  - 总代码行数
  - 模块数
  - 语言分布
  - 每个 scope/package 的文件数与代码行数
  - 最大文件榜
  - 目录预算热点
  - maintainability hotspots
- 支持 `source` / `repo-volume` 两种视角切换。
- 从仓库根可直接启动本地大盘。

### 明确不做

- 历史趋势数据库
- 自动定时扫描
- 邮件/消息/Webhook 告警
- 自动修复建议
- 线上部署和多用户权限

## 统一方案决策

### 方案结论

采用“单 app 内聚 + 单一概览接口 + 复用现有脚本”的方案。

### 为什么不用其它方案

- 不拆新 package：
  当前需求是本地研发工具，拆额外共享包只会增加目录平铺和维护成本。
- 不做多接口：
  第一版只读大盘更适合单次扫描后一次性返回概览 JSON，避免前端额外编排多个请求。
- 不引入数据库：
  当前用户目标是“看当下仓库的维护性大盘”，不是先解决历史时序分析。

## 数据来源与后端职责

### 复用的现有脚本

- [`scripts/code-volume-metrics-profile.mjs`](/Users/peiwang/Projects/nextbot/scripts/code-volume-metrics-profile.mjs)
- [`scripts/code-volume-metrics-snapshot.mjs`](/Users/peiwang/Projects/nextbot/scripts/code-volume-metrics-snapshot.mjs)
- [`scripts/maintainability-hotspots.mjs`](/Users/peiwang/Projects/nextbot/scripts/maintainability-hotspots.mjs)
- [`scripts/maintainability-directory-budget.mjs`](/Users/peiwang/Projects/nextbot/scripts/maintainability-directory-budget.mjs)

### 后端 owner

`apps/maintainability-console/server/maintainability-data.service.ts`

### 后端职责边界

- 调用现有脚本导出的共享能力
- 整理统一 JSON 响应
- 补充前端友好的 summary / percent / 排序结果
- 在需要时补算热点文件的当前行数
- 不承载写操作
- 不承载历史存储

### 接口契约

`GET /health`

- 返回服务健康状态

`GET /api/maintainability/overview?profile=source|repo-volume`

- 返回统一概览 JSON
- `profile` 非法时返回 400
- 默认 profile 为 `source`

### 关键响应字段

- `totals`
- `summary`
- `byScope`
- `byLanguage`
- `largestFiles`
- `directoryHotspots`
- `maintainabilityHotspots`

## 前端信息架构

### 顶部 Hero

- 页面定位
- 当前 profile 说明
- 手动刷新入口
- 最近扫描时间
- 扫描耗时
- Git 分支 / SHA

### Summary Cards

- 总代码行数
- 总文件数
- 模块数
- 目录热点数
- 维护性热点数

### 主内容区

- Scope / package 体积榜
- 语言分布
- 最大文件榜
- 目录预算热点
- maintainability hotspots
- 扫描范围说明（include paths / extensions / exclude dirs）

### 交互原则

- 只做手动刷新，不自动轮询
- profile 切换后重新请求数据
- 保持桌面优先，但移动端可读
- 风格上避免默认模板感，仍保持信息密度和清晰度

## 文件落位规划

### 继续使用 / 修改

- Modify: `scripts/code-volume-metrics-snapshot.mjs`
- Modify: `apps/maintainability-console/package.json`
- Modify: `apps/maintainability-console/tsconfig.backend.json`
- Modify: `apps/maintainability-console/scripts/dev.utils.mjs`
- Modify: `apps/maintainability-console/server/index.ts`
- Modify: `apps/maintainability-console/server/maintainability-data.service.ts`
- Modify: `apps/maintainability-console/shared/maintainability.types.ts`
- Modify: `package.json`

### 新增

- Create: `apps/maintainability-console/eslint.config.mjs`
- Create: `apps/maintainability-console/scripts/smoke.test.mjs`
- Create: `apps/maintainability-console/src/main.tsx`
- Create: `apps/maintainability-console/src/app.tsx`
- Create: `apps/maintainability-console/src/index.css`
- Create: `apps/maintainability-console/src/services/maintainability-api.service.ts`
- Create: `apps/maintainability-console/src/lib/maintainability-format.utils.ts`
- Create: `apps/maintainability-console/src/components/panel.tsx`
- Create: `apps/maintainability-console/src/components/stat-card.tsx`
- Create: `apps/maintainability-console/src/components/console-hero.tsx`
- Create: `apps/maintainability-console/src/components/metric-table.tsx`
- Create: `apps/maintainability-console/src/components/overview-stat-grid.tsx`
- Create: `apps/maintainability-console/src/components/volume-panels.tsx`
- Create: `apps/maintainability-console/src/components/governance-panels.tsx`
- Create: `apps/maintainability-console/src/components/directory-hotspot-list.tsx`
- Create: `apps/maintainability-console/src/components/maintainability-hotspot-list.tsx`
- Create: `apps/maintainability-console/src/components/dashboard-content.tsx`

## 分阶段实施任务

### Task 1: 校准现有半成品骨架

**Files:**
- Modify: `apps/maintainability-console/package.json`
- Modify: `apps/maintainability-console/tsconfig.backend.json`
- Modify: `apps/maintainability-console/scripts/dev.utils.mjs`
- Create: `apps/maintainability-console/eslint.config.mjs`

**目标：**

- 把现有 app 从“目录已建好”推进到“开发/构建链路逻辑正确”
- 修正 dev / start / build / lint 的接线假设

**Steps:**

1. 对齐 `build` 与 `start` 的产物路径。
2. 把 `lint` 脚本改为沿用仓库根 `pnpm exec eslint` 模式。
3. 去掉 `dev.utils.mjs` 对本地 `node_modules/.bin/pnpm` 的错误依赖。
4. 新增 `eslint.config.mjs`，至少继承仓库根 ESLint 配置。
5. 运行 `pnpm -C apps/maintainability-console tsc`，确认骨架配置无明显路径错误。

**建议提交点：**

- `chore: fix maintainability console app wiring`

### Task 2: 固化共享扫描与后端概览服务

**Files:**
- Modify: `scripts/code-volume-metrics-snapshot.mjs`
- Modify: `apps/maintainability-console/server/index.ts`
- Modify: `apps/maintainability-console/server/maintainability-data.service.ts`
- Modify: `apps/maintainability-console/shared/maintainability.types.ts`

**目标：**

- 保持后端继续复用现有统计逻辑
- 保证前端后续只需要消费单个概览接口

**Steps:**

1. 确认 `scripts/code-volume-metrics-snapshot.mjs` 已导出文件级明细能力，若缺字段则补齐。
2. 整理 `MaintainabilityDataService` 的响应结构，确保 summary、scope、largest file、hotspots 字段可直接渲染。
3. 对齐共享类型，避免前后端对同一 JSON 形态出现漂移。
4. 检查生产模式下静态资源托管路径是否与客户端构建目录一致。
5. 用 `curl` 或 `fetch` 对 `/health` 与 `/api/maintainability/overview` 做本地请求校验。

**建议提交点：**

- `feat: finalize maintainability console overview api`

### Task 3: 实现前端单页大盘

**Files:**
- Create: `apps/maintainability-console/src/main.tsx`
- Create: `apps/maintainability-console/src/app.tsx`
- Create: `apps/maintainability-console/src/index.css`
- Create: `apps/maintainability-console/src/services/maintainability-api.service.ts`
- Create: `apps/maintainability-console/src/lib/maintainability-format.utils.ts`
- Create: `apps/maintainability-console/src/components/panel.tsx`
- Create: `apps/maintainability-console/src/components/stat-card.tsx`
- Create: `apps/maintainability-console/src/components/console-hero.tsx`
- Create: `apps/maintainability-console/src/components/metric-table.tsx`
- Create: `apps/maintainability-console/src/components/overview-stat-grid.tsx`
- Create: `apps/maintainability-console/src/components/volume-panels.tsx`
- Create: `apps/maintainability-console/src/components/governance-panels.tsx`
- Create: `apps/maintainability-console/src/components/directory-hotspot-list.tsx`
- Create: `apps/maintainability-console/src/components/maintainability-hotspot-list.tsx`
- Create: `apps/maintainability-console/src/components/dashboard-content.tsx`

**目标：**

- 把统计结果变成真正可浏览的大盘，而不是裸 JSON
- 保持“信息密度高但不乱”的本地研发工具视觉

**Steps:**

1. 在 `main.tsx` 中接好 React Query。
2. 在 `maintainability-api.service.ts` 中收敛接口请求逻辑。
3. 在 `app.tsx` 中承载 profile 切换、刷新、加载态与错误态。
4. 拆出展示型组件，避免单个页面文件继续膨胀。
5. 在 `index.css` 中完成桌面优先、移动可读的样式实现。
6. 确认页面至少展示总览卡片、scope 榜、语言分布、大文件榜、目录热点与 maintainability hotspots。

**建议提交点：**

- `feat: add maintainability console dashboard ui`

### Task 4: 补齐根脚本与本地冒烟

**Files:**
- Modify: `package.json`
- Create: `apps/maintainability-console/scripts/smoke.test.mjs`

**目标：**

- 从仓库根能直接启动或验证该 app
- 有一条真实 smoke 路证明前后端都能跑起来

**Steps:**

1. 在根 `package.json` 新增用于本地启动该 app 的脚本。
2. 根据需要补一个根级 validate 脚本，串联 build/lint/tsc/smoke。
3. 新建 `scripts/smoke.test.mjs`：
   - 启动构建后的 server
   - 等待 `/health`
   - 请求 `source` 与 `repo-volume` 两种 profile
   - 用 Playwright 打开页面，确认关键文本与切换交互
4. 确认 smoke 默认不往仓库外之外的路径写测试垃圾数据。

**建议提交点：**

- `test: add maintainability console smoke coverage`

### Task 5: 完整验证与收尾留痕

**Files:**
- Modify: `docs/logs/<new-iteration>/README.md`（仅在进入实现阶段且触达代码后）

**目标：**

- 让这次交付具备可复验性
- 在真正进入代码实现后按仓库规则补 iteration log

**Steps:**

1. 运行 `pnpm -C apps/maintainability-console build`
2. 运行 `pnpm -C apps/maintainability-console lint`
3. 运行 `pnpm -C apps/maintainability-console tsc`
4. 运行 `pnpm -C apps/maintainability-console smoke`
5. 运行 `pnpm lint:maintainability:guard`
6. 执行一次独立的 `post-edit-maintainability-review`
7. 代码阶段完成后，再按 `docs/logs` 规则新建或更新迭代记录

**建议提交点：**

- `docs: record maintainability console delivery`

## 验收标准

1. 从仓库根运行 `pnpm -C apps/maintainability-console dev` 可以同时起前后端。
2. 打开页面后能看到当前仓库的总代码量、总文件数、模块榜与大文件榜。
3. 切换 `source` / `repo-volume` 后，页面数据能刷新，接口返回合法。
4. 页面能展示目录预算热点和 maintainability hotspots。
5. `build / lint / tsc / smoke` 全部通过。

## 验证命令清单

```bash
pnpm -C apps/maintainability-console build
pnpm -C apps/maintainability-console lint
pnpm -C apps/maintainability-console tsc
pnpm -C apps/maintainability-console smoke
pnpm lint:maintainability:guard
```

## 风险与应对

- 风险：全仓扫描耗时偏高
  - 应对：第一版不做轮询，只做手动刷新
- 风险：复制已有脚本逻辑导致统计真相源漂移
  - 应对：强制复用现有脚本导出能力
- 风险：前端页面文件膨胀
  - 应对：拆成小型展示组件，避免 `app.tsx` 继续堆积
- 风险：本地 dev / smoke 链路依赖假设不一致
  - 应对：把 `dev`、`build`、`start`、`smoke` 在同一次实现里一起对齐

## 这次仅写方案文件时的留痕判定

当前这一步只是在 `docs/plans` 中沉淀方案文件，默认不创建 `docs/logs` 迭代目录，因为这仍属于设计/规划类文档更新。等后续真正进入代码实现阶段，再按仓库规则判断并补迭代记录。
