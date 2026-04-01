# Nextbot Structure Governance Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `nextbot` 的“目录持续发散、owner abstraction 缺失、巨型页面/巨型模块继续长大”问题，收敛为一套默认阻断新增结构债务的自动化治理闭环；后续实现优先落机制，不做仓库级业务重构。

**Architecture:** 继续沿用仓库现有的三层治理思路：`ESLint` 负责通用静态约束，`post-edit-maintainability-guard` 负责 diff-only maintainability gate，新增一层“module structure contract + topology gate”负责结构漂移治理。这里不把 `class` 数量当 KPI，而把“是否存在明确 owner abstraction、是否继续在 flat mixed directory 里堆逻辑、是否保留平行主入口”当作机器可验证的治理目标。

**Tech Stack:** Node.js scripts, existing maintainability guard, ESLint flat config, topology governance report, AGENTS/commands workflow docs

---

## 1. 背景与问题定义

这次方案针对的不是单点坏文件，而是仓库已经出现的三类系统性结构退化：

1. 目录组织继续发散  
   核心目录如 `packages/nextclaw-server/src/ui`、`packages/nextclaw-ui/src/components/chat`、`packages/nextclaw-ui/src/components/config`、`workers/nextclaw-provider-gateway-api/src` 已经表现出“根目录过宽 + 多种组织模型并存 + shared 容器边界变弱”的趋势。

2. 本该有 owner abstraction 的逻辑仍以函数堆叠形式继续增长  
   问题不在于“函数不好”，而在于有状态、跨阶段、带生命周期或跨副作用编排的逻辑，没有稳定收敛到 class / manager / service / controller / presenter 这种 owner abstraction 中。

3. 治理机制已有基础，但还没有形成真正的默认主链路  
   仓库里已经有 `lint:maintainability:guard`、`lint:new-code:governance`、`check:topology`、hotspot freeze、incremental paydown 等机制，但它们还没有被统一为“默认收尾必须过、CI 必须过、目录契约必须解释”的一条闭环。

如果继续维持现状，结果不会只是“代码看起来乱一点”，而会直接伤害 NextClaw 作为统一入口产品的长期演进能力：

- 新能力越来越难找到正确落点
- 边界继续模糊，review 成本持续升高
- 每次改动更依赖维护者记忆，而不是可预测结构
- 不同模块重复制造同类 god file / god page / god controller

## 2. 当前基础与关键缺口

### 2.1 已存在的基础

仓库已经具备以下治理基座：

- `pnpm lint:maintainability:guard`
- `pnpm lint:new-code:governance`
- `pnpm check:topology`
- `scripts/lint-new-code-closure-objects.mjs`
- `scripts/lint-new-code-stateful-orchestrators.mjs`
- `scripts/lint-new-code-flat-directories.mjs`
- `scripts/lint-new-code-frozen-directories.mjs`
- `scripts/maintainability-hotspots.mjs`
- `docs/workflows/maintainability-hotspot-freeze.md`
- `docs/workflows/incremental-maintainability-paydown.md`

这说明仓库的问题不是“没有治理意识”，而是“治理还没收束成一套足够强的默认机制”。

### 2.2 当前缺口

本次应补的缺口有四个：

1. `check:topology` 还不是默认的收尾/准入 gate。  
   这让跨层耦合、孤儿模块、拓扑漂移更多停留在“报告可见”，而不是“默认阻断”。

2. 缺少模块级结构契约。  
   现在还没有统一数据源声明：
   - 一个模块采用 `feature-first` 还是 `layer-first`
   - 根目录允许出现哪些角色文件
   - 哪些 shared 目录允许存在
   - 哪些路径是主入口，哪些旧路径应退役

3. 缺少对 shared 容器退化的自动识别。  
   `utils`、`types`、`support`、`common`、`helpers` 之类目录，当前还缺少“只允许真正共享、低耦合、无业务编排内容”的自动守卫。

4. 缺少对“新结构出现后旧结构不退役”的自动识别。  
   目前最容易继续恶化的一类问题不是单文件变长，而是新旧主入口并存，导致事实来源不唯一。

## 3. 方案结论

### 3.1 不采用的错误方向

本次不采用以下思路：

