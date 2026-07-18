# v0.25.33 Platform 双站移动工作台

## 迭代完成说明

本次把 Platform Console 与 Platform Admin 从“桌面壳在手机上被压缩”改成真正可操作的移动工作台：两站都使用单一内容滚动区、紧凑顶部导航和视口内壳层；实例列表与用户列表在手机端使用任务卡，桌面端继续保留带固定列的数据表。用户偏好、筛选、分页、实例操作、额度管理和退出入口在 390 × 844 视口内均可到达。

根因是两个应用都以固定桌面高度和最小高度承载页面：Console 在手机端纵向堆叠完整侧栏后仍由外层 `overflow-hidden` 裁切内容，Admin 则始终保留 248px 固定侧栏并由 `body { overflow: hidden }` 阻止页面接管滚动。该判断通过线上真实页面的 DOM 几何与滚动属性确认：Console 内容底部超出视口但 document 不可滚动，Admin 的用户表可见宽度被侧栏压缩到极小区域。修复直接调整壳层滚动 owner 与移动端信息架构，不依赖局部 `overflow` 补丁。

首次部署后的真实手机截图继续暴露了验收缺口：虽然页面已经“无横向溢出且能滚到底”，但移动端仍然只是压缩后的桌面壳，顶部品牌、横向导航、账号整行、重复标题、长说明和筛选卡连续占据首屏，第一张实例卡在约 600px 后才出现。第二轮修正把两站改为 56px 顶部身份栏、五等分底部导航和单一内容滚动区；Console 移除移动端重复标题与外层卡片，Admin 将用户列表提升为移动端首要任务并把全局额度收为次级折叠面板。

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
- 第二轮本地 390 × 844 验收：两站首张任务卡完整出现在初始视口，顶部身份栏不超过 56px，底部导航不超过 64px 且无需横向滚动，document 与内容区之间没有第二个主滚动面。
- 第二轮本地 320 × 844 极窄视口验收：Console 与 Admin 冒烟均通过；Console 四个实例操作在极窄宽度下使用两列布局。
- Console 额外完成中文、深色主题和账号菜单打开态整页截图复核；语言、主题、账号和退出能力均保留并可达。

## 发布/部署方式

首轮先在本地 `master` 创建提交 `48c9617f3`，再依次执行 `pnpm deploy:platform:console` 与 `pnpm deploy:platform:admin`。Platform Console Pages 部署为 `https://e7c974e8.nextclaw-platform-console.pages.dev`，Platform Admin Pages 部署为 `https://09e6305f.nextclaw-platform-admin.pages.dev`。真实手机截图指出首轮视觉验收不足后，第二轮移动信息架构修正按同样的本地 `master` 优先流程重新提交、部署和在线验收。

## 用户/产品视角的验收步骤

1. 用 390 × 844 或相近尺寸打开 Platform Console，确认顶部只保留品牌、当前模块和账号入口，底部五个模块完整显示且不需要横向滚动；账号菜单可访问账号、语言、主题和退出操作。
2. 在“我的实例”确认首屏完整显示筛选器和至少一张实例任务卡；分页与打开、固定域名、分享、归档操作均可见，从顶部滚动到列表末尾时页面不横向抖动。
3. 切换“用量与充值”“我的 Apps”“我的 Skills”“账号”，确认同一内容区可以正常纵向滚动。
4. 打开 Platform Admin，确认移动端顶部只显示当前模块与管理员入口，五个管理模块固定在底部且完整可达。
5. 在“用户与额度”确认用户搜索和第一张用户卡直接出现在首屏；全局额度位于列表后的折叠面板。用户卡显示账号、角色、额度进度、余额、时间和“管理额度”，额度弹窗不越出视口。
6. 在桌面尺寸复核两站侧栏、数据表、排序、固定列和操作列保持原有行为。

## 可维护性总结汇总

- 本次属于新增移动端用户能力，生产代码增长用于建立明确的响应式壳层与任务卡，而不是为旧桌面表格堆媒体查询特判。
- 复用了两站既有 DataTable、Button、筛选、分页与业务 action owner；移动端只是同一数据和动作的第二种展示，不新增平行状态或 API 链路。
- `AdminShell` 从历史白名单外目录归位到 `app/`；实例列表展示组件从查询编排文件中拆出，文件 owner 和预算均更清楚。
- 代码增减报告：新增 634 行、删除 297 行、净增 337 行；非测试代码同口径净增 337 行。增长来自新增移动工作台、任务卡和浏览器级验收能力，已通过删除旧 Admin Shell、复用既有 DataTable/action owner、拆分实例展示职责控制长期成本。
- 第二轮修正新增 491 行、删除 248 行、净增 243 行；增长用于两套真实移动导航、移动主任务重排和可执行的首屏质量门，不新增业务状态或 API 链路。Console/Admin 分别复用原路由、业务 action、DataTable 和查询 owner，桌面与移动只分展示结构。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`。守卫无阻塞项；`scripts/smoke` 的历史目录预算警告已有 README 豁免，本次未新增直接文件。
- 失败教训已进入 `frontend-interaction-quality`：移动端不能只以“能滚、无溢出、控件存在”验收，后续必须检查首屏主任务、页面 chrome 占用、横向导航探索成本和单滚动面，并以截图或几何断言收口。

## NPM 包发布记录

不涉及 NPM 包发布。Platform Console 与 Platform Admin 均为私有 Web 部署目标，本轮不添加 `.changeset`。
