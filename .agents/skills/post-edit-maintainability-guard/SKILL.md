---
name: post-edit-maintainability-guard
description: 在本仓库完成代码、脚本、测试或影响运行链路的配置改动后使用，用于自检可维护性漂移，重点发现超长文件和持续膨胀的文件。
---

# Post Edit Maintainability Guard

## 定位

这个 skill 用来在“代码已改完、准备收尾”时执行一轮可维护性自检。它不替代 `build`、`lint`、`tsc` 或冒烟测试，补的是另一条线：

- 结构是否正在继续膨胀
- 职责是否正在继续混杂
- 历史债务是否被继续放大
- 本次改动是否留下了可追踪的维护成本信号

它的核心定位仍然是一个 `diff-only maintainability gate`，但文档上需要把“闸门型检查”和“趋势型指标”区分开。前者决定是否阻塞，后者负责持续观察。

## 能力地图

当前这套可维护性检查可以按两类信号理解。

### 一类：闸门型信号

这些信号用于阻断“新增债务”：

- 文件级预算检查
- 目录级预算检查
- 函数级复杂度与长度检查
- 文件名与主职责一致性检查
- 红区触达与减债记录检查
- 通过新增 `eslint-disable` 绕过既有约束的检查

### 二类：趋势型信号

这些信号默认用于报告和趋势跟踪，不应轻易直接阻塞：

- 仓库总体代码体积
- `TypeScript` / `TSX` 文件数与代码行数
- `TS + TSX` 的合并体积
- Top scope / Top package 的体积变化
- 与上一次快照相比的增量

这里的“代码统计”属于可维护性的一部分，但它更适合作为趋势信号，而不是直接和“超长函数”“目录失控”混为同一阻塞级别。

## 适用范围

以下场景默认适用：

- 修改了源码、脚本、测试
- 修改了会影响运行链路的配置
- 尤其适用于触达 `service`、`controller`、`manager`、`runtime`、`loop`、`router`、`Page`、`App`，以及大型表单/容器组件

以下场景默认不适用：

- 纯文档改动
- 措辞微调
- 元信息小改动

不适用时，需要在结果中明确说明“本次不适用”及原因。

## 默认执行入口

默认入口不变，仍然是：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs
```

如果这次属于纯 bugfix、纯重构、结构整理、命名调整或其它不新增用户能力的改动，必须改用：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature
```

如果只检查特定文件：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths path/to/file.ts path/to/file.tsx
```

如果既是非功能改动，又只想检查当前触达范围，可以组合：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths path/to/file.ts path/to/file.tsx
```

如果需要补充仓库级代码体积快照，可额外查看：

```bash
pnpm metrics:repo:local
```

或：

```bash
node scripts/metrics/code-volume-metrics.mjs --scope-profile repo-volume --no-write --print-summary
```

这里的代码统计默认仍属于“补充信号”，用于增强 maintainability report；但在 `--non-feature` 模式下，`非测试代码净增 <= 0` 会升级为真实阻塞逻辑。

## 非功能改动的正确解法

`--non-feature` 模式下，非测试代码净增 `<= 0` 只是最低门槛，不是最终目标。真正目标是让生产代码维护成本下降。

完成标准是代码质量和可维护性提升。一次非功能改动只有在生产代码出现可观察的改善时才算通过：owner 更清晰、行为更简单、分支或状态更少、复用更自然、耦合更低、验证更容易，或需要维护的代码更少。行数达标和正向减债动作只是证明这个结果的证据，不是结果本身。

当非功能改动被 line-change gate 阻塞时，默认按以下顺序解决：

1. 删除：移除死代码、重复路径、过期兼容、无用状态、无效分支或不再需要的生产代码。
2. 简化：减少条件分支、状态来源、参数传递、生命周期入口、数据流转换和需要同时理解的行为面。
3. 复用：优先使用已有稳定组件、manager、service、utility、类型或配置路径，避免复制平行实现。
4. 职责收敛：把散落的业务逻辑收回正确的 class / manager / presenter / service owner。
5. 必要解耦抽象：只有当抽象能消除重复、降低耦合、澄清 owner 或让调用方更简单时，才作为有效减债手段。

删除和简化优先于新增抽象。新增抽象若只是多一层间接调用，不能算通过 line-change gate 的正向解法。

收尾复核时必须能说清楚本次是哪一种正向减债动作让非功能改动通过，以及它如何带来代码质量或可维护性提升，而不是只报告行数达标。

## 检查模型

默认检查模型分为六层。

### 1. 文件级预算

- 比较当前文件与 `HEAD` 的行数变化
- 判断是否进入预算外、是否继续膨胀、是否已逼近预算

### 2. 目录级预算

- 比较被触达目录的“直接手写代码文件数”是否达到 `12` 个硬限制
- 按 diff-only 原则判断目录是否继续膨胀

### 3. 函数级规则

复用仓库 ESLint 结果，关注：

