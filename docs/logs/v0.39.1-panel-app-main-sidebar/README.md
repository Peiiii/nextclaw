# Panel App 主侧栏入口

## 迭代完成说明

本迭代把 Panel App 从只能作为右侧辅助工具使用，扩展为可由用户手动提升到左侧主侧栏的一级应用入口。

- Kernel 将 `.panel-apps.state.json` 升级到 v2，以有序稳定 `appId` 保存主侧栏绑定，并兼容读取 v1 收藏/打开状态。
- Server、Client SDK 和 UI preferences 合同增加 `mainSidebar`，安装过程不会自动写入该偏好。
- “添加到主侧栏/从主侧栏移除”作为低频布局管理，只出现在 Panel Apps 卡片和右侧运行态的更多菜单中；卡片、运行工具栏和主内容页面不平铺该动作，左侧导航只投影当前启用且可解析的绑定。
- preferences mutation 会先乐观更新共享 Panel Apps 缓存，左侧入口即时出现或消失；后台持久化失败时精确回滚，成功后用 PATCH 返回值校准，不再紧接一次全量列表重扫。
- 从 Panel Apps 列表打开应用不再等待 `recordOpened` 写盘；先切换到应用，再后台记录打开时间/次数，并用返回 entry 校准单条缓存。
- `/apps/panel/:appId` 主页面复用现有 iframe sandbox、Panel App Bridge、Client SDK 授权和右侧资源 target，没有新增第二套运行时。
- Panel App 内层工具栏删除了“返回 Apps”伪导航；右侧只保留 Doc Browser 的唯一前进/后退 owner，从 Apps、会话或其它资源进入时都返回真实来源。
- 禁用、升级和回滚保留绑定；卸载或 workspace Panel 显式删除会清理绑定，后续重新安装不会自动恢复入口。
- Review 发现并关闭了六类问题：卸载残留绑定会绕过“安装不自动添加”、Client 授权结果可能跨主页面实例复用、放置动作一度过度平铺、偏好写盘链路被暴露成交互延迟、右侧返回与浏览器历史重复，以及资源 ID 解析可能把显式 source path 误当成稳定目录 App。

设计合同见 [Panel App 主侧栏应用入口设计](../../designs/2026-08-19-panel-app-main-sidebar-shortcuts.design.md)。

## 测试/验证/验收方式

- Kernel 定向测试：3 个文件、32 项通过；Review 修正后重新运行受影响的 package 生命周期测试通过。
- Server 组装边界测试：16 项通过，覆盖 HTTP preferences 合同、非布尔拒绝、写盘和重建 Kernel 后恢复。
- UI 最终定向测试：14 个文件、71 项通过，覆盖菜单化放置动作、乐观更新/失败回滚、非阻塞打开统计、主侧栏投影、主页面、sandbox、Bridge、授权、稳定资源 ID 和 Doc Browser 历史。
- `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` TypeScript 检查通过。
- 相关源码定向 ESLint、`lint:new-code:governance` 和 `git diff --check` 通过。
- `@nextclaw/ui` 生产构建通过；仅保留仓库既有的 Browserslist 数据和 chunk 体积提示。
- 未重启当前运行中的 NextClaw 实例。真实源码开发页面 `http://127.0.0.1:5174` 已验收：卡片表面无主侧栏平铺动作；列表和运行态 `⋮` 菜单可管理；添加/移除后左侧入口立即变化；浏览器返回回到原 Panel Apps Tab。测试 App 已恢复为未添加状态。
- 本地 Panel Apps 列表与三个个人空间内容接口实测 TTFB/总耗时约 15–33ms；原可感知等待来自 UI 把偏好写盘、活动统计和全量重扫放在交互关键路径，不是外网请求。

## 发布/部署方式

本批仅完成本地设计、实现、验证和交付文件。未获得提交、推送、发布或部署授权，因此未执行 commit、push、NPM publish、runtime channel 更新或线上部署。

后续由正式发布批次消费 `.changeset/panel-app-main-sidebar.md`，并按常规 NPM/runtime 发布流程完成部署与发布后 smoke。

## 用户/产品视角的验收步骤

1. 打开 Apps 中的 Panel Apps 列表，确认安装或新建 Panel App 后不会自动出现在左侧主侧栏。
2. 打开目标 Panel App 卡片的 `⋮` 菜单并选择“添加到主侧栏”；也可以先打开 App，再从运行态工具栏的 `⋮` 菜单添加。确认菜单关闭后入口立即出现在内置导航之后、会话列表之前，不等待后台写盘。
3. 从 Apps 列表打开 Panel App 后点击右侧顶部“返回”，确认回到原来的 Panel Apps 列表，而不是由 Panel App 自己重新打开一个 Apps 页面。
4. 点击左侧入口，确认主内容区显示 Panel App，并可刷新或在右侧面板打开；主页面不出现低频的主侧栏平铺按钮。回到任一管理菜单移除后，当前页面不被强制关闭。
5. 禁用再重新启用 App，确认入口先隐藏后按原顺序恢复。
6. 卸载或删除 App，确认入口被清理；重新安装后仍需用户再次手动添加。

## 可维护性总结汇总

- 主侧栏偏好由 Kernel 单一 owner 保存；UI 只投影当前可用 entries，右侧 SideDock 状态保持独立。
- 主内容宿主复用既有 sandbox、Bridge、授权和 resource target；共享图标、Client 授权 hook 和统一 Panel App URI 解析消除了列表/主页面/右侧运行态的重复逻辑。
- `PanelAppEntry` 等公开类型从 manager 移到类型 owner，`panel-app.manager.ts` 净减少 51 行，没有用 wrapper 隐藏复杂度。
- 最终 scoped maintainability guard 为 0 error、6 warning；4 项是未增长或下降的既有预算提示，新增提示来自接近预算的既有 Kernel 测试文件（+2 行）和 Doc Browser 回归测试文件。主观复核未发现需要阻止交付的 finding。
- 新文件角色、跨 feature 公共入口、React effect owner 和目录结构均通过治理检查。

## NPM 包发布记录

需要随下一次统一正式发布交付，但本批尚未发布：

- `@nextclaw/kernel`：待统一发布（patch）。
- `@nextclaw/server`：待统一发布（patch）。
- `@nextclaw/client-sdk`：待统一发布（patch）。
- `@nextclaw/ui`：待统一发布（minor）。
- `nextclaw`：待统一发布（minor）。
- `@nextclaw/desktop`、`@nextclaw/remote`、`@nextclaw/service`、`@nextclaw/companion`：因内部依赖版本传播待统一发布（patch）。

以上均为本次本地未发布变更；`changeset status` 已验证版本传播关系。当前没有外部发布阻塞，触发条件是用户明确授权正式 NPM/runtime 发布。
