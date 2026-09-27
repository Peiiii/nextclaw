# Bibo 工作界面与双主题

用户授权落地上线，并连续纠正配色、控件尺寸、提示范围、间距及反馈。以用户提供的 Codex 截图作为几何参考；官方 ChatGPT 页面需登录，未将登录页误作工作界面参考。

默认 Bibo 经典保留暖白与绿色，简约采用中性色；账号菜单切换并保存浏览器偏好。两主题共用组件和几何。复用 Button、IconButton、NavigationItem、Tab／TabList、SegmentedControl、ListRow 和 Radix Tooltip，消除页面的重复尺寸与背景配方。规范归 personal-agent-ui README，Bibo AGENTS 仅链接 owner，用户说明同步帮助页与双语文档。

鼠标图标 32px，触屏点击区 44px、可见反馈 32px；仅 pointer: coarse 扩大，窄桌面只改变布局。导航行间 4px、分组 8px；内容行内缩留白与圆角，底部导航用小圆角反馈。文字已完整的筛选、按钮和内容入口不加重复提示，图标说明用途，截断文字及文件路径补充信息。分段 hover 使用更强的语义色与 ink 文字。

## 验证与审查

- 组件库及 Worker／client／runner tsc、Vite 构建通过；构建存在既有 Mermaid 大块提示。
- product／composer smoke 覆盖发送、停止、失败恢复、多会话、数据页、长名称、Tab／目录键盘、抽屉、主题持久化与提示例外；合并后的文件自动预览 smoke 通过。
- 1512／1100／390／320px、两主题、鼠标与触屏截图和测量通过，草稿及消息节点不因外观切换重建。读取已有线上数据和实际模型回答仍待部署后记录。
- diff-only maintainability 无错误，保留已有 app 目录及临界文件预算警告；定向 ESLint 无错误。本任务范围治理与双语文档检查通过。合并主干期间，全合并 diff 的治理命中了其它任务的 Playwright fill 命名误判，改用 origin/master 明确本任务 diff，不改无关测试或检查器。
- 主观复核无未关闭 finding：单一 store 状态 owner、稳定组件类型、Radix 生命周期与公共 package 入口；新增导航组件减少多处配方，测试 helpers 按设计体系组织，数据类型独立表达契约，无额外业务适配层。

## 恢复与交付

主工作区思想文档 WIP 未修改。实现已隔离，合并主干最新文件预览／操作反馈／搜索能力后重新验证。纯前端部署复用线上容器，无数据迁移、NPM／runtime channel／desktop 发布。部署身份、生产复验、文档部署与主线回流待补充。

本地 build:client 会清理重建共享依赖 dist，运行中的 Vite 可能短暂无法加载模块；验证期间直接构建 Vite 产物，避免清理活动预览依赖。一次截图写入遇到瞬时 ENOSPC，空间恢复后重新完整验证；未删除用户文件。重复 tooltip、设备与窗口宽度混用、单边尺寸导致图标长条等经验已修正原组件 owner 与规范，不新增窄治理脚本。
