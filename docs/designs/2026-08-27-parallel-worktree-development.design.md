# 并行开发 Worktree 标准化设计

## 结论

NextClaw 的并行开发以“独立 Git worktree + 共享 pnpm store + 最小依赖闭包构建 + 自动主线协调”为唯一标准路径。主工作区常驻 `master` 镜像，不承载待交付提交。

## 问题

并行任务若直接在主工作区开发，会与自动快进和其它 WIP 相互覆盖；若每个 worktree 完整安装依赖，会重复下载和执行无关原生构建；若交付后依赖人工 pull/rebase，主线闭合不可靠。

## 边界与 owner

```text
primary master worktree
  -> dev:worktree（创建 codex/<task> + offline link）
  -> isolated feature worktree（实现、定向验证、精确提交）
  -> release:reconcile:mainline（integration worktree 合并、验证、普通 push）
  -> origin/master 与 primary master 安全同步
```

- `dev:worktree` 只负责创建隔离分支和当前 worktree 的依赖链接。
- pnpm store 是可共享缓存；`node_modules` 不是共享对象，因为 workspace symlink 必须指向当前 worktree 的源码。
- 依赖安装不执行 lifecycle scripts；实际验证按目标 package 依赖闭包显式 build，避免无关 native build。
- `release:reconcile:mainline` 是唯一回流 owner，负责并发推送、集成 worktree、验证与主镜像同步/retry。

## 非目标

不创建平行 Git 命令体系，不共享运行实例或数据目录，不自动删除其他任务 worktree，不把 NPM/desktop 发布语义塞入日常开发 bootstrap。

## 验收

1. 一条命令创建命名隔离分支/worktree，并离线复用 pnpm store。
2. 新 worktree 不引用另一个 worktree 的 `node_modules`。
3. 生命周期只在并发提交场景按需加载本合同。
4. 提交后仍由既有协调器完成 `master` 回流，不要求用户操作 Git。
