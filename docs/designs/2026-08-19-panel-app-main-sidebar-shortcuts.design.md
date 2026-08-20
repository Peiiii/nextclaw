# Panel App 主侧栏应用入口设计

## 背景与用户任务

NextClaw 现有 Panel App 可以在右侧资源面板中打开，并固定到右侧快捷栏。这个位置适合聊天旁的计算器、Todo、监控或临时工作台，但不能表达“这是我经常使用的一项主要应用”。Skills、定时任务和 Agents 则位于左侧主侧栏，点击后占据主内容区，代表稳定的一级工作入口。

本设计要完成的用户任务是：

> 用户在管理 Panel App 或实际使用某个 Panel App 时，明确把它添加到主侧栏；此后可以从左侧稳定进入该 App 的主内容界面，并在升级、回滚、刷新、禁用、重新启用和卸载后获得可预测结果。

安装 App 不得自动修改主侧栏。开发者只提供 Panel App 的稳定身份、标题、图标和内容；是否进入一级导航由用户决定。

## 产品判断

这项能力符合 NextClaw“统一入口”和“生态扩展”的愿景：第三方或用户自建 App 不再只能作为临时小工具存在，也可以被用户提升为自己的长期工作入口。但主侧栏是稀缺信息架构，不能变成 Marketplace App 自动争抢注意力的广告位。

因此需要明确两种放置语义：

| 放置位置 | 用户心智 | 打开方式 | 状态 owner |
| --- | --- | --- | --- |
| 右侧快捷栏 | 与当前任务并行使用的辅助工具 | 右侧 Doc Browser | 浏览器本地 SideDock 偏好 |
| 左侧主侧栏 | 用户主动提升的一级应用 | 主内容区完整页面 | Kernel 中的 Panel App 主侧栏偏好 |

“收藏”仍用于 Apps 列表排序；“固定到右侧快捷栏”和“添加到主侧栏”是两个独立动作，不能复用同一个布尔值或模糊地都叫“固定”。

## 现状证据

- 左侧 Skills、定时任务和 Agents 由 `chat-sidebar-desktop-layout.tsx` 的静态导航产生，主页面路由共用 Chat 主工作区外壳。
- Panel App 已经拥有稳定 `appId`、标题、图标、内容地址、iframe sandbox、Bridge、Client SDK 授权和 Service Action 授权。
- schema v2 App 已有 `presentation.primaryPanel`，App 包级操作可以自然落到主 Panel；Panel App 列表仍可对任意子 Panel 单独操作。
- 右侧 SideDock 只保存浏览器 localStorage，目标是右侧资源 URI，不适合作为一级产品导航的状态事实源。
- Panel App 内容已经按稳定 `appId` 解析当前启用的 workspace/package source；主侧栏必须继承该合同，不能重新保存绝对路径或旧 source ID。
- Doc Browser 已有跨 Tab 的 `activeHistory`，顶部前进/后退是右侧资源导航的唯一 history owner。
- 旧 Panel App 内层工具栏又单独提供了一个“返回 Apps”箭头，导致相邻两层工具栏出现两个图标相同但语义不同的返回动作。用户从非 Apps 来源打开时，内层动作会伪造来源并破坏浏览历史心智。

## 候选方案

### A. 复用 SideDock 状态并把相同入口复制到左侧

实现最少，但主侧栏会继承浏览器本地、只认右侧资源 URI、缺少安装生命周期的状态模型。用户在另一浏览器、升级或禁用时无法得到一致结果，也会把“右侧辅助工具”和“一级应用”混成同一语义。

不采用。

### B. App manifest 声明后自动注册一级导航

开发者体验简单，但安装即改变核心信息架构；多个 App 会争抢位置，恶意或低质量 App 也可以自动占位。用户无法判断入口来自系统还是安装副作用。

不采用。manifest 只提供展示元数据，不拥有用户主侧栏。

### C. 用户控制的主侧栏绑定，运行时复用 Panel App Host

Kernel 保存按稳定 `appId` 排序的用户绑定，UI 从当前可用 Panel App 投影出动态导航。点击后进入稳定主页面路由，复用现有 iframe、sandbox、Bridge 和授权链路。

