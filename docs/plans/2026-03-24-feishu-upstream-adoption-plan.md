# NextClaw 飞书 Upstream 吸收执行计划

## 目标

把飞书官方插件的可迁移能力，收敛成一个本次可以一次性实现、验证、发布的 Phase 1 闭环。

这次不追求“对齐全部飞书官方能力”，而是优先完成后续所有飞书能力扩展都要依赖的底座，并让现有 NextClaw 飞书通道先获得一轮结构性升级。

## Phase 1 交付边界

本次发布只做以下内容：

1. 新建 `@nextclaw/feishu-core`
2. 吸收飞书配置模型、账号解析、SDK client 管理、基础 probe、基础消息内容转换
3. 让 `@nextclaw/core` 使用新的飞书配置模型
4. 让 `@nextclaw/channel-runtime` 的 Feishu runtime 改为基于 `@nextclaw/feishu-core`
5. 让当前 Feishu 通道获得以下首批能力：
   - `accountId` 路由
   - 多账号配置基础设施
   - `domain` / `lark` 品牌切换
   - richer inbound content conversion
   - DM / group / mention 基础策略
   - outbound 按账号发送
6. UI 配置页补齐本次已经真正支持的关键字段

本次明确不做：

- OAuth / UAT / token store
- OAPI tools 注册
- 文档 / 云盘 / wiki / 日历 / 任务的工具执行入口
- card action / reply dispatcher
- OpenClaw 生命周期兼容壳层改造

## 为什么这是本次最优切片

站在 AgentOS 视角，飞书最终要覆盖的不只是消息入口，而是工作入口。

但站在 CEO + CTO + PM 联合视角，本次最优切片不是直接做一堆工具，而是先解决当前最本质的问题：

- 飞书能力现在散落在 channel runtime，后续无法可持续扩展
- 配置模型过薄，很多关键能力没有落点
- 没有飞书平台层，后续要复用官方实现会越来越乱

所以这次先把“平台底座 + 入口质量”做好，属于高杠杆投入。

## Upstream 文件吸收清单

### A 类：本次直接吸收

- `src/core/config-schema.js`
  - 吸收其字段设计与 cross-field 约束思路
  - 落地为 NextClaw TypeScript 版本，避免直接保留 compiled JS
- `src/core/accounts.js`
  - 吸收多账号合并与 `domain/brand` 解析逻辑
- `src/core/lark-client.js`
  - 吸收 SDK client 缓存、brand/domain、header 注入、bot probe 核心逻辑
- `src/messaging/converters/content-converter.js`
  - 吸收转换框架与 mention 解析策略
- `src/messaging/converters/text.js`
- `src/messaging/converters/post.js`
- `src/messaging/converters/image.js`
- `src/messaging/converters/file.js`
- `src/messaging/converters/audio.js`
- `src/messaging/converters/sticker.js`
- `src/messaging/converters/interactive.js`
- `src/messaging/converters/calendar.js`
- `src/messaging/converters/todo.js`

### B 类：本次只吸收设计，不直接搬代码

- `src/core/tool-client.js`
  - 本次只保留目录位与设计意图，不进入实现范围
- `src/core/scope-manager.js`
- `src/core/token-store.js`
- `src/core/uat-client.js`
- `src/core/app-scope-checker.js`

### C 类：本次明确不复制

- `src/channel/plugin.js`
- `src/channel/config-adapter.js`
- `src/channel/onboarding.js`
- `src/messaging/inbound/dispatch.js`
- `src/messaging/inbound/handler.js`
- `src/messaging/outbound/actions.js`
- `src/card/reply-dispatcher.js`

## 目录与文件映射

### 新包

新增目录：

- `packages/extensions/nextclaw-feishu-core`

首批文件结构：

- `src/index.ts`
- `src/config-schema.ts`
- `src/accounts.ts`
- `src/lark-client.ts`
- `src/probe.ts`
- `src/content-converter.ts`
- `src/content-converter.test.ts`
- `src/accounts.test.ts`
- `package.json`
- `tsconfig.json`
- `eslint.config.mjs`
- `README.md`

### 现有包改动

- `packages/nextclaw-core/src/config/schema.ts`
  - 切到新的 Feishu schema
- `packages/nextclaw-core/src/config/schema.labels.ts`
  - 补充本次真正支持的新字段文案
- `packages/nextclaw-core/src/config/schema.help.ts`
  - 补充说明
- `packages/nextclaw-core/src/channels/feishu-probe.ts`
  - 改为复用 `@nextclaw/feishu-core`
- `packages/extensions/nextclaw-channel-runtime/src/channels/feishu.ts`
  - 切到 `@nextclaw/feishu-core`
- `packages/extensions/nextclaw-channel-runtime/package.json`
  - 增加 `@nextclaw/feishu-core`
- `packages/nextclaw-ui/src/components/config/channel-form-fields.ts`
  - 补齐当前已支持字段
- `packages/nextclaw-ui/src/lib/i18n.ts`
- `packages/nextclaw-ui/src/lib/i18n.channels.ts`
- 根目录 `package.json`
  - 把新包纳入 `build/lint/tsc`

## Phase 1 的产品定义

本次发布后，NextClaw 对飞书的产品定义从：

- “一个基础消息通道”

升级为：

- “一个带飞书平台底座的消息入口”

用户可见的直接收益：

1. Feishu 配置模型不再只有最基础的四五个字段
2. 通道层第一次具备多账号与账号路由基础设施
3. 群聊/私聊策略与 mention 门槛有了明确配置落点
4. 飞书消息内容转换更接近真实工作消息，而不是纯文本碰碰运气
5. 后续继续吸收日历、任务、文档、知识库能力时，不需要再推翻一次结构

## 最小发布范围

本次 changeset 预计至少覆盖：

- `@nextclaw/feishu-core`
- `@nextclaw/core`
- `@nextclaw/channel-runtime`

若 UI 改动进入 npm 打包链路，则视验证结果决定是否同时纳入：

- `nextclaw`
- `@nextclaw/server`

判断原则：

- 若只改前端源码但不影响 npm runtime 包，不扩大发布
- 若根级联动导致直接依赖链版本必须同步，则按 workspace 联动发布

## 验证计划

本次至少完成：

1. `@nextclaw/feishu-core` 单测
2. `@nextclaw/feishu-core` build / lint / tsc
3. `@nextclaw/core` build / lint / tsc
4. `@nextclaw/channel-runtime` build / lint / tsc
5. 若改 UI：
   - `@nextclaw/ui` lint / tsc
6. maintainability guard

本次不做真实飞书线上 OAuth / 工作面冒烟，因为未引入 OAuth 与 OAPI tools 执行入口；但会对 config、route metadata、converter 行为做可自动验证的覆盖。

## 发布后下一步

Phase 1 发完后，按优先级推进：

1. `tool-client + scope + token + oauth` 基础设施
2. `wiki / drive / document` 工作面
3. `calendar / task` 调度执行面
4. richer card / streaming / media outbound

## 本次执行原则

- 不把官方飞书插件作为运行时依赖
- 不把 OpenClaw 壳层复制进 NextClaw
- 允许复制纯飞书层逻辑，但进入仓库后立刻转为 NextClaw 自维护资产
- 一切以“结构更清晰、复杂度更低、后续可持续扩展”为优先
