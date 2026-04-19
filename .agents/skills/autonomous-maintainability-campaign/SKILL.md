---
name: autonomous-maintainability-campaign
description: 当用户希望这个仓库执行一次可跨上下文压缩、可整夜续跑、低人工监督的长期可维护性治理战役时使用，尤其适用于治理规则已经明确、主要挑战是稳定自治推进而不是一次性方案设计的场景。
---

# 自治可维护性治理战役

## 概述

当任务目标不是“修一个可维护性问题”，而是“在较长时间里持续清理可维护性债务，并尽量减少人工盯盘”时，使用这个 skill。

这是一个面向 Nextbot / NextClaw 仓库的长期任务 skill。它可以依赖本仓库的治理机制，但应尽量避免依赖具体业务模块、具体产品功能或写死的业务目录，除非当前批次确实离不开这些信息。

它的目标，是让治理进展在以下场景下仍然稳定：

- 长对话
- 上下文压缩
- 多次唤醒
- 整夜自治续跑

核心思路非常简单：

1. 每一轮都先读取同一份外部状态
2. 只选一个高置信治理批次
3. 推进该批次
4. 执行验证
5. 把状态写回去
6. 只有当下一步仍然高置信时才继续

不要把聊天记忆当作真相源。

## 何时使用

以下场景适合使用：

- 用户希望做“整夜跑”或“持续往下推进”的可维护性治理
- 仓库里的治理规则已经基本明确，当前任务主要是执行而不是重新定义规则
- 任务大概率会跨多轮或多次唤醒
- 当前更在乎上下文连续性，而不是单次实现速度
- 用户希望 agent 主动持续减债，而不是等用户一次次点一个问题

以下场景通常不适合使用：

- 单个很小的局部重构
- 作用域明确的一次性 bugfix
- 宽泛的产品设计工作
- 重点不是可维护性治理的功能开发

## 必需输入

开始第一轮治理前，必须先对齐以下仓库真相源：

- `docs/VISION.md`
- `AGENTS.md` 里的相关规则，尤其是 Rulebook / Project Rulebook 与 `docs/logs` 机制
- `commands/commands.md` 里的 `/validate` 与 `/maintainability-review`
- `.agents/skills/iteration-work-notes/SKILL.md`
- `.agents/skills/post-edit-maintainability-guard/SKILL.md`
- `.agents/skills/post-edit-maintainability-review/SKILL.md`

把仓库治理规则视为硬约束，不要把它们当作建议。

## 治理机制分层

为避免长期任务跑偏，默认把本仓库的可维护性治理机制理解成四层。

### 第一层：上位目标与硬规则

这是最核心的一层，任何长期治理都不能绕开：

- `docs/VISION.md`
- `AGENTS.md` 的 Rulebook / Project Rulebook
- `AGENTS.md` 的 `docs/logs` 留痕机制

其中与长期治理直接相关的关键规则，至少包括：

- `business-logic-must-use-class`
- `class-over-function-sprawl`
- `stateless-utility-first`
- `ordinary-function-no-input-mutation`
- `class-arrow-methods-by-default`
- `react-effect-boundary-only`
- `long-term-maintainability-mission-default`
- `non-feature-changes-must-not-bloat-codebase`
- `delete-simplify-before-add`
- `incremental-maintainability-paydown-on-touch`

### 第二层：执行入口

这是把规则落到当前任务上的直接入口：

- `commands/commands.md` 中的 `/validate`
- `commands/commands.md` 中的 `/maintainability-review`
- `.agents/skills/post-edit-maintainability-guard/SKILL.md`
- `.agents/skills/post-edit-maintainability-review/SKILL.md`

### 第三层：长期任务抗失忆与留痕

- `.agents/skills/iteration-work-notes/SKILL.md`
- `docs/logs/v<semver>-<slug>/README.md`
- `docs/logs/.../work/working-notes.md`
- `docs/logs/.../work/state.json`

### 第四层：按场景补充

以下内容不是每轮都必读，但在命中对应问题形态时应主动补读：

