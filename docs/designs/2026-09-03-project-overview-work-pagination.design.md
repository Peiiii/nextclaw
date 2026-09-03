# 项目概览双核心区域与工作项分页设计

> 状态：Implemented and Verified
>
> 日期：2026-09-03
>
> 上位设计：[项目工作项设计](2026-08-31-project-work-items.design.md)
>
> 产品愿景：[NextClaw 产品愿景](../VISION.md)

`design-document: required`

`plan: not-required`

## 1. 问题与目标

Project 是用户持续理解和推进一个项目的统一入口，不是单一的工作项管理器。当前原生 Work Item 上线后，Overview 只显示工作项统计与最近工作项，最近产物从概览消失；Work API、Kernel Store 和 UI 又一次性读取并渲染全部工作项。结果同时破坏了项目主页的信息完整性和数据规模边界。

本次修复必须让用户进入项目后同时看到：

1. 当前正在推进的工作；
2. 最近形成或关联的产物；
3. 可持续增长、可按状态浏览的工作项集合。

## 2. 用户可见信息架构

### 2.1 Overview

Overview 顶部保留工作项统计。统计下方固定为两个同权核心区域：

```text
宽布局
┌──────────────────────┬──────────────────────┐
│ 当前工作             │ 最近产物             │
│ 最近更新的工作项     │ 最近关联的项目文件   │
└──────────────────────┴──────────────────────┘

窄布局
┌─────────────────────────────────────────────┐
│ 当前工作                                    │
├─────────────────────────────────────────────┤
│ 最近产物                                    │
└─────────────────────────────────────────────┘
```

- 宽布局使用等宽两列，不按内容数量或产品优先级改变列宽；
- 窄布局才上下堆叠，区域顺序为当前工作、最近产物；
- 两区都有独立 loading、error 和 empty 状态，一个区域失败不能抹掉另一个区域；
- 当前工作最多显示 5 条最近更新记录；最近产物最多显示 5 个去重后的显式 ArtifactLink；
- 点击工作项打开统一详情 Drawer；点击产物使用现有项目文件预览入口。

最近产物只查询 Project Work Store 已显式关联的路径，不扫描目录、Session、Marker 或消息历史。相同路径关联到多个工作项时，Overview 只显示最近一次关联，并附带来源工作项标题。

### 2.2 Work

Work 默认使用按自定义状态分组的列表。每个组：

- 显示状态名和服务端总数；
- 支持展开与折叠；
- 独立加载首批 20 条；
- 独立使用“加载更多”继续读取下一游标；
- 空状态组保持可见，便于理解完整工作流；
- 列表和看板复用同一个状态组查询与卡片，不各自维护数据副本。

列表视图使用纵向折叠组；看板视图将同一组投影为横向列。切换视图不改变查询、排序、已加载页和详情入口。

分组的展示顺序与状态配置顺序分开处理：

- 列表优先帮助用户继续推进工作，按“越接近完成的活跃状态越靠前”排列，再展示未开始、Backlog、已完成和已取消；同一类别内按工作流位置从后向前排列；
- 看板表达完整工作流，保持状态配置中的从前到后顺序；
- 状态设置继续按配置顺序展示和调整，不把列表的关注顺序回写为领域状态顺序。

每个分组的服务端总数使用紧邻状态名的常驻数字徽标表达，展开、折叠和空组均不隐藏。看板在桌面使用统一的可用工作区高度，所有列等高，卡片内容在各列内部独立纵向滚动；横向滚动仍由看板容器负责。矮窗口允许页面滚动兜底，避免固定高度截断工具栏或内容。

