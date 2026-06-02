# NextClaw SideDock 右侧快捷入口设计

## 背景

NextClaw 已经有右侧 DocBrowser / right panel，用来承载 docs、Apps、Service Apps、Panel App 和其它适合在右侧展示的轻量资源。上一阶段的 [右侧栏资源 URI 设计](2026-06-01-unified-navigation-uri-design.md) 解决的是“这些右侧栏资源如何被统一描述、打开、去重和恢复”。

但用户真实想要的产品能力不是 URI 本身，而是一个更直接的入口：

> 在右侧有一条类似 Activity Bar 但更轻量的快捷入口条，用户可以快速打开内置功能，也可以把常用右侧栏资源 pin 到那里。

本文将这个能力暂称为 **SideDock**。

## 产品定位

SideDock 是右侧栏资源的固定快捷入口层。它不承载内容，不替代主路由，也不是完整 Activity Bar 系统。

它只做三件事：

1. 展示一组右侧快捷入口。
2. 支持系统内置入口和用户 pin 的入口共存。
3. 点击入口后打开或聚焦对应的右侧栏资源。

内容仍由 DocBrowser / right panel 承载；资源身份和打开合同复用 right-panel-resource URI 体系。

## 命名判断

候选名：

- `Activity Bar`：不推荐。它暗示 VS Code 式 activity/view-container 体系，容易把能力做重。
- `RightRail`：偏布局名，表达右侧轨道，但不够产品化。
- `QuickDock`：强调快捷，但位置不明显。
- `SideDock`：推荐。表达侧边固定入口，语义轻，不强行绑定 VS Code activity 模型。

第一阶段建议使用：

- 产品概念：`SideDock`
- feature root：`features/side-dock`
- 类型前缀：`SideDock`

## 与右侧栏资源 URI 的关系

SideDock 和 right-panel-resource URI 是两个独立但关联的设计：

- SideDock 是用户可见的快捷入口层。
- right-panel-resource URI 是可打开目标的资源合同。

SideDock item 不直接保存 React component、iframe URL、manager method 或函数引用，而是保存稳定 target 描述：

```ts
export type SideDockItemTarget = {
  type: 'right-panel-resource';
  uri: string;
};
```

点击时由 SideDock manager 调用 DocBrowser manager：

```ts
docBrowserManager.open(item.target.uri);
```

这样 SideDock 不需要理解 docs、Apps、Service Apps、Panel App 的具体打开细节，也不会成为第二个 route owner。

## 范围

### 第一阶段做

- 右侧窄条快捷入口 UI。
- 系统内置入口：
  - Apps
  - Service Apps
  - Docs
  - New Tab / Start Page
- 用户可 pin 的入口模型。
- 用户 pin 列表持久化。
- 内置入口不可 unpin。
- 点击入口打开对应 right-panel resource。
- 当前 active / open 状态的基础视觉反馈。

### 第一阶段不做

- 不做完整 Activity Bar / View Container。
- 不把主工作区页面全部接入。
- 不做全局 Omnibox。
- 不做复杂分组、折叠、工作区级 profile。
- 不支持 pin 任意 React component。
- 不把 SideDock 做成 DocBrowser 的内部子模块。

## 核心交互

### 打开

点击 SideDock item：

1. 如果右侧栏未打开，则打开右侧栏。
2. 如果目标资源已有 tab，则聚焦该 tab。
3. 如果没有，则打开新 tab 或复用对应 dedupe tab。

实际去重策略由 DocBrowser manager 和 right-panel-resource resolver 负责。

### Pin

用户在可 pin 的资源入口处选择 Pin to SideDock：

1. 调用 SideDock manager 的 `pinItem`。
2. SideDock store 持久化 item。
3. SideDock UI 立即出现该入口。

可 pin 的资源必须能表达为 `SideDockItemTarget`。如果一个页面不能稳定表达为 right-panel resource URI，则第一阶段不支持 pin。

### Unpin

- 系统内置入口不可 unpin。
- 用户 pin 的入口可以 unpin。
- Unpin 只移除快捷入口，不关闭已经打开的 DocBrowser tab。

### 排序

第一阶段可以先固定顺序：

1. 系统内置入口按配置顺序在上。
2. 用户 pin 入口按 pin 时间或用户排序在下。

拖拽排序可作为后续增强。

## 数据模型

```ts
export type SideDockItemId = string;

export type SideDockItemTarget = {
  type: 'right-panel-resource';
  uri: string;
};

export type SideDockIconName = 'apps' | 'docs' | 'new-tab' | 'service-apps';

export type SideDockItemIcon =
  | { type: 'builtin'; name: SideDockIconName }
  | { type: 'url'; url: string };

export type SideDockItem = {
  id: SideDockItemId;
  labelKey: string;
  icon: SideDockItemIcon;
  target: SideDockItemTarget;
  builtIn: boolean;
  removable: boolean;
};

export type SideDockPinnedItem = {
  id: SideDockItemId;
  labelKey: string;
  icon: SideDockItemIcon;
  target: SideDockItemTarget;
  createdAt: string;
};
```

内置入口来自 config，不进入用户持久化列表。用户持久化只保存 `SideDockPinnedItem[]`。

## 代码组织

```text
packages/nextclaw-ui/src/features/side-dock/
├── index.ts
├── components/
│   └── side-dock.tsx
├── configs/
│   └── side-dock-built-in-items.config.ts
├── managers/
│   └── side-dock.manager.ts
├── stores/
│   └── side-dock.store.ts
├── types/
│   └── side-dock.types.ts
└── utils/
    └── side-dock-item.utils.ts
```

