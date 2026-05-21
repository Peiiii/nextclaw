# NextClaw UI（网关复用）设计文档

## 目标

- 新增 `nextclaw ui` 命令，打开网页作为“操作系统界面”。
- UI 后端使用 **Hono**，并**复用 gateway 进程**。
- 前端独立 dev server，不由后端托管静态资源。
- 第一阶段仅实现“系统配置”能力（模型与渠道配置）。
- 本地开发模式不需要额外授权。
- 端口可配置，并提供默认端口。
- 详细 API 规范见 `docs/designs/2026-02-12-ui-gateway-api.md`。

## 非目标（第一阶段）

- 会话聊天 UI、工具日志、执行可视化、插件管理。
- 远程访问、权限系统、审计。
- 生产部署的 TLS/反向代理方案。

## 总体架构

```
[nextclaw ui]
   | (启动 gateway + ui server)
   v
[Gateway Process]
   |- AgentLoop
   |- MessageBus
   |- SessionManager
   |- Channels Manager
   |- UI Server (Hono)

[Frontend Dev Server]
   |- React/Vite/其他（由前端实现）
   |- 与 UI Server 通讯（REST + WS）
```

- `nextclaw ui` 负责启动 gateway，并挂载 UI Server。
- UI Server 只提供 API/WS，不负责静态资源。
- 前端 dev server 通过 API/WS 访问后端。

## 端口与配置

新增配置项：

```json
{
  "ui": {
    "enabled": false,
    "host": "127.0.0.1",
    "port": 55667,
    "open": true
  }
}
```

- `host`：默认 127.0.0.1，仅本地访问。
- `port`：默认 55667，可自定义。
- `open`：是否自动打开浏览器（仅 `nextclaw ui` 默认 true）。

CLI 参数建议：

- `nextclaw ui --host 127.0.0.1 --port 55667 --no-open`
- `nextclaw gateway --ui`（可选：在 gateway 上也启用 UI）

## UI Server（Hono）设计

### 路由前缀

- REST：`/api`
- WS：`/ws`

### 配置 API（第一阶段）

#### 读取当前配置

- `GET /api/config`
- 返回：当前 config 全量（敏感字段可脱敏，如 apiKey 仅保留前后 2 位）

#### 更新模型与 Provider

- `PUT /api/config/model`
  - body: `{ "model": "minimax/MiniMax-M2.5" }`
  - 行为：更新 `agents.defaults.model`

- `PUT /api/config/providers/<provider>`
  - body: `{ "apiKey": "...", "apiBase": "...", "extraHeaders": {...} }`
  - 行为：更新指定 provider 节点

#### 更新渠道配置

- `PUT /api/config/channels/<channel>`
  - body: 渠道配置（例如 token/allowFrom 等）
  - 行为：更新指定 channel 节点

#### 重载运行时配置（可选）

- `POST /api/config/reload`
  - 行为：通知 gateway 重新加载配置（重新初始化 provider/渠道）

### WS 事件（预留）

第一阶段只需要配置，但预留事件协议：

- `config.updated`
- `config.reload.started`
- `config.reload.finished`
- `error`

## 与 Gateway 的集成方式

- 在 `gateway` 启动流程中创建 UI Server 实例。
- UI Server 使用 `loadConfig/saveConfig` 访问配置文件。
- 如果需要“热重载”，对 `ChannelManager` 与 `AgentLoop` 提供重载入口。

## 数据安全与校验

- 本地开发模式默认不做鉴权。
- 对配置写入使用 schema 校验（复用 `ConfigSchema`）。
- 写入前合并原配置，避免覆盖无关字段。
- 对 apiKey 做最小脱敏展示（仅 UI 展示，存盘保存原值）。

## 模块设计（建议）

```
packages/nextclaw/src/ui/
  server.ts          // Hono app + routes
  router.ts          // 具体路由注册
  config.ts          // config read/write helpers
  types.ts           // API 类型
```

- `server.ts`：提供 `createUiServer({ configPath, onReload, ... })`
- `config.ts`：封装 config 读写/脱敏/校验
- `types.ts`：前后端共享接口定义（供前端生成类型）

## CLI 设计

新增命令：

- `nextclaw ui`
  - 默认等价于 `nextclaw gateway --ui --open`
  - 启动 UI Server，并打开浏览器

可复用命令行框架：`packages/nextclaw/src/cli/index.ts`

## 迭代计划

### Phase 1（本次）

- UI Server 基础框架（Hono）
- 配置读取/更新接口
- `nextclaw ui` 命令
- 端口可配 + 默认端口
- 本地模式不鉴权

### Phase 2

- 会话列表/历史
- 对话流与工具日志（WS）
- 运行状态监控（channels/cron/heartbeat）

### Phase 3

- 插件管理、可视化工具链
- 角色/权限（可选）
- 生产部署指南

## 验证方案（实现阶段）

- `pnpm build / lint / tsc`
- `nextclaw ui` 启动后：
  - `GET /api/config` 返回正确结构
  - `PUT /api/config/model` 写入后配置生效
  - `PUT /api/config/channels/telegram` 写入后配置文件更新

## 风险与权衡

- 复用 gateway 进程会耦合 UI 生命周期，但减少进程数。
- 无鉴权适合本地开发，不适合公网部署。
- 热重载涉及 provider/channel 的安全重建，需要谨慎处理。
