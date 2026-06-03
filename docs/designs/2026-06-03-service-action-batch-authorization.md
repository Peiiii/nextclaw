# Service App 动作批量授权方案

## 背景

Panel App 调用 Service App action 时，目前按 action 粒度弹出授权。这个权限粒度是对的，但交互粒度过细：一个应用如果声明了多个 action，用户会连续遇到多次授权弹窗，体验接近“每一步都被打断”。

目标不是取消授权，也不是把所有权限改成粗粒度 app 级大开关，而是把同一个 Panel App 已声明、未授权的 Service App actions 合并成一次确认。

## 目标

- 用户第一次触发某个 Service App action 时，一次性看到当前 Panel App 声明但尚未授权的 actions。
- 用户确认后，底层仍逐 action 记录 grant，保留清晰撤销能力。
- Service App 的启动、发现、调用链路不变；授权改动不引入新的运行模型。
- 单 action 授权继续可用，但走同一条批量授权主链路。

## 非目标

- 不做 Service App 级永久授权。
- 不做风险级 scope，例如“允许所有 read action”。
- 不改变 Service App lazy start / MCP runtime lifecycle。
- 不为 Agent capability 授权引入新的批量模型，本次只处理 Service App actions。

## 推荐方案

### 1. Kernel

在 `ServiceAppManager` 增加：

- `grantServiceActions(actionIds, request): Promise<ServiceActionGrant[]>`
- `grantServiceAction(actionId, request)` 保留为薄包装，内部调用批量方法的一元素路径。

批量方法负责：

- 校验 caller。
- 去重并规范化 action ids。
- 逐个校验 action 是否已被当前 Panel App 声明。
- 逐个读取 manifest action，并按 action 的 risk 写入 grant store。

底层 `.service-action-grants.json` 不改 schema，继续按 caller + actionId 存储。

### 2. Server / SDK

新增 API：

- `POST /api/service-action-grants`
- body: `{ "actionIds": ["app.action"] }`
- response: `{ "grants": [...] }`

旧的：

- `POST /api/service-actions/:actionId/grant`

继续保留，但走同一个 manager 方法，避免破坏已有调用点。

### 3. Panel App Bridge

当 `invoke` 收到 `AUTHORIZATION_REQUIRED`：

1. 使用当前 bridge session 调用 `listServiceActions`。
2. 找出 `grantState === "not-granted"` 的 actions。
3. 确保当前触发的 action 在授权列表中。
4. 弹一次授权对话框，展示所有待授权 actions。
5. 用户确认后调用 `grantServiceActions`。
6. 重试原始 invoke。

这样用户只被问一次，但系统权限仍然是逐 action 落盘、逐 action 撤销。

### 4. UI

授权弹窗从“单动作详情”变成“本次待授权动作清单”：

- 来源：Panel App id。
- 动作列表：显示 title/id、description、risk。
- 当前调用输入预览：仅展示触发本次授权的 action 输入，不假装它属于所有 actions。
- 按风险值直观展示，不额外隐藏危险 action。

### 5. 验收

- Kernel：批量授权多个 declared actions 后，两个 actions 都是 granted。
- Kernel：批量授权包含未声明 action 时失败。
- Server：`POST /api/service-action-grants` 透传 bridge caller / declared actions。
- UI Bridge：一次 authorization request 包含多个未授权 actions，只调用一次 batch grant，并重试原 action。
- TypeScript：触达的 kernel/server/client-sdk/ui 包通过类型检查。