- 不做“统计 class 占比并强推 class 数量提升”
- 不做“看到大文件就直接大重构”
- 不做“要求全仓统一成某一种目录模板”
- 不做“靠人工 review 口头提醒就算完成治理”

原因：

- `class` 只是 owner abstraction 的一种常见实现，不应被当作字面 KPI
- 当前真正要先阻断的是“新增结构债务”，不是立刻清仓历史债务
- 目录治理的目标是可预测、可解释、可验证，而不是形式统一

### 3.2 采用的核心方向

本次采用四件事组成的统一方案：

1. 把 `maintainability gate + topology gate` 收束为默认准入闭环。
2. 引入 `module structure contracts` 作为模块级单一事实来源。
3. 在 `lint:new-code:governance` 里补一条新的 `module-structure` diff-only 检查。
4. 对首批高风险目录建立目录级冻结和例外说明机制。

一句话总结：

**后续治理不再问“大家以后能不能注意”，而是问“新增结构债务能不能在默认主链路里直接被拦住”。**

## 4. 一次性落地范围

本次统一落地的实现范围明确收敛为“机制层一次性硬化”，不做业务逻辑重构：

- 允许改：
  - Node 治理脚本
  - `package.json` 命令入口
  - 文档与工作流
  - `AGENTS.md` / `commands/commands.md` 中与默认验证流程直接相关的条目
  - hotspot / frozen directory / structure contract 数据源

- 不做：
  - 仓库级业务代码重构
  - 大文件拆分
  - 页面/服务/控制器职责搬迁
  - 为了“过治理规则”而展开的功能逻辑改写

也就是说，这一轮治理实现的目标是：

**先把“继续变烂”变得很难，再在后续迭代中按热点逐步减债。**

## 5. 目标闭环

一次性落地后的默认闭环应当变成：

1. 开发者改动代码。
2. 收尾默认执行统一治理入口。
3. 统一入口至少覆盖：
   - `pnpm lint:maintainability:guard`
   - `pnpm check:topology`
4. `lint:maintainability:guard` 继续负责：
   - 文件预算
   - 目录预算
   - hotspot 留痕
   - diff-only 新债务阻断
5. `lint:new-code:governance` 继续负责：
   - class/object method arrow
   - closure object -> owner abstraction
   - stateful top-level orchestrator -> owner abstraction
   - flat directory -> subtree
   - frozen directory block
   - 新增的 module structure contract 检查
6. 若命中结构红区或契约冲突：
   - 默认阻断
   - 必须拆分、退役旧路径，或补完整豁免说明

## 6. 首批治理对象

本次机制硬化后，首批应纳入结构契约或冻结治理的目录：

- `packages/nextclaw-server/src/ui`
- `packages/nextclaw-ui/src/components/chat`
- `packages/nextclaw-ui/src/components/config`
- `workers/nextclaw-provider-gateway-api/src`
- `apps/platform-admin/src`
- `apps/platform-console/src`

其中优先级最高的是前三类：

- `packages/nextclaw-server/src/ui`
- `packages/nextclaw-ui/src/components/chat`
- `workers/nextclaw-provider-gateway-api/src`

原因：

- 这些目录正处在主链路
- 目录宽度、角色混用、owner abstraction 缺失信号最明显
- 如果不先冻结，后续每个新功能都可能继续往里堆

## 7. 结构契约设计

建议新增一个机器可读的数据源，例如：

- Create: `scripts/structure-governance-contracts.mjs`

每个 contract 至少包含：

- `modulePath`
- `organizationModel`
  - `feature-first`
  - `layer-first`
  - `flat-with-explicit-exception`
- `allowedRootRoles`
- `allowedSharedDirs`
- `primaryEntryPoints`
- `legacyPathsPendingRetirement`
- `frozen`
- `exceptionDoc`

### 7.1 这个 contract 要解决什么

它不是用来规定“所有目录必须长一样”，而是用来回答下面几个必须机器可验证的问题：

- 这个模块到底采用什么组织模型
- 根目录允许出现哪些角色文件
- shared 目录是否真的是共享，而不是垃圾桶
- 主入口到底是哪几个
- 新结构出现后，哪些旧路径应该退役

### 7.2 为什么必须用数据源而不是只写 Markdown

因为这套机制最终要由脚本阻断新增债务，而不是靠人读文档猜边界。

