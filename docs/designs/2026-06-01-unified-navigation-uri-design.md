# NextClaw 右侧栏资源 URI 设计

## 关联文档

- [NextClaw SideDock 右侧快捷入口设计](2026-06-02-side-dock-design.md)：定义右侧快捷入口层。SideDock 使用本文定义的 right-panel resource URI 作为打开目标，但不拥有 URI 解析和 DocBrowser 内容承载职责。

## 背景

NextClaw 前端已经有右侧 DocBrowser，它不再只是帮助文档窗口，而是在承载一组可在右侧栏展示的资源：

- docs 页面，例如 `https://docs.nextclaw.io/...`。
- 新标签页，例如 `nextclaw://new-tab`。
- Apps / Service Apps 面板，例如 `nextclaw://apps`、`nextclaw://apps?tab=service-apps`。
- Panel App iframe，目前由 `entry.contentPath + kind: panel-app` 打开。

上一版方案把问题扩大成“全局导航 URI 系统”，会自然滑向 chat、settings、marketplace、omnibox、全局 history 都要接入。这个范围过大，也偏离当前真实目标。

本设计修正为：**建立右侧栏可展示资源的 URI 合同**。核心不是让所有东西都接入，而是让“适合在右侧栏打开的东西”可以被统一描述、打开、去重、恢复和扩展。

## 产品目标

这个 URI 体系服务的是右侧栏的灵活性和便利性：

- 用户在主工作区不离开当前任务，也能打开文档、应用、工具面板和轻量页面。
- 业务入口不需要知道 DocBrowser 内部 tab/history/dedupe 细节。
- 后续新类型资源只需要增加右侧栏 route definition 和必要 renderer，而不是在侧边栏、Apps、DocBrowser 首页、manager 里多处分支。

它不是第一阶段的全局路由替代品，也不是要求所有内部页面都 URI 化。

## 参考 Chrome 的部分

可以参考 Chrome，但只参考这些点：

- 用 scheme 表达内部资源，例如 `chrome://settings` 对应 NextClaw 的 `nextclaw://apps`。
- 不同 scheme / host 由 resolver 决定如何解析成右侧栏 target、标题是什么、是否去重。
- tab 有自己的 URL、title、history、restore 语义。

不参考这些点：

- 不做完整浏览器。
- 不把所有 NextClaw 页面都变成右侧栏资源。
- 不把主工作区 React Router path 立即替换成 URI。
- 不做全局 Omnibox，除非后续明确要做。

## 范围

### 第一阶段接入

- `nextclaw://new-tab`
- `nextclaw://apps`
- `nextclaw://apps?tab=service-apps`
- docs URL：`https://docs.nextclaw.io/...`
- docs 语义 URI：`nextclaw://docs/...`
- panel app：`nextclaw://panel-app/<app-id>`
- fallback embeddable content：受控的 `http(s)` / `data:` / 内部 content URL

### 第一阶段不接入

- `/chat`
- `/settings`
- `/model`
- `/providers`
- `/marketplace/mcp`
- 普通主工作区页面
- 所有 agent/task/workflow 资源

这些目标只有在“确实需要在右侧栏打开”时才设计对应 URI。主工作区导航仍然走 React Router 和现有侧边栏路径。

## 设计原则

### 范围克制

URI 体系只覆盖右侧栏可展示资源，不把“统一入口”误解成“所有页面必须接入同一 URL 系统”。

### single-domain-owner

右侧栏资源 URI 不是单一层级能完整拥有的能力，应拆成两个 owner：

- 业务无关 URI 机制 owner：只负责 URI 解析、route definition 匹配、归一化和等价判断。它是纯工具/解析器，不是 MMVP manager。
- NextClaw 右侧栏资源 owner：只负责哪些 NextClaw 业务资源允许在右侧栏展示，以及它们如何变成 DocBrowser target。它也是 route resolver，不是 feature-level presenter 或 manager。

`DocBrowser` 自己不是业务资源 owner，它只是右侧栏容器和 tab/history 状态 owner。主工作区 app route 也不应成为第一阶段 owner。