采用该方案。它新增一个明确放置合同，不新增第二套 Panel App runtime。

## 信息架构与交互

### 添加与移除

“添加到主侧栏”会改变长期导航结构，但一个 App 通常只操作一次，因此属于低频布局管理，不是运行 App 时的常驻主动作。不能为了发现性把它与收藏、刷新、打开并列平铺，也不能在每个界面复制一个常驻按钮。

操作面按“管理来源”和“当前上下文”收敛为三个低视觉权重入口：

| 操作面 | 用户意图 | 交互 |
| --- | --- | --- |
| Panel Apps 列表卡片 | 管理某个 Panel App | 卡片 `⋮` 菜单提供添加/移除；卡片表面只保留高频收藏与打开 |
| 右侧正在运行或从快捷栏恢复的 Panel App | 用过之后决定是否提升为主要入口 | Panel App 工具栏 `⋮` 菜单提供同一动作，不新增独立平铺按钮；稳定身份先读资源 URI，缺失或不可解析时再读当前内容 URL |
| 左侧主侧栏中的 Panel App | 已经提升后调整一级导航 | 展开态在当前行 hover 或键盘 focus 时显示右侧 `⋮`，菜单提供“从主侧栏移除” |

- 三个菜单复用同一个 Panel App 主侧栏菜单项组件；该组件拥有标签、图标、`aria-pressed`、pending 状态和 preferences mutation，不让各入口分别复制动作语义。
- 未添加时使用“添加到主侧栏”；已添加时使用“从主侧栏移除”。
- 主内容区页面不复制 Header 或放置按钮。左侧入口自身就是该页面的就近管理面，避免为了低频动作重新占用主内容区。
- 点击后先乐观更新 Panel Apps 查询缓存，让左侧入口立即出现或消失；Kernel 持久化在后台完成。失败时只回滚对应 App 并显示错误，不回滚其它并发偏好。
- PATCH 成功返回完整 `PanelAppEntry`，UI 用返回值校准该条缓存；不再为一个布尔偏好立即触发全量 Panel Apps 重扫。
- 添加或移除不改变当前路由、右侧 Tab 或 iframe 实例，避免一个导航偏好动作打断工作。
- 从 Panel Apps 列表打开应用时，完成必要授权后先打开目标，再在后台记录 `lastOpenedAt/openCount`；活动统计不得成为导航前置条件。记录成功后同样只校准单条缓存，不触发全量重扫。
- App 包级入口后续可以用 `presentation.primaryPanel` 提供相同动作；本批保证任意 Panel App 子组件都可以单独添加。
- 添加只改变导航偏好，不隐式授予 Client SDK、Agent 或 Service Action 权限。
- 安装完成不会自动添加；若未来在安装成功页提供快捷动作，也必须由用户点击确认。

### 左侧主侧栏

- 动态 App 入口位于内置 Inbox、定时任务、Skills、Agents 之后，会话/项目列表之前，并使用分隔线与系统入口区分。
- 展开态显示当前 Panel App 标题和图标；收起态显示图标与 tooltip。
- 展开态的更多按钮默认零视觉、零占位、零命中，行 hover 或其内部 focus 时才出现在右侧；按钮与导航链接是兄弟元素，禁止把按钮嵌进链接。点击更多不得触发路由跳转。
- 更多菜单只有“从主侧栏移除”，因为该入口存在本身已经证明 `mainSidebar=true`。移除后共享缓存立即投影为空，当前页面继续运行，不被强制导航离开；失败则入口恢复并显示统一错误提示。
- 收起态不在狭窄 rail 上叠加第二个命中目标，继续通过 tooltip 保持入口身份；用户可在右侧 Panel App 工具栏或 Apps 列表执行同一动作。后续若需要紧凑态就地管理，应使用统一对象上下文菜单，而不是覆盖主导航点击区。
- 入口顺序按用户添加顺序稳定保存。本批不增加拖拽排序 UI，但数据合同保留有序数组，后续排序不需迁移。
- 主侧栏只展示当前可解析且启用的绑定。失效绑定保留在 Kernel，不渲染死链接。

