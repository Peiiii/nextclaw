# v0.14.83-nextclaw-remote-runtime-package-split

## 迭代完成说明

- 新建独立可发布包 `@nextclaw/remote`，把 remote access 的运行时主链路正式从 `nextclaw` 主包拆出。
- 迁移内容包含：
  - remote command registration facade
  - runtime action facade
  - platform client
  - websocket connector
  - relay bridge
  - service module
  - remote status store
- `nextclaw` 主包改为通过薄桥接文件 `remote-runtime-support.ts` 注入宿主能力，不再让新包反向依赖 CLI 内部实现。
- 根级 `build`、`lint`、`tsc` 脚本已纳入 `packages/nextclaw-remote`。
- 实际 npm 发布结果：
  - `nextclaw@0.13.7`
  - `@nextclaw/mcp@0.1.7`
  - `@nextclaw/server@0.10.7`
  - `@nextclaw/remote@0.1.3`
  - `@nextclaw/ncp-mcp@0.1.7`
- 本次设计与落地计划分别记录在：
  - [设计文档](../../plans/2026-03-20-nextclaw-remote-runtime-package-split-design.md)
  - [实施计划](../../plans/2026-03-20-nextclaw-remote-runtime-package-split-implementation-plan.md)

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm install`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-remote tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-remote lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-remote build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-mcp tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-mcp lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
- 标准 `pnpm release:publish` 已执行到全量 lint 阶段，但被仓库既有且与本次无关的 warning 阻塞，阻塞点在 `workers/nextclaw-provider-gateway-api` 的 `eslint --max-warnings=0`。
- 发布后安装态冒烟：
  - `PATH=/opt/homebrew/bin:$PATH npx -y nextclaw@0.13.7 remote --help`
  - `PATH=/opt/homebrew/bin:$PATH npx -y nextclaw@0.13.7 remote connect --help`
  - `PATH=/opt/homebrew/bin:$PATH npx -y nextclaw@0.13.7 remote status --help`
  - `PATH=/opt/homebrew/bin:$PATH npx -y nextclaw@0.13.7 remote doctor --help`
  - `TMP_HOME=$(mktemp -d) && HOME=\"$TMP_HOME\" XDG_CONFIG_HOME=\"$TMP_HOME/.config\" XDG_DATA_HOME=\"$TMP_HOME/.local/share\" PATH=/opt/homebrew/bin:$PATH npx -y nextclaw@0.13.7 remote status --json`

## 发布 / 部署方式

- 新增 changeset，提升 `nextclaw` 版本，并发布新包 `@nextclaw/remote`。
- 优先走仓库标准流程：
  - `pnpm release:version`
  - `pnpm release:publish`
- 若标准全量发布被仓库既有且与本次无关的问题阻塞，则按最小闭环执行：
  - 完成本次变更相关包的 `build/lint/tsc`
  - 执行 `pnpm release:version`
  - 执行 `pnpm changeset publish`
- 发布完成后，必须进行安装态 CLI 冒烟，确认远程命令在 npm 安装结果中可见。

## 用户 / 产品视角的验收步骤

- 升级到发布后的 `nextclaw` 版本。
- 运行 `nextclaw remote --help`，确认 remote 命令组存在。
- 运行 `nextclaw remote status`，确认 remote 状态可正常输出。
- 已登录平台的情况下运行 `nextclaw remote doctor`，确认平台 token、api base、本地 UI 健康检查仍能正常工作。
- 若需要后台远程接入，运行 `nextclaw remote enable` 后再执行 `nextclaw start`，确认 service 模式的 remote connector 仍可正常接入。

## 红区触达与减债记录

### packages/nextclaw/src/cli/commands/diagnostics.ts

- 本次是否减债：否
- 说明：本次触达仅为将 remote status snapshot 改接到新包桥接层，没有继续增加文件体积，也没有把新的产品职责继续塞进该文件。
- 下一步拆分缝：先拆 diagnostics collector、runtime status mapper、user-facing renderer。
