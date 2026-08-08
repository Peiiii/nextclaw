# Doc Browser Panel App 滚动恢复设计

## 背景

Doc Browser 是跨产品页面保留的全局右侧浏览区。用户在 Panel App 中阅读较长内容后点击刷新，期望像浏览器一样留在原阅读位置，而不是被送回顶部。

当前刷新按钮会递增 `iframeReloadVersion`；该值参与 iframe 的 React `key`，因此刷新实际是销毁旧 iframe、创建新 iframe。旧文档的滚动位置没有被读取或恢复。

## 现状依据

- `DocBrowser` 以 `activeTabId`、`navVersion`、`iframeReloadVersion` 组成 iframe 实例 key；点击刷新只增加最后一项。
- Panel App iframe 使用不含 `allow-same-origin` 的 sandbox，文档为 opaque origin；宿主不能直接读取其 `scrollY`、DOM 或 storage。
- 内核为每个 Panel App 注入 bridge 脚本，因此宿主与 Panel App 已有受控的 `postMessage` 通道。
- Doc Browser 的 tab、地址和布局状态已由 Zustand 持久化；滚动位置不属于现有 snapshot。

结论：不能在宿主直接读取 iframe 滚动；必须由已注入的 Panel App runtime 主动上报，并由宿主在新 iframe 加载后回放。

## 核心判断

能力限定为受控 Panel App 中用户最后实际滚动的滚动面：刷新或切换回来导致 iframe 重建时，恢复该 tab、同一 URL 的最后阅读位置。范围包括页面主滚动面和常见的内部 `overflow: auto` 容器。

设计原则：

- `information-expert`：Panel App 文档拥有真实滚动面与位置事实；Doc Browser 拥有 tab 生命周期与恢复时机。
- `single-fact-owner`：每个 iframe 实例只上报最后实际滚动的位置；宿主只维护一份按 tab 和 URL 键控的最近快照。
- `simple-structure-first`：不新增独立 manager、第二个持久 store 或每个应用的定制代码；使用 Doc Browser 私有 hook 和既有 bridge 注入点。
- 可预测行为：不伪造对任意跨域页面的支持，不在读取失败后猜测 DOM。

## 范围与非目标

本期支持：

1. Panel App 的页面主滚动面，以及用户最后实际滚动的嵌套滚动容器。
2. 同一 Doc Browser tab、同一 `currentUrl` 下的用户点击刷新。
3. 因切换 tab 而重新挂载 iframe 后的恢复。

本期不支持：

- 任意外部网站、普通 Content tab 或 Docs iframe；它们可能跨域，宿主无法可靠读取滚动位置。
- DOM 结构在刷新后已经变化的滚动容器；不能安全确认同一元素时明确跳过。
- NextClaw 外壳整体刷新或重启后的恢复；第一期只保存当前 App Shell 生命周期内的临时阅读上下文。未来若要跨外壳恢复，应把版本化位置纳入既有 `DocBrowserStore` persist 合同，而不是另建 storage。

## 协议合同

`@nextclaw/shared` 公开 `PANEL_APP_SCROLL_RESTORATION_CONTRACT`，作为 `kernel` 与 `nextclaw-ui` 的唯一协议事实源：

```ts
{
  scrollMessageType: 'nextclaw:panel-app-scroll',
  restoreScrollMessageType: 'nextclaw:panel-app-restore-scroll',
  version: 1,
}
```

双向消息携带：

```ts
{
  type: string;
  version: 1;
  target: { kind: 'document' } | {
    kind: 'element';
    path: Array<{ index: number; tagName: string }>;
  };
  x: number;
  y: number;
}
```

`path` 是从 `body` 到目标元素的子序号与 tagName 校验链，不包含文本、属性或业务数据。坐标和路径均受范围约束。宿主只接收 `event.source === iframe.contentWindow` 的消息；Panel App 是 opaque origin，不能把 `event.origin` 当作鉴权边界。

## Panel App runtime

在既有 bridge 注入内容中安装滚动观察与恢复：

1. 用捕获阶段的 `document` `scroll` 事件监听页面与嵌套容器，按 `requestAnimationFrame` 合并同一帧事件，上报最后实际滚动面的路径与位置。
2. 收到 restore 后，页面主滚动面调用 `window.scrollTo`；嵌套滚动面先按路径与 tagName 精确解析，再调用元素 `scrollTo`。
3. 若 iframe `load` 后应用仍在异步读取数据，首次恢复可能因页面高度不足而被浏览器 clamp。bridge 必须检查坐标是否真正生效；未生效时观察文档尺寸与 DOM 变化并重试，成功后立即停止，最长十秒清理。
4. 不发送初始 `(0, 0)` 快照，避免新 iframe 启动时覆盖刷新前的位置。
5. 路径不一致时跳过，不猜测替代元素。

