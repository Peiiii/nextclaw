# Runtime Session Type Icon Design

## 背景

NextClaw 已经支持多种 agent runtime / session type，但“新会话”选择器、侧边栏会话上下文与当前会话头部仍主要依赖纯文本 label。

这会带来三个问题：

- 不同 runtime 的识别成本偏高，尤其是 `Codex`、`Claude`、`Hermes` 这类用户心智非常强的运行时
- runtime 明明已经是正式产品能力，但在 UI 上仍像一层临时字符串配置
- 后续第三方 runtime 若想提供稳定品牌识别，当前没有正式展示扩展点

## 统一资源协议前提

runtime icon 不是孤立特性。它属于 NextClaw 的 Resource URI 体系，统一规范见 [2026-04-18-resource-uri-conventions.md](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-18-resource-uri-conventions.md)。

本方案默认遵循两个前提：

- 不新增 runtime 专属 scheme
- 应用内置静态资源统一走 `app://...`

## 长期目标对齐

这次改动服务三条长期方向：

- 统一入口：不同 runtime 仍然通过同一套会话入口进入 NextClaw
- 统一体验：runtime 差异以统一展示协议呈现，而不是各处临时写死判断
- 生态扩展：runtime author 可以声明自己的展示图标，而不是要求核心 UI 硬编码品牌逻辑

## 我的判断

推荐方案是：

- 给 session type / runtime entry 增加一层极薄的展示元数据，只新增 `icon`
- 第一版只支持“UI 可直接消费的图片图标”，不引入图标主题系统、远程抓取服务或额外注册中心
- 第一方 runtime 图标直接下载官方资源并落库到仓库静态资源目录，不在运行时热链官网
- 第三方 runtime 若要自定义图标，通过已有 runtime 注册/描述链路返回 `icon` 即可

不推荐的方案：

- 前端根据 `codex / claude / hermes` 直接写死官网图标映射
- 运行时去请求官网 favicon
- 为图标单独设计一整套庞大的配置页和拉取缓存系统

## 目标结构

### 1. 数据合同

新增统一图标结构：

```ts
type SessionTypeIconView = {
  kind: "image";
  src: string;
  alt?: string | null;
};
```

接入两条链路：

1. `ChatSessionTypeOptionView.icon`
2. `RuntimeEntryView.icon`

其中：

- `ChatSessionTypeOptionView.icon` 是前端最终消费的会话类型图标
- `RuntimeEntryView.icon` 只负责让“基于 entry 的 runtime”能够声明默认图标，例如 `agents.runtimes.entries.hermes`
- `src` 保留图片字段语义，但其值统一要求写 Resource URI；本次内置 runtime 图标使用 `app://runtime-icons/<file>`

### 2. 来源优先级

会话类型图标按以下优先级解析：

1. `describeSessionTypeForEntry` / `describeSessionType` 显式返回的 `icon`
2. runtime entry 自身声明的 `icon`
3. 无图标

第一方内置 runtime 的做法：

- `Codex` 插件描述返回 `app://runtime-icons/codex-openai.svg`
- `Claude` 插件描述返回 `app://runtime-icons/claude.ico`
- `Hermes` 这类由 runtime entry 驱动的类型，通过 `agents.runtimes.entries.<id>.icon` 提供

### 3. UI 接入面

本次接入以下位置：

- 左侧 “新任务 / 新会话” runtime 下拉
- 项目分组里的新会话下拉
- 侧边栏会话 item 的 session context icon
- 当前会话头部的 session type badge

这些位置统一消费同一份 `sessionTypeOptions[].icon`，避免各处自行做品牌判断。

### 4. 第一方图标资源策略

第一方 runtime 图标统一放在：

- `packages/nextclaw-ui/public/runtime-icons/`

资源规则：

- 直接下载官方资源并随仓库发布
- 不在产品运行时访问官网
- 不引入额外下载脚本作为产品依赖
- runtime 描述合同里使用 `app://runtime-icons/...`，由 UI 在边界层解析到实际静态路径

## 非目标

本次不做：

- 运行时自动抓取 favicon
- 图标主题切换 / 明暗两套 runtime 皮肤系统
- 图标颜色配置、hover 动画、品牌介绍卡片
- 为 runtime config 页面新增一整套图标表单编辑器
- 第三方插件静态资源打包规范重构

## 实现约束

### 1. 避免冗余配置

只新增 `icon` 一个展示字段，不新增：

- `brand`
- `logo`
- `logoUrl`
- `faviconUrl`
- `iconTheme`
- `iconProvider`

### 2. 避免硬编码品牌判断

核心 UI 不允许出现：

- `if (sessionType === "codex") use openai icon`
- `if (sessionType === "claude") use claude icon`

品牌资源应由 runtime 描述链路或 runtime entry 自己提供。

### 3. 不新增 runtime 专属协议

核心实现不允许继续引入：

- `runtime-icon://...`
- `session-type-icon://...`

统一复用 Resource URI 规范中的 `app://...`

### 3. 保持回退稳定

若 runtime 没有提供图标：

- 下拉仍显示文本 label
- 会话列表仍显示现有 badge / label
- 不影响已有 session type 可用性

## 验证与发布

收尾至少完成：

1. 相关单元测试覆盖新的 icon 元数据透传与回退行为
2. `pnpm lint:maintainability:guard`
3. `pnpm check:governance-backlog-ratchet`
4. 受影响包的测试与类型检查
5. 本地 UI 冒烟确认：
   - `Codex` 新会话项显示官方图标
   - `Claude` 新会话项显示官方图标
   - 带 `icon` 的 `Hermes` runtime entry 显示官方图标
   - 无 `icon` 的 runtime 仍保持纯文本可用
