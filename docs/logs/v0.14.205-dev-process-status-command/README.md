# v0.14.205-dev-process-status-command

## 迭代完成说明

- 新增 `scripts/dev-process-status.mjs`，提供一个本地进程巡检入口，用于汇总查看所有 `pnpm dev start` 实例与独立 `serve` 实例。
- 根 `package.json` 新增 `pnpm dev:status`，后续可通过单条命令查看实例状态、端口、TTY、运行时长、默认 home/隔离 home 推断，以及附加备注。
- 进程聚合逻辑按“实际启动链路”而不是单纯 `pgid` 分组，避免同一 shell 下批量拉起多个 `serve` 时被错误合并。
- 支持默认表格输出、`--verbose` 详细输出、`--json` 机器可读输出，便于人工排查与后续自动化。

## 测试/验证/验收方式

- 执行 `PATH=/opt/homebrew/bin:$PATH node scripts/dev-process-status.mjs`
- 执行 `PATH=/opt/homebrew/bin:$PATH pnpm dev:status`
- 执行 `PATH=/opt/homebrew/bin:$PATH node scripts/dev-process-status.mjs --verbose`
- 执行 `PATH=/opt/homebrew/bin:$PATH pnpm exec node -e "let data='';process.stdin.on('data',d=>data+=d);process.stdin.on('end',()=>console.log(JSON.parse(data).groups.length));" < <(PATH=/opt/homebrew/bin:$PATH node scripts/dev-process-status.mjs --json)` 验证 JSON 可被解析
- 本次现场验证结果：命令成功识别出 40 组相关实例，其中 `dev-start` 9 组、`standalone-serve` 31 组，并正确拆分出同一 shell 下批量残留的多个独立 `serve`

## 发布/部署方式

- 不涉及发布平台、数据库、远程 migration 或线上部署。
- 代码合并后，仓库内直接执行 `pnpm dev:status` 即可使用，无需额外部署步骤。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `pnpm dev:status`
2. 确认输出中每一行代表一条实际实例链路，而不是被多个 `serve` 合并后的模糊结果
3. 关注 `status` 列，快速区分 `running`、`partial`、`stale`
4. 关注 `mode`、`ui`、`web`、`home`、`notes`，判断哪些实例仍连接默认 `~/.nextclaw`，哪些是隔离 home，哪些已残留但不再真正监听
5. 如需进一步定位，执行 `pnpm dev:status -- --verbose` 查看每组实例下的全部 PID、命令行与角色
