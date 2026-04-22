---
name: startup-readiness-governance
description: 当用户要求评估、监测、复盘或持续优化 NextClaw “从启动开始到可用”的耗时时使用。先建立并复用可量化基线，再基于统一口径排序优化优先级，同时维护当前长期目标、当前基线、主要瓶颈与下一步。
---

# Startup Readiness Governance

## 定位

这个 skill 把“启动慢不慢”从一次性排查，收敛成可复用的治理机制。

它负责两件事：

- 建立并复用统一的启动可用性测量口径
- 维护这条长期优化线上的目标、基线、瓶颈与下一步

默认原则：

- 先测量，再优化
- 先排序大头，再动实现
- 同一轮前后对比必须使用同一口径

## 何时使用

满足任一条件就应使用：

- 用户说“启动慢”“前端很久才能用”“想做到秒开”
- 用户要求先量化启动耗时，再决定优化顺序
- 要比较优化前后启动耗时是否真的改善
- 要把启动可用性沉淀成长期监测机制，而不是一次性脚本
- 涉及 `/api/auth/status`、`bootstrap-status`、`health`、`ncpAgent.ready`、能力水合、启动 trace、冷启动基线

## 核心口径

默认同时记录五个时间点：

1. `UI API 可达`
2. `auth status ok`
3. `health ok`
4. `ncpAgent.ready`
5. `bootstrap ready`

默认“主优化口径”使用 `bootstrap-ready`，因为它最接近“整条启动链真正 ready”。

但不要只看一个数。每次都要一起看这五个时间点，避免把小头误判成大头。

如果用户明确改口径，例如把“最终可用”定义成“首条消息真正可发成功”，必须：

- 在工作记录中写下新的定义
- 后续前后对比都沿用同一个定义

## 默认执行步骤

### 1. 先确认当前活跃迭代

默认复用当前相关迭代目录，不要为测量动作单独新建新的迭代目录。

### 2. 维护工作文件

默认维护两个文件：

- `docs/logs/<iteration>/work/goal-progress.md`
- `docs/logs/<iteration>/work/startup-readiness-baseline.md`

`goal-progress.md` 负责短期对齐。

`startup-readiness-baseline.md` 负责长期沉淀：

- 当前主口径
- 当前长期目标
- 最新基线命令
- 最新基线结果
- 当前最大瓶颈
- 下一步优化优先级

### 3. 跑基线

默认命令：

```bash
pnpm smoke:startup-readiness -- --runs 3 --timeout-ms 90000 --criterion bootstrap-ready
```

补一条聊天主链 ready 口径：

```bash
pnpm smoke:startup-readiness -- --runs 1 --timeout-ms 60000 --criterion ncp-agent-ready
```

如果需要机器可读输出：

```bash
pnpm smoke:startup-readiness -- --runs 3 --timeout-ms 90000 --criterion bootstrap-ready --json
```

### 4. 先排序，再优化

跑完后先判断：

- `UI API/auth status/health/ncpAgent.ready` 是否已经很快
- `ncpAgent.ready -> bootstrap ready` 是否仍有巨大差值
- 最大耗时到底落在哪个阶段

默认优先优化“最长的阶段差值”，不要凭直觉直接改前端或某个接口。

### 5. 优化后复测

任何启动优化完成后，都必须复跑同一组命令，再比较：

- 中位数是否下降
- p95 是否下降
- 最大瓶颈是否转移

如果只改善了小口径，但主口径没变，要明确写“没有打到最大大头”。

## 记录要求

每次执行后，`startup-readiness-baseline.md` 至少要更新这些内容：

- 日期
- 主口径
- 运行命令
- 每轮结果
- 聚合结果
- 当前判断
- 下一步优先级

默认要把“当前最大瓶颈”写成一句明确判断，例如：

`当前最大耗时不在 UI API bring-up，而在 ncpAgent.ready 之后到 bootstrap ready 之间的能力水合。`

如果 `/api/auth/status` 启动初期直接不可达或明显晚于 `UI API 可达`，必须把它单独写成一个问题节点，不能被并入泛化的“接口慢”描述里。

## 行为约束

- 没有基线时，不要直接推动启动优化实现
- 不要把单轮偶然值当结论，默认至少看 `3` 轮
- 不要在非隔离环境下把冷启动测量写回仓库目录
- 不要只记录“变快了”，必须记录具体口径和具体数值

## 相关入口

- 基线脚本：
  - `scripts/smoke/startup-readiness/measure-startup-readiness.mjs`
- 命令入口：
  - `pnpm smoke:startup-readiness`

## 完成标准

只有同时满足以下条件，才算这个 skill 本轮真正生效：

1. 已有统一启动口径
2. 已跑出可复现基线
3. 已记录当前长期目标
4. 已明确当前最大瓶颈
5. 已给出下一步优化优先级，而不是凭感觉开改
