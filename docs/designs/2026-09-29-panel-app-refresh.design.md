# Panel App 宿主刷新入口（NC-185）

## 问题与依据

NC-185 要求已打开的 Panel App 在资源更新后可手动刷新，同时保留应用身份、权限和持久数据。旧式 `panel-app` 右侧标签已有 `PanelAppToolbar` 刷新图标，点击后用 `DocBrowser.refreshIframe` 重建 iframe。新的 `system-object` 资源入口把 Panel App 渲染为 `NativeObjectResource`，此前没有刷新入口；`refreshIframe` 也只作用于 DocBrowser 自己的 iframe，对这个自定义内容无效。窄屏将自定义工具栏放在标签折叠菜单内。

Panel HTML 与 asset 响应均为 `Cache-Control: no-store`，重建相同 URL 的 iframe 即可获取更新文件。现有 `usePanelAppRuntime` 决定是否挂载 iframe，bridge 消息处理器使用当前 `iframeRef` 校验来源。

## 用户链路与方案

通过对象资源打开 Panel App 时，右侧工作台在现有标签的“更多操作”中提供刷新，不新增标题行。主资源页把刷新图标并入已有标题行，并显示应用标题。窄屏工作台也通过现有标签菜单提供刷新。

刷新只增加宿主资源视图的版本，由 `PanelAppRuntimeSurface` 使用该版本重建 iframe；`appId`、URL、sandbox、运行时权限状态和持久数据不变。主内容区原有独立路由与独立页面保持应用画布，不在应用内部叠按钮。

刷新入口属于宿主容器。它不依赖 Panel 作者实现 reload API。

## 验收

1. 对象资源的标签菜单、旧式右侧标签的原有标题行均可操作刷新；非 Panel App 对象不显示此入口，也不为刷新新增一行。
2. 修改本地 HTML、CSS、JavaScript，触发刷新后重新请求并显示更新后的文件。
3. 刷新前后 URL、sandbox、App 身份及 grant 决策不变；新 iframe 的 bridge 消息仍由现有 manager 处理。
4. App 持久数据不因刷新被宿主清理，Service Action 权限仍由原授权 owner 判定。

验证使用组件行为测试、匹配范围 TypeScript 检查，以及真实 Panel 页面和资源更新链路。布局同时检查桌面与窄屏。