### 主内容页面

- 路由使用 `/apps/panel/:appId`，URL 只包含稳定 App 身份。
- 主侧栏入口已经承担 App 身份与选中态，进入后 iframe 从主内容区顶边开始铺满；宿主不再重复渲染图标、标题、刷新或“在右侧打开”的 Header。
- Panel App 自己拥有页面内部的信息架构和 Header。宿主只负责路由、尺寸、sandbox、Bridge 消息验证、Client SDK 注入与 Service Action 授权，不给正常内容叠加第二层页面 chrome。
- 加载、授权失败、App 不可用等尚无可渲染 iframe 的状态继续由宿主显示完整状态页；这些是运行边界反馈，不属于重复 Header。
- 主页面和右侧面板是两个独立 iframe 实例；允许同时打开，不搬运 React/iframe 实例，也不共享临时 DOM 状态。
- 页面刷新保持路由和 active 导航；浏览器返回遵循普通路由历史。

#### 主页面 chrome 取舍

| 候选 | 结果 | 判断 |
| --- | --- | --- |
| 固定宿主 Header | 宿主标题与 App 自有 Header 重复，占用主工作区并让生态 App 看起来仍像嵌套面板 | 不采用 |
| 无宿主 Header、内容铺满 | 与 Skills、Agents 等一级页面保持“入口负责导航、页面负责内容”的层级，App 获得完整主工作区 | 采用 |
| 悬浮或自动隐藏宿主控制 | 减少固定高度，但仍引入遮挡、发现性和移动端状态，且当前没有必须常驻的宿主动作 | 不采用 |

右侧 Doc Browser 是资源容器，仍需要自己的 Tab、返回、固定、关闭及 Panel App 工具栏；该合同不因主页面去除 Header 而改变。两者差异来自容器语义，不要求视觉结构完全相同。

### 移动端

用户要求的是桌面左侧主侧栏。动态 App 不占用数量有限的移动端底部导航；移动端访问 `/apps/panel/:appId` 时仍可显示主内容，并通过顶部返回主工作区。后续如需移动端快速入口，应进入统一 Apps/More 入口设计，不自动复制桌面侧栏。

## 状态与唯一 owner

主侧栏绑定由 Kernel 的 Panel App 状态 owner 保存，使用独立的有序稳定身份集合：

```ts
type PanelAppMainSidebarState = {
  appIds: string[];
};
```

现有 `.panel-apps.state.json` 升级为向后兼容的新版本，在原有 `apps` 活动/收藏状态之外增加 `mainSidebarAppIds`。旧文件缺少该字段时视为空数组，不重写、不报错。

约束：

- 数组只保存稳定 `appId`，不保存 source ID、文件名、绝对路径、标题、图标或 package 版本。
- 添加前 Kernel 必须确认当前 `appId` 可以唯一解析；重复添加幂等。
- 移除只删除该稳定 ID；未知 ID 的移除同样幂等。
- 列表时以当前 source 的标题、图标、内容地址和授权状态投影，升级后的新元数据自动生效。
- 收藏和打开次数继续沿用现有 source state，不在本批迁移；主侧栏绑定不依赖这些旧 key。

公开的 `PanelAppEntry` 增加：

```ts
mainSidebar: boolean;
mainSidebarOrder?: number;
```

现有 preferences 更新合同增加 `mainSidebar?: boolean`。设置为 `true` 时追加到有序数组末尾，设置为 `false` 时移除。API、Client SDK 和 React Query 继续使用现有 `PATCH /api/panel-apps/:id/preferences`，不为一个布尔动作新增平行路由。

## 端到端主链路

### 添加

```text
用户从 Panel App 的更多菜单点击“添加到主侧栏”
  -> UI 立即乐观更新共享 Panel Apps 缓存
  -> 左侧从缓存投影入口，不等待 I/O
  -> UI PATCH 当前 Panel App preference
  -> Kernel 将请求 id 解析为当前 source 与稳定 appId
  -> State Store 原子写入 mainSidebarAppIds
  -> PATCH 返回完整 entry，UI 校准单条缓存
  -> 失败时回滚该 entry 并提示错误
```

