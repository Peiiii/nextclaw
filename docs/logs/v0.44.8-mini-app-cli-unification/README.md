# v0.44.8 Mini App 统一命令与并行开发合同

## 迭代完成说明

Mini App 的用户与 AI 操作入口已统一为 `nextclaw app`。Marketplace、控制台和发布结果只展示由应用标识实时生成的 `nextclaw app install <app-id>`；Registry 不再保存或返回每个应用各自的安装命令。`@nextclaw/app-runtime` 保持独立发布与运行时职责，但不再作为第二个用户命令面。

CLI 覆盖 Marketplace 查询，以及本机运行中的 NextClaw 对本地目录、`.napp` 包和 Registry 应用的安装、查看、启停、更新、回滚、卸载和操作结果查询。

根因是早期 runtime CLI 与产品 CLI 同时暴露，且 Marketplace 为每条 App 记录冗余的安装命令，导致入口和事实源分叉。修正把命令语法收敛到 shared formatter；Registry 仅传输安装所需的 `kind/spec/registry`，所有展示端从同一 formatter 推导命令。

同时新增并行 worktree 合同与 `pnpm dev:worktree`：每项并行任务在独立分支/worktree 中工作；依赖只复用 pnpm store 的离线链接，不共享 `node_modules`；交付经协调器安全回流 `master`。

用户可见变更见 [mini app CLI unification changeset](../../../.changeset/mini-app-cli-unification.md)，设计冻结见 [并行 worktree 开发设计](../../designs/2026-08-27-parallel-worktree-development.design.md)。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-shared tsc`、`pnpm -C workers/marketplace-api tsc`、`pnpm -C packages/nextclaw-app-runtime tsc`、`pnpm -C packages/nextclaw tsc`、三个 Marketplace 前端 workspace 的 `tsc` 均通过。
- Mini App CLI、Registry mapper、runtime publish、shared formatter、NextClaw Server App Package controller 与 CLI command reference 的定向测试均通过。
- 三个 Marketplace 前端和 Marketplace Worker build 均通过；`pnpm lint:new-code:governance`、`pnpm check:skill-progressive-loading` 与 `git diff --check` 均通过。
- 真实 Registry 查询已确认 CLI JSON 输出不含 `install.command`，文本输出只显示统一的 `nextclaw app install <app-id>`。
- `pnpm dev:worktree -- --name parallel-worktree-smoke-20260827 --path /tmp/nextclaw-parallel-worktree-smoke-20260827 --no-bootstrap` 已真实创建并清理临时隔离 worktree；脚本单测覆盖名称、分支、路径、离线依赖策略和 pnpm 参数分隔符。

## 发布/部署方式

- 已提交并推送 `882b6e0be`（`feat(app): unify mini app CLI management`）至 `origin/master`。
- Marketplace Worker 发布为 Cloudflare Worker Version `1b1090f6-d570-48df-8509-1d2c393b9881`。部署时发现 runtime 的既有 Node 内置模块依赖未启用 Worker 兼容层，已在 `wrangler.toml` 补充 `nodejs_compat`，避免 Cloudflare 因 `node:fs/promises` 拒绝版本上传。
- Apps Web 已发布至 `https://64d7a79c.nextclaw-apps.pages.dev`，Platform Console 已发布至 `https://17c0cf74.nextclaw-platform-console.pages.dev`，Platform Admin 已发布至 `https://10f7ad41.nextclaw-platform-admin.pages.dev`，均指定生产 `master` 分支。
- 无缓存请求已对生产 Registry 的 `/api/v2/apps/items` 与 `/api/v1/apps/items/:slug` 验证：install 只返回 `kind/spec/registry`。原有边缘缓存的 TTL 是 120 秒，旧 URL 在 TTL 结束前仍可能读到旧响应，但新缓存键已返回新合同。

## 用户/产品视角的验收步骤

1. 在 Marketplace 或控制台打开任意 Mini App，确认显示的安装命令是 `nextclaw app install <app-id>`。
2. 执行 `nextclaw app marketplace search --query <keyword> --json`，确认每项 install 对象只含 `kind`、`spec` 与 `registry`。
3. 对本机运行的 NextClaw 执行 `nextclaw app install <本地目录或 bundle.napp> --json`，随后用 `nextclaw app operations --json` 查看结果。
4. 执行 `nextclaw app list --json`，再按需运行 `enable`、`disable`、`update`、`rollback` 或带确认值的 `uninstall`。

## 可维护性总结汇总

安装命令从每个 App 的重复存储改为一个 shared formatter，删除了 Registry、类型和展示端的冗余 `command` 数据。独立 runtime 包继续承担实现与契约，不再与产品 CLI 竞争用户入口。CLI 的 Marketplace 查询和本机 Package 生命周期分别由查询服务与本机 API 服务承担，未复制宿主产品语义。

并行开发把隔离、依赖复用和主线回流写入 lifecycle 条件合同，并落地为可测试脚本。未共享 worktree 的 `node_modules`，避免 workspace symlink 指向错误源码。自动治理检查无 error；对原有 TSX alias 检查补足 JSX 解析，避免检查器自身阻断合法前端修改。平台应用现有 `api` 边界已显式登记，目录协议与实际边界一致。

## NPM 包发布记录

不涉及 NPM 包发布。本迭代会添加 changeset，供后续统一版本发布使用；独立 runtime 与主 `nextclaw` 包均不在本次部署中发布到 NPM。