### information-expert

每类右侧栏资源的 route definition 只负责自己知道的事实：

- docs route 知道 docs URL 如何本地化和归一化。
- apps route 知道 `nextclaw://apps?tab=service-apps` 如何归一化和去重。
- panel app route 知道 app id 如何对应 iframe content URL。

### 不新增独立 presenter

本设计不新增 `NavigationPresenter`、`DocBrowserPresenter` 或 feature-level presenter。项目 presenter 是应用级装配根；右侧栏 URI 的解析由 resolver 承担，DocBrowser 状态迁移由 `DocBrowserManager` 承担，持久状态由 Zustand store 承担。

### MMVP 和文件角色约束

- `*.manager.ts` 只用于真实 manager：拥有状态迁移、业务 action、生命周期或 store action ownership。
- 右侧栏 URI 解析器不命名为 manager，不放 `managers/`，也不导出 singleton instance。
- 不新增 `registries/` 这类项目角色白名单外目录。通用解析器和右侧栏 route resolver 都是无状态解析/归一化能力，放在 `utils/`，文件名使用 `*.utils.ts`。
- 长生命周期对象由 `AppPresenter` 一次性装配：`RightPanelResourceRouteResolver` 作为 `DocBrowserManager` 的稳定依赖传入。
- React Provider 只连接 context/store snapshot/manager 方法，不创建 manager、不保存业务 owner。

### shared 只放业务无关机制

可跨项目复用的部分可以进 `shared/lib`，但它必须不认识 NextClaw 的 docs、apps、panel app，也不依赖 React、DocBrowser 或 Zustand。只要代码开始知道 `nextclaw://apps`、`docs.nextclaw.io`、`PanelAppEntryView`，它就已经是业务 feature 代码。

## 方案空间

### 方案 A：全局 app navigation URI

把 chat、settings、marketplace、docs、apps、panel app 全部纳入一个 `app/navigation` owner。

优点：

- 理论上最统一。
- 未来 Omnibox、AI 打开页面、全局 history 可以复用。

问题：

- 第一阶段范围过大，会把主路由、右侧栏、外部打开、未来 agent/task URI 混在一起。
- 当前真实痛点是右侧栏展示灵活性，不是替换整个 React Router。
- 容易诱导新增独立 navigation presenter 或全局中转层。

结论：不选，作为未来全局 Omnibox 方向单独设计。

### 方案 B：DocBrowser 内聚右侧栏资源 URI

只把可在右侧栏展示的资源纳入 URI 合同，沿用 DocBrowser 的 tab/history/store/manager，再把 route registry 从 utils 级别整理成明确 owner。

优点：

- 正中当前目标：让文档、Apps、Service Apps、Panel App、可嵌入内容能稳定在右侧栏打开。
- 复用现有 DocBrowser 状态模型，不引入全局路由重写。
- 新类型资源只扩展 route definition 和 renderer，复杂度可控。

问题：

- 不解决主工作区页面的统一地址问题。
- 如果未来做 Omnibox，仍需要再设计 app-level navigation。

结论：比全局 navigation 更好，但仍不够干净。它会让 DocBrowser 同时知道容器状态和 NextClaw 业务资源。

### 方案 C：shared URI 基础层 + 右侧栏资源 feature

把纯 URI 机制放到 `shared/lib/resource-uri`，把 NextClaw 右侧栏业务资源放到 `features/right-panel-resources`，DocBrowser 只保留 tab/history/renderer 容器职责。

优点：

- 业务无关部分可跨项目复用。
- NextClaw 业务资源有专门 feature owner，不污染 shared。
- DocBrowser 不再反向拥有 docs/apps/panel-app 业务事实。
- 后续新增右侧栏资源只扩展 feature route definitions。

问题：

- 相比只整理 DocBrowser，多一个 feature root。
- 第一版要明确哪些代码真共享，避免把业务规则伪装成 shared。

结论：推荐。它最符合“可复用机制”和“业务 feature”分层。

### 方案 D：保持现状，只加 Panel App helper

