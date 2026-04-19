## 目录结构
- 命令入口层只保留面向 CLI runtime 的顶层 command 文件。
- 具体实现按职责拆到 `agent/`、`channel/`、`config/`、`diagnostics/`、`plugin/`、`remote/`、`runtime/`、`service/`、`usage/` 与 `ncp/` 子树，避免入口层继续扁平膨胀。
- 兼容性相关内容不再占用命令根层，统一收敛到 `ncp/compat/`。
- 顶级运行态命令 `gateway / ui / start / restart / serve / stop` 采用特殊分组，统一由 `runtime/` 承载其共享 owner，而不是继续错误地挂在 `service/` 下面。
