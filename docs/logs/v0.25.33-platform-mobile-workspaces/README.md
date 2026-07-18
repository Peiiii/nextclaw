# v0.25.33 Platform 双站移动工作台

## 迭代完成说明

本次把 Platform Console 与 Platform Admin 从“桌面壳在手机上被压缩”改成真正可操作的移动工作台：两站都使用单一内容滚动区、紧凑顶部导航和视口内壳层；实例列表与用户列表在手机端使用任务卡，桌面端继续保留带固定列的数据表。用户偏好、筛选、分页、实例操作、额度管理和退出入口在 390 × 844 视口内均可到达。

根因是两个应用都以固定桌面高度和最小高度承载页面：Console 在手机端纵向堆叠完整侧栏后仍由外层 `overflow-hidden` 裁切内容，Admin 则始终保留 248px 固定侧栏并由 `body { overflow: hidden }` 阻止页面接管滚动。该判断通过线上真实页面的 DOM 几何与滚动属性确认：Console 内容底部超出视口但 document 不可滚动，Admin 的用户表可见宽度被侧栏压缩到极小区域。修复直接调整壳层滚动 owner 与移动端信息架构，不依赖局部 `overflow` 补丁。

结构上将历史 `components/admin/admin-shell.tsx` 归位到 `app/admin-shell.tsx`；Platform Console 的实例列表展示职责收敛到 `remote-instance-list-item.tsx`，查询、筛选和分页编排继续留在 `remote-instances-card.tsx`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/platform-console tsc`：通过。
- `pnpm --filter @nextclaw/platform-admin tsc`：通过。
- `pnpm --filter @nextclaw/platform-console lint`：通过，0 warning。
- `pnpm --filter @nextclaw/platform-admin lint`：通过，0 warning。
- 两个应用的 Vite production build：通过。
- `PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4173 node scripts/smoke/platform-console-smoke.mjs`：通过。
- `PLATFORM_ADMIN_BASE_URL=http://127.0.0.1:4177 node scripts/smoke/platform-admin-smoke.mjs`：通过。
- 新增 390 × 844 定向断言：document 无横向溢出、内容滚动区可到达底部、移动卡片替代桌面表格、导航溢出可达、核心操作可见、额度弹窗不越出视口。
- 使用用户当前 Chrome 打开本地双站登录页，确认 390px 宽度下 `scrollWidth === clientWidth`；核心登录后工作台由带 API fixtures 的真实浏览器冒烟与截图复核。
- `PLATFORM_CONSOLE_BASE_URL=https://platform.nextclaw.io node scripts/smoke/platform-console-smoke.mjs`：生产域通过。
- `PLATFORM_ADMIN_BASE_URL=https://platform-admin.nextclaw.io node scripts/smoke/platform-admin-smoke.mjs`：生产域通过。
- 两个生产首页、构建 JS 与 `/logo.svg` 均返回 `200`；Console 加载 `index-CMu5qo8Q.js`，Admin 加载 `index-5NVIVjW9.js`，favicon 均为 `image/svg+xml`。

## 发布/部署方式

本轮先在本地 `master` 创建提交 `48c9617f3`，再依次执行 `pnpm deploy:platform:console` 与 `pnpm deploy:platform:admin`。Platform Console Pages 部署为 `https://e7c974e8.nextclaw-platform-console.pages.dev`，Platform Admin Pages 部署为 `https://09e6305f.nextclaw-platform-admin.pages.dev`；两个生产自定义域均已完成 390 × 844 在线验收。

## 用户/产品视角的验收步骤

1. 用 390 × 844 或相近尺寸打开 Platform Console，登录后确认顶部可以横向访问所有模块，账号行可展开账号、语言、主题和退出操作。
2. 在“我的实例”确认筛选器、实例任务卡、分页与打开、固定域名、分享、归档操作均可见；从顶部滚动到列表末尾，页面不横向抖动。
3. 切换“用量与充值”“我的 Apps”“我的 Skills”“账号”，确认同一内容区可以正常纵向滚动。
4. 打开 Platform Admin，确认移动端不再显示占据大部分宽度的固定侧栏，所有管理模块可从顶部导航到达。
5. 在“用户与额度”确认用户卡片显示账号、角色、额度进度、余额、时间和“管理额度”；打开额度弹窗，确认内容与底部操作在视口内可滚动到达。
6. 在桌面尺寸复核两站侧栏、数据表、排序、固定列和操作列保持原有行为。

## 可维护性总结汇总

- 本次属于新增移动端用户能力，生产代码增长用于建立明确的响应式壳层与任务卡，而不是为旧桌面表格堆媒体查询特判。
- 复用了两站既有 DataTable、Button、筛选、分页与业务 action owner；移动端只是同一数据和动作的第二种展示，不新增平行状态或 API 链路。
- `AdminShell` 从历史白名单外目录归位到 `app/`；实例列表展示组件从查询编排文件中拆出，文件 owner 和预算均更清楚。
- 代码增减报告：新增 634 行、删除 297 行、净增 337 行；非测试代码同口径净增 337 行。增长来自新增移动工作台、任务卡和浏览器级验收能力，已通过删除旧 Admin Shell、复用既有 DataTable/action owner、拆分实例展示职责控制长期成本。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`。守卫无阻塞项；`scripts/smoke` 的历史目录预算警告已有 README 豁免，本次未新增直接文件。

## NPM 包发布记录

不涉及 NPM 包发布。Platform Console 与 Platform Admin 均为私有 Web 部署目标，本轮不添加 `.changeset`。
