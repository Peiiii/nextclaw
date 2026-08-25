# 发布自动化误判失败修复执行计划

## 目标与边界

依据 [发布自动化失败语义与不可变运行身份设计](../designs/2026-08-26-release-failure-semantics.design.md)，让一次稳定发布始终绑定冻结 commit，能自行等待或恢复 exact-SHA 准备制品，并把传播 pending 与确定合同失败分开。

本计划不 commit、push、触发正式发布，也不修改用户工作站同步模型。

## 执行部分

### 1. 冻结子 workflow 身份

- Owner：Desktop preflight 与 NPM runtime release 脚本/workflow。
- 输入：冻结 SHA、唯一 dispatch ID、现有版本和 channel。
- 结果：workflow run-name 暴露 dispatch ID；checkout 使用冻结 SHA；调用方只按 dispatch ID 定位。
- 设计策略：复用上位设计，不新增通用 orchestrator。
- 验证：脚本单测 + workflow 文本/YAML 合同测试，覆盖 `master` 推进和并发 dispatch。

### 2. exact-SHA NPM prepare 等待与恢复

- Owner：`npm-release-prepare.yml`、prepared artifact owner、稳定发布编排。
- 输入：父 workflow 冻结 SHA。
- 结果：push 预热不会跨 SHA 取消；手动 recovery 可 checkout exact SHA；publish 在消费前复用、等待或补建该 SHA 的制品。
- 设计策略：复用上位状态模型；如实现中发现 GitHub artifact API 无法支持现有下载合同，返回 Design，不在 publish 内偷偷 rebuild。
- 验证：纯状态选择测试、workflow 合同测试、模拟 success/in-progress/missing/cancelled/timeout。

### 3. 传播与 registry 失败语义

- Owner：Desktop closure、runtime manifest verification、Desktop published identity preflight。
- 输入：预期版本/固定字段和有界等待配置。
- 结果：短暂读取失败和旧投影继续等待；确定 mismatch fail-fast；超时报最后观察。
- 设计策略：在现有 owner 内使用窄轮询函数，不建立通用重试框架。
- 验证：故障注入序列测试，包括 `404 -> old -> expected`、持续不可用、预期版本但固定字段错误。

### 4. 总体验证与 Review

- Owner：release automation 受影响面。
- 输入：前三部分完成的 diff。
- 结果：相关测试、YAML 解析、语法检查、发布 dry-run/合同模拟通过，diff-only maintainability 无阻断 finding。
- 设计策略：复用上位设计；发现新的失败状态才返回 Design。
- 交付边界：只报告本地隔离分支结果；未经用户再次授权不 commit/push/release。

## 中断与恢复

- 工作分支：`codex/release-false-failure-audit`。
- 每部分以对应定向测试作为恢复入口；失败时先回到该部分最后一个可观察条件，不重跑正式发布。
- 若跨会话，从本文最早未完成部分继续，并先确认上位设计与远程 `origin/master` 是否发生影响合同的变化。
