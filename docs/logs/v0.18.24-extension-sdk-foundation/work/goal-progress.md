# Goal Progress

## 当前目标

把 Extension SDK 第一阶段骨架跑通，同时保持通用 `Ingress`、现有 `/ws` eventBus、原始 `NcpEndpointEvent` 透传这三条主线不漂移。

## 明确非目标

不迁移旧微信复杂实现；不新增 extension 专属 webhook/ws/event bridge；不为无语义转发创建 adapter、host、context 或 wrapper。

## 冻结边界 / 不变量

- `/webhook` 是通用 ingress 入口。
- `/ws` 复用现有 app event bus。
- `ncp.event` payload 必须是原始 `NcpEndpointEvent`。
- 配置监听通过通用 `config.updated` 失效后重新 `config.get()`。
- 非新增能力优先删除重复结构。

## 已完成进展

- 新增共享 `Ingress` 并挂到 `nextclaw.ingress`，server `/webhook` 直接调用 gateway ingress。
- 新增 `@nextclaw/extension-sdk` 与新版微信 extension 包骨架，公共入口无启动副作用。
- SDK 根对象收敛为 `NextClawExtension`，配置监听和 channel NCP event 都复用通用事件机制。
- `ncp.event` 已收敛为原始 `NcpEndpointEvent`，删除 channel 路由字段包装。
- 已删除空心 `NcpEventBridgeService`，backend 事件订阅生命周期回到 `UiNcpAgentRuntimeService`。
- 已保留 `unsubscribeNcpEvents` 的 `null` 状态语义，并把“清晰性优先于机械消灭可空状态”沉淀到 clean implementation skill。

## 当前下一步

完成 bridge 删除后的 targeted test、tsc、lint、maintainability 与 smoke 复核；当前 targeted test 暴露既有期望/超时问题，需要继续按最小真实链路修正或隔离验证。

## 锚点计数器

18/20
