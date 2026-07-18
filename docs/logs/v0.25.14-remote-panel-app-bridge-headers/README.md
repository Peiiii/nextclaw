# v0.25.14 远程小应用桥接请求头修复

## 迭代完成说明

- 现象：通过远程访问页面打开“小应用”时，页面样式和脚本都已加载，但业务内容显示“加载失败”；浏览器控制台的真实错误为 `panel app bridge session is required`。
- 根因：前端远程传输已经把 `x-nextclaw-panel-bridge-session` 放进 WebSocket 请求帧，但本机 `RemoteAppAdapter` 转发到本地 API 时只重新创建了 `Content-Type` 和登录 Cookie，丢弃了请求帧中的桥接会话头。服务端因此按设计返回 401。
- 确认方式：在实际远程页面观察网络与控制台错误，核对当前 0.25.3 安装产物和源码的 `browser transport -> connector frame -> remote app adapter -> service action controller` 全链路，确认请求头在适配器边界消失。
- 修复：远程面板请求改为复用 `RemoteRelayBridge` 的安全请求头转发规则；保留桥接会话头和普通业务头，同时过滤远端伪造的 Cookie、Host、Content-Length、X-Forwarded-For 等代理边界头，再由本机可信 Cookie 覆盖认证 Cookie。
- 结构减债：`client.request/client.stream` 协议类型收敛为单一声明；四个有状态远程 IO owner 移入 `src/services/*.service.ts`，公共包导出保持不变；远程包根目录直接文件由 16 个降到 12 个。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service exec vitest run src/services/remote src/utils/remote --maxWorkers=1 --reporter=verbose`：通过，4 个文件、14/14。新增组装测试经过真实临时 HTTP 回环端口，验证缺失桥接头返回 401、合法桥接头返回 200，并验证伪造 Cookie/Host/Content-Length/X-Forwarded-For 不会穿透。
- `pnpm -C packages/nextclaw-server exec vitest run src/features/service-apps/controllers/service-apps.controller.test.ts src/features/panel-apps/controllers/panel-apps.controller.test.ts src/app/server.cors.test.ts`：通过，3 个文件、28/28，覆盖服务动作授权、面板 agent 路由和 null-origin 运行时 CORS。
- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/lib/transport/__tests__/remote.transport.test.ts`：通过，2/2，确认前端远程请求帧保留桥接会话头。
- `pnpm -C packages/nextclaw-remote tsc`、`lint`、`build`：通过；构建产物确认调用统一安全头部转发逻辑。
- `pnpm -C packages/nextclaw-service tsc`、`pnpm -C packages/nextclaw-ui tsc`：通过。
- 本次范围的 `pnpm lint:new-code:governance -- ...`：16 项治理检查通过；`pnpm check:governance-backlog-ratchet`：通过。
- 全仓复合命令 `pnpm lint:maintainability:guard` 的维护性扫描为 0 error，但后续全仓治理被本任务范围外的 `packages/nextclaw-ncp-runtime-stdio-client/src/test-fixtures/slow-cancel-agent.mjs` 命名债务阻断；本次所有改动路径已通过同一治理入口的 scoped 检查。

## 发布/部署方式

- 本轮未发布、未重启当前 NextClaw 0.25.3 运行实例，避免打断正在使用的远程会话。
- 修复需要随 `@nextclaw/remote` 的下一次 patch 发布进入 runtime bundle，并在用户升级或重启到包含该版本的运行时后生效。
- 不涉及数据库 migration、Worker 部署或前端独立部署。

## 用户/产品视角的验收步骤

1. 升级并重启到包含本修复的 NextClaw 运行时。
2. 从远程访问页面进入一个包含小应用的会话，打开“小应用”。
3. 确认小应用能正常加载数据并执行声明的 service action，不再出现“加载失败”或 `panel app bridge session is required`。
4. 在网络检查中确认本地 service action 请求带有桥接会话头；远端传入的 Cookie、Host 和代理来源头没有覆盖本机可信值。

## 可维护性总结汇总

- 本次范围内生产语义代码新增 144 行、删除 163 行，净减少 19 行；测试新增 237 行、删除 4 行；总代码新增 381 行、删除 167 行。
- 正向减债：删除连接器中的重复协议类型和适配器中的重复 Cookie 头构造；安全请求头规则只保留一个 owner；四个远程 IO 类统一进入服务角色目录并采用箭头实例方法。
- 没有新增 fallback、兼容旁路、第二套 header sanitizer 或额外运行时 service；公共导出名称与调用方合同保持不变。
- `post-edit-maintainability-guard`：0 error；远程包根目录从 16 个文件降到 12 个，仍处于目录预算边界并保留继续按角色迁移的后续缝。
- `post-edit-maintainability-review` 结论：通过。修复落在丢失请求头的真实适配器边界，同时把安全过滤收敛到原有 relay owner，长期维护成本下降。

## NPM 包发布记录

- 需要发布：`@nextclaw/remote` patch。
- npm registry 当前版本：`0.3.10`；workspace 当前版本同为 `0.3.10`，本次源码变更尚未发布。
- 已添加 `.changeset/remote-panel-app-bridge-headers.md`，状态为 `待统一发布`。