只为 Panel App 增加 `openPanelApp(entry)` helper，不整理 route registry。

优点：

- diff 最小。
- 风险最低。

问题：

- Apps、Service Apps、Docs、Panel App 的打开规则继续散落。
- 后续每加一个右侧栏资源都会继续复制 `kind/title/dedupeKey/url` 拼装逻辑。
- 不能形成可恢复、可去重、可扩展的合同。

结论：不推荐，只适合临时止血。

## URI 语法草案

```text
nextclaw://new-tab
nextclaw://apps
nextclaw://apps?tab=service-apps
nextclaw://docs/guide/getting-started
nextclaw://panel-app/<app-id>
https://docs.nextclaw.io/en/guide/getting-started
```

说明：

- `nextclaw://docs/...` 是 docs 语义地址，解析成当前语言对应的真实 docs URL。
- `nextclaw://panel-app/<app-id>` 表达应用身份，不把 `contentPath` 当成长期外部合同。
- `https://docs.nextclaw.io/...` 继续支持，因为用户和内容里天然会出现真实网页地址。
- 不设计 `nextclaw://route/chat`、`nextclaw://route/settings/model` 作为第一阶段目标。

## 解析结果合同

第一版业务解析结果为 `RightPanelResourceTarget`，它复用 DocBrowser 可消费的 `DocBrowserRouteTarget` 形状：

```ts
export type RightPanelResourceKind =
  | 'home'
  | 'docs'
  | 'apps'
  | 'panel-app'
  | 'content';

export type RightPanelResourceHistoryPolicy = 'managed' | 'none';

export type RightPanelResourceTarget = {
  kind: RightPanelResourceKind;
  title: string;
  url: string;
  historyPolicy: RightPanelResourceHistoryPolicy;
  dedupeKey?: string;
};
```

字段说明：

- `kind`：右侧栏 tab/render key。
- `url`：DocBrowser 当前 tab 实际加载或渲染使用的地址；docs 是真实 URL，panel app 第一阶段是 `entry.contentPath`。
- `dedupeKey`：同一资源是否复用已有 tab。
- 规范化和等价判断由 route definition / resolver 提供，不强迫所有业务 target 携带 `normalizedUri` 字段。

不包含：

- `appPath`：第一阶段不调度主工作区 route。
- `externalUrl`：外部浏览器打开不是右侧栏 URI 的核心职责。
- `main` placement：第一阶段不把主工作区纳入此系统。
- `iframeUrl`：当前 DocBrowser iframe 消费 `url`，不在 target 上增加第二套地址字段。

## 代码组织

第一阶段拆成三层：

1. `shared/lib/resource-uri`：业务无关 URI resolver 基础层。
2. `features/right-panel-resources`：NextClaw 右侧栏业务资源 feature。
3. `shared/components/doc-browser`：右侧栏容器、tab/history/store/renderer。

### 业务无关基础层

```text
packages/nextclaw-ui/src/shared/lib/resource-uri/
├── index.ts
├── types/
│   └── resource-uri.types.ts
└── utils/
    ├── resource-uri-resolver.utils.ts
    └── resource-uri.utils.ts
```

职责：

- `types/resource-uri.types.ts`：`ResourceUri`、`ParsedResourceUri`、`ResourceUriRouteDefinition`、通用 match/normalize/resolve 类型。
- `utils/resource-uri.utils.ts`：URL/scheme 解析、路径 segment 校验、query 读取、URI 规范化等纯函数。
- `utils/resource-uri-resolver.utils.ts`：通用 resolver class，负责按 definition 匹配、resolve、normalize、areEquivalent。它没有业务状态和生命周期，不属于 manager。
- `index.ts`：稳定导出边界。

限制：

- 不引用 React、Zustand、DocBrowser、Panel App、i18n。
- 不出现 `nextclaw://apps`、`docs.nextclaw.io`、`PanelAppEntryView`。
- 不决定 placement、iframe sandbox、tab title 等 NextClaw 产品语义。

