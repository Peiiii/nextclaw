---
name: predictable-behavior-first
description: 仅当任务实际新增或改变 fallback、兼容、降级、救援路径、重试、默认值或 legacy 保留时使用；普通实现没有这些分支时不触发。
---

# 可预测行为优先

目标是同一输入与安装状态产生同一行为：不靠隐藏环境状态意外成功，也不把发布、配置或协议缺陷伪装成健康。

## 默认立场

- fail-fast 优于静默救援，单一事实源优于多级 fallback。
- dev convenience 必须显式开启；发布产物不得借用 cwd、源码 checkout 或本机偶然资源。
- 内部重构迁移所有已知调用方并删除旧入口，不为方便保留 alias、proxy、adapter 或双 manager。
- 未发布中间态不是兼容合同；旧 route/API 只有在承载持久用户数据、已证明外部合同或不可避免的分阶段 rollout 时才保留。
- 无效的 prompt、schema、协议或上游值应修 producer 并显式拒绝，不在下游用别名或归一化悄悄接受。
- read/get/list/status/discover/report 必须纯读、可重复且无副作用；加载、注册、授权、写入和外部调用使用显式 action。
- schema/tool 只表达自身合同，不承载动态 catalog、CLI 教程和 AI 工作流；发现与操作流程归对应 owner。

## 决策流程

1. 写出主合同：发布包、桌面产物、公共 API、配置 schema、持久数据或 transport。
2. 区分 shipped runtime 与显式 dev mode。
3. 判断 fallback 是否掩盖 packaging/config/release/runtime 缺陷；若是，修源合同并增加相应交付 guard。
4. 判断错误是否来自上游意图或协议；若是，修 producer，不在 consumer 宽容化。
5. 判断 read-shaped path 是否会被页面加载、路由、轮询、重试、重连或 focus-refetch 自动调用；任何执行副作用都应拆成显式 action。
6. 协议模式已知时第一次请求就使用正确 contract，不先发错误模式再按错误文本切换。
7. 仍需兼容时，读取[例外政策](references/predictable-behavior-policy.md)，证明外部必要性，并冻结触发、范围、信号、owner 和退出条件。

## 禁止的运行时补丁

除非用户明确授权短期事故止血且有删除条件，不得在 shipped runtime 中加入：

- 用 `stderr/stdout.includes(...)` 识别当前坏版本、打包事故或临时上游故障；
- “latest release 已坏”等版本/事故签名特判；
- 扫描多个无关目录直到找到可用资源；
- 先发送错误 transport，再根据上游报错文本重试真实模式；
- 自动触发的前端 read path 隐藏 load/register/install/write/external call；
- 没有真实外部合同的旧 API 转发、双实现或永久 mode flag。

## 输出

说明主合同、观察/执行属性、自动调用副作用、fallback 是否掩盖缺陷、旧路径是否拥有持久数据或外部合同，以及结论属于：删除、fail-fast、显式 dev-only、或有退出条件的临时兼容。

允许兼容必须同时具备具体必要性、窄范围、可观察信号、cleanup owner 和明确退出事件；缺一项就不保留。