- `max-lines-per-function`
- `max-statements`
- `max-depth`
- `sonarjs/cognitive-complexity`

同时要注意与增量治理脚本的联动：`pnpm lint:new-code:governance` 当前除了 touched class / touched object 的箭头函数治理外，还会开始检查“普通函数是否偷偷修改入参”“React effect 是否把业务逻辑留在渲染后补丁里”“闭包多方法对象是否该升成 class/owner”“扁平混杂目录是否该长子树”“共享状态的顶层编排是否缺 owner”。其中 class 方法箭头函数这条虽然不由本 skill 直接计算阈值，但收尾时若命中该问题，默认修复策略应是：

- 以当前触达的 class 为边界，统一检查该 class 内所有可治理的实例方法
- 优先一次性把同类普通实例方法一起改成 `methodName = () => {}`
- 不要只修当前报错的那一个方法，避免同一个 class 在后续改动里重复触发同类治理噪音
- `constructor`、`get/set`、`static`、`abstract`、`override`、带 decorator 的方法仍按既有豁免处理

若命中“普通函数修改入参”这条治理，默认修复策略应是：

- 优先改成 `input -> output` 或 `input -> patch` 的纯返回形式
- 若逻辑本质是状态 owner / 生命周期 owner，则提升为明确 class 边界
- 不要继续保留“helper 名字 + 原地改入参”的中间形态

若命中“React effect owner 边界”这条治理，默认修复策略应是：

- 先判断这段 effect 是否真的在同步外部系统
- 若不是，优先把远端读取迁回 `query / view hook`
- 本地 UI 态迁回 `store`
- 业务动作、状态迁移与跨模块协调迁回 `manager / presenter`
- 不要继续在 effect 中堆条件分支，把它当渲染后的业务补丁点

### 4. 命名职责一致性

按 diff-only 原则检查文件名是否与实现主职责明显冲突。当前优先覆盖高置信度场景，例如：

- 文件名声明 `cache`
- 但内容只呈现纯映射 / updater 逻辑
- 且缺少缓存协调信号

### 5. 红区治理

若本次触达仓库红区文件，则校验当前迭代 `README.md` 是否包含：

- `## 红区触达与减债记录`
- `### <repo-path>`
- `本次是否减债`
- `说明`
- `下一步拆分缝`

### 6. 代码体积统计

这部分当前应作为 report signal 来理解，重点看：

- 仓库总体 `LOC`
- `TypeScript` 文件数与代码行数
- `TSX` 文件数与代码行数
- `TS + TSX` 的合并规模
- Top scope 的体积分布
- 相对上一次快照的增量

文档上应把它明确纳入 maintainability 体系。默认模式下，它仍不与文件预算、复杂度、红区治理共享同一阻塞级别；但在 `--non-feature` 模式下，排除测试后的非测试代码净增若大于 `0`，就必须直接阻断。

即使 `--non-feature` 模式下非测试净增已经 `<= 0`，后续 `post-edit-maintainability-review` 仍必须判断减债方式是否真实有效：能否对应到删除、简化、复用、职责收敛或必要解耦抽象；若只是让代码更密、更难读，或把复杂度移到统计口径之外，不能视为通过。

## 阻塞项

以下情况默认视为阻塞项：

- 新文件直接超出预算
- 文件从预算内增长到预算外
- 文件原本已超预算，这次改动后还在继续增长
- 新文件引入函数级可维护性违规
- 本次改动引入新的函数级可维护性违规
- 已存在的函数级违规在本次改动后进一步恶化
- 新文件名与主职责明显不一致
- 本次改动引入新的文件名-职责错配
- 目录从 `<12` 个直接手写代码文件增长到 `>=12`，且目录内没有明确记录的“目录预算豁免”说明
- 目录达到或超过 `12` 个直接手写代码文件，但目录 `README.md` 中的“目录预算豁免”块缺失或不完整
- 本次新增了针对 `max-lines` / `max-lines-per-function` / 复杂度规则的 `eslint-disable` 注释
- 本次触达红区文件，但未在本次迭代日志里记录红区触达与减债状态
- 本次触达红区文件，但日志块缺少 `本次是否减债`、`说明` 或 `下一步拆分缝`
- 在 `--non-feature` 模式下，排除测试后的非测试代码净增大于 `0`
- 非功能改动虽然满足非测试代码净增 `<= 0`，但后续复核无法指出任何正向减债动作：删除、简化、复用、职责收敛或必要解耦抽象

## 警告项

以下情况默认视为警告：

- 文件已经逼近预算线，进入预算的 80% 以上
- 目录达到或超过 `12` 个直接手写代码文件，但已在目录 `README.md` 中留下完整的“目录预算豁免”说明
- 已经达到或超过 `12` 个直接手写代码文件的历史目录，本次触达但未继续恶化，且仍未补豁免说明
- 文件本次增长明显，但尚未超预算
- 你触达了一个原本就超限的函数，但本次没有继续把它变得更糟
- 你触达了一个原本就存在文件名-职责错配的文件，但本次没有继续恶化
- 你触达了红区文件，并已留下完整的减债记录；这类任务仍应在结果中明确“本次是否减债”
- 代码体积增长明显，但还未达到需要调整结构或拆分范围的程度

