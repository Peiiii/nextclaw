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
- 已提交新版微信 extension 运行链路：`9e2eb81b Add Weixin extension channel runtime`。
- 已删除旧版 `packages/extensions/nextclaw-channel-plugin-weixin` 包源码、root build/lint/tsc 旧入口、openclaw compat 旧依赖和 lockfile 旧 workspace 链接；root build/lint/tsc 已改为覆盖新版 `nextclaw-channel-extension-weixin`。
- 旧版微信删除验证通过：旧包 filter 已无匹配，新版 extension lint/tsc/build 通过，openclaw compat tsc/lint 通过，server tsc 与触达文件 ESLint 通过，governance 与 backlog ratchet 通过。
- 生产闭环缺口已补齐：`@nextclaw/service` 直接依赖新版 `@nextclaw/channel-extension-weixin`，service extension discovery 能在生产安装中解析新版 manifest root。
- 新版 Weixin 登录能力已回到 extension 包 owner：QR code start/poll/login、账号 token 保存、旧账号替换、配置回写均由 `WeixinLoginService` 负责；UI auth 通过通用 `extension.request` / `extension.response` 调用 extension 进程，不再由 service import 微信业务导出。
- 真实微信最终冒烟通过：使用新版 extension dist 的 `HttpWeixinApiClient` 和现有账号向真实微信用户发送最终闭环验证文本，返回 `messageId=958206ea-adc6-47e5-9bfd-6cbfa1f18d89`。
- 生产发现、CLI/UI binding、扫码登录配置回写、真实发送、旧包残留搜索、package lint/tsc/test/build、governance、maintainability guard 均已完成闭环。
- 已补修 service/extension 边界漂移：service 仅通过 manifest 生成 channel binding / UI metadata；auth 动态能力走通用 app event bus + ingress 协议；`rg` 已确认 service 源码没有 `WeixinLoginService`、`WEIXIN_*` 或微信 extension 业务 import。

## 当前下一步

当前下一步：完成最终验证复核和收尾汇报；无关 automation/cron 工作区改动继续隔离。

## 锚点计数器

20/20
