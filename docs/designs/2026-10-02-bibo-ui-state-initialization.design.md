# Bibo 首屏 UI 状态恢复

## 问题与证据

用户报告进入首页后，会话列表自行播放收起动画。现有 `BiboSpaceOwner.sidebarCollapsed` 默认 false；`BiboChatOwner.bootstrap` 等待 `/api/auth/me`，组件 effect 再 `bindAccount`，从 `space-layout:<accountId>` 恢复 true。桌面侧栏 CSS 始终开启 width/opacity transition，因此账号确认把默认布局变成保存布局时重播动画。状态由前端 Zustand 拥有，显示偏好在 localStorage；服务端只提供账号、会话和内容。

本任务为 L2 bugfix。首次编辑在 `codex/bibo-layout-initialization`，基线 `feaa9aabe66ba6118a6544c92dc2849342a8c654`；源区已有会话置顶等 WIP 不属于本任务。复现选择 reproduce：浏览器延迟账号响应，比较响应前后侧栏宽度并监听 transition。只提交 Bibo 本次范围，按既有默认交付授权合入、部署应用并线上复验。

## 用户链路与方案

用户主动收起侧栏后刷新首页，首屏直接显示收起后的布局；账号请求尚未返回和返回后布局均稳定。主动展开/收起仍有连续动画，导航、刷新和账号切换不重播。新浏览器无偏好时默认展开；不能访问本地存储时仍可正常操作。

显示偏好由独立 `useWorkspaceUiStore`（Zustand）唯一拥有，复用现有 workspace-layout utils：侧栏折叠、文件目录折叠和目录宽度使用单一 `bibo-ui-layout` 本地快照，在 store 创建时同步读取、用户操作时保存；主题沿用现有同步恢复。移除账号空间 store 中的显示字段与操作，直接迁移现有消费者，不保留同名转发。账号布局仅保存文件夹展开、Tab、活动文件和右工作区目标；内容与草稿继续按账号隔离。账号切换沿用空间 owner 重建和旧异步请求失效机制，不从别的账号恢复文件信息。手机目录始终展开，不能将手机的适配结果写回覆盖桌面偏好。

动效沿用现有右工作区做法：`useLayoutMotion` 统一两个真实布局动作的 DOM ref、当前路由与账号上下文许可和动画前几何读取；组件连接点击与 store 操作。侧栏和右工作区的 CSS 过渡仅在许可时启用，路由或账号变化清除许可。初始化与账号恢复不启用过渡。

单纯禁用动画仍会先展开后跳成收起；等账号后才挂载整个应用增加首屏等待。选同步恢复纯设备布局，账号数据独立恢复。不增加后端设置接口、全局账号提示缓存、第二份 React 状态或迁移兼容层；Bibo 当前 demo 阶段允许旧账号布局中的显示偏好恢复为默认，文件 Tab/草稿继续保留。

## 验收与 Review

- 浏览器延迟账号响应：保存收起偏好后刷新，响应前后宽度一致，无侧栏 transition；主动展开/收起有中间态，结束后保存生效。
- 桌面/手机刷新、站内往返和账号切换：显示偏好不被账号初始化重置，文件/草稿隔离成立，手机文件目录可达；右工作区恢复不播放动画，主动操作保留动画。
- localStorage 缺失/损坏/不可写：默认布局可用、主动操作仍有效。
- 定向 store 测试、现有产品浏览器 smoke、Worker/网页/脚本/容器 tsc、Vite build；上线核对产物版本并从真实首页复验。

design-document: required（状态初始化与持久化边界调整）；plan: not-required（单批）。二次方案 Review：先前在账号 owner 内读取设备偏好仍需重建时拷贝防护，且增长已有超限 store；改为独立 UI store 隔离真实生命周期变化点，四个现有消费者直接使用，删除旧显示路径。动效 hook 收敛侧栏/工作区两份 DOM 操作，只同步外部几何，不持有业务状态。纯几何无账号内容，桌面适配与手机保存边界有验证，恢复/操作动效区分明确；没有新增权限、服务或兼容分叉，design-review: passed。视觉偏好不变，无新增主观审美项。

实现验收：空间 store 的 21 项测试、Worker/网页/脚本 tsc、Vite build、产品与异步提问浏览器 smoke 均通过。恢复用例覆盖延迟账号、首次绘制、手动中间态、减少动态效果、桌面/手机目录偏好；空间测试覆盖账号隔离与存储异常。diff-only maintainability 无 error，仅三个既有/接近文件预算的 warning；定向 lint、治理与 ratchet 通过，implementation-review: passed。复盘事实归本设计和 Bibo README：显示生命周期独立于账号恢复；通用规则已有前端 owner 与初始化动效合同，无新增流程或规则文件。
