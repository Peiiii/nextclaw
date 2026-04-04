# 2026-04-04 Release Registry Verification Hardening Plan

## 背景

当前仓库的 release 机制已经把“当前 batch 校验”和“历史漂移健康报告”拆开，但判断真相源仍然主要围绕：

- pending changeset
- 本地版本号
- git tag
- 包目录源码漂移

这套机制能回答“当前仓库里哪些包像是 release batch”，但不能直接回答最关键的问题：

- 这个精确版本到底有没有出现在 npm 官方源上？
- 当前 batch 是真的还没发，还是只是 tag 没补齐？
- `release:publish` 跑完之后，线上闭环是否已经完成？

因此用户会遇到一种不必要的歧义：本地脚本还把包视作 batch，但 npm 官方源其实已经存在该版本。

## 问题定义

这不是“发布命令缺失”的问题，而是“发布判断真相源混杂”的问题。

当前机制的缺口有两个：

1. 没有一个标准入口专门回答“线上 exact version 是否存在”。
2. 标准 `release:publish` 流程没有把“发布后线上核验”纳入自动闭环。

## 目标

本次只做最小必要强化，不重做整套 release 系统：

1. 新增官方源 exact version 核验入口。
2. 将该核验接入 `release:publish` / `release:publish:frontend`。
3. 让 health/report 输出区分：
   - repository hygiene
   - current batch registry status
4. 保持现有 batch 推导逻辑可用，不把“缺 tag”粗暴改写成“未发布”。

## 非目标

- 不重写 changeset 流程
- 不把发布链路改成自定义 npm client
- 不增加发布后的全量 tarball 解包校验作为默认步骤
- 不为单次事故增加运行时 fallback

## 方案

### 1. 新增 registry truth 脚本

新增一个脚本，按当前 release batch 读取每个 public package 的：

- package name
- local version
- npm official registry exact version presence

脚本职责：

- 读取当前 npm registry
- 针对 `pkg@version` 做 exact 查询
- 支持短暂轮询，吸收 publish 后的 registry 传播延迟
- 输出：
  - 已发布列表
  - 仍缺失列表
  - 最终 count
- 若仍有缺失则 exit non-zero

### 2. 接入标准发布闭环

将 `release:publish` 和 `release:publish:frontend` 调整为：

1. `changeset publish`
2. `release:verify:published`
3. `changeset tag`

这样“已发线上”从人工约定变成脚本保证。

### 3. 强化 health report 语义

`release:report:health` 继续保持“非阻塞型报告”，但增加当前 batch 的 registry 状态摘要：

- already on registry
- still missing on registry

从而避免把“当前 batch 仍在脚本视角内”误读成“还没发线上”。

## 验证

至少执行：

- `node --check scripts/release-scope.mjs`
- `node --check scripts/report-release-health.mjs`
- `node --check scripts/verify-release-published.mjs`
- `pnpm release:report:health`
- `pnpm release:verify:published` 或等价定向验证
- `pnpm lint:maintainability:guard`

## 预期结果

- 仓库能明确区分“缺 tag”和“线上缺版本”
- `release:publish` 完成后，默认已经包含线上 exact version 核验
- 用户以后追问“到底发没发”时，可以直接运行标准脚本，而不是再写临时命令
