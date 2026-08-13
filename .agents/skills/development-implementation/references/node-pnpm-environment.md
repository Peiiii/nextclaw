# Node / pnpm 环境恢复

仅当 `node`、`pnpm`、`npx` 或 `corepack` 在 macOS/Linux shell 中报 `command not found` 时使用；命令已能解析则不读取。

先运行仓库 helper：

```bash
bash .agents/skills/development-implementation/scripts/locate-node-pnpm.sh
```

它检查当前解析结果，并搜索 Homebrew `/opt/homebrew/bin`、`/usr/local/bin` 和 NVM `~/.nvm/versions/node/*/bin`。优先使用一次性 PATH 前缀继续当前任务：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -v
```

只有用户明确需要持久修复时，才把正确目录加入对应 shell rc；非交互 shell 可能不加载 rc，应优先使用显式 PATH。找不到二进制时报告已检查位置和安装缺口，不擅自安装或修改用户环境。
