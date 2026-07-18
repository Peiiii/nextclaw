# v0.25.28 Platform Admin 用户治理与开发前置检查

## 迭代完成说明

- Platform Admin 与 Platform Console 分别补齐 NextClaw SVG favicon 与浏览器主题色，两个独立站点的标签页不再显示默认空白图标。
- “用户与额度”从密集的整行编辑矩阵改为浏览优先的用户表格：账号、角色、免费额度使用率、付费余额、注册时间、最近更新和固定操作列保持清晰分层。
- 用户列表支持服务端分页、页大小、邮箱/用户名/用户 ID 搜索、角色快捷筛选和安全白名单排序；角色计数随搜索条件同步更新。
- 额度调整改为点击“管理额度”后进入独立对话框，展示当前免费消耗、免费剩余和付费余额，仅在明确提交时修改免费额度上限或付费余额增减。
- 新增业务无关 `DataTable` 基础组件，统一拥有加载态、空态、排序表头、固定左右列、横向滚动与列宽合同；用户查询与额度语义继续由 `admin-users` feature owner 管理。
- Worker 的用户列表 SQL 收敛到独立 repository，搜索通配符转义、角色条件、分页 offset、稳定二级排序和排序列白名单均在服务端完成。
- 开发流程新增 `pnpm preflight:governance -- <path...>`：首次编辑前用真实文件角色与模块结构 owner 校验计划新增、重命名、移动和触达路径；实现途中新增计划外路径必须先补跑。
- 文件命名 skill、完整命名规范、标准交付 workflow 与 `AGENTS.md` 同步指向统一 preflight；允许后缀文档与可执行白名单同步补齐 `constants / presenter / route / tools`，不再依赖实现者记忆猜测。

### 本轮纠偏根因

- 初次实现虽然前置读取了命名 skill，但没有把允许后缀和模块合同转成可执行 planned-path 检查，仍凭惯性使用了规范不存在的 `.client.ts`，直到后置 governance 才被发现。
- 只增加文件角色 preflight 后，真实 diff 又被 `app-l2` 模块结构合同拦住，证明单独前置命名仍会遗漏 feature root 约束；最终收敛为同一入口同时执行文件角色和模块结构两位真实 owner。
- 当前 Admin 实现没有为通过检查而开放旧 `api/components/pages` 根目录；新增代码落在 `features/admin-users` 与 `shared/components`，旧 API client 保持未触达，避免把局部改动扩成无关的全应用迁移。

## 测试/验证/验收方式

- `pnpm -C apps/platform-admin lint`、`tsc`、`build`：通过；Vite 生产构建包含 favicon、CSS 与 JS 资产。
- `PLATFORM_ADMIN_BASE_URL=http://127.0.0.1:4177 pnpm smoke:platform:admin`：通过；覆盖 favicon 加载、用户列表渲染、搜索请求、角色筛选请求、排序请求、分页摘要、额度对话框打开与取消，以及其他管理路由回归。
- `pnpm -C apps/platform-console lint`、`tsc`、`build` 与 `PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4173 pnpm smoke:platform:console`：通过；生产构建包含 `/logo.svg`，本地 HTTP 验证返回 `image/svg+xml`。
- `pnpm -C workers/nextclaw-provider-gateway-api lint` 与 `tsc`：通过。
- `pnpm -C workers/nextclaw-provider-gateway-api test:admin-users`：通过；覆盖两页数据、角色计数与筛选、用户名搜索、`%` 字面量搜索转义和余额排序。
- `pnpm -C workers/nextclaw-provider-gateway-api test:remote-instances`：通过；既有远程实例分页合同无回归。
- `pnpm -C workers/nextclaw-provider-gateway-api test:quota`：14 项通过；既有 Remote quota 合同无回归。
- 文件角色治理测试 32 项、模块结构治理测试 65 项全部通过；非法 `.client.ts`、错误 page 命名和 contract-only 旧根路径会在 planned-path 阶段被拦截。
- `pnpm preflight:governance -- <本轮计划路径>`：文件角色与模块结构两阶段通过。
- `pnpm lint:new-code:governance` 定向覆盖本轮 23 个源码/治理文件：全部通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- 线上 HTTP 验收：`platform.nextclaw.io` 与 `platform-admin.nextclaw.io` 首页、`/logo.svg` 和构建产物均返回 `200`；两个自定义域均声明 `image/svg+xml` favicon。
- 用户当前 Chrome 验收：`platform.nextclaw.io` 标签页读取到 `https://platform.nextclaw.io/logo.svg`；管理后台管理员筛选收敛为 1 行、账号排序进入升序、额度对话框打开/取消正常。
- maintainability guard：23 个文件，`0 error / 4 warning`；总代码 `+1504 / -563 / net +941`，非测试代码 `+1344 / -562 / net +782`。本轮包含新增用户能力与通用治理能力，允许正向增量；warning 为两个治理 owner 接近 500 行预算、既有 smoke 目录豁免和 Admin controller 接近 600 行预算，均未越过硬门槛。

