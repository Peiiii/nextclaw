# Goal Progress

## 当前目标

把 extension 外部入口收敛成通用 `Ingress`：HTTP `/webhook` 只做路由绑定，内部直接进入 `gateway.ingress`，删除旧 `WebhookService` / `UiWebhook*` / extension 专属 webhook 抽象。

## 明确非目标

不引入新的 `*Gateway` / `*Host` / `*Runtime` / `*Options` / `*Props` 换皮概念来掩盖重复 contract。

## 冻结边界 / 不变量

- server 不拥有 gateway runtime。
- webhook 是通用入口，不是 extension 专属。
- `/ws` 复用现有实时通道。
- 非新增能力改动必须优先删除重复结构。
- 不新增 adapter / host / context 换皮层；能直接访问 owner 就直接访问。

## 已完成进展

- 已识别 `StartUiServerGateway` 是错误换名模式。
- 已把“禁止重命名替代结构修复”写入 clean implementation skill。
- 已删除 server 侧导出的 gateway runtime/options/host 类型，`startUiServer` 改为直接接收 gateway。
- 已删除 `server.types.ts`，webhook contract 回到 route types，server handle 回到 server 文件。
- 已把本轮机制问题收敛为规则：新名字必须对应真实 owner / 生命周期 / 权限边界 / 协议转换 / 持久化责任，否则必须删除重复 contract。
- 已补全 gateway runtime / webhook 方案文档的当前代码对齐状态、过渡债务、启动阶段归属、分阶段验收和交付前检查清单。
- 已把 `NextclawGatewayRuntime` 收敛为 gateway 启动 owner，删除外层 hydrate/apply/state 搬运链路。
- 已把 constructor 胶水 owner 拆到 `gateway/managers/` 独立文件。
- 已把 classless `.service.ts` 改为 `.utils.ts` 并移动到对应 `utils/` 目录。
- 已通过 `@nextclaw-service` / `@nextclaw/server` / `nextclaw` TypeScript 验证、targeted gateway/plugin/NCP tests、三包 ESLint、`pnpm lint:new-code:governance`、maintainability guard、governance ratchet 与 `git diff --check`。
- 已定位并修复 dev start 左上角版本与更新状态问题：禁用 runtime update host 时不再注册 update 路由；产品版本解析优先读取 `nextclaw` 产品包版本。
- 已修正 service 包真实发布名为 `@nextclaw/service`，`@nextclaw-service` 仅保留为源码内部 alias。
- 已新增共享 `Ingress`，并挂到 `nextclaw.ingress`，与 `nextclaw.eventBus` 同级。
- 已让 `NextclawGatewayRuntime` 持有 `nextclaw.ingress` 并传给 server；server 的 `/webhook` 路由直接调用 `gateway.ingress.handle()`。
- 已删除 service 侧 `WebhookService` 及其测试，删除 server 侧 `UiWebhookEnvelope` / `UiWebhookContext` / `UiWebhookHost` 导出。
- 已把 extension runtime 的 channel config / submit message handler 注册到 `Ingress`，extension SDK 内部提交命名从 webhook 调整为 ingress，HTTP 路径仍保留通用 `/webhook`。
- 已避免为测试批量污染 legacy root 测试文件，保留旧测试默认不需要传 ingress；新增 route 级 ingress 测试落到 `ui-routes/` 子树。
- 已通过相关 tsc / lint / maintainability / governance / diff-check；server route test 当前受既有 Vitest alias 解析问题阻塞，已记录在验证结果中。

## 当前下一步

最终复核 diff 和验证结果，确认没有旧 webhook 抽象残留后交付 review。

## 锚点计数器

2/20