角色说明：

- `stores/side-dock.store.ts`：Zustand persist owner，保存用户 pin 的入口、排序等轻量状态。
- `managers/side-dock.manager.ts`：SideDock 业务 action owner，负责 pin、unpin、reorder、open item。
- `configs/side-dock-built-in-items.config.ts`：系统内置不可移除入口。
- `components/side-dock.tsx`：渲染右侧快捷入口条，只连接 store / manager，不承载内容。
- `utils/side-dock-item.utils.ts`：无状态合并和校验，例如合并内置入口与用户 pin 入口。

`SideDockManager` 是真实 manager，因为它拥有可持久化状态的业务动作，并需要调用 `DocBrowserManager` 打开资源。它的实例由 `AppPresenter` 装配。

## AppPresenter 装配

```ts
export class AppPresenter {
  rightPanelResourceRouteResolver = new RightPanelResourceRouteResolver();
  docBrowserManager = new DocBrowserManager(this.rightPanelResourceRouteResolver);
  sideDockManager = new SideDockManager(this.docBrowserManager);
}
```

SideDock manager 可以依赖 DocBrowser manager，因为它的业务动作是“打开右侧栏资源”。这是一条稳定 manager 依赖，应由 app-level presenter 构造期一次性装配，不通过 callback、bind 或 Provider 二次注入。

## UI 布局关系

SideDock 属于 app layout 层，与 DocBrowser 同级组合：

```text
AppLayout
├── DesktopAppShell / MobileAppShell
├── SideDock
└── DocBrowser
```

SideDock 不放进 DocBrowser 内部。理由：

- SideDock 是入口层，DocBrowser 是内容容器。
- SideDock 即使在 DocBrowser 关闭时也可能可见。
- SideDock 的 pin 状态独立于 DocBrowser tab/history 状态。

## 内置入口草案

```ts
export const SIDE_DOCK_BUILT_IN_ITEMS: SideDockItem[] = [
  {
    id: 'apps',
    labelKey: 'appsTitle',
    icon: { type: 'builtin', name: 'apps' },
    target: { type: 'right-panel-resource', uri: 'nextclaw://apps' },
    builtIn: true,
    removable: false,
  },
  {
    id: 'service-apps',
    labelKey: 'serviceAppsTitle',
    icon: { type: 'builtin', name: 'service-apps' },
    target: { type: 'right-panel-resource', uri: 'nextclaw://apps?tab=service-apps' },
    builtIn: true,
    removable: false,
  },
  {
    id: 'docs',
    labelKey: 'docBrowserHelp',
    icon: { type: 'builtin', name: 'docs' },
    target: { type: 'right-panel-resource', uri: 'nextclaw://docs' },
    builtIn: true,
    removable: false,
  },
  {
    id: 'new-tab',
    labelKey: 'docBrowserHomeTitle',
    icon: { type: 'builtin', name: 'new-tab' },
    target: { type: 'right-panel-resource', uri: 'nextclaw://new-tab' },
    builtIn: true,
    removable: false,
  },
];
```

本次第一版实现已经落地 SideDock rail、内置入口、pin/unpin/reorder 的 manager/store 合同和持久化校验。具体资源页面上的 `Pin to SideDock` 入口可以在后续按资源场景逐个接入，不需要再改 SideDock 的 owner 结构。

## Pin 入口来源

第一阶段可支持以下来源：

- DocBrowser tab menu：Pin current tab to SideDock。
- Apps / Panel App 列表：Pin app to SideDock。
- RightPanelResourceHomePage：对支持 pin 的入口提供 pin action。

暂不支持：

- 主工作区任意页面 pin。
- 任意 URL pin。
- 任意 component pin。

## 设计原则

### 入口轻量

SideDock 只做快捷入口，不做内容系统，不引入第二套路由。

### 资源稳定

可 pin 的东西必须有稳定 target。第一阶段 target 只接受 right-panel-resource URI。

### 内置与用户态分离

系统内置入口来自 config，不写入用户持久化；用户 pin 入口来自 store，可新增、移除、排序。

### App-level 装配

`SideDockManager`、`DocBrowserManager`、`RightPanelResourceRouteResolver` 都由 `AppPresenter` 装配，避免 feature singleton 和 Provider 临时 new owner。

### 不扩大 URI 范围

为了支持 SideDock，不把 `/chat`、`/settings`、`/providers` 等主工作区页面强行变成 right-panel resource。只有确实需要在右侧栏展示的资源才接入。

## 后续演进

- 支持拖拽排序。
- 支持更多可 pin 资源，例如常用 panel app、常用 docs page。
- 支持 hover tooltip、badge、活跃状态。
- 支持右键菜单：Open、Pin/Unpin、Move。
- 支持从 AI 回复或 command 中推荐 pin 常用资源。
- 如果未来出现全局 Omnibox，再单独设计 app navigation URI，不把 SideDock 扩成全局导航协议。

## 验收标准

- 右侧出现稳定快捷入口条。
- 内置入口可打开对应右侧栏资源，且不可 unpin。
- 用户 pin 的入口刷新后仍保留。
- 点击 pin 入口复用 DocBrowser 既有 tab/dedupe/history 机制。
- SideDock 不拥有内容、不复制 right-panel-resource route 逻辑。
- 不新增 feature-level presenter。
- 不导出 manager singleton。
- Provider 不创建 manager。