- `docs/workflows/incremental-maintainability-paydown.md`
- `docs/workflows/maintainability-hotspot-freeze.md`
- `.agents/skills/file-organization-governance/SKILL.md`
- `.agents/skills/file-naming-convention/SKILL.md`
- `.agents/skills/role-first-file-organization/SKILL.md`
- `.agents/skills/collapsible-feature-root-architecture/SKILL.md`
- `.agents/skills/predictable-behavior-first/SKILL.md`

不要每次都把第四层全文读完，只在当前批次确实命中时再补。

## 启动前快速核对

在真正开始第一轮改动前，至少先回答以下问题：

1. 这次是不是长期可维护性治理，而不是功能开发？
2. 当前要用到的治理规则，是否已经在 `AGENTS.md` 中明确写明？
3. 当前活跃迭代目录是否已确定，`docs/logs` 留痕路径是否明确？
4. 当前批次是否属于非功能改动，是否需要把 `非测试代码净增 <= 0` 当成硬门槛？
5. 当前是否命中 hotspot、目录预算、命名治理或结构治理等专项场景？
6. 本轮是否已有可执行的最小验证方案？

## 最小运行时状态

在当前活跃迭代目录的 `work/` 下，默认只维护两个状态文件：

- `work/working-notes.md`
- `work/state.json`

默认职责分工：

- `working-notes.md`：给人看的当前真相源
- `state.json`：给机器读的续跑状态

如果当前任务已经有合法迭代目录，而这两个文件还不存在，就从本 skill 的模板生成。

除非内容已经明显失控，否则不要继续新增其它状态文件。

## 战役初始化

在战役开始时：

1. 按仓库 `docs/logs` 规则识别当前活跃迭代目录
2. 创建或更新 `work/working-notes.md`
3. 创建或更新 `work/state.json`
4. 在两个文件里都写入简短战役目标
5. 记录初始候选问题批次

问题批次应优先按治理形状划分，而不是按业务形状划分。优先使用如下批次：

- class owner 收敛 / 函数蔓延治理
- React effect boundary 治理
- 普通函数改入参治理
- 文件组织与命名治理
- 非功能改动净增长回收
- 已触达范围内的 maintainability guard 积压项

尽量不要把批次直接写成“设置页”“provider 页面”“discord 模块”这类业务名称，除非当前轮次确实必须收窄到那里。

## 执行循环

每一轮自治推进都必须严格按以下顺序执行：

1. 重新读取 `work/working-notes.md` 与 `work/state.json`
2. 必要时重新读取直接相关的治理 skill 文档
3. 只选择一个高置信批次
4. 为该批次做最小但完整的一组改动
5. 执行仓库规则要求的最小充分验证
6. 执行或应用 `post-edit-maintainability-guard`
7. 执行一次 `post-edit-maintainability-review`
8. 把以下内容写回两个状态文件：
   - 已完成什么
   - 已否决什么
   - 还剩什么
   - 精确的下一步是什么
9. 判断是立即继续、等待下一次 heartbeat，还是停止

不要因为代码位置相邻，就在同一轮里混做无关批次。

每轮开始前，默认先重新确认两件事：

- 当前批次仍然属于同一治理目标，而没有悄悄漂移成产品需求
- 当前下一步仍然能被归到一个明确的治理规则，而不是主观风格偏好

## 批次选择规则

只有当下一批仍然是高置信时，才允许继续自治推进。

一个批次要被视为高置信，至少同时满足：

- 要执行的规则已经在仓库治理里写明
- 修复方向在结构上是明显的
- 验证手段已经存在，而且当前就能执行
- 这批改动可以被当成一个连贯的可维护性步骤来 review

优先顺序：

1. 语义风险低的确定性治理清理
2. owner 边界清晰的结构简化
3. 更大范围的重构，但前提是前面的小批次已经收敛

默认批次颗粒度应控制在“一轮能完成改动、验证、守卫、复核并写回状态”的范围内。若一个批次大到需要拆成两轮以上，默认先拆小。

## 停机条件

出现以下任一情况时，必须停止自治循环，并把原因写入两个状态文件：

- 剩下的都只是低置信架构判断
- 下一步需要补充产品意图澄清
- 验证结果含混不清
- 仓库规则之间出现需要人工裁决的冲突
- 下一步会跨越太多无关关注点
- 当前工作已经不再是可维护性治理，而变成了产品开发