本地 HTTP 是 NextClaw UI 与 Kernel 的统一进程边界，便于 Desktop、Web 与远程宿主共用合同；“本地”不代表 UI 可以等待完整请求链才反馈。旧实现的 `PATCH -> invalidate -> GET 全量扫描` 把 source 解析、manifest/授权读取、状态文件原子写和再次扫描全部暴露给了用户；列表打开还先 `await recordOpened` 再切换页面，让活动统计阻塞导航。本设计用乐观缓存和“先打开、后记录”把持久化延迟移出交互关键路径。

### 打开

```text
用户点击动态入口
  -> React Router 进入 /apps/panel/:appId
  -> Panel App 主页面从当前列表按稳定 appId 取展示元数据
  -> 若 Client SDK 尚未授权，由宿主使用既有授权流程确认
  -> iframe 请求 /api/panel-apps/:appId/content
  -> Kernel 解析当前启用 source 并注入现有 runtime token/Bridge
```

### 在右侧打开

稳定 Panel App 使用同一个 resource target 调用 Doc Browser。右侧 SideDock 是否固定仍由用户单独决定，主侧栏状态不联动。右侧工具栏解析管理对象时优先使用 `tab.resourceUri`；若旧快捷入口没有有效资源 URI，则回退到 `tab.currentUrl` 的稳定 `/api/panel-apps/:appId/content` 身份。带显式 `?path=` 的临时资源在两个来源上都不可绑定，继续不展示主侧栏动作。

### 右侧返回与历史

- Doc Browser 顶部前进/后退继续是唯一返回入口，Panel App 内层工具栏不再渲染第二个返回箭头。
- 从 Apps 列表进入 Panel App 时，Apps Tab 和 Panel App Tab 都进入既有 `activeHistory`；点击顶部返回自然回到原 Apps 列表及原筛选 Tab。
- 从会话资源、固定快捷栏、另一个 Tab 或恢复状态进入时，返回到真实上一条历史记录，不强制跳到 Apps。
- 当前没有上一条历史时，顶部返回保持禁用；不把 Apps 列表当成伪造的 fallback。
- Panel App 自己不读写、复制或修补 Doc Browser 历史，只通过现有 `openTarget` 进入标准主链。

## 生命周期矩阵

| 场景 | 主侧栏行为 | 主页面行为 |
| --- | --- | --- |
| 首次添加 | 立即出现，位于已有动态入口末尾 | 点击后正常加载 |
| 刷新/重进 | 由 Kernel 状态恢复，顺序不变 | 稳定路由重新解析当前 source |
| App 升级/回滚 | 保留入口，显示当前版本标题/图标 | 加载当前 active 版本内容 |
| App 禁用 | 暂时隐藏，绑定保留 | 已打开页面进入不可用态 |
| App 重新启用 | 原位置恢复 | 再次加载当前内容 |
| App 卸载 | 清理绑定，不保留隐藏入口 | 已打开或收藏的旧路由显示 App 不可用并提供返回 Apps |
| 同一 App 重装 | 不自动恢复；用户需要重新添加 | 加载重装后的当前内容 |
| workspace Panel 删除 | 删除动作同时清理主侧栏绑定 | 路由显示不可用态 |
| 标题/图标变化 | 下次 query 使用新元数据 | 工具栏同步更新 |
| 授权拒绝 | 入口保留 | 不加载增强 Client 能力，显示可重试的宿主态 |

禁用只代表暂时停用，因此保留绑定并在重新启用后恢复；升级和回滚不进入卸载清理链，也保留绑定。卸载和 workspace Panel 显式删除都代表用户移除资源，必须同步清理绑定，确保之后重新安装不会绕过“只能由用户手动添加”的原则。

## 安全边界