## 发布/部署方式

- 源码先提交到本地 `master`，再部署 Worker、Platform Admin 与 Platform Console，最后从本地 `master` 推送 `origin/master`。
- Worker 不涉及 D1 schema 变更；部署仍执行远程 migration 检查，预期为 `No migrations to apply`。
- Platform Admin 使用 `pnpm deploy:platform:admin` 发布 Cloudflare Pages；发布后检查自定义域、favicon、静态资产和登录态用户列表真实交互。
- Platform Console 使用 `pnpm deploy:platform:console` 发布 Cloudflare Pages；发布后在用户当前 Chrome 的既有 `platform.nextclaw.io` 标签页刷新，检查 favicon 声明、资源响应和标签页效果。
- 实际部署：Worker version `4b89d7e4-827f-4926-9f7c-b5327449e3b8`；Platform Admin Pages `https://e3644c6d.nextclaw-platform-admin.pages.dev`；Platform Console Pages `https://03c177df.nextclaw-platform-console.pages.dev`。

## 用户/产品视角的验收步骤

1. 打开 `https://platform.nextclaw.io/` 与 `https://platform-admin.nextclaw.io/`，确认两个浏览器标签页均显示 NextClaw 图标。
2. 登录管理后台后进入“用户与额度”，确认首屏是只读表格，不再在每行常驻多个输入框与保存/重置按钮。
3. 搜索邮箱、用户名或用户 ID，并切换“全部 / 普通用户 / 管理员”，确认计数、数据和分页同步更新。
4. 点击账号、角色、免费额度、付费余额、注册时间或最近更新时间表头，确认排序方向清晰变化。
5. 切换每页 10、20、50 条并翻页，确认范围摘要和上一页/下一页状态正确。
6. 点击某位用户的“管理额度”，确认对话框展示当前余额快照；取消不产生修改，只有输入有效变更后“确认保存”才可用。

## 可维护性总结汇总

- `post-edit-maintainability-review` 结论：无阻塞 finding；用户列表 owner 从单个 496 行旧页面拆为 feature page、列表 section、toolbar、table、pagination、dialog、provider 与 types，基础表格能力进入 `shared/components`。
- Worker 保持 controller -> repository 单一路径，动态排序列来自固定白名单，搜索值和角色值全部参数化，不存在把用户输入拼入 SQL 排序表达式的路径。
- 正向减债动作：删除旧 496 行额度表格页和每行常驻编辑状态；编辑交互按需实例化，浏览表格不再为每位用户维护两份 draft。
- 治理学习闭环覆盖四层：`AGENTS.md` 常驻阶段门、delivery/naming skill 自动触发、统一 preflight 可执行入口、文件角色与模块结构单元测试；后置 governance 继续验证真实 diff 与源码级规则。
- 两个治理检查 owner 已接近 500 行软预算但仍未越界；若继续扩展 planned-path 之外的更多模式，应优先抽取共享 preflight 支撑模块，不继续膨胀主检查文件。

## NPM 包发布记录

不涉及 NPM 包发布。Platform Admin 与 Worker 均为私有部署目标，治理机制为仓库内部开发流程，本轮不添加 `.changeset`。
