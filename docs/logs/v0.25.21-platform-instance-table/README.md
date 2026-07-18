# v0.25.21 Platform 实例表格升级

## 迭代完成说明

本次把 Platform 首页的实例管理从“当前实例表 + 独立归档列表”的临时形态，升级为单一、可扩展的数据表格。归档不再是第二套列表，而是与当前、全部并列的状态筛选；实例查询由 Worker 负责分页、搜索、连接状态过滤和排序，前端只持有明确的查询条件与当前页。

新增的共享 `DataTable` 负责列宽、固定列、表头排序、空态、加载态和分页骨架，业务页面只提供列定义与查询行为。实例表默认固定名称列和操作列，桌面端横向滚动时仍能看清对象与操作；390px 移动端自动取消固定操作列，避免遮挡正文。操作区收敛为紧凑按钮，分享授权在选中实例后按需展开，不再长期占用页面宽度。

后端将实例 CRUD 与分页查询收敛到 `remote-instance.repository.ts`，查询支持：

- `archiveStatus=active|archived|all`
- `connectionStatus=online|offline|all`
- 名称、实例 ID、安装 ID、平台与版本模糊搜索
- `lastSeenAt`、`displayName`、`createdAt` 排序
- 1–100 的服务端分页，并返回 `total` 与 `totalPages`
- 兼容旧 `includeArchived=true` 查询语义，但新前端只走统一查询合同

## 测试/验证/验收方式

- `pnpm -C apps/platform-console tsc`：通过。
- `pnpm -C apps/platform-console lint`：通过，0 warning。
- `pnpm -C apps/platform-console build`：通过，Vite production build 成功。
- `pnpm -C workers/nextclaw-provider-gateway-api tsc`：通过。
- `pnpm -C workers/nextclaw-provider-gateway-api lint`：通过，0 warning。
- `pnpm -C workers/nextclaw-provider-gateway-api test:remote-instances`：通过；基于内存 SQLite 验证 13 条当前实例分页、归档筛选、在线状态过滤、转义后的 `%` 字面搜索、名称排序和用户隔离。
- `PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4174 pnpm smoke:platform:console`：通过；浏览器级覆盖 12 条数据翻页、归档快捷筛选、搜索/重置、固定操作列、390px 响应式布局，以及归档、恢复、永久删除、远程打开等完整交互。
- `pnpm lint:maintainability:guard`：通过；0 error / 3 个既有 warning。
- 生产 Chrome 实机验收：通过；复用用户已打开的 `https://platform.nextclaw.io/` 标签页，确认生产资源为 `index-Dd4ZroVW.js` / `index-CuzbcEKC.css`，当前实例 24 条、归档实例 11 条，第二页显示第 11–20 条，归档筛选回到第 1 页且只显示恢复/删除操作。表格 5 个表头均为 sticky，当前页 10 个操作单元格均固定，表格容器为横向自动滚动且页面本身无横向溢出。
- 组合发布回归验收：通过；复用用户已打开的远程访问标签页，刷新后 Panel App 仍加载签名 `styles.css` 与 `app.js`，正文背景为 `rgb(10, 14, 39)`，标题字号 20px / 字重 700，并渲染 2 个 ECharts canvas。Platform 与远程页面均无页面自身的浏览器错误；日志中的 warning/error 全部来自浏览器扩展注入脚本。

## 发布/部署方式

已发布 `nextclaw-provider-gateway-api` Worker 与 `nextclaw-platform-console` Pages：

- Worker Version ID：`c6c7315e-0112-4564-8701-54f9dad61815`
- Pages 部署地址：`https://2ced78fd.nextclaw-platform-console.pages.dev`
- 生产域名：`https://platform.nextclaw.io/`
- 数据库列与索引未变化，不需要 migration。
- 平台管理后台未变化，未重复部署。
- Worker 发布分支已合并远程 Panel App 资源修复，生产远程访问回归验收通过。

## 用户/产品视角的验收步骤

1. 打开 `https://platform.nextclaw.io`，确认首页内容宽度受控，实例管理为一张统一表格。
2. 使用“当前 / 已归档 / 全部”快捷筛选，确认归档实例不再出现在额外列表中。
3. 按名称、ID、平台或版本搜索，并使用连接状态过滤；确认分页汇总与每页数量同步更新。
4. 点击名称或最近在线时间表头，确认服务端排序变化；横向滚动时名称和操作列保持可见。
5. 验证在线实例可打开远程入口，离线实例有明确禁用提示；归档实例只显示恢复和删除操作。
6. 在窄屏下确认表格可以横向滚动，操作列不覆盖中间字段。

## 可维护性总结汇总

本次是新增用户能力，允许生产语义代码净增长。收尾守卫统计总代码 `+1731/-937`、净增 794 行，排除测试后 `+1598/-937`、净增 661 行。正向减债包括：删除 470 行首页内联实例表/归档表/分享面板实现，删除 169 行旧复合 hook；把 Worker 的实例职责从综合 `remote.repository.ts` 拆到独立 repository；把冒烟入口从 491 行降到 387 行，并把实例 fixtures、路由与验收放入对应测试域；把命令闭包收敛为显式 `RemoteInstanceActionsManager`。共享表格、查询 hook、命令 manager 和业务组合组件均保持单一 owner，没有新增第二套实例列表。

守卫的 3 个 warning 均为既有债务：`scripts/smoke` 根目录有已记录例外，远程 relay/controller 接近既有文件预算；本次没有增加这两个 Controller 的行数。

## NPM 包发布记录

- NPM 包：不涉及。Platform Console 与 Worker 都是私有部署型应用，不添加 changeset，不执行 NPM publish。
- GitHub release / Desktop release：不涉及。