- App、Marketplace 响应或安装脚本不能直接写入主侧栏绑定。
- 标题与图标只来自 Kernel 当前解析后的 Panel App entry；UI 不执行 App 提供的导航代码。
- 带显式 `?path=` source 的临时/外部 Panel 资源不提供主侧栏动作；主侧栏只能绑定当前目录中可稳定解析的逻辑 `appId`，避免按钮展示的内容与之后主入口打开的内容不一致。
- 添加主侧栏不等于授权能力；Client SDK、Agent 与 Service Action 仍走现有宿主授权。
- iframe 继续拒绝伪造 source window 的 Bridge 消息。
- 路由参数只作为稳定 ID 交给 Kernel 解析，不能成为文件路径。

## 实现范围

### Kernel / Server / SDK

- 扩展 `PanelAppStateStore` 的版本化状态、原子更新与去重归一化。
- `PanelAppManager` 在 list/update/delete 主链解析和投影主侧栏状态。
- 扩展 Panel App API/Client SDK preferences 类型与 controller 白名单。

### UI

- 抽取一个业务内共享的 Panel App 主侧栏菜单项，统一添加/移除标签、图标、可访问状态、pending 和 mutation；Apps 列表、右侧工具栏和左侧入口只负责各自的菜单容器。
- Apps Panel App 卡片的更多菜单提供添加/移除主侧栏；不增加卡片常驻按钮。
- 右侧 Panel App 工具栏的更多菜单提供同一低频动作，并兼容从旧快捷入口恢复后只有当前内容 URL 可解析的稳定 Panel App；主内容页面不渲染宿主 Header 或宿主动作栏。
- 左侧展开态入口用链接和独立更多按钮组成一行，hover/focus 显示菜单；移除不触发导航。收起态不叠加更多按钮。
- preferences mutation 乐观更新共享缓存，失败精确回滚，成功用 PATCH 返回值校准，避免紧随其后的全量重拉。
- Panel Apps 列表先打开目标，再后台记录打开统计；主页面的统计记录也只回写单条缓存。
- 删除 Panel App 内层“返回 Apps”动作，返回完全服从 Doc Browser 的标准 active history。
- 左侧导航增加动态 Panel App 区域和当前路由选中态。
- 新增主页面路由与全尺寸 iframe 宿主。
- 抽取共享 Panel App 图标和 Client SDK 授权 hook，避免列表与主页面复制。
- 把 Panel App Bridge 的 iframe 消息输入从 Doc Browser 专用类型收窄为 Panel App 自有最小合同，使两个宿主复用同一 manager。

## 验证标准

1. Store 测试证明旧 v1 文件、去重、追加、移除、顺序与原子持久化。
2. Kernel 测试证明列表投影、稳定 appId 更新、workspace 删除清理、package disable/re-enable 保留。
3. Controller 与 Client SDK 测试证明 `mainSidebar` 只接受布尔值并透传。
4. UI 测试证明列表、右侧运行态与左侧动态入口复用同一菜单项语义；右侧可从稳定资源 URI 或稳定内容 URL 解析当前 App，左侧 hover/focus 菜单可以移除且不触发导航；卡片和主页面不出现平铺按钮，同时证明动态入口顺序/图标/收起态和 active route。
5. Hook 测试证明持久化未完成时左侧缓存已经更新，失败时精确回滚；列表测试证明打开发生在统计记录之前；主页面测试证明 iframe 直接占满正常内容区且没有宿主 Header，同时覆盖加载、授权和不可用状态。
6. iframe Bridge 测试证明主页面仍校验 `event.source` 并复用现有授权链。
7. Doc Browser 回归测试证明 Panel App 不再渲染第二套返回动作，顶部返回按 active history 回到真实来源，无历史时禁用。
8. Kernel、Server、Client SDK、UI TypeScript 检查通过；定向 lint、测试、build/真实浏览器交互按风险执行。

## 非目标

- 不允许 App 安装后自动进入主侧栏。
- 不开放 App 自定义任意 React 路由、系统导航分组或主侧栏排序权。
- 不把动态 App 放入移动端底部导航。
- 本批不实现拖拽排序、数量折叠或 Marketplace “推荐固定”协议。
- 不新增第二套 Panel App runtime、Bridge 或授权机制。
