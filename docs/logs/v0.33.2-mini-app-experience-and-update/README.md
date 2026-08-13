# v0.33.2 Mini APP 体验与应用更新修复

## 迭代完成说明

本批把内置 Personal Space 的待办和日历从静态示例提升为可持续维护的 React/Vite Mini APP，并闭合应用市场中影响用户使用的更新、目录准入和宽屏布局问题。

- Personal Space `0.1.4`：待办和日历使用独立 Panel、共享本地 Service 数据 owner，补齐新增、编辑、完成、删除、月历/日程、ICS 来源同步、响应式、暗色、空态、错误态、键盘焦点与失败输入保留。
- 应用更新：生产 Registry 的单应用文档曾被统一 API 响应层包成 `{ ok, data }`，而已发布客户端按 NPM Registry 根文档读取 `name`、`dist-tags` 与 `versions`，因此在解析第一步报 `name 必须是非空字符串`。生产响应与真实操作共同确认根因；修复让该协议端点返回原始 Registry 文档，保留 ETag/CDN 缓存，不在客户端增加双形态 fallback。
- 操作状态：应用卡片原先从全部历史记录中查找第一个“活动或失败”操作；更新成功后会跳过最新成功项，继续显示更早的失败。修复改为先确定该应用最新一次操作，再判断它是否需要展示，成功重试会立即清除历史错误。
- 商城准入：将“可直达安装/更新”和“进入发现目录”拆成两个事实；只有 `published + public + listed + schema v2` 进入商城。旧 schema 与主动下架应用仍保留详情、Registry 和历史安装升级能力。
- Apps Web：统一 `1120px` 内容宽度，目录最多三列，封面固定 `16:9`，详情首屏改为封面与身份信息双栏，避免超宽屏图片失控放大。
- Marketplace skill 发布：发布闭环增加官方源与国内默认源的完整文件路径和 SHA-256 一致性，以及真实旧版本 update 与二次幂等 update 验收。

本次修复针对生产者合同和操作状态选择根因，没有用隐藏错误、清理历史记录或客户端兼容分支掩盖症状。

## 测试/验证/验收方式

- Personal Organizer panels：Vitest、TypeScript、targeted ESLint、双 Panel production build 通过；组合包 `napp validate-publish --mode bundle` 通过且无警告。
- Personal Organizer Service：静态检查、真实 MCP runtime `app dev` 与关键 action `app call` 通过；隔离 `NEXTCLAW_HOME` 宿主内完成待办/日历读写、持久化、重开和 Panel-to-Service Bridge 验收。
- Service dev harness：修复 `app dev/call` 未给未安装 Service 注入数据目录的问题；真实 Personal Space Service 的 19 个 action 全部 `matched`，`todo_list` 通过同一 MCP runtime 返回空列表。临时目录仅属于显式 dev 命令，并在 runtime dispose 后清理。
- UI：应用面板定向测试 6 项、TypeScript、targeted ESLint 通过；新增“旧失败 + 新成功”回归场景。
- 更新真实链路：从运行中的 NextClaw UI 点击“检查更新”，后台 operation `f944e8d7-e467-48c8-a822-0e480e294197` 成功完成 5/5，返回 `changed: false / activeVersion: 0.1.3`，页面显示“已是最新版本”，无 `name` 错误、alert 或 page error。
- Marketplace Worker：Registry root document 合同、公共响应/ETag 缓存、目录准入与发布记录投影定向测试通过；TypeScript、targeted ESLint、build 通过。
- 生产 Worker：部署版本 `0eb17f23-1172-4ee8-93ba-ee23783ce8dc`；`marketplace-api.nextclaw.io` 与 `apps-registry.nextclaw.io` 健康检查、v1/v2 列表和单应用 Registry 文档均通过。
- Apps Web：TypeScript、targeted ESLint、production build 与多视口浏览器截图检查通过；封面资源解码和页面 console 检查通过。
- 自动可维护性检查：本批最终触达范围 0 error、7 warning；告警均为文件接近预算或本批内合理增长，因此已按 skill 条件完成主观复核。

## 发布/部署方式

- Marketplace Worker 的 Registry 响应修复已经先行部署，未执行 migration，避免 `name` 错误继续影响已发布客户端。
- `catalog_visibility` / `manifest_schema_version` migration、Marketplace Worker 完整版本和 Apps Web 在本批源码提交后统一部署并做生产冒烟。
- Personal Space 作为 `nextclaw` 内置应用随 NPM/runtime/desktop stable `0.33.2` 发布；版本包保持单一组合包合同，不单独复制一套远端资源。

## 用户/产品视角的验收步骤

1. 打开 Apps，确认 Personal Space 为启用状态，卡片无历史错误。
2. 点击更多操作 → 检查更新，确认操作在后台执行，结束后显示“已是最新版本”或新版本，不出现 `name` 错误。
3. 打开待办，创建、编辑、完成和删除任务；刷新或重新打开后数据仍在。
4. 打开日历，创建和编辑日程，切换月份与日期；添加 ICS 来源并同步，失败时能看到来源级错误且不会丢失已有数据。
5. 在窄侧栏、宽屏和暗色模式检查待办与日历，无横向溢出、失控大图或遮挡操作。
6. 打开 `apps.nextclaw.io`，确认目录不展示旧协议应用，目录卡片与详情封面在宽屏保持合理尺寸。

## 可维护性总结汇总

Panel 源码采用一个 feature root，todos/calendar 各自拥有 manager、presenter、store 与 components；共享 bridge、类型、基础组件和日期工具位于同一 app 的 shared 边界。构建产物只写入内置应用资源目录，没有另建运行时状态 owner。

Registry 端点使用已有 `ApiResponseFactory` 的原始公共文档分支，缓存和 ETag 仍只有一个实现；客户端操作状态只收紧最新记录选择，没有引入清理器或额外 store。目录上架事实落在 canonical App record 和 D1 字段，不在产品网站维护 slug 黑名单。

自动 guard 对本批最终触达文件报告 0 error、7 warning。主观复核结论如下：Marketplace skill 校验器的增长来自同一次发布一致性校验，不拆成并行 owner；两个治理 support/check 文件只增加生成物边界，维持现有唯一规则 owner；Personal Space Service 已把 ICS 解析独立，后续新增领域动作前再从数据访问边界拆分；Marketplace 两个 repository 仅增加 canonical 目录字段，发布前临时拆分会扩大查询与写入回归面，下一次新增查询或写入语义前分别抽出 query/write seam；Worker main 本批没有继续增长。上述告警均未越过预算，且没有新增重复状态 owner、fallback 或跨包私有导入。

## NPM 包发布记录

- `nextclaw`：需要 patch；当前为 `待统一发布 0.33.2`。原因是内置 Personal Space、UI 嵌入产物和应用更新行为均为用户可见变化。
- `@nextclaw/ui`：需要 patch；当前为 `待统一发布`。原因是应用操作历史失败清除逻辑发生变化，并由 `nextclaw` 嵌入消费。
- `@nextclaw/kernel`：需要 patch；当前为 `待统一发布`。原因是显式 dev harness 可以通过标准 Service App record 向真实 MCP runtime 注入隔离数据目录。
- 其它公共 workspace 包由 stable release 的依赖闭包和自动 changeset 计算确定；发布后在本节回填精确版本、tag、workflow 与真实安装证据。
