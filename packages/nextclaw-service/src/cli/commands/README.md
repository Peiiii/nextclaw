## 目录结构
- 命令入口层只保留面向 CLI runtime 的顶层 command 文件。
- `commands/` 下只允许真实命令名；当前运行态命令根已显式落为 `gateway/`、`ui/`、`start/`、`restart/`、`serve/`、`stop/`，不再允许 `runtime/` 这类伪 feature 根目录。
- 具体实现按职责拆到各命令自己的 feature root，以及 `agent/`、`channel/`、`config/`、`diagnostics/`、`plugin/`、`remote/`、`service/`、`usage/` 与 `ncp/` 子树，避免入口层继续扁平膨胀。
- 兼容性相关内容不再占用命令根层，统一收敛到 `ncp/compat/`。
- 跨多个运行态命令共享、但仍带 CLI 项目语义的运行时能力，统一下沉到 `src/cli/shared/services/` 与 `src/cli/shared/utils/`，而不是继续挂在某个伪命令目录下。
