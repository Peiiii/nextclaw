---
name: post-edit-maintainability-guard
description: 在本仓库完成代码、脚本、测试或影响运行链路的配置改动后使用，用于自检可维护性漂移，重点发现超长文件和持续膨胀的文件。
---

# Post Edit Maintainability Guard

## 概述

在本仓库中，只要任务触达代码，就应在收尾阶段使用这个 skill。它把“记得保持可维护性”变成可重复执行的检查，并给出明确的文件预算、函数级复杂度约束与阻塞条件。

这个 skill 不替代 `build`、`lint`、`tsc` 或冒烟测试。它补的是“可维护性闸门”，重点关注：

- 文件膨胀、超长文件漂移，以及是否已经到达必须拆分的时点
- 函数级职责爆炸，例如超长函数、语句数过多、嵌套过深、认知复杂度过高
- 文件名是否与主职责明显错配，尤其是 `cache` 这类高歧义角色后缀
- 是否通过新增 `eslint-disable` 注释来绕过既有可维护性约束

## 何时使用

- 修改了源码、脚本、测试，或影响运行链路的配置之后。
- 尤其适用于触达 `service`、`controller`、`manager`、`runtime`、`loop`、`router`、`Page`、`App`，以及大型表单/容器组件时。
- 任何代码改动任务在最终回复前都应执行一次。

纯文档、措辞微调或元信息小改动不适用；这类情况要明确说明“本次不适用”。

## 执行流程

1. 先判断本次任务是否触达代码路径。
2. 默认执行：

```bash
node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs
```

3. 如果只检查特定文件，执行：

```bash
node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths path/to/file.ts path/to/file.tsx
```

4. 脚本会同时做三层检查：

- 文件级预算检查：比较当前文件与 `HEAD` 的行数变化
- 函数级规则检查：复用仓库 ESLint 结果，关注 `max-lines-per-function`、`max-statements`、`max-depth`、`sonarjs/cognitive-complexity`
- 命名职责一致性检查：按 diff-only 原则检查文件名是否与实现主职责明显冲突；当前优先覆盖高置信度场景，例如文件名声明 `cache`，但内容只呈现纯映射 / updater 逻辑且缺少缓存协调信号
- 红区治理检查：若本次触达仓库红区文件，则校验当前迭代 `README.md` 是否包含 `## 红区触达与减债记录`，并为每个红区文件提供 `### <repo-path>` + `本次是否减债 / 说明 / 下一步拆分缝`

5. 以下情况默认视为阻塞项：
- 新文件直接超出预算。
- 文件从预算内增长到预算外。
- 文件原本已超预算，这次改动后还在继续增长。
- 新文件引入函数级可维护性违规。
- 本次改动引入新的函数级可维护性违规。
- 已存在的函数级违规在本次改动后进一步恶化。
- 新文件名与主职责明显不一致。
- 本次改动引入新的文件名-职责错配。
- 本次新增了针对 `max-lines` / `max-lines-per-function` / 复杂度规则的 `eslint-disable` 注释。
- 本次触达红区文件，但未在本次迭代日志里记录红区触达与减债状态。
- 本次触达红区文件，但日志块缺少 `本次是否减债`、`说明` 或 `下一步拆分缝`。

6. 以下情况默认视为警告：
- 文件已经逼近预算线，进入预算的 80% 以上。
- 文件本次增长明显，但尚未超预算。
- 你触达了一个原本就超限的函数，但本次没有继续把它变得更糟。
- 你触达了一个原本就存在文件名-职责错配的文件，但本次没有继续恶化。
- 你触达了红区文件，并已留下完整的减债记录；这类任务仍应在结果中明确“本次是否减债”。

7. 出现阻塞项时，默认应继续拆分后再结束任务；除非用户明确接受这笔债务。若保留债务，必须说明原因、指出下一步拆分缝，并在最终回复中写明风险。

## 预算规则

- 默认源码文件：400 行。
- `service` / `controller` / `manager` / `runtime` / `loop` / `router` / `provider`：600 行。
- React 页面或 App 入口：650 行。
- UI 组件 / form / dialog / panel：500 行。
- 测试文件：900 行。
- `types` / `schema` / `constants` / 明确的纯配置文件（如 `*.config.ts`）：900 行。

预算只是启发式边界，不代表文件低于预算就一定设计良好。像裸名 `config.ts` 这类文件，若承载运行逻辑，不应自动按“纯配置文件”放宽预算。即使文件没超限，只要职责明显混杂，也应指出风险。

函数级规则不直接复刻在 skill 文档里，而是复用当前仓库 ESLint 基线。这样可以避免“ESLint 是一套阈值、skill 又是另一套阈值”的漂移。

## Diff-only 原则

这个 skill 的目标不是让每次任务都被历史债务卡死，而是优先阻断“新增债务”。

- 历史超长文件若本次没有继续增长，通常只给警告。
- 历史超限函数若本次没有继续恶化，通常只给警告。
- 历史文件名若原本就与主职责不一致、但本次只是触达且未继续引入新的错配，通常只给警告。
- 只要本次改动新增或恶化了文件级 / 函数级 / 命名职责债务，就视为阻塞项。

换句话说，这个 skill 默认是一个 “diff-only maintainability gate”。

## 输出约定

运行这个 skill 后，输出里必须包含：

- 本次检查是否适用
- 实际检查了哪些文件
- 是否存在阻塞项
- 是否存在值得跟踪的警告
- 文件级风险与函数级风险的区分
- 命名职责风险与文件级 / 函数级风险的区分
- 红区治理风险与其它风险的区分
- 若命中函数级风险，命中的规则名、函数/方法名（若能识别）、以及位置
- 若命中命名职责风险，需指出角色名、错配原因，以及推荐的重命名或拆分方向
- 若命中红区治理风险，需指出红区文件路径、缺失的日志字段，以及应该补到哪个 `docs/logs/.../README.md`
- 每个风险文件的下一步拆分位点

## 资源

- `scripts/check-maintainability.mjs`：Node 版入口脚本
- `scripts/maintainability-guard-core.mjs`：结果组装与 diff-only 判定
- `scripts/maintainability-guard-hotspots.mjs`：红区触达与迭代日志校验
- `scripts/maintainability-guard-lint.mjs`：ESLint 结果解析
- `scripts/maintainability-guard-support.mjs`：git / 文件 / 预算辅助函数
- `../../../../scripts/maintainability-hotspots.mjs`：仓库红区清单与日志格式约定
