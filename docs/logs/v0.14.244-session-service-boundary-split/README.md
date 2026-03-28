# 迭代完成说明

本次把 UI 会话读写链路从 `UiNcpAgent` 中拆出，改成独立的 `ncpSessionService`。

- 删除了被否定的“启动期 sessionApi 挂到 deferred agent 上”的方案，不再把 session contract 伪装成 runtime agent 的一部分。
- `UiNcpAgent` 现在只负责 runtime transport、stream、session type 与 asset 能力；`/api/ncp/sessions*` 改为显式依赖 `ncpSessionService`。
- `SessionManager` 提前提升到 shell context，在 UI shell 刚启动时就能构造正式 `UiSessionService`，因此会话列表/历史消息不需要等 `UI NCP agent: ready`。
- `createUiRouter()` 把 NCP session routes 和 NCP runtime routes 分开注册，session read contract 不再被 runtime route gating 卡住。

# 测试/验证/验收方式

- 单元测试：
  - `pnpm -C packages/nextclaw test -- run src/cli/commands/service-deferred-ncp-agent.test.ts src/cli/commands/ncp/ui-session-service.test.ts`
  - `pnpm -C packages/nextclaw-server test -- run src/ui/router.ncp-agent.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw tsc`
  - 当前 `packages/nextclaw` 的 `tsc` 被仓库里已有的两处无关测试文件阻塞：
    - `src/cli/commands/codex-runtime-plugin-provider-routing.test.ts`
    - `src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
- 运行态冒烟：
  - 使用隔离 `NEXTCLAW_HOME` 执行 `pnpm -C packages/nextclaw dev serve --ui-port 18893`
  - 实测 `GET http://127.0.0.1:18893/api/ncp/sessions?limit=200` 已在 `✓ UI NCP agent: ready` 打印前返回 `200`

# 发布/部署方式

- 本次为本地 UI backend / CLI 启动链路重构，无数据库迁移。
- 按常规发布 `@nextclaw/server` 与 `nextclaw` 所在包即可。
- 发布后重点验证：
  - UI shell 启动早期 `GET /api/ncp/sessions` 返回 `200`
  - `/chat` 页面首次打开时能直接读到会话列表，不再出现启动早期 `503`

# 用户/产品视角的验收步骤

1. 启动开发服务或前台服务。
2. 在 UI API 刚可访问后立即打开 `/chat`。
3. 确认会话列表直接可见，不需要等待所有插件、channel 或 runtime agent 完整就绪。
4. 打开任意历史会话，确认消息历史可以立即加载。
5. 打开浏览器 Network，确认 `/api/ncp/sessions` 与 `/api/ncp/sessions/:id/messages` 不再因为 `UI NCP agent` 尚未 ready 而返回 `503`。