不要为了“继续忙下去”就随便切换到附近的其它工作。

## 整夜续跑 / Heartbeat 模式

当用户希望长时间无人值守地持续推进时，优先使用 thread heartbeat automation。

每次被唤醒后，都应该把自己当成新的一轮：

1. 读取当前状态文件
2. 检查当前仓库状态
3. 如果下一批仍然高置信，就继续推进
4. 否则干净停下，并留下阻塞说明

automation prompt 应该短而耐用，描述长期 standing task，而不是某个临时子步骤。

## Working Notes 要求

`working-notes.md` 必须保持简洁、可接手、可续跑。要持续维护当前真相，而不是堆积过期结论。

它应当始终回答以下问题：

- 当前战役目标是什么？
- 哪些事实已经确认？
- 当前活跃批次是什么？
- 哪些事情已经完成？
- 哪些路径已经明确排除？
- 精确的下一步是什么？
- 如果已经停机，停机原因是什么？

## 验证规则

这个 skill 不替代仓库已有验证规则，它负责把这些规则编排进长期循环。

对每个批次：

- 按触达范围执行最小充分验证
- 如果该批次属于非功能改动，要套用更严格的非功能 maintainability 检查
- 不要把“代码已经改了”当成成功
- 如果验证或 maintainability review 仍判定需要继续修改，就不要继续往下跑

当任务本质是修可维护性债务而不是新增用户能力时，代码净增长默认应被视为可疑信号，并优先尝试回收。

### 默认验证接线

若当前批次触达代码，默认按以下顺序接线：

1. 先按 `AGENTS.md` 中的关键结构规则做实现前自检
2. 按 `commands/commands.md` 的 `/validate` 口径执行最小充分验证
3. 执行 `post-edit-maintainability-guard`
4. 执行 `pnpm lint:new-code:governance`
5. 执行 `pnpm check:governance-backlog-ratchet`
6. 执行 `post-edit-maintainability-review`

若当前批次属于纯 bugfix、纯重构、结构整理、命名调整或其它非新增用户能力改动，应优先套用：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`

必要时可配合 `--paths <touched-files...>` 收窄范围。

若当前批次触达 hotspot 文件或相关目录红区，还应补读并遵循：

- `docs/workflows/maintainability-hotspot-freeze.md`
- `docs/workflows/incremental-maintainability-paydown.md`

### 验证失败后的默认动作

若验证、guard 或 review 失败，默认按以下顺序处理：

1. 先判断是否还能在当前批次内继续删减或简化
2. 若还能修，就继续留在当前批次，不要跳到新批次
3. 若修不动且原因明确，写入阻塞与下一步
4. 若失败说明当前批次本身切得过大，先把批次拆小，再继续

## 与现有治理 Skill 的配合

这里不要重复实现现有治理 skill 的细节逻辑，而应直接配合它们：

- 使用 `iteration-work-notes` 来整理和刷新 `work/working-notes.md`
- 使用 `post-edit-maintainability-guard` 作为客观闸门
- 使用 `post-edit-maintainability-review` 作为主观二审

这个 skill 负责长期循环和批次推进；其它治理 skill 负责各自的局部判断。

此外，本 skill 默认把 `commands/commands.md` 中的 `/validate` 与 `/maintainability-review` 视为“执行协议入口”，而不是可选参考。

## 非目标

这个 skill 不是用来做下面这些事的：

- 临时发明新的可维护性政策
- 按个人风格偏好去重写整个仓库
- 试图在一轮里追完所有 warning
- 把无关功能开发打包进治理战役里

它的职责，是在既有治理规则下做纪律化的自治执行。

## 完成条件

只有在以下任一情况成立时，战役才算完成：

- 目标中的高置信批次队列已经耗尽
- 剩余工作全部卡在低置信设计判断上
- 用户结束或重定向该战役

完成时：

1. 确保 `work/working-notes.md` 反映最终状态
2. 确保 `work/state.json` 已标记为 `已停止` 或 `已完成`
3. 如果仓库规则要求留痕，更新对应迭代的 `README.md`
4. 最后总结：
   - 清掉了什么
   - 有意留下了什么
   - 如果后续重启战役，下一条最合适的切入缝在哪里
