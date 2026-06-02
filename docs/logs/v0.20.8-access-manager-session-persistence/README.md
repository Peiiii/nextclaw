# v0.20.8 Access Manager 会话持久化

## 迭代完成说明

本次将管理员密码登录态从 `nextclaw-server` 进程内存 session 调整为 kernel `AccessManager` 管理的持久 access session。

持久化文件使用 `access/access-sessions.json`，内容带 `kind: "nextclaw.access.sessions"` 标识，避免与 chat/NCP session 存储混淆。

根因：原实现把 session 存在 `UiAuthService` 的内存 `Map` 中，服务进程重启后 session 事实源丢失，浏览器 cookie 即使存在也无法通过认证。

确认方式：旧测试明确断言 websocket cookie 只在当前进程生命周期有效；代码中 `UiAuthService` 直接持有内存 session map，并由 server 同时承担密码、cookie、session 状态职责。

修复方式：新增 kernel `AccessManager` 和 `AccessSessionStore`，让持久化 session hash、撤销、过期和密码认证语义归 kernel；server `UiAuthService` 收敛为 HTTP/cookie adapter。修复目标指向状态 owner 错位，而不是只给 server 加一个临时缓存。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/server test -- router.auth.test.ts`：通过，11 个接口级 auth 用例通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/server lint`：通过，但存在无关既有 warning：server app/config/provider-auth 等历史超长或复杂度 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：未通过，阻塞来自本任务外已触达的 core/runtime provider 文件角色命名问题，不是本次 auth 文件。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过；提示 `packages/nextclaw-server/src/app` 目录既有文件数超预算 warning，本次未新增该目录文件。

## 发布/部署方式

隔离 worktree 执行 NPM 全量 public workspace 发布准备。

本次变更涉及 kernel/server 源码和测试，未涉及数据库 migration、远程 deploy 或线上服务配置。NPM 发布通过 `/private/tmp/nextbot-npm-release-access-sessions` 隔离 worktree 从 `108e60122` 生成版本元数据，避免主工作区未完成 provider/runtime/UI WIP 混入发布。

## 用户/产品视角的验收步骤

1. 启用管理员用户名密码并完成登录。
2. 用当前 cookie 访问受保护 API，例如 `/api/config`，应返回 `200`。
3. 重启 UI/server 进程。
4. 再次用同一浏览器访问 UI 或受保护 API，应保持登录，不应重新输入用户名密码。
5. 主动退出、修改密码或 session 过期后，旧 cookie 应失效并返回登录态未认证。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard`。

本次是用户可见安全能力改动：新增跨重启持久登录、session TTL、hash 落盘和撤销语义。代码总量净增，但 server 认证 service 从大而杂的内存 session/password/cookie owner 收敛为薄 HTTP/cookie adapter；持久化和认证状态 owner 上移到 kernel `AccessManager` / `AccessSessionStore`。抽象边界更清楚，server 不再拥有持久化数据。

目录和命名遵守角色后缀：manager、store、types、utils、service、controller 分别落在对应目录。遗留风险是 `UiKernelHost.accessManager` 仍允许测试 fallback；生产路径由 `NextclawKernel.accessManager` 提供。

## NPM 包发布记录

本次已执行 public workspace 全量 stable 发布，核心用户可见产物包括：

- `nextclaw@0.20.4`
- `@nextclaw/kernel@0.2.4`
- `@nextclaw/server@0.13.4`
- 其余 public workspace package 由 `pnpm release:auto:changeset` 同批次 patch 发布并同步 CHANGELOG。

发布前已执行：

- `pnpm release:report:health`
- `pnpm release:sync-readmes`
- `pnpm release:check-readmes`
- `pnpm release:check:groups`
- `pnpm release:auto:changeset`
- `pnpm release:version`
- `pnpm release:check`

发布后已闭合：

- `pnpm release:publish`：通过，发布 47 个 public package，并创建对应本地 changeset tags。
- `pnpm release:verify:published`：通过，确认 `published 47/47 package versions`。
- `npm view nextclaw dist-tags version --json`：确认 `latest` 为 `0.20.4`。
- `npm view @nextclaw/kernel@0.2.4 version dist-tags --json`：确认 `latest` 为 `0.2.4`。
- `npm view @nextclaw/server@0.13.4 version dist-tags --json`：确认 `latest` 为 `0.13.4`。
- 临时目录全局安装 `nextclaw@latest`：通过，`nextclaw --version` 返回 `0.20.4`，包内 launcher 和 `resources/update-bundle-public.pem` 存在，`nextclaw update --check` 返回 runtime 已是 `0.20.4`。
- `pnpm release:report:health`：通过，`Repository release health is clean.`
