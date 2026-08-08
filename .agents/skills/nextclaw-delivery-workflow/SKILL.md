---
name: nextclaw-delivery-workflow
description: NextClaw 普通源码、脚本、测试、运行链路和从方案到实现任务的唯一默认开发入口；负责按风险依次路由调查、设计、实现、验证与收尾，不在任务开始时预读未来阶段 skill。
---

# NextClaw 标准开发流程

## 定位

这是普通开发任务唯一默认 workflow owner。它只编排当前阶段；专项 skill 到阶段再加载，一个分支最多选择一个直接下游。

## 1. 开始

只确定四件事：

- 一个可观察结果；
- 最近 owner 和影响面；
- 风险等级 L0-L4；
- 最小可信证据。

风险：L0 文档元信息；L1 局部低风险/纯视觉；L2 交互、状态、局部行为或明确 bug；L3 跨 owner/transport、持久化、兼容或运行链路；L4 发布、迁移、生产或不可逆操作。

## 2. 调查与设计

- L0-L1：调查最近链路，不写设计。
- L2：确认 producer、owner、consumer 和成功条件；根因不确定时保留修前证据。
- L3-L4 或用户明确要求设计：此时才加载 `nextclaw-solution-design`。
- 用户明确要求系统性调查，或局部证据不足：加载 `code-investigation-workflow`。
- 跨多轮需要保存事实时才加载 `iteration-work-notes`；用户明确启动目标模式时由 `goal-mode` 管理锚点。

每次新增调查必须改变一个实现或验证决策。已经确认且未变化的长文件、skill、日志和命令输出不得重读。

只有 `node/pnpm/npx/corepack` 确实无法从 PATH 解析时，才读取[Node/pnpm 环境恢复](references/node-pnpm-environment.md)；命令正常时不读取。

## 3. 实现前检查

源码修改前直接回答，不再加载独立 clean implementation skill：

1. 能否删除、复用或收敛已有路径？
2. 事实、状态和生命周期的 owner 是否正确？
3. 是否新增了无语义的 wrapper、adapter、factory、参数搬运或第二入口？
4. 是否把 fallback/compatibility 放在真实边界并写清退出条件？
5. 是否新增、移动、重命名文件或改变目录角色？只有命中时才加载 `file-organization-governance` 并运行 preflight。

实现保持单一路径、稳定合同和可见主流程。必要、安全、清晰的最小增长允许存在；禁止向无关模块找行数抵消。

只有用户明确讨论简单性、拆分收益、过度防卫、过度抽象或代码审美，且当前确实要裁决“保留、拆分还是抽象”时，才读取[实现工艺](references/implementation-craft.md)。普通实现不读取。

只有当前决策确实涉及架构 owner、kernel 主干、前端状态、React 生命周期、交互、样式或兼容策略时，才加载对应的一个专项 skill；不要因泛化的“写代码/重构”同时加载多项原则 skill。

## 4. 验证

实现稳定后才加载 `nextclaw-validation-workflow`：

- 迭代中只跑能指导下一步的最快定向证据；
- 收尾时统一跑一次匹配风险的验证；
- 同一风险已有权威证据后不叠加等价测试、浏览器路径或截图；
- 每增加一项验证必须排除新的失败类型。

源码类改动在验证末尾运行一次 `post-edit-maintainability-guard`。它提示需要主观判断时，按 guard 的条件 reference 复核，不再加载独立 review skill。

## 5. 收尾

只报告结果、主要证据、未验证边界和真实触发的维护/发布状态。不要罗列所有命令和未触发项。

内部做一次短反思：

- 是否读了无关或未变化的上下文？
- 是否重复证明同一风险？
- 是否有无信息增量的强制步骤？
- 下次能否以更短路径获得同等可信度？

只有问题可复用、反复或高影响时才更新规则。只有提交/发布、跨模块长链路、重要根因、红区或大型治理批次才加载迭代/发布 owner。

## 禁止

- 任务开始时预读 validation、guard、release 或可能用到的专项 skill。
- workflow 与专项 skill 互相回链。
- 小修改自动加载完整原则、目录和前端 skill 组合。
- 为流程完整而重复验证、复核或留痕。
