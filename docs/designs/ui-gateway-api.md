# NextClaw UI API 设计（Phase 1）

本文件提供 UI 与后端协作的详细接口定义与类型约定。

## 基本约定

- Base URL: `http://127.0.0.1:<ui.port>`
- REST 前缀：`/api`
- WS 入口：`/ws`
- 本地开发模式无鉴权
- CORS：允许前端 dev server（例如 `http://localhost:5173`）

## 统一响应封装

```ts
type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
```

## 通用类型定义（TypeScript）

```ts
export type ProviderConfigView = {
  apiKeySet: boolean;          // 是否已设置
  apiKeyMasked?: string;       // 展示用，例如 "sk-****abcd"
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
};

export type ProviderConfigUpdate = {
  apiKey?: string | null;      // 传空字符串或 null 表示清空
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
};

export type ChannelConfigUpdate = Record<string, unknown>;

export type UiConfigView = {
  enabled: boolean;
  host: string;
  port: number;
  open: boolean;
};

export type ConfigView = {
  agents: {
    defaults: {
      model: string;
      workspace?: string;
      maxTokens?: number;
      maxToolIterations?: number;
    };
  };
  providers: Record<string, ProviderConfigView>;
  channels: Record<string, Record<string, unknown>>;
  tools?: Record<string, unknown>;
  gateway?: Record<string, unknown>;
  ui?: UiConfigView;
};

export type ProviderSpecView = {
  name: string;
  displayName?: string;
  keywords: string[];
  envKey: string;
  isGateway?: boolean;
  isLocal?: boolean;
  defaultApiBase?: string;
};

export type ChannelSpecView = {
  name: string;
  displayName?: string;
  enabled: boolean;
  tutorialUrl?: string;
};

export type ConfigMetaView = {
  providers: ProviderSpecView[];
  channels: ChannelSpecView[];
};
```

## 配置 Schema（Phase 1）

来源：`packages/nextclaw/src/config/schema.ts`。以下为 UI 常用字段结构。

```ts
export type AgentDefaults = {
  workspace: string;
  model: string;
  maxTokens: number;
  maxToolIterations: number;
};

export type ProviderConfig = {
  apiKey: string;
  apiBase: string | null;
  extraHeaders: Record<string, string> | null;
};

export type WhatsAppConfig = {
  enabled: boolean;
  bridgeUrl: string;
  allowFrom: string[];
};

export type TelegramConfig = {
  enabled: boolean;
  token: string;
  allowFrom: string[];
  proxy: string | null;
};

export type DiscordConfig = {
  enabled: boolean;
  token: string;
  allowFrom: string[];
  gatewayUrl: string;
  intents: number;
};

export type FeishuConfig = {
  enabled: boolean;
  appId: string;
  appSecret: string;
  encryptKey: string;
  verificationToken: string;
  allowFrom: string[];
};

export type DingTalkConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  allowFrom: string[];
};

export type SlackConfig = {
  enabled: boolean;
  mode: string;
  webhookPath: string;
  botToken: string;
  appToken: string;
  userTokenReadOnly: boolean;
  groupPolicy: string;
  groupAllowFrom: string[];
  dm: { enabled: boolean; policy: string; allowFrom: string[] };
};

export type EmailConfig = {
  enabled: boolean;
  consentGranted: boolean;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  imapMailbox: string;
  imapUseSsl: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpUseTls: boolean;
  smtpUseSsl: boolean;
  fromAddress: string;
  autoReplyEnabled: boolean;
  pollIntervalSeconds: number;
  markSeen: boolean;
  maxBodyChars: number;
  subjectPrefix: string;
  allowFrom: string[];
};

export type MochatConfig = {
  enabled: boolean;
  baseUrl: string;
  socketUrl: string;
  socketPath: string;
  socketDisableMsgpack: boolean;
  socketReconnectDelayMs: number;
  socketMaxReconnectDelayMs: number;
  socketConnectTimeoutMs: number;
  refreshIntervalMs: number;
  watchTimeoutMs: number;
  watchLimit: number;
  retryDelayMs: number;
  maxRetryAttempts: number;
  clawToken: string;
  agentUserId: string;
  sessions: string[];
  panels: string[];
  allowFrom: string[];
  mention: { requireInGroups: boolean };
  groups: Record<string, { requireMention: boolean }>;
  replyDelayMode: string;
  replyDelayMs: number;
};

export type QQConfig = {
  enabled: boolean;
  appId: string;
  secret: string;
  allowFrom: string[];
};
```