现有 `shared/lib/app-resource-uri` 是更窄的 `app://` 静态资源解析能力。它可以保持独立；如果后续发现两者共享 segment 校验逻辑，可把纯校验函数下沉到 `shared/lib/resource-uri/utils/resource-uri.utils.ts`，但不要为了新设计立即强行合并。

### 业务 feature 层

```text
packages/nextclaw-ui/src/features/right-panel-resources/
├── index.ts
├── configs/
│   └── right-panel-resource-routes.config.ts
├── components/
│   └── right-panel-resource-home-page.tsx
├── types/
│   └── right-panel-resource.types.ts
└── utils/
    ├── right-panel-resource-route-resolver.utils.ts
    └── right-panel-resource-uri.utils.ts
```

职责：

- 定义 NextClaw 允许在右侧栏展示的资源类型。
- 注册 docs、apps、service apps、panel app、content fallback 的业务 route definitions。
- 把业务 URI 解析成 DocBrowser 可以消费的 target。
- 处理 `nextclaw://panel-app/<app-id>` 到 `contentPath` 的映射策略。

限制：

- 不管理 DocBrowser tab/history/store。
- 不新增 presenter。
- 不替换主工作区 React Router。
- 不把所有主页面注册进来。

推荐类型：

```ts
export type RightPanelResourceKind =
  | 'home'
  | 'docs'
  | 'apps'
  | 'panel-app'
  | 'content';

export type RightPanelResourceTarget = {
  kind: RightPanelResourceKind;
  title: string;
  url: string;
  historyPolicy: 'managed' | 'none';
  dedupeKey?: string;
};
```

`RightPanelResourceRouteResolver` 可以组合 `ResourceUriResolver`，但不要继承它，也不要把业务 route definition 反向塞进 shared。它不导出 singleton instance，运行时实例由 `AppPresenter` 持有。

### DocBrowser 容器层

```text
packages/nextclaw-ui/src/shared/components/doc-browser/
├── index.ts
├── doc-browser-context.tsx
├── doc-browser.tsx
├── managers/
│   └── doc-browser.manager.ts
├── stores/
│   └── doc-browser.store.ts
├── types/
│   └── doc-browser.types.ts
└── utils/
    ├── doc-browser-route-resolver.utils.ts
    ├── doc-browser-state.utils.ts
    └── doc-browser-url.utils.ts
```

### 文件角色

- `managers/doc-browser.manager.ts`：右侧栏状态迁移 owner，负责 open、navigate、goBack、goForward、closeTab、setActiveTab。
- URI 解析不放在 DocBrowser 内部，而是由 `features/right-panel-resources` 提供 target。
- `utils/doc-browser-route-resolver.utils.ts`：DocBrowser 的默认 fallback resolver，只处理 docs/home/content 默认语义；NextClaw 业务资源 resolver 由 app-level presenter 注入。
- `utils/doc-browser-url.utils.ts`：无状态 URL 解析、本地化、归一化 helper。
- `stores/doc-browser.store.ts`：Zustand 状态和 persist owner。

不新增：

- `presenters/`：不需要独立 presenter。
- `services/`：没有远程 IO 或生命周期服务。
- `app/navigation/`：第一阶段不是全局 app navigation。
- `registries/`：不是当前项目允许的角色目录；解析能力落在 `utils/`。
- DocBrowser 内部业务 route resolver：业务资源属于 `features/right-panel-resources`。

## Resolver 抽象

通用 `ResourceUriResolver` 只提供机制：

```ts
export type ResourceUriRouteDefinition<TTarget> = {
  id: string;
  match: (uri: ParsedResourceUri) => boolean;
  resolve: (uri: ParsedResourceUri) => TTarget;
  areEquivalent?: (left: string, right: string) => boolean;
};

export type ResourceUriResolverOptions<TTarget> = {
  getNormalizedUri: (target: TTarget) => string;
};

export class ResourceUriResolver<TTarget> {
  constructor(
    private readonly routeDefinitions: ResourceUriRouteDefinition<TTarget>[],
    private readonly options: ResourceUriResolverOptions<TTarget>,
  ) {}

  resolve = (uri: string): TTarget => {
    const parsed = parseResourceUri(uri);
    const definition = this.findDefinition(parsed);
    return definition.resolve(parsed);
  };

  normalize = (uri: string): string => {
    return this.options.getNormalizedUri(this.resolve(uri));
  };

  areEquivalent = (left: string, right: string): boolean => {
    const definition = this.findDefinition(parseResourceUri(left));
    return definition.areEquivalent?.(left, right) ?? this.normalize(left) === this.normalize(right);
  };
}
```

