# 2026-02-19 NextClaw 渠道插件化对齐 OpenClaw 方案（能力不扩展）

## 背景

当前 NextClaw 已进入“渠道由插件注册表驱动”的阶段，但内置渠道仍主要通过 core 内建映射注入，和 OpenClaw 的“每个渠道作为独立插件定义并走 register(api) 注册”仍有差距。

本方案目标是在**不增加渠道能力面**的前提下，对齐 OpenClaw 的组织与加载方式。

## 对齐目标（本次范围）

- 对齐 1：内置渠道改为独立的 bundled 插件定义（每个渠道一个插件模块）。
- 对齐 2：bundled 渠道也走 `register(api) -> registerChannel(...)` 注册路径，而不是旁路注入。
- 对齐 3：运行时继续仅消费插件注册结果（`extensionChannels`），不回退硬编码渠道分支。

## 非目标（本次明确不做）

- 不扩展渠道能力模型（不新增 OpenClaw 的 dock / hooks / cli / service 等高级能力）。
- 不改变现有渠道配置键、行为语义和默认开关。
- 不拆分为多个独立 npm 包发布（先保持 bundled 模式）。

## 目标架构

1. 在 `@nextclaw/openclaw-compat` 内新增 bundled 渠道插件目录：
   - 每个渠道一个插件定义，暴露 `id/name/description/configSchema/register(api)`。
   - `register(api)` 内调用 `api.registerChannel({ plugin: { id, nextclaw: { isEnabled, createChannel } } })`。

2. `loadOpenClawPlugins` 调整为：
   - 先加载 bundled 渠道插件定义并执行 `register(api)`；
   - 再按现有机制发现并加载外部 OpenClaw 插件；
   - 两类插件共用同一注册去重/冲突校验逻辑。

3. `ChannelManager` 保持“只消费 extension registry”模式，确保 core 不再承担渠道硬编码装配。

## 里程碑与交付物

### Milestone A：插件定义拆分

交付物：
- bundled 渠道插件目录（每个渠道一个插件文件 + 聚合导出）。
- 插件定义具备统一元信息与 `register(api)` 入口。

验收标准：
- 能列出 `builtin-channel-*` 插件；
- 每个内置渠道插件都有独立来源文件。

### Milestone B：注册路径统一

交付物：
- loader 去掉内置渠道旁路注入；
- bundled 渠道走与外部插件一致的 register 注册流程。

验收标准：
- 插件冲突/保留名校验行为与外部插件一致；
- `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0` 时，bundled 渠道插件仍可注册并运行。

### Milestone C：验证与发布闭环

交付物：
- 验证记录（build/lint/tsc + 冒烟）。
- 迭代日志（docs/logs 新增版本目录并索引）。
- changeset/version/publish 发布闭环执行结果。

验收标准：
- `pnpm build && pnpm lint && pnpm tsc` 通过；
- `/tmp` 隔离目录冒烟通过：`channels status`、`plugins list --enabled`；
- 发布命令按项目流程执行并留痕。

## 风险与回滚

风险：
- loader 改造后若 bundled 插件注册链路异常，渠道可能全部不可用。

缓解：
- 先保留现有 `nextclaw.createChannel` 运行时钩子，不改渠道行为；
- 通过 build/lint/tsc + CLI 冒烟覆盖关键路径。

回滚：
- 回滚 bundled 插件加载改动与 loader 统一注册改动；
- 恢复到当前“core 映射注入 + extension 消费”版本。