Markdown 可以解释背景，`contract data source` 才能成为脚本的单一事实来源。

## 8. 新增的自动化守卫

建议新增一个统一脚本，而不是继续分散判断逻辑：

- Create: `scripts/lint-new-code-module-structure.mjs`

它应读取 `scripts/structure-governance-contracts.mjs`，并负责以下 diff-only 检查：

### 8.1 Shared Directory Purity

检查目标：

- 新增或修改位于 `utils` / `types` / `support` / `common` / `helpers` 等共享容器下的文件

阻断条件：

- 文件明显只服务单一 feature
- 文件混入业务编排、I/O、副作用、环境读取、领域决策
- 文件路径让模块边界更模糊而不是更清晰

### 8.2 Parallel Entrypoints Retirement

检查目标：

- 同一模块出现新的主入口、注册器、controller、assembler、router 之后，旧路径仍继续被触达或继续保留为可误判的并行主路径

阻断条件：

- 新旧主入口同时存在，但 contract 未声明保留窗口
- `legacyPathsPendingRetirement` 缺失
- 已声明 legacy path，但缺少明确退出条件或 owner

### 8.3 Root Role Drift

检查目标：

- 根目录新增文件是否属于 contract 允许的角色

阻断条件：

- 本应进入子树的 feature 文件继续堆进根目录
- 根目录同时吸纳 UI / orchestration / integration / state 多种角色，且 contract 不允许

### 8.4 Organization Model Drift

检查目标：

- 目录是否开始混用与 contract 不一致的组织模型

阻断条件：

- 已声明 `feature-first` 的模块继续新增大量 `layer-first` 式根级平铺文件
- 已声明 `layer-first` 的模块继续把单一 feature 私有内容塞入根级 shared 容器

## 9. 默认命令闭环设计

建议把统一准入闭环显式收束为一个命令入口：

- Modify: `package.json`

建议新增：

- `check:repo-governance`

推荐定义：

```json
"check:repo-governance": "pnpm lint:maintainability:guard && pnpm check:topology"
```

同时：

- `/validate` 默认文档说明更新为“代码改动收尾默认执行 `pnpm check:repo-governance`”
- `AGENTS.md` 中默认验证说明同步到统一入口

理由：

- 避免治理命令继续分散
- 让结构治理成为默认主链路，而不是额外记忆负担

## 10. 目录级冻结策略

`scripts/lint-new-code-frozen-directories.mjs` 当前只冻结了 `packages/nextclaw-core/src/agent`，这远远不够。

建议首批扩展为：

- Modify: `scripts/lint-new-code-frozen-directories.mjs`

新增或评估冻结：

- `packages/nextclaw-server/src/ui`
- `workers/nextclaw-provider-gateway-api/src`
- `packages/nextclaw-ui/src/components/config`

冻结策略不是“一刀切禁止修改”，而是：

- 在 direct code files 超预算且还没有稳定子树边界时
- 禁止继续往根目录新增 unrelated structure
- 允许最小必要的 bug fix、桥接代码、拆分接线代码

如果某个目录确实必须临时保持宽根目录，则必须有显式豁免说明和退出条件。

## 11. 既有机制如何协同

### 11.1 保留并复用的机制

以下机制继续保留，不重复发明：

- `scripts/lint-new-code-closure-objects.mjs`
- `scripts/lint-new-code-stateful-orchestrators.mjs`
- `scripts/lint-new-code-flat-directories.mjs`
- `scripts/lint-new-code-frozen-directories.mjs`
- `scripts/maintainability-hotspots.mjs`
- `scripts/topology-governance-report.mjs`
- `post-edit-maintainability-guard`

### 11.2 对“class 用太少”的治理翻译

这次不新增“class 占比”类指标。

真正的治理翻译应当是：

- 共享状态跨多个顶层函数扩散时，必须有 owner abstraction
- closure-backed multi-method object 出现时，必须评估提升为 class / manager / explicit owner
- 新目录结构必须能为 owner abstraction 提供清晰落点

换句话说：

**治理的是“缺 owner abstraction 的结构”，不是“字面 class 数量”。**

## 12. 实施任务

### Task 1: 收束默认治理入口

**Files:**
- Modify: `package.json`
- Modify: `commands/commands.md`
- Modify: `AGENTS.md`

