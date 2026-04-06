# 2026-04-06 Resumable Release Check Plan

## 背景

当前 `pnpm release:publish` 的耗时不可接受，核心原因不是单个构建命令慢，而是：

- `release:publish` 每次都强制重新跑 `release:check`
- `release:check` 以“整批串行、无状态”的方式执行
- 任一包中途失败，下一次重试会把前面已经成功的包全部重跑

这违背了发布系统的第一性原则：发布临界路径只应包含“尚未被证明成功的最小工作集”。

## 目标

本次做一个真正结构性的收敛，而不是外层包脚本：

1. 让 `release:check` 成为可恢复执行。
2. 把成功步骤落盘，失败后重试只继续未完成或失效节点。
3. 当上游内部依赖发生变化时，自动让下游缓存失效，保证正确性。
4. 保持现有 `pnpm release:publish` 入口不变。

## 非目标

- 本次不重写 `changeset publish`
- 本次不做完整的并发 DAG 调度器
- 本次不引入远程缓存或 CI 分布式执行

## 方案

### 1. 冻结 batch 身份

`release:check` 先根据当前 public batch 生成稳定的 batch id：

- 输入：`package name + version`
- 输出：`tmp/release-checkpoints/<batch-id>.json`

这样同一批次的重试会复用同一个状态文件。

### 2. 为每个包计算可传播的指纹

每个包先计算自己的源码输入指纹，再把“本包内部依赖的 batch 包指纹”一并混入，形成最终执行指纹。

这样：

- 只改当前包，本包缓存失效
- 改上游依赖，下游缓存也会自动失效
- 未受影响的包仍可继续复用成功状态

### 3. 步骤级状态落盘

状态文件记录：

- batch id
- 包版本
- 包指纹
- 每个步骤（`build/lint/tsc`）的成功状态、命令与时间

若某步已成功，且指纹与命令都没变，则直接跳过。

### 4. 保持默认行为不变

对外入口仍然是：

```bash
pnpm release:check
pnpm release:publish
```

只是第二次执行时不再从零开始。

## 验证

至少执行：

- `node --check scripts/check-release-batch.mjs`
- `pnpm -C packages/nextclaw-openclaw-compat lint`
- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- 实际运行一次 `pnpm release:check` / `pnpm release:publish`，确认状态文件写出
- 若中途失败或手动重跑，确认前面已成功步骤被跳过

## 预期结果

- 当前这次发布失败后不会再整批从零重跑
- 后续所有 npm 发布都具备最基本的断点恢复能力
- 发布系统从“无状态长串行命令”升级为“同批次可恢复执行器”