业务 `RightPanelResourceRouteResolver` 组合它：

```ts
export class RightPanelResourceRouteResolver implements DocBrowserRouteResolver {
  private readonly resourceUriResolver = new ResourceUriResolver<RightPanelResourceTarget>(
    RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS,
    { getNormalizedUri: (target) => target.url },
  );

  resolve = (uri: string): RightPanelResourceTarget => this.resourceUriResolver.resolve(uri);

  areEquivalent = (left: string, right: string): boolean => {
    return this.resourceUriResolver.areEquivalent(left, right);
  };
}
```

route definition 只解析，不打开 UI、不写 store。

第一批 definitions：

- `homeRightPanelResourceRouteDefinition`
- `docsUrlRightPanelResourceRouteDefinition`
- `nextclawDocsRightPanelResourceRouteDefinition`
- `appsRightPanelResourceRouteDefinition`
- `panelAppRightPanelResourceRouteDefinition`
- `contentRightPanelResourceRouteDefinition`

## Manager 抽象

`DocBrowserManager` 继续是状态迁移 owner。它消费业务 feature 提供的 `RightPanelResourceTarget`：

```ts
export class DocBrowserManager {
  open = (url?: string, options?: DocBrowserOpenOptions): void => {
    this.setSnapshot((prev) => {
      const target = this.routeResolver.resolveOpenTarget({ url, kind: options?.kind });
      return openResolvedDocBrowserState(this.routeResolver, prev, target, options);
    });
  };

  openTarget = (target: RightPanelResourceTarget, options?: DocBrowserOpenOptions): void => {
    this.setSnapshot((prev) => openResolvedDocBrowserState(this.routeResolver, prev, target, options));
  };
}
```

`open()` 负责从 URI/URL 解析 target，`openTarget()` 负责打开已经解析好的 target。这样 Apps 面板可以先用 `entry.contentPath` 构造 panel app target，避免把真实 content URL 再按 `panel-app` URI 二次解析。

React 接入层不新增独立 presenter，也不强制新增 hook。当前实现通过 `AppPresenter` 装配 `DocBrowserManager` 和右侧栏 resolver，再通过 `PANEL_APPS_DOC_BROWSER_RENDERERS` 注入 home/apps/panel-app renderer：

- `AppPresenter` 装配 `RightPanelResourceRouteResolver` 和 `DocBrowserManager`。
- `DocBrowserProvider` 接收已经装配好的 `DocBrowserManager`。
- renderer 只负责当前 tab kind 的内容渲染。
- 业务资源的 route facts 留在 `features/right-panel-resources`。

## Panel App 接入

Panel App 不再把 `entry.contentPath` 当长期导航合同。目标形态：

```text
nextclaw://panel-app/<app-id>
```

解析流程：

1. right-panel-resources route resolver 识别 `panel-app` URI。
2. 根据当前 Panel App list 或 manager/query cache 找到 app entry。
3. 解析为：

```ts
{
  kind: 'panel-app',
  title: entry.title,
  dedupeKey: `panel-app:${entry.id}`,
  url: entry.contentPath,
  historyPolicy: 'managed'
}
```

如果第一阶段 route resolver 无法同步读取 app list，可以先由 `openPanelApp(entry)` 生成完整 target，再逐步迁移到 id-based resolve。文档合同仍以 `nextclaw://panel-app/<app-id>` 为目标。

## 与主路由的关系

主路由暂时保持现状：