**目标：**

- 新增统一命令 `check:repo-governance`
- 让默认验证文档围绕统一入口而不是多个散命令展开

**验收：**

- 仓库存在 `pnpm check:repo-governance`
- `/validate` 与默认规则说明都指向同一入口

### Task 2: 引入模块结构契约数据源

**Files:**
- Create: `scripts/structure-governance-contracts.mjs`

**目标：**

- 给首批重点模块声明结构模型、允许根级角色、shared 目录边界、主入口和 legacy path 退役策略

**验收：**

- 首批重点模块都能在单一数据源中找到 contract
- contract 字段足以支持自动检查

### Task 3: 新增模块结构 diff-only 检查

**Files:**
- Create: `scripts/lint-new-code-module-structure.mjs`
- Modify: `scripts/lint-new-code-governance.mjs`

**目标：**

- 把 shared-dir-purity、parallel-entrypoints-retirement、root-role-drift、organization-model-drift 收进统一脚本
- 接入 `lint:new-code:governance`

**验收：**

- 新脚本可单独运行
- `pnpm lint:new-code:governance` 自动包含该检查
- 命中契约冲突时返回非零退出码

### Task 4: 扩大目录冻结和结构红区

**Files:**
- Modify: `scripts/lint-new-code-frozen-directories.mjs`
- Modify: `scripts/maintainability-hotspots.mjs`
- Modify: `docs/workflows/maintainability-hotspot-freeze.md`

**目标：**

- 把目录级风险从个别样本升级为首批重点目录的显式冻结/红区治理

**验收：**

- 新增的 frozen directory / hotspot 条目有明确原因和拆分缝
- 触达这些目录时默认能得到机器反馈，而不是只能靠人工提醒

### Task 5: 让 topology gate 进入默认主链路

**Files:**
- Modify: `package.json`
- Modify: `commands/commands.md`
- Modify: `AGENTS.md`

**目标：**

- `check:topology` 不再只是报告命令，而成为默认准入的一部分

**验收：**

- `pnpm check:repo-governance` 会实际执行 topology 检查
- 默认文档与验证流程不再遗漏 topology

### Task 6: 补齐工作流文档

**Files:**
- Create: `docs/workflows/module-structure-contracts.md`
- Modify: `docs/workflows/incremental-maintainability-paydown.md`

**目标：**

- 说明 structure contract 的写法、例外写法、何时新增 contract、何时退役 legacy path

**验收：**

- 后续维护者能不读历史上下文也知道如何补 contract 和豁免说明

## 13. 验收标准

后续真正开始实现时，必须同时满足：

1. 新增统一治理入口后，代码任务收尾能只执行一个命令完成默认结构治理检查。
2. `lint:new-code:governance` 新增模块结构检查，并能在契约冲突时阻断。
3. `check:topology` 进入默认主链路。
4. 首批重点模块都有结构契约。
5. 首批重点目录都有明确的冻结/豁免/拆分缝策略。
6. 没有引入业务逻辑重构或仓库级大拆分。

## 14. 非目标

本次实现明确不追求：

- 清零历史大文件
- 统一全仓目录命名风格
- 把所有函数改成 class
- 把所有目录都补成 feature-first
- 在本轮顺手做大重构

## 15. 风险与取舍

### 风险 1：规则过宽，导致噪音太多

缓解：

- 首批只对高风险模块写 contract
- diff-only 检查优先拦新增与恶化，不追杀全部历史债务

### 风险 2：规则过弱，起不到阻断作用

缓解：

- 统一入口必须进入默认验证主链路
- frozen directories 和 hotspot 必须显式扩容到当前真实重灾区

### 风险 3：把“class 少”误做成 KPI

缓解：

- 规则永远围绕 owner abstraction、shared state、entrypoint uniqueness、directory drift 来写
- 不引入 class 数量阈值

## 16. 本轮交付说明

按当前用户约束，这一轮只提交本计划文档，不开始任何治理脚本或业务代码改造。

这份文档的作用是：

- 把“为什么要做”写清楚
- 把“具体做什么”写清楚
- 把“后续实现改哪些文件”写清楚
- 把“如何验收算完成”写清楚

后续真正执行时，应以这份文档作为统一实现入口，而不是再临时拼方案。
