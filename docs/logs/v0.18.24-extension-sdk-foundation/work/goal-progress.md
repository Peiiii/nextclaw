# Goal Progress

## 当前目标

把 gateway 启动链路收敛成“直接传 gateway 对象”，并继续推进 extension SDK / gateway runtime 方案，不再通过换名制造临时 host/runtime/gateway 类型。

## 明确非目标

不引入新的 `*Gateway` / `*Host` / `*Runtime` / `*Options` / `*Props` 换皮概念来掩盖重复 contract。

## 冻结边界 / 不变量

- server 不拥有 gateway runtime。
- webhook 是通用入口，不是 extension 专属。
- `/ws` 复用现有实时通道。
- 非新增能力改动必须优先删除重复结构。

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

## 当前下一步

等待 review；下一步应继续从新版微信 extension 包接入开始，不要回退到旧插件机制或新增切换开关。

## 锚点计数器

13/20
