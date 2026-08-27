# 并行开发 Worktree 标准化执行计划

上位设计：[并行开发 Worktree 标准化设计](../designs/2026-08-27-parallel-worktree-development.design.md)。

## 1. 固化创建与快速 bootstrap

- Owner：`scripts/dev/create-parallel-worktree.mjs`。
- 交付：隔离 `codex/<slug>` worktree、离线冻结锁文件的依赖链接、机器可读结果。
- 验证：参数与路径规划单测；真实 worktree 使用该入口创建。

## 2. 固化 Agent 触发与回流边界

- Owner：`development-lifecycle` 的条件 reference。
- 交付：只在并发提交场景加载的隔离、最小构建、运行数据隔离与 `release:reconcile:mainline` 合同。
- 验证：skill progressive-loading 检查与治理 ratchet。

## 3. 交付验证

- Owner：当前 Delivery。
- 验证：脚本单测、目标功能定向测试和 typecheck；提交后执行主线协调器，确认不污染主工作区 WIP。
- 恢复：bootstrap 或主线协调失败时保留隔离分支/worktree，沿脚本输出的路径继续，不对活跃 `master` 执行 reset、stash 或 rebase。
