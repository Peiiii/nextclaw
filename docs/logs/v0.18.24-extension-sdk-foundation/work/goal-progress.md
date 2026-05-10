# Goal Progress

## 当前目标

把 Extension SDK 与新版 Weixin extension 的真实收发链路跑通，同时保持通用 `Ingress`、现有 `/ws` eventBus、原始 `NcpEndpointEvent` 透传这三条主线不漂移。

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
- 新版 Weixin adapter 已接入真实 iLink `getupdates` / `sendmessage`、账号 token/cursor 文件、allowFrom、context_token、NCP reply consumer。
- Package 级 `tsc` / `test` / `lint` / `build` 通过；真实 Weixin `getupdates` 收到 marker，并用新鲜 `context_token` 真实 `sendmessage` 成功。
- 新版 `WeixinChannelAdapter` 本体路径也已跑通：adapter 自己 poll 到 marker，再通过 `sendNcpEvent(MessageCompleted)` 发送回复。
- 新版 Weixin feature parity 已补齐：typing start/stop、delta 流式回复、原生图片/文件发送、入站附件、跨进程 asset URL 回读都有合同测试。
- 旧版 Weixin built-in channel 入口已禁用；dev 启动只看到新版 `nextclaw-channel-extension-weixin` extension 进程连到现有 `/ws`。
- 真实 Weixin API 冒烟通过：`fetchConfig`、`sendtyping` start/stop、`sendmessage` 文本发送、原生图片发送均返回成功。
- 按用户要求补做真实媒体发送：发送 `tmp_wechat_img27.jpg`、`wikipedia.png` 两张真实图片和 `USAGE.md` 文件，微信 API 均返回成功。
- 功能降级审计补齐旧版合同缺口：API 业务错误、typing keepalive/cache/stop、入站图片/文件下载、markdown MIME、下载失败 remote-only、getupdates session timeout cursor 恢复均有测试覆盖。
- 新版 Weixin targeted 验证通过：21 个测试、package lint、package tsc、build、diff check；全局 governance 被无关 dirty 文件 `packages/nextclaw-core/src/features/cron/services/service.ts` 的命名规则阻塞。

## 当前下一步

收尾复核验证结果、可维护性报告和剩余风险；等待用户决定是否处理无关治理阻塞或提交。

## 锚点计数器

20/20
