# 2026-04-04 Project Pulse Dashboard Plan

## 背景与判断

NextClaw 的长期目标不是堆一个“功能很多的 AI 产品”，而是成为用户使用软件、互联网、系统、服务与云计算的统一入口。`Project Pulse` 的价值不只是展示工程数据，而是把“持续进化、持续交付、持续控制复杂度”变成一个可见、可管理、可传播的产品信号。

现状并非从零开始：

- 已有源码 LOC 持续统计与历史快照：
  - `.github/workflows/code-volume-metrics.yml`
  - `docs/metrics/code-volume/latest.json`
  - `docs/metrics/code-volume/history.jsonl`
  - `docs/metrics/code-volume/comparison.json`
- 已有截图自动化：
  - `.github/workflows/product-screenshots.yml`
  - `images/screenshots/*`
- 已有公开文档站：
  - `apps/docs/**`
  - `pnpm deploy:docs`

因此本次不新开平行站点、不引入额外前端框架、不接外部 BI。直接在现有 docs 站里做一个静态可部署的 `Project Pulse` 页面，同时补齐 commit / release / timeline 数据采集。

## 目标

本次一次性落地一个可公开展示、也可内部使用的首版 `Project Pulse` 页面，覆盖：

1. 代码规模趋势
2. commit 趋势
3. release 节奏
4. 当前体积分布与基准对比
5. 产品演进时间线
6. 截图展示区
7. 文档站导航入口
8. 对应的自动化数据生成链路

## 非目标

- 不引入数据库或 SaaS 分析平台
- 不做实时后端 dashboard
- 不做权限分层后台
- 不把所有工程指标都公开；首版只选对外叙事也成立的指标
- 不为图表引入重量级图表库

## 产品定位

`Project Pulse` 不是“报表墙”，而是一个双用途页面：

- 对内：帮助观察代码体积、发布频率、模块分布与近期演进节奏
- 对外：向用户、贡献者与潜在关注者展示 NextClaw 的迭代速度、产品方向与工程克制

页面语气应更接近“产品脉搏”而不是“工程后台”。

## 信息架构

页面分为六个区块：

### 1. Hero / 概览

展示最少但最有叙事价值的指标：

- 当前源码 LOC
- 最近 30 天 commit 数
- 最近 90 天 release/tag 数
- 最近一次产品更新日期
- 与 OpenClaw 的源码体积对比

### 2. 趋势区

三条核心趋势：

- LOC 历史曲线
- 周 commit 趋势
- 月 release 趋势

要求：

- 不是单纯数字墙，要有趋势线与阶段说明
- 默认使用静态数据静态渲染，避免页面依赖运行时 API

### 3. 结构区

- 当前 top scopes 体积分布
- 代码规模说明与口径说明
- OpenClaw 基准对比卡片

### 4. 产品演进区

基于公开 `notes` 构建时间线：

- 近期产品更新列表
- 每条展示日期、标题、摘要、链接
- 对中英文文档站分别提供对应链接

### 5. Screenshot Gallery

- 展示当前代表性产品截图
- 显示最新自动化刷新时间
- 把“产品可视化演进”接上现有截图自动化链路

### 6. Explain / Trust

说明：

- 指标口径
- 为什么不是所有数据都公开
- 为什么这些数据能帮助理解 NextClaw 的持续演进

## 数据来源与生成策略

### A. LOC 数据

继续复用现有来源：

- `docs/metrics/code-volume/latest.json`
- `docs/metrics/code-volume/history.jsonl`
- `docs/metrics/code-volume/comparison.json`

### B. Commit 数据

新增脚本从 git 历史生成：

- 每日 commit 历史
- 最近 30 天 commit 总数
- 最近 12 周 commit 趋势
- 活跃天数

实现注意：

- workflow checkout 必须改为 `fetch-depth: 0`，否则历史不完整

### C. Release 数据

新增脚本从 git tag 生成：

