# Node / pnpm 环境恢复

仅当 `node`、`pnpm`、`npx` 或 `corepack` 在 macOS/Linux shell 中报 `command not found`，或实际 Node 与仓库 `.nvmrc` 不一致时使用。命令能解析但版本错误同样会让原生依赖出现 ABI 假故障，不能继续执行后再临时绕过。

执行仓库命令时优先走项目 wrapper；它会读取 `.nvmrc`，命中时零额外开销，不命中时通过 NVM 自动安装并切换到精确版本：

```bash
bash scripts/dev/node/run-with-project-node.sh <command>
```

需要诊断解析结果时再运行 helper：

```bash
bash .agents/skills/development-implementation/scripts/locate-node-pnpm.sh
```

它检查当前解析结果、仓库声明版本，并搜索 NVM、Homebrew 和 `/usr/local/bin`。仓库存在 `.nvmrc` 时，只接受与其完全一致的 Node；helper 输出的一次性 PATH 只用于诊断或无法调用 wrapper 的恢复场景：

```bash
PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH" node -v
```

隔离 worktree 可能位于主 workspace 外，工具注入的 PATH 可能与主目录不同；创建脚本会在 bootstrap 前再次校验并输出实际版本。只有用户明确需要持久修复时，才调整 NVM 默认版本或 shell rc。禁止自动改用更高版本。
