# 2026-02-18 Restart coordinator + auto restart apply

## 背景 / 问题

- 插件与部分配置修改后需要重启才能生效，但之前逻辑分散在多个命令分支里，行为不一致。
- 用户期望“尽量自动应用变更”：当后台服务运行时应自动重启服务；未运行时给出明确手动重启提示。
- 需要一个后续可复用的统一重启入口，避免每个新场景重复造轮子。

## 决策

- 引入统一 `RestartCoordinator`，将“是否自动重启、是否退出当前进程、是否仅提示手动重启”收敛为策略。
- 优先保证可维护性：保留现有“插件变更需要重启”的边界，不引入运行时插件热插拔复杂度。
- 先覆盖高频路径：`config set/unset`、`plugins enable/disable/install/uninstall`、`channels add`、gateway reload 的 restart-required 分支、gateway controller 的 restart/apply/patch/update 重启请求。

## 变更内容

- 用户可见变化：
  - 当 `nextclaw` 后台服务正在运行时，执行上述“需要重启”的操作将自动 `stop + start` 应用变更。
  - 当后台服务未运行时，仍保留清晰的“Restart the gateway to apply ...”提示。
- 关键实现点：
  - 新增 `packages/nextclaw/src/cli/restart-coordinator.ts`：统一重启策略与去重（重启进行中/已调度）。
  - `packages/nextclaw/src/cli/runtime.ts`：
    - 新增 `requestRestart` 统一入口。
    - 新增后台服务自动重启实现（复用已有 `stopService`/`startService`）。
    - 接入 `config` / `plugins` / `channels add` / config reloader 的 restart-required 分支。
  - `packages/nextclaw/src/cli/gateway/controller.ts`：
    - 去掉散落的直接 `process.exit` 调度逻辑。
    - 支持注入 `requestRestart`，让 controller 重启行为与 CLI 统一。

## 验证（怎么确认符合预期）

```bash
# 1) 使用 nvm 激活 node
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use default

# 2) 编译/静态检查
pnpm -C packages/nextclaw build
pnpm -C packages/nextclaw lint
pnpm -C packages/nextclaw tsc

# 3) 隔离冒烟（非仓库目录，避免污染）
export NEXTCLAW_HOME="$(mktemp -d /tmp/nextclaw-smoke-XXXXXX)"
node packages/nextclaw/dist/cli/index.js init --force
node packages/nextclaw/dist/cli/index.js start --ui-host 127.0.0.1 --ui-port 19891
node packages/nextclaw/dist/cli/index.js config set ui.open false --json
node packages/nextclaw/dist/cli/index.js plugins enable smoke-plugin
node packages/nextclaw/dist/cli/index.js stop
node packages/nextclaw/dist/cli/index.js plugins disable smoke-plugin
```

验收点：

- `config set` 后后台服务 PID 变化，说明自动重启生效。
- `plugins enable` 后后台服务 PID 再次变化，说明插件场景自动重启生效。
- 停止后台服务后执行 `plugins disable`，输出手动重启提示（不强制退出当前命令进程）。

## 发布 / 部署

- 如随 npm 包发布，按 `docs/workflows/npm-release-process.md` 执行：
  - `pnpm changeset`
  - `pnpm release:check`
  - `pnpm release:version`
  - `pnpm release`

## 影响范围 / 风险

- Breaking change? 否。
- 风险点：后台服务重启时会短暂中断；当前实现以“可维护性优先”，未引入复杂的重启延迟/排空机制。
- 回滚方式：回退 `restart-coordinator` 接入提交，恢复原先“仅提示手动重启”行为。