出现阻塞项时，默认应继续拆分后再结束任务；除非用户明确接受这笔债务。若保留债务，必须说明原因、指出下一步拆分缝，并在最终回复中写明风险。

## 预算规则

- 默认源码文件：400 行
- 默认目录文件预算：`12` 个直接手写代码文件起默认禁止
- 目录级预算统计口径：只看当前目录的直接代码文件，不递归子目录
- 目录级预算默认排除：`__tests__`、`tests`、`__fixtures__`、`fixtures`、`generated`、`migrations`
- `service` / `controller` / `manager` / `runtime` / `loop` / `router` / `provider`：600 行
- React 页面或 App 入口：650 行
- UI 组件 / form / dialog / panel：500 行
- 测试文件：900 行
- `types` / `schema` / `constants` / 明确的纯配置文件：900 行

若目录确实必须达到或超过 `12` 个直接手写代码文件，需在该目录的 `README.md` 中显式加入以下块：

```md
## 目录预算豁免
- 原因：该目录受框架或生成约束，必须保留扁平文件集合。
```

预算只是启发式边界，不代表文件低于预算就一定设计良好。像裸名 `config.ts` 这类文件，若承载运行逻辑，不应自动按“纯配置文件”放宽预算。即使文件没超限，只要职责明显混杂，也应指出风险。

函数级规则不直接复刻在 skill 文档里，而是复用当前仓库 ESLint 基线，避免“ESLint 一套阈值、skill 又是一套阈值”的漂移。

## Diff-only 原则

这个 skill 的目标不是让每次任务都被历史债务卡死，而是优先阻断“新增债务”。

- 历史超长文件若本次没有继续增长，通常只给警告
- 历史超限函数若本次没有继续恶化，通常只给警告
- 历史文件名若原本就与主职责不一致、但本次只是触达且未继续引入新的错配，通常只给警告
- 历史代码体积本身偏大，不自动构成阻塞；只有当趋势明显恶化并伴随结构风险时，才应升级处理

只要本次改动新增或恶化了文件级 / 函数级 / 命名职责 / 红区治理债务，就视为阻塞项。

## 输出约定

运行这个 skill 后，输出里必须包含：

- 本次检查是否适用
- 实际检查了哪些文件
- 是否存在阻塞项
- 是否存在值得跟踪的警告
- 文件级风险、目录级风险与函数级风险的区分
- 命名职责风险与文件级 / 函数级风险的区分
- 红区治理风险与其它风险的区分
- 若命中目录级风险，需指出目录路径、当前文件数、变更前文件数、是否存在豁免说明，以及推荐的拆分方向
- 若命中函数级风险，命中的规则名、函数/方法名、以及位置
- 若命中 class 方法箭头函数治理问题，需额外给出“当前 class 是否已整类修复”与“若未整类修复，原因是什么”
- 若命中命名职责风险，需指出角色名、错配原因，以及推荐的重命名或拆分方向
- 若命中红区治理风险，需指出红区文件路径、缺失的日志字段，以及应该补到哪个 `docs/logs/.../README.md`
- 若补充了代码体积统计，需单独列出 `TypeScript`、`TSX`、`TS + TSX` 的文件数 / 代码行数 / 增量
- 每个风险文件的下一步拆分位点

推荐的输出顺序是：

1. 适用性
2. 阻塞项
3. 警告项
4. 代码体积摘要
5. 下一步拆分建议

## 扩展约定

后续给这个 skill 加能力时，优先沿着“信号类型”扩展，而不是继续堆一段段流程说明。

推荐扩展方向：

- 新的闸门型信号：例如目录职责边界、跨层依赖、重复实现
- 新的趋势型信号：例如 `TS/TSX` 体积趋势、测试资产密度、模块增长速度
- 新的治理报告：例如按 package 输出 maintainability profile

判断标准：

- 能直接阻断新增债务的，归入闸门型信号
- 更适合长期观察和比较的，归入趋势型信号

## 资源

- `scripts/check-maintainability.mjs`：Node 版入口脚本
- `scripts/maintainability-guard-core.mjs`：结果组装与 diff-only 判定
- `scripts/maintainability-guard-directory-budget.mjs`：目录文件预算与豁免说明检查
- `scripts/maintainability-guard-hotspots.mjs`：红区触达与迭代日志校验
- `scripts/maintainability-guard-lint.mjs`：ESLint 结果解析
- `scripts/maintainability-guard-support.mjs`：git / 文件 / 预算辅助函数
- `../../../../scripts/governance/maintainability-hotspots.mjs`：仓库红区清单与日志格式约定
- `../../../../scripts/metrics/code-volume-metrics.mjs`：仓库代码体积快照与 LOC 趋势统计
