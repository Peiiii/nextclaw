# 统一页面滚动位置恢复设计

## 背景与用户任务

用户从 NextClaw 的主页面、会话、工作台或全局侧边栏切走后再返回，希望继续停留在离开前的阅读位置，而不是重新从顶部开始。当前只有少数局部实现：Panel App 在右侧 Doc Browser 中通过 iframe 消息保存滚动位置，项目文件树在自己的 store 中保存 `scrollTop`；一级页面、主侧边栏和主工作台没有共同 owner。

本设计增强 NextClaw 作为长期统一工作台的连续性，不改变页面内容、导航结构或业务数据。

## 当前链路与问题

- 普通设置页由 `DesktopAppShell` 的 `<main>` 承载滚动，路由切换时内容卸载，但滚动节点复用。
- Chat 主工作台的 Cron、Agents、Skills、Inbox 和 Conversation 各自拥有内部滚动节点，外层禁止滚动。
- 全局设置侧边栏与 Chat 侧边栏分别拥有内部滚动节点。
- Panel App 有两种 iframe 承载：Doc Browser tab 已有局部恢复，主工作台路由没有恢复。
- 聊天会话还受 sticky-bottom、历史消息加载和虚拟列表约束，不能由路由壳直接写入滚动位置。

当前违反 `single-complete-owner` 与 `equivalence-by-construction`：相同的“切走后返回”语义分散在 panel app hook、项目文件树 store 和未实现的页面容器中，无法由一个机制保证一致。

## 方案比较

### 方案 A：浏览器原生 / window 级恢复

只监听路由并恢复 `window.scrollY`。实现最少，但 NextClaw 的真实滚动都发生在嵌套容器或 iframe 内，无法覆盖主路径，放弃。

### 方案 B：保持组件常驻，只隐藏非活动页面

浏览器会自然保留 DOM 滚动位置，但会让所有页面和 Panel App iframe 长期挂载，扩大内存、网络与后台副作用，且无法统一处理路由卸载和 iframe reload，放弃。

### 方案 C：共享会话内 manager + 边界适配

由一个 `ScrollRestorationManager` 持有有限容量的 key -> `{x,y}` 映射。普通 DOM 使用共享 hook；Panel App 使用协议适配 hook；各页面只提供稳定 key。该方案覆盖真实边界，不要求页面常驻，也不把 iframe 协议泄漏给普通页面，采用。

## 冻结设计

### Owner 与主链路

`ScrollRestorationManager` 是唯一状态 owner，位于 `shared/lib/navigation-history`，因为滚动位置属于应用内返回历史的一部分。它负责：

- 对有限、非空 key 保存规范化的非负有限坐标；
- 读取位置时不产生状态变化；
- 以最近保存顺序限制容量，防止长期运行时无界增长；
- 为测试和明确生命周期提供单 key 删除与整体清空。

DOM 链路：

```text
scroll event / unmount -> useScrollRestoration -> manager.save
mount / restoration key change -> manager.read -> element.scrollTo
```

Panel App 链路：

```text
iframe scroll message -> usePanelAppScrollRestoration -> manager.save
iframe load -> manager.read -> restore-scroll postMessage
```

页面、会话与 app id 是外部事实，由接入方组成带命名空间的稳定 key；manager 不解析路由或业务对象。

### 生命周期与不变量

- 仅在当前应用运行期间保留；浏览器刷新、宿主重启或重新登录后回到页面默认位置。
- 路由/会话/app key 不同则位置隔离；同 key 返回时恢复。
- 缺少记录、记录非法或目标内容已变短时不报错；DOM 自身会把坐标限制到可滚动范围。
- DOM 恢复发生在 layout effect，避免先绘制顶部再跳动。
- iframe 只有在同一资源 URL 与同一滚动 target 下恢复；导航到新 URL 不套用旧位置。
- 聊天 sticky-bottom 仍拥有“新消息与首次加载”的滚动决策；共享恢复只在已有 session key 返回时提供历史坐标，不替代虚拟列表锚定和向上加载逻辑。

### 首批接入矩阵

| 表面 | restoration key | 边界 | 预期 |
| --- | --- | --- | --- |
| 设置类一级页面 | route pathname + search | Desktop shell main | 返回同一路由恢复 |
| Cron / Agents / Skills | 固定页面 key | 内部 DOM | 页面间切换恢复 |
| Inbox | list key、delivery key | 两个内部 DOM | 列表和每封内容分别恢复 |
| Chat Conversation | session key | sticky/virtualized DOM | 返回会话恢复，首次会话仍到底部 |
| 工作区 Markdown 预览 | 文件 tab + resolved path + refresh version | 内部 DOM | 切出文件或工作台后返回恢复 |
| 全局设置侧边栏 | 固定 key | DOM | 主页面切换后恢复 |
| Chat 侧边栏会话列表 | 固定 key | DOM | 主页面/会话切换后恢复 |
| Panel App 主页面与 Doc Browser tab | app/tab + URL | iframe message | 切换承载或 tab 后恢复 |

项目树已有按项目定义的细粒度 owner；本批不迁移它，避免破坏既有文件树语义。弹窗、菜单、选择器、临时搜索结果等短生命周期滚动区不属于“页面返回”，不接入。

## 抽象审计

- 保留 manager：它消除 DOM 与 iframe 的重复状态 owner，并保护容量、坐标规范化和 key 隔离不变量。
- 保留两个 hook：DOM 与跨 iframe transport 是真实不同边界；hook 只把 React 生命周期/消息协议适配到 manager。
- 删除原 Doc Browser 私有位置 Map，使 Panel App 不再有平行 owner。
- 延后磁盘持久化、比例/锚点恢复、动态注册表、全 DOM 自动扫描；当前用户任务不需要，且会引入版本、隐私或错误命中成本。

命中原则：`information-expert`、`single-complete-owner`、`equivalence-by-construction`、`simple-structure-first`、`abstractions-pay-rent`。抽象力度刚好覆盖当前已确认的 DOM 与 iframe 消费者，没有引入 provider、registry 或通用 DSL。

## 验证标准

1. manager 单测证明规范化、key 隔离、容量淘汰和清理。
2. DOM hook 单测证明卸载/切 key保存并在挂载时恢复。
3. Panel App hook 单测证明消息来源、URL、target 校验和 load 后恢复。
4. 页面与侧边栏组件测试证明各自连接共享 hook，并保留原 onScroll 行为。
5. 运行 `nextclaw-ui` 定向测试、匹配范围 TypeScript 编译与 diff-only maintainability 检查。

## 非目标

- 不跨应用重启持久化滚动位置。
- 不改变聊天首次进入、追随新消息、加载历史消息的产品语义。
- 不恢复弹窗、popover、下拉框等临时表面。
- 不为滚动恢复新增 CLI；该能力是纯视觉交互且没有有意义的命令行语义。