参考依据：Linear 的 [Display options](https://linear.app/docs/display-options) 明确规定列表按状态排序时优先展示最接近完成的工作、组头展示总数；[Board layout](https://linear.app/docs/board-layout) 则保持状态从工作流首端到末端排列并由看板承担横向浏览。NextClaw 复用这些已验证的信息层级，但看板高度与滚动 owner 按本项目页壳的真实空间约束落地，不机械复制外观。

### 2.3 状态视觉语义

分组标题不能只靠文字表达流程位置。状态名左侧固定显示一枚紧凑状态图标，复用已有 `category + position`，不新增后端颜色字段：

- Backlog：中性点状环，表达尚未进入计划；
- Unstarted：中性空环，表达已计划但尚未开始；
- Started：按同类别状态在工作流中的相对位置逐步填充圆环，默认三个阶段对应 25% / 50% / 75%，并使用黄 / 橙 / 绿递进；
- Completed：绿色勾选圆，表达流程终态成功；
- Canceled：中性叉号圆，表达流程终止但非成功。

图标、填充比例和颜色共同编码，不能只依赖颜色。颜色只落在 16px 图标上，不染标题文字、整行背景或数量徽标，避免高饱和视觉污染。折叠、展开、列表和看板使用同一投影；自定义 Started 状态根据其类别内顺序自动获得相对进度，无需按名称硬编码。

参考依据：Linear 的 [Issue status](https://linear.app/docs/configuring-workflows) 将状态组织为 Backlog、Unstarted、Started、Completed、Canceled 固定类别，并允许 Started 内存在 In Progress、In Review、Ready to Merge 等递进阶段；其公开界面使用点状环、空环、递进圆环和终态图形提升扫描效率。NextClaw 采用相同语义原则，但使用更克制的无底色图标以适配当前页面密度。

## 3. 数据与 owner

### 3.1 Work Item 分页

`ProjectWorkManager` 继续是 Work Item 唯一 owner。列表公共合同调整为：

```ts
type ProjectWorkListInput = {
  stateId?: string;
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
};

type ProjectWorkItemPage = {
  items: ProjectWorkItemListEntry[];
  nextCursor: string | null;
  total: number;
};
```

- 默认 `limit=20`，最大 `100`；
- cursor 对调用方 opaque，内部编码 `(updatedAt, id)`；
- 排序固定为 `updatedAt DESC, id DESC`，相同时间仍稳定；
- `total` 是同一 `projectId/stateId/includeDeleted` 条件下的服务端计数；
- 非法 cursor、limit 或跨 Project stateId 显式失败；
- 列表项包含 `artifactCount`，不读取完整 Artifact 数组；完整关系只由详情查询返回。

Summary 使用独立 SQL 聚合，不再通过全量 `list()` 计算。

### 3.2 最近产物

新增有界只读投影：

```ts
type ProjectRecentArtifact = {
  id: string;
  path: string;
  label: string | null;
  workItemId: string;
  workItemTitle: string;
  createdAt: string;
  exists: boolean;
};

type ProjectRecentArtifactPage = {
  artifacts: ProjectRecentArtifact[];
  nextCursor: string | null;
  total: number;
};
```

Store 按路径去重，保留每个路径最新的 ArtifactLink，再按 `(createdAt, id)` 游标分页。Manager 只对返回页中的已知相对路径检查文件存在性，不做目录发现。HTTP 使用 `GET /api/projects/:projectId/work/artifacts`，SDK 和 UI 直接复用同一合同。

## 4. 查询与刷新

```text
Overview 当前工作 ──► GET /work?limit=5
Overview 最近产物 ──► GET /work/artifacts?limit=5
Work 状态目录 ─────► GET /work/states
每个状态组 ────────► GET /work?stateId=...&limit=20&cursor=...
```

TanStack Query 保存各状态组的独立 infinite-query cache。`project.work.changed` 只负责 invalidate Work、Summary、Artifact 和命中详情查询；UI 不重放事件，也不维护第二份领域状态。

## 5. 失败与恢复

- cursor 不合法：返回稳定校验错误，不回退到第一页；
- 状态被删除：对应查询失效，状态目录刷新后组自然退出；
- 工作项换状态：新旧状态组同时失效并重新查询；
- 产物文件后来缺失：仍展示关联记录并标记不可用，不删除历史关系；
- 某一区域请求失败：在区域内部显示错误，另一核心区域仍可使用；
- mutation 成功后：刷新 Summary、所有 Work 分组、最近产物和命中的详情。

## 6. 不采用的方案

- **传统页码**：实时插入和状态迁移会造成跨页重复或遗漏，不适合作为列表/看板共同模型；
- **前端伪分页**：仍会全量读取数据库、传输和渲染，不能解决规模问题；
- **一个全局 cursor 再前端分组**：大状态组会挤占其它状态，无法显示各组真实总数；
- **概览重新读取 Observation**：会恢复目录和 Session 扫描，使 Work Item 变化拖慢项目首屏；
- **自动发现最近文件**：文件最近修改不等于项目产物，会制造无证据事实。

## 7. 验收契约

- contract-id：`project-overview-work-pagination-v1`
- parent-goal：项目主页同时呈现当前工作与最近产物，并让工作项在持续增长时仍可按状态稳定浏览。
- scope-revision：1
- scope-confirmation：user-confirmed

| ID    | Required | 合同                                                       | Status | 当前证据                                              |
| ----- | -------- | ---------------------------------------------------------- | ------ | ----------------------------------------------------- |
| AC-01 | true     | 宽布局两个核心区域等宽左右排列，窄布局上下堆叠             | passed | 真实页面 1440px 等宽 520px；800px 同宽 416px 上下排列 |
| AC-02 | true     | 工作项按状态分组、可折叠，组名旁常驻显示服务端总数         | passed | 组件测试；真实页面折叠后仍显示 4，空组显示 0          |
| AC-03 | true     | Work API/Store 使用有界 opaque cursor                      | passed | Kernel/Server/SDK 测试与隔离实例两页回放              |
| AC-04 | true     | 每个状态组独立继续加载                                     | passed | hook/组件测试；真实页面 20/23 → 23/23                 |
| AC-05 | true     | 最近产物使用独立轻量查询且不扫描 Observation               | passed | Query Store SQL、API 与真实产物存在性验证             |
| AC-06 | true     | 宽/窄、空、错误、刷新、超过一页均有证据                    | passed | UI 状态测试、事件刷新测试与浏览器终态                 |
| AC-07 | true     | 匹配范围 tsc、测试、真实页面与 maintainability review 通过 | passed | 6 包 tsc、32 个定向用例、真实页面、review 0 error     |
| AC-08 | true     | 列表优先活跃近完成状态；看板保持工作流顺序                 | passed | 排序单测；真实列表/看板顺序                           |
| AC-09 | true     | 看板列等高并在稳定工作区高度内独立滚动                     | passed | 1440×900：看板 628px、列 620px、长列 580/1536px 独立滚动 |
| AC-10 | true     | 状态组以形状、环形进度和克制颜色表达流程语义               | passed | 组件映射测试；真实页面明暗主题列表与看板截图               |

## 8. 验证边界

- Kernel：稳定排序、相同时间 tie-break、状态过滤、deleted 过滤、非法 cursor、limit 上限、Summary 聚合、Artifact 去重与分页；
- Server/SDK：query 透传、错误合同和返回类型；
- UI：分组折叠、组内加载更多、列表/看板共享数据、区域独立状态、点击入口，以及状态图标的类别、进度和颜色映射；
- 真实页面：桌面等宽两列、窄容器堆叠、超过一页后继续加载、产物可打开，以及明暗主题下状态视觉不污染行背景与文字；
- 类型：所有触达的 TypeScript package 运行匹配范围 `tsc`。

## 9. 实现账本

- Kernel：新增查询 Store 与 Query Service，负责状态过滤、服务端计数、opaque cursor、最近产物去重和存在性检查；原 Work Manager 保持公共 owner。
- Server/SDK/CLI/Tool：统一支持 `stateId/cursor/limit/includeDeleted`，新增最近产物只读接口；CLI 使用 cursor 继续读取，不暴露内部游标结构。
- UI：Overview 双核心区域独立请求；Work 按状态创建独立 infinite query，列表与看板共享同一查询和详情入口。
- UI 体验修订：列表使用活跃近完成优先排序；看板保留工作流顺序并使用等高列、列内滚动；所有组头使用常驻数字徽标。
- UI 状态语义：Backlog 使用中性点状环，Planned/Todo 使用无彩中性空环，执行中状态按工作流位置使用 25% / 50% / 75% 的黄、橙、绿进度环，完成与取消使用终态图形；颜色仅限 16px 图标。
- 文档：中英文项目说明与 CLI 命令全集已同步；用户可见变化已添加 changeset。
- 交付边界：实现位于 `codex/project-overview-pagination` 隔离分支，未提交、未推送、未发布。
