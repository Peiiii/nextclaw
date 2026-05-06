---
name: nextclaw-delivery-workflow
description: 用作源码、脚本、测试、运行链路配置任务的默认端到端交付流程 owner；当用户要求实现、修复、重构、验证、提交、收尾、完成工作，或需要标准化流程与主动汇报时使用。
---

# NextClaw 标准交付流程

## 目标

提供一个统一的实现与收尾流程入口，避免代理记住了很多零散规则，却仍然漏掉跨步骤义务。

`AGENTS.md` 负责固定的主流程骨架。  
本 skill 负责这些主步骤背后的条件细节、skill 路由、收尾强制检查与最终主动汇报。

本 skill 统一承接：

- 目标对齐
- 实现前删减与收敛判断
- 实现阶段约束
- 验证闭环
- 可维护性披露
- 复盘后的机制改进
- 迭代留痕决策
- 最终汇报合同

它不替代专项 skill，而是编排它们。

## 必须联动的专项 skill

按需使用并遵守：

- `nextclaw-clean-implementation`
- `predictable-behavior-first`
- `nextclaw-validation-workflow`
- `post-edit-maintainability-guard`
- `post-edit-maintainability-review`
- `nextclaw-iteration-log-governance`
- 当复盘结论涉及治理系统时，用 `nextclaw-agent-instructions-governance`

## 主流程与条件展开

`AGENTS.md` 已固定 6 个主步骤。  
本 skill 负责这些主步骤背后的条件展开，避免主流程骨架与条件细节分离后漂移。

### 1. 目标与成功标准

动手前必须明确：

- 这是新增用户能力，还是非功能改动
- 这次到底要改变什么用户可见或可观察结果
- 什么现象算修好
- 哪些旧代码、旧分支、旧中间层可能先删

如果不是新增用户能力，默认目标是：

- `非测试代码净增 <= 0`
- 优先通过删除旧实现、重构收敛或相关链路减债达成，不要求删减只发生在当前改动点
- 禁止通过 hack、强行压行、牺牲可读性或把复杂度外移来伪造过线

条件联动：

- 复杂 debug：`long-chain-debugging`
- 多轮推进、易漂移任务：`iteration-work-notes`
- 明确需要目标锚点：`goal-progress-anchor`
- 用户明确要求目标模式：`goal-mode`

### 2. 实现前删减与 owner 判断

进入编辑前，必须先过 `nextclaw-clean-implementation`。

至少要能说清：

- 这次准备先删什么、合并什么
- 真正的 owner 是谁
- 为什么这是单一路径，而不是补丁叠补丁
- 最小可信验证是什么

如果任务涉及 fallback、compatibility、环境救援或 just-in-case 逻辑，必须再联动：

- `predictable-behavior-first`

如果命名、目录落点、文件角色不清，按场景联动：

- `file-naming-convention`
- `role-first-file-organization`
- `collapsible-feature-root-architecture`
- `file-organization-governance`

### 3. 实现阶段

实现时持续遵守：

- 优先删除和简化，而不是加分支
- 业务逻辑放进清晰 owner
- 避免平行 helper、wrapper、proxy
- 不能把“我最后解释一下”当成结构不清的替代品

如果触达 NextClaw 自管理命令语义，还必须同步：

- `docs/USAGE.md`
- `packages/nextclaw/resources/USAGE.md`
- `nextclaw-self-manage`

并说明是否运行了 `sync-usage-resource`。

### 4. 验证闭环

改完后使用 `nextclaw-validation-workflow`。

至少覆盖相关子集：

- 定向测试
- 触达 TypeScript / 运行链路边界时必须跑的 `tsc`
- 用户可见行为的冒烟或贴近链路验收
- maintainability guard
- governance ratchet

如果最真实的验证路径被阻塞，必须说明：

- 阻塞点是什么
- 当前用了哪个最小可信替代证明

对源码、脚本、测试、运行链路配置改动，还必须继续进入：

- `post-edit-maintainability-guard`
- `post-edit-maintainability-review`

### 5. 可维护性披露

这一步对源码、脚本、测试、运行链路配置改动是强制项。

必须主动收集并汇报：

- 总代码增减报告
- 非测试代码增减报告
- 是否满足非功能改动的行数门槛
- 本次正向减债动作是什么：
  - 删除
  - 简化
  - 复用
  - 职责收敛
  - 必要解耦抽象
- 为什么这不是靠 hack、强行压行或把复杂度转移到统计面外过线

不能等用户追问“代码是不是变多了”才补说。

如果这是非功能改动且 `非测试代码净增 > 0`，任务不能收尾。

### 6. 复盘与机制改进

对于 bugfix、异常修复、重构、发布闭环，或者任何暴露流程摩擦的任务，最终回复前必须做一个短复盘：

- 这次暴露出的流程缺口是什么
- 这个改进应该落在 `AGENTS.md`、已有 skill、新 skill、命令、自动化还是普通文档
- 现在能不能安全地顺手落实

如果是小而明确的机制改进，应该在同一任务里直接落实，而不是只提建议。

如果复盘结论涉及治理系统，必须联动：

- `nextclaw-agent-instructions-governance`

### 7. 迭代留痕决策

收尾阶段必须使用 `nextclaw-iteration-log-governance` 判断是否需要 `docs/logs`。

不要因为工作开始了就自动建 log。  
但只要代码、测试、脚本、运行链路配置或治理系统发生了实质变化，就要认真判断是更新最近相关迭代，还是新建一个版本更高的迭代目录。

### 8. 最终汇报合同

最终回复里，凡是适用的项都要主动覆盖：

- 结果
- 执行过的命令与结果
- 适用时的确切 `tsc` 命令
- 冒烟 / 验收场景
- 可维护性披露里的总代码与非测试代码增减
- 跳过了什么验证，以及为什么 `不适用`
- 复盘结果
- 是否顺手落地了治理 / workflow 改进
- 是否新增或更新了迭代记录

只要其中某个适用项被漏报，就不算真正完成收尾。

## 什么时候由本 skill 做主 owner

以下场景默认由本 skill 作为总流程 owner：

- 用户要求实现、修复、重构
- 用户要求“完成”“提交”“收尾”“验证”“发布”“修复 bug”
- 任务横跨编码、验证、说明多个阶段
- 任务暴露出“容易忘步骤”或“规则分散难以闭环”的问题

## 反模式

以下都视为流程失败：

- 做完了实现，但可维护性披露要等用户追问才说
- 验证做了，但没告诉用户哪些项跳过了
- bugfix 收尾时，没有说清真实的观察指标和成功条件
- 发现治理缺口了，但没有做落点判断
- 内部已经知道行数门槛结果，却没有在最终回复主动披露
- 用了很多专项 skill，但没有一个总流程 owner 兜住收尾