- 每月 release/tag 数
- 最近 90 天 release 数
- 最近一次 release 日期
- 最近若干 tags 列表

说明：

- 首版以 tag 为 release 代理信号
- 后续如果要更强语义，可再接 changeset / GitHub Release metadata

### D. 产品时间线

新增脚本读取 `apps/docs/en/notes` 与 `apps/docs/zh/notes` 的 frontmatter 与索引，输出 timeline 数据。

### E. Screenshot 数据

新增脚本收集：

- `images/screenshots/*`
- 选定的 docs/landing 公共截图
- 文件修改时间

同时复制首版需要展示的截图到 docs 公共目录，避免文档站依赖站外路径。

### F. 页面聚合数据

新增一个统一生成脚本，输出单一静态模块：

- `apps/docs/.vitepress/data/project-pulse.generated.mjs`

这样 docs 页面只依赖一个聚合数据入口，不在 Vue 组件里到处拼文件。

## 页面实现策略

采用 VitePress 原生能力实现：

- 页面文件：中英文各一页
- 图表：自绘轻量 SVG / CSS，不引入额外 chart lib
- 视觉风格：做成明显的“产品脉搏”专题页，不沿用普通文档正文样式

实现拆分：

- 页面 markdown：承接标题、SEO、入口
- Vue 组件：承接布局、图表、视觉
- 生成脚本：承接数据整理

## 自动化策略

### 代码体积 workflow 扩展

在 `.github/workflows/code-volume-metrics.yml` 中：

- checkout 改为完整历史
- 在生成 LOC 后追加执行 `project pulse` 数据生成
- schedule / workflow_dispatch 时自动回写：
  - `docs/metrics/code-volume/*`
  - `apps/docs/.vitepress/data/project-pulse.generated.mjs`
  - docs 公共截图拷贝产物（若有）

### 本地执行入口

新增 workspace script，方便本地生成与验收：

- `pnpm project:pulse`

## 导航与站点接入

在中英文 docs 导航中增加入口：

- 英文：`/en/guide/project-pulse`
- 中文：`/zh/guide/project-pulse`

位置放在 `Project` 分组下，与 `Vision`、`Roadmap` 同级，符合“长期地位 + 对外叙事”定位。

## 验证与验收

### 开发验证

- `pnpm project:pulse`
- `pnpm -C apps/docs build`
- `pnpm lint:maintainability:guard`

如脚本或 docs 构建涉及类型或运行链路，再补：

- 受影响脚本的本地执行冒烟

### 用户视角验收

1. 打开中英文 `Project Pulse` 页面。
2. 首屏可以看到核心指标，而不是只有表格。
3. 趋势区能看到 LOC、commit、release 三类图表。
4. 结构区能看到 top scopes 与 OpenClaw 对比。
5. 时间线区能打开近期 Product Notes。
6. 截图区能看到当前产品画面与最近刷新时间。
7. 页面整体视觉明显区别于普通文档页，具备宣传质感。

### 发布闭环

如果本地环境具备 Cloudflare Pages 发布条件，则本次直接执行：

- `pnpm deploy:docs`

若环境缺少发布凭据，则至少完成：

- 本地构建通过
- 页面产物生成完成
- 提交完成
- 明确记录发布阻塞项

## 可维护性约束

虽然本次新增了专题页和数据脚本，但必须保持结构清晰：

- 不做零散 JSON 拼装
- 不在 markdown 中写大段内联逻辑
- 不为每一张图拆一堆薄文件
- 不为了“看起来高级”引入沉重依赖

优先复用现有数据，新增逻辑集中在一个聚合脚本和少量组件中。

## 实施顺序

1. 新增方案文档
2. 新增 `project pulse` 数据生成脚本
3. 扩展 workflow 与 package scripts
4. 新增 docs 公共数据与截图产物
5. 新增页面与图表组件
6. 接入中英文导航
7. 执行构建、可维护性检查与冒烟
8. 补迭代记录
9. 提交
10. 若凭据可用则执行 docs 发布
