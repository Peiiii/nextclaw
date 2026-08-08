---
name: classic-software-design-principles
description: 当当前决策明确涉及通用架构 owner、生命周期、不变量、职责边界或抽象力度，并需要用经典软件设计原则比较方案时使用；普通“深入分析”“最佳实践”、局部修复和一般重构不自动触发。
---

# 经典软件设计原则

## 目标

用少量稳定原则判断 owner、状态、生命周期和抽象是否合理。这里只负责通用架构裁决；NextClaw kernel 主干、前端状态、目录和兼容细节由各自专项 owner 处理。

## 原则

- `information-expert`：职责归拥有完成它所需事实和不变量的对象。
- `single-domain-owner`：同一事实、状态变化和生命周期只有一个权威 owner。
- `complete-owner`：owner 覆盖自身创建、状态、不变量、生命周期和对外语义，不做注入一切的空心壳。
- `responsibility-surface-minimization`：上层只提供 owner 无法自知的外部事实、用户选择或真实策略点。
- `high-cohesion-low-coupling`：一起变化、必须同步的状态放在一起；调用方知道的内部细节越少越好。
- `tell-dont-ask`：调用业务意图，不读散字段后替 owner 在外层拼流程。
- `simple-structure-first`：数组、对象、局部函数和现有 owner 足够时，不升级为新 service/manager/context。
- `abstractions-pay-rent`：抽象必须消除重复、保护不变量或隔离真实变化点，其收益大于名字、文件、跳转和合同成本。
- `constructor-builds-graph`：constructor 建立同步确定的长期对象图；load/start/stop/reload/dispose 驱动副作用。
- `cqs-pure-read`：read/get/list/status 不暗中改变状态；mutation 方法表达业务意图。
- `no-compatibility-by-default`：内部重构直接迁移并删除旧入口；临时兼容必须有外部必要性、边界和删除点。
- `deletion-first`：新增前先删除重复入口、平行 owner、无语义 wrapper 和过期兼容，不为指标损害可读性或合同安全。

## 判断顺序

1. 写出要保护的事实、不变量和生命周期。
2. 找 information expert，并确认它能形成完整 owner。
3. 删除重复 owner、透传层和无语义抽象。
4. 确认上层只传外部事实，没有代替 owner 决策。
5. 比较保持简单结构与新增抽象的实际成本。
6. 明确旧路径迁移和删除点。

## 输出

给出命中的原则 key、当前违反点、推荐 owner、可删除路径、生命周期边界和为什么该抽象力度刚好。只有当前问题确实进入 kernel/manager/store/presenter 主干依赖时，才转交 `kernel-branch-owner-architecture`；不要回链完整 workflow。
