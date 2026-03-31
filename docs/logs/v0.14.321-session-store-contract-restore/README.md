# v0.14.321-session-store-contract-restore

## 迭代完成说明

- 恢复 `SessionManager` 的会话主存储契约到全局 `NEXTCLAW_HOME/sessions`，不再根据传入 `workspace` 改写到 `workspace/sessions`。
- 恢复 `getSessionsPath()` 的纯全局语义，避免 UI 会话列表、运行时会话读写和历史数据目录出现静默漂移。
- 新增回归测试，覆盖“不同 workspace 仍应共享同一份 UI 会话历史”的场景，防止会话列表再次因路径漂移而变空。
- 现场排查确认 `/api/remote/status` 报错不是本次代码回归，而是同一 `NEXTCLAW_HOME` 下同时存在两个运行中的 NextClaw 进程导致 remote ownership 冲突。

## 测试/验证/验收方式

- 运行 `pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/ui-session-service.test.ts src/cli/commands/ncp/nextclaw-agent-session-store.test.ts`
- 运行 `pnpm lint:maintainability:guard`
- 真实开发服务验证：
  - `curl -sS http://127.0.0.1:18792/api/auth/status`
  - `curl -sS -i http://127.0.0.1:18792/api/ncp/sessions`
  - `curl -sS -i http://127.0.0.1:18792/api/remote/status`
- 验收观察点：
  - `/api/ncp/sessions` 返回 200 且包含历史会话数据，不再为空列表。
  - `/api/remote/status` 返回的错误信息明确指向 remote ownership 冲突，而不是会话存储代码异常。

## 发布/部署方式

- 本次为本地开发态回归修复，未执行发布。
- 若后续需要随正式版本带出，按常规版本流程执行受影响包构建、校验和发布即可。

## 用户/产品视角的验收步骤

1. 启动开发环境并打开 UI。
2. 进入会话列表页，确认历史会话正常展示，不再出现空列表。
3. 打开浏览器网络面板查看 `/api/ncp/sessions`，确认返回 200 且有历史数据。
4. 查看 `/api/remote/status` 返回内容；若仍显示 remote ownership 冲突，关闭同一 `NEXTCLAW_HOME` 下的另一条 NextClaw 进程后再刷新确认。
