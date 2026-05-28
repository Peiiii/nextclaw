# DocBrowser 内置路由注册设计

## 背景

DocBrowser 已经从单纯文档窗口演进成 NextClaw 的内置操作入口：它承载文档、应用面板、服务应用、panel app iframe，以及新建标签页导航页。继续用 `kind` 分支和组件内手写 URL，会让每个新入口都变成一次局部补丁，难以支持稳定的前进、后退、打开新页面、去重和恢复。

这件事服务 NextClaw 的“个人操作层”愿景：DocBrowser 应该逐步成为统一入口的一部分，而不是只服务帮助文档的临时容器。

## 现状判断

当前并不是缺少 manager/store：

- `DocBrowserStore` 已经持久化 `tabs`、`activeTabId`、`mode`。
- `DocBrowserTab` 已经包含 `currentUrl`、`history`、`historyIndex`、`navVersion`。
- `DocBrowserManager` 已经拥有 `open`、`navigate`、`goBack`、`goForward`、`closeTab` 等动作。

真正缺失的是一层稳定的 route registry：

- `kind` 同时承担渲染 key、URL 类型、导航语义，职责过重。
- `docs`、`home`、`apps`、marketplace 跳转分散在不同文件。
- `goBack/goForward/navigate` 写死 `docs`，没有按 route policy 判断。
- 新建标签页自己手写 URL 与 dedupe 规则，后续扩展会继续复制。

## 目标架构

### Store

Store 只保存可序列化状态：

- 面板开关与模式。
- tab 列表。
- 当前 tab。
- 每个 tab 的 URL 历史。

Store 不判断业务页面，不归一化 URL，不决定 title，不执行跳转。

### Manager

`DocBrowserManager` 是唯一状态迁移 owner：

- 打开 URL 或 route target。
- 新建标签。
- 当前 tab 内导航。
- 前进、后退。
- 去重并更新已有 tab。
- 关闭和切换 tab。

组件只调用 manager/context 暴露的意图级方法，不直接修改 tab 历史。

### Route Registry

Route registry 是 URL 到 DocBrowser route 语义的事实源。每个 route 定义：

- `id`：稳定 route id。
- `kind`：tab/render key。
- `defaultUrl`：无 URL 打开时的默认地址。
- `matchUrl`：URL 匹配规则。
- `normalizeUrl`：URL 归一化。
- `getTitle`：默认 tab 标题。
- `getDedupeKey`：可选去重键。
- `historyPolicy`：是否由 DocBrowser 管理 tab history。

首页导航项也从 registry 导出，避免导航页组件硬编码产品入口。

## 本次落地范围

本次先做可继续演进的一版，不一次性重写全部渲染系统：

1. 新增 DocBrowser route registry。
2. 让 `DocBrowserManager` 通过 registry 解析 open/navigate/sync/back/forward。
3. 让新建标签和首页导航项走 registry target。
4. 将 apps URL 常量收敛到 DocBrowser route 层，panel apps 功能复用同一事实源。
5. 保留现有 `customTabRenderers`，后续再把 renderer 也升级为 route definition 的一部分。

## 后续演进

后续可以继续把 `customTabRenderers` 合并进 route definitions，让 route 同时声明：

- content renderer。
- toolbar renderer。
- iframe sandbox。
- iframe message handler。
- external app route bridge。

到那一步，DocBrowser 会从“tab + renderer map”升级成真正的内置 route surface。

## 验收标准

- 新建标签仍打开 `nextclaw://new-tab`。
- 首页导航项不再在组件里手写 URL 和 dedupe 规则。
- Apps / Service Apps 使用统一 apps route 常量。
- `navigate/goBack/goForward` 不再写死只允许 `docs`，而是按 route history policy 工作。
- 既有 docs、apps、自定义内容 tab 行为不回归。
- TypeScript、定向测试、用户可见冒烟验证通过。