## 更新语义（REST）

- 所有 `PUT` 都是 **merge 更新**（仅覆盖传入字段）。
- 对字符串字段：传空字符串视为清空。
- 对 `nullable` 字段：传 `null` 表示清空。
- 对数组字段：需要传完整数组。
- 对对象字段（如 `extraHeaders` / `slack.dm`）：完整替换该对象。

## REST API

### 1) 健康检查

`GET /api/health`

```json
{ "ok": true, "data": { "status": "ok" } }
```

### 2) 读取配置

`GET /api/config`

- 返回完整配置（敏感字段脱敏）
- `providers.*.apiKey` 不直接返回，转为 `apiKeySet` / `apiKeyMasked`

```ts
ApiResponse<ConfigView>
```

### 3) 配置元信息

`GET /api/config/meta`

- 返回 providers / channels 列表
- UI 用于动态渲染表单

```ts
ApiResponse<ConfigMetaView>
```

### 4) 更新模型

`PUT /api/config/model`

```json
{ "model": "minimax/MiniMax-M2.5" }
```

响应：

```ts
ApiResponse<{ model: string }>
```

### 5) 更新 Provider

`PUT /api/config/providers/:provider`

```json
{
  "apiKey": "sk-xxx",
  "apiBase": "https://api.minimaxi.com/v1",
  "extraHeaders": { "X-Header": "value" }
}
```

响应：

```ts
ApiResponse<ProviderConfigView>
```

说明：
- `apiKey` 为空字符串或 `null` 表示清空
- `extraHeaders` 为对象，`null` 表示清空
- 对未知 provider 返回 `404`

### 6) 更新渠道配置

`PUT /api/config/channels/:channel`

```json
{
  "enabled": true,
  "token": "...",
  "allowFrom": ["123"]
}
```

响应：

```ts
ApiResponse<Record<string, unknown>>
```

说明：
- merge 更新，不覆盖未提供字段
- 对未知 channel 返回 `404`

### 7) 更新 UI 配置（可选）

`PUT /api/config/ui`

```json
{ "host": "127.0.0.1", "port": 18791, "open": true }
```

响应：

```ts
ApiResponse<UiConfigView>
```

### 8) 触发配置重载

`POST /api/config/reload`

响应：

```ts
ApiResponse<{ status: "reloading" | "ok" }>
```

说明：

- Phase 1 为 best-effort，可能仍需要重启 gateway 才完全生效。

## WebSocket 事件（Phase 1）

连接：`ws://127.0.0.1:<ui.port>/ws`

```ts
type WsEvent =
  | { type: "config.updated"; payload: { path: string } }
  | { type: "config.reload.started"; payload?: Record<string, unknown> }
  | { type: "config.reload.finished"; payload?: Record<string, unknown> }
  | { type: "error"; payload: { message: string; code?: string } };
```

### 建议的前端使用方式

- 连接后监听 `config.updated`，按需刷新配置
- 更新表单成功后，也可本地同步状态并等待后端推送

## 错误码建议

- `NOT_FOUND`：unknown provider/channel
- `INVALID_BODY`：请求体不合法
- `WRITE_FAILED`：写入 config 失败
- `RELOAD_FAILED`：重载失败

## 脱敏规则建议

- apiKey 长度 >= 8：显示 `前2 + **** + 后4`
- apiKey 短：显示 `****`

## 版本约定

- Phase 1 仅支持配置管理
- 后续阶段会新增会话与日志相关 API，保持向后兼容
