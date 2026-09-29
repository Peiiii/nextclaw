# Panel App 当前页面刷新

## 问题与依据

Linear NC-185 要求已打开的 Panel 在资源更新后可显式重新加载，且保留 App 身份、权限、Service Action 授权和持久数据。右侧资源浏览器已有刷新按钮，使用 `refreshIframe` 重建 iframe；主内容区与独立页面共用的 `PanelAppRuntimeSurface` 只有 iframe，没有刷新操作。该表面此前刻意保持应用内容铺满，不加重复宿主标题栏。

Panel HTML 与 asset 响应均为 `Cache-Control: no-store`，重建相同 URL 的 iframe 即可获取更新文件。现有 `usePanelAppRuntime` 决定是否挂载 iframe，bridge 消息处理器使用当前 `iframeRef` 校验来源；刷新不能绕过这两个 owner。

## 用户链路与方案

用户在主内容区或独立页面打开 Panel App，更新本地 HTML、CSS 或 JavaScript 后点击宿主提供的“刷新当前面板应用”，当前 iframe 原位重建并请求相同内容 URL；更新后的资源显示出来，用户仍留在当前 App。右侧 Panel 沿用已有刷新按钮。应用不可用或权限检查未通过时，不展示刷新按钮，保留原恢复入口。

在共用运行表面的右上角放置小型宿主刷新按钮，复用 `IconActionButton`、现有 i18n 文案与交互反馈。按钮在桌面悬停、键盘焦点和触控环境可见，不添加占高标题栏。点击只递增 iframe 实例版本；`appId`、`src`、sandbox、App 数据与 grant 状态不变。桥接仍绑定新 iframe，原持久数据及 Service Action 授权不修改。

候选方案是增加常驻标题栏，但它会压缩应用画布并推翻主内容区无重复宿主 Header 的现有合同；受控 Panel reload API 则要求 Panel 作者接入，不能解决所有已安装 App 的宿主入口。选用宿主按钮，牺牲少量右上角覆盖空间。

## 验收

1. 主内容区与独立页面打开 Panel 后可找到并触发刷新，不离开当前 App；右侧已有入口继续可用。
2. 修改本地 HTML、CSS、JavaScript，触发刷新后重新请求并显示更新后的文件。
3. 刷新前后 URL、sandbox、App 身份及 grant 决策不变；新 iframe 的 bridge 消息仍由现有 manager 处理。
4. App 持久数据不因刷新被宿主清理，Service Action 权限仍由原授权 owner 判定。

验证使用组件行为测试、匹配范围 TypeScript 检查，以及可用时的真实 Panel 页面和资源更新链路。布局同时检查桌面、触控视口与键盘可达性。