这条通道只传阅读位置，不含权限、令牌或业务数据，也不改变 service-action bridge 的授权语义。

## Doc Browser owner 与数据流

`use-doc-browser-scroll-restoration` 是 React/iframe 外部系统同步边界，在组件生命周期内保存：

```ts
Map<tabId, { currentUrl: string; target: ScrollTarget; x: number; y: number }>
```

```text
Panel App document capture scroll
  -> bridge postMessage
  -> Doc Browser hook 校验来源与坐标
  -> tabId + currentUrl 临时快照
  -> iframe 重建完成 onLoad
  -> hook postMessage restore
  -> Panel App 对匹配滚动面 scrollTo
  -> 未就绪时等待布局变化后重试
```

恢复必须同时匹配 `tabId` 与 `currentUrl`。关闭 tab 时删除快照。位置不进入 Zustand，避免高频滚动写入 localStorage，也避免产品重启后恢复陈旧位置。

renderer 只增加窄能力声明 `supportsScrollRestoration?: boolean`，仅 Panel App renderer 返回 `true`。其它 tab 不监听、不保存、不恢复。

## 恢复时序

1. 用户滚动 Panel App，bridge 在下一动画帧发送最新位置。
2. 用户点击标题栏刷新按钮，现有动作立即重建 iframe，不增加额外握手或等待。
3. 新 iframe 的 `load` 触发后，hook 查找同 tab、同 URL 的快照并发送 restore。
4. bridge 尝试应用位置；若内容尚未撑开，通过 `ResizeObserver` 与 `MutationObserver` 等待布局就绪，成功后停止，最长十秒。

选择“持续、节流上报 + load 后恢复”，而不是刷新时临时请求快照并等待回复，避免新增超时、重试与刷新延迟。

## 文件落位

| 路径 | 责任 |
| --- | --- |
| `packages/nextclaw-shared/src/configs/panel-app-scroll-restoration.config.ts` | 跨包消息名与版本唯一事实源。 |
| `packages/nextclaw-kernel/src/utils/panel-app-bridge.utils.ts` | 在既有 Panel App runtime bridge 中安装滚动观察与恢复。 |
| `packages/nextclaw-ui/src/shared/components/doc-browser/hooks/use-doc-browser-scroll-restoration.ts` | 维护 tab 临时快照、校验来源、在 iframe load 后回放。 |
| `packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser-renderer.types.ts` | 声明 renderer 是否支持受控协议。 |
| `packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.tsx` | 连接 hook、iframe ref 与当前 tab 生命周期。 |
| `packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser-panel-parts.tsx` | 透传 iframe `onLoad`。 |
| `packages/nextclaw-ui/src/features/panel-apps/utils/panel-app-doc-browser.utils.tsx` | Panel App renderer 声明支持协议。 |

不新增 scroll manager、额外 Zustand store、Panel App 专属 wrapper 或外部网站 fallback，避免重复 iframe 生命周期 owner 或产生平行状态链路。

## 兼容与迁移

- 旧 Panel App 不需要改源码；内核提供 HTML 时会注入 runtime script。
- 不支持协议的 iframe 不恢复，这是明确能力边界。
- 不保留读取跨域 `contentWindow.scrollY` 的兼容路径。
- 协议版本不匹配时双方忽略消息，不维护旧、新 payload 双读。

## 验收标准

1. bridge 测试覆盖主滚动、嵌套滚动、非法目标和异步内容撑开后的恢复。
2. Doc Browser 组件测试覆盖 Panel App 上报位置、点击“刷新当前面板应用”、新 iframe load 后收到 restore。
3. 非当前 iframe、非法坐标、版本不匹配、不同 tab 或不同 URL 不得串用位置。
4. shared、kernel、UI 的 TypeScript、定向测试、targeted lint 与治理检查通过。
5. 在真实开发态 Panel App 中滚至中段，点击标题栏刷新，异步渲染结束后仍回到原阅读位置。

## 实现状态

实现已落到 shared 协议、Panel App 注入 bridge、Doc Browser hook、renderer capability 和定向测试。真实开发态使用“面试准备大盘”验证：刷新前 `scrollY = 432`，点击面板标题栏刷新按钮并等待异步渲染后仍为 `scrollY = 432`。
