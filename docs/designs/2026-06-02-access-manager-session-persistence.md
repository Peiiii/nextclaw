# Access Manager 会话持久化设计

## 背景

当前管理员密码保护启用后，UI 登录态由 `nextclaw-server` 内存 `Map` 保存。服务进程重启会丢失 session，导致浏览器 cookie 仍存在但访问受保护 API 时被要求重新输入用户名密码。

这个行为不是理想产品语义：它既没有明确的时间过期，也不能跨服务重启保持登录。更重要的是，NextClaw 的 server 层应保持薄 HTTP/API 边界，不应成为持久化认证状态的 owner。

## 目标

- 服务重启后，已登录设备在 session 未过期、未退出、未被密码变更撤销时继续保持登录。
- session 明文 token 只进入 cookie，不落盘；持久化文件只保存 token hash。
- 主动退出、修改密码、禁用密码认证能撤销相关 session。
- server 只负责 HTTP/cookie 适配；kernel 负责 access 状态和持久化 owner。

## 架构决策

采用 kernel 级 `AccessManager`，而不是 server 级 UI session store。

原因：

- 持久化数据 owner 应位于 kernel。server 只做 Hono route、middleware、cookie 与 WebSocket 请求适配。
- `AccessManager` 是通用访问控制 owner，不命名为 `UiAuthManager` 或 `LocalUiAuthManager`。当前只落地 password auth，但命名保留未来 remote token、device trust、desktop bridge 等访问方式的扩展空间。
- cookie 是传输层合同，仍保留在 server。kernel 不感知 `Set-Cookie`、`SameSite`、`Secure` 或 Hono `Request`。

## 模块边界

```text
packages/nextclaw-kernel/src/managers/access.manager.ts
packages/nextclaw-kernel/src/stores/access-session.store.ts
packages/nextclaw-kernel/src/types/access.types.ts
packages/nextclaw-kernel/src/utils/access-password.utils.ts
packages/nextclaw-kernel/src/utils/access-token.utils.ts

packages/nextclaw-server/src/features/auth/services/ui-auth.service.ts
packages/nextclaw-server/src/features/auth/utils/access-cookie.utils.ts
```

kernel 职责：

- 读取和更新 `ui.auth` 配置。
- 创建、校验、删除、清空和过期清理 access session。
- 保存 session hash、principal、创建时间和过期时间。
- 对外暴露意图级 API：setup、login、logout、update password、update enabled、authenticate session。

server 职责：

- 从 HTTP/WebSocket cookie 中提取 access token。
- 把 kernel 返回的 token 写入 `HttpOnly` cookie。
- 将 kernel 状态映射成 `/api/auth/*` 响应。
- 在 API middleware 和 event stream auth 中调用 kernel 认证结果。

## Session 合同

- token：随机 32 bytes，base64url 编码。
- token hash：`sha256(token)`，仅 hash 落盘。
- 默认 TTL：30 天。
- cookie：`HttpOnly; SameSite=Lax; Path=/; Max-Age=<ttl>`，HTTPS 请求下附加 `Secure`。
- 持久化路径：
  - 自定义 kernel `homeDir`：`<homeDir>/access/access-sessions.json`
  - 默认：`getDataDir()/access/access-sessions.json`

文件结构：

```json
{
  "kind": "nextclaw.access.sessions",
  "version": 1,
  "sessions": [
    {
      "tokenHash": "sha256...",
      "principal": { "id": "admin", "role": "admin" },
      "createdAt": "2026-06-02T00:00:00.000Z",
      "expiresAt": "2026-07-02T00:00:00.000Z"
    }
  ]
}
```

## 行为规则

- 未启用或未配置 password auth：受保护 API 直接放行，`authenticated=false`。
- setup：写入密码 hash，清空旧 session，创建当前 session。
- login：校验 username/password，创建 session。
- logout：删除当前 token 对应 session，并清 cookie。
- update password：要求当前已认证；更新密码 hash；清空所有 session；为当前请求创建新 session。
- disable password auth：要求当前已认证；禁用认证；清空所有 session；清 cookie。
- enable password auth：要求已配置；创建当前请求 session。
- session 过期或持久化文件损坏：不放行。文件损坏不应变成隐式 bypass。

## 验证计划

- 接口级测试覆盖 `/api/auth/setup` 后访问 `/api/config`。
- 构造新的 `AccessManager` 和 router，模拟服务重启，验证旧 cookie 仍可访问受保护 API。
- 验证 logout 后旧 cookie 失效。
- 验证密码变更后旧 cookie 失效，新 cookie 有效。
- 验证过期 session 被拒绝。
- 验证 session store 不保存明文 token。
- 验证 WebSocket cookie 认证可跨 `AccessManager` 重建。