- 侧边栏主导航继续使用 React Router path。
- settings/model/providers 等页面继续使用 app route。
- DocBrowser 首页可以保留跳转主路由的入口，但这类入口不属于右侧栏 URI；它只是“从右侧栏首页触发主页面跳转”。

如果未来确实要做全局 Omnibox 或 AI 返回“打开某个主页面”的 URI，再单独设计 `app/navigation`。那是第二个问题，不并入本轮。

## 迁移路径

### 第一阶段：整理现有右侧栏 route owner

1. 新增 `shared/lib/resource-uri`，只放业务无关 URI 机制。
2. 新增 `features/right-panel-resources`，放 NextClaw 右侧栏资源 route definitions 和 resolver。
3. 将当前 `utils/doc-browser-route-registry.utils.ts` 的业务规则迁入 `features/right-panel-resources/utils/right-panel-resource-route-resolver.utils.ts`。
4. DocBrowser 只消费 `RightPanelResourceTarget`，不再拥有 docs/apps/panel-app route 事实。
5. 保持现有 docs、home、apps 行为不变。
6. 不动主路由和侧边栏主导航。

### 第二阶段：Panel App URI 化

1. 将 `nextclaw://panel-app/<app-id>` 从稳定 identity placeholder 升级为可直接解析真实 `contentPath` 的 URI。
2. Apps 面板打开 Panel App 时可以只传 URI，而不是传完整 entry target。
3. 保留短期 fallback：如果只有 entry 对象，则由局部 helper 生成完整 target 并通过 `openTarget()` 打开。
4. 添加去重和刷新恢复测试。

### 第三阶段：右侧栏入口统一

1. DocBrowser 首页只输出右侧栏 URI target。
2. Chat/sidebar 里的“打开 Docs / Apps”改为传 URI。
3. 删除 `DocBrowserNavigationTarget` 的 `app-route` 分支，或者改名为明确的 `DocBrowserHomeAction`，避免误解成全局导航协议。

## 测试组织

```text
packages/nextclaw-ui/src/shared/lib/resource-uri/utils/resource-uri-resolver.utils.test.ts
packages/nextclaw-ui/src/features/right-panel-resources/utils/right-panel-resource-route-resolver.utils.test.ts
packages/nextclaw-ui/src/shared/components/doc-browser/managers/doc-browser.manager.test.ts
packages/nextclaw-ui/src/features/panel-apps/utils/panel-app-doc-browser.utils.test.ts
```

测试重点：

- `nextclaw://apps` 与 `nextclaw://apps?tab=service-apps` 归一化和去重。
- docs URL 与 `nextclaw://docs/...` 的等价性。
- `nextclaw://panel-app/<app-id>` 解析到稳定 dedupeKey。
- `DocBrowserManager.open()` 通过 resolver 解析 URI/URL，`openTarget()` 能直接打开已解析 target，避免 panel app content URL 被二次解析。
- 主工作区 path 不被强制接入右侧栏 URI。

## 验收标准

- 右侧栏可展示资源能用 URI 描述。
- 现有 DocBrowser docs/apps/home 行为不回归。
- Panel App 具备稳定的 `nextclaw://panel-app/<app-id>` 目标合同。
- 业务无关 URI resolver 不依赖 NextClaw 业务资源。
- NextClaw 业务 route definitions 位于 `features/right-panel-resources`。
- DocBrowser 不再拥有 docs/apps/panel-app 业务 route 事实。
- 不新增独立 presenter。
- 不新增 feature manager singleton，不在 Provider 内创建 manager。
- 不新增 `registries/` 目录或其它角色白名单外目录。
- 不引入全局 app navigation。
- 不要求所有主页面接入。
- 新增右侧栏资源时只新增 route definition 和 renderer，不在多个入口复制分支。

## 开放问题

- Panel App route resolver 是否应同步读取 app list，还是长期保持由 Apps 面板生成完整 target。
- 右侧栏是否需要区分“嵌入内容”和“内部 React panel”的 renderer contract。
- `DocBrowser` 这个名字是否已经不够准确，后续是否要改成 `RightPanelBrowser` 或 `SideSurface`。
