# Project 移除能力设计

## 背景与用户任务

Project 注册表目前只有创建、登记和读取能力，用户无法从 NextClaw 中移除不再需要的项目。用户应能从 Project 页面明确执行“从项目列表移除”，在理解影响后完成操作，并立即看到该项目从项目入口消失。

Project 注册记录、本地目录、历史会话和 Project Work 是不同事实。移除 Project 不应被误解为删除本地文件，也不应为隐藏一条列表记录而级联销毁历史会话或工作数据。

## 方案比较与结论

### 采用：注册表软移除，显式重新添加时恢复

- `ProjectManager` 继续拥有 Project 生命周期；`ProjectStore` 在 v3 文件中分别持久化活动项目和已移除项目。
- 移除把完整记录从活动集合移动到已移除集合。普通 list/get 只返回活动项目。
- kernel 启动导入历史会话目录时，已移除根目录保持已移除，不会自动复活。
- 用户显式创建、添加或重新绑定同一目录时，恢复原 Project ID 和已有 Project Work，并更新时间；显式操作是唯一恢复入口。
- 本地目录、目录内容、历史会话及 Project Work 均不删除。

该方案让删除结果稳定、可恢复且不产生跨存储的部分级联失败。

### 不采用：级联删除目录、会话或 Project Work

这会放大不可逆数据损失，并要求跨 JSON 注册表、session journal、SQLite 和文件系统做无法原子完成的事务；不符合用户仅想移除 Project 的直接意图。

### 不采用：只从活动数组删除

历史会话会在下次 kernel 启动时重新导入同一目录，造成“删除后又出现”；新 Project ID 还会让保留的 Project Work 失联。

## Owner 与主链路

```text
Project 页面 / nextclaw projects remove
  -> DELETE /api/projects/:projectId + confirmProjectId
  -> client SDK
  -> ProjectManager.removeProject
  -> ProjectStore active -> removed
  -> projects query 失效 / CLI 输出结果

显式 add existing / create / session set-project 同一路径
  -> ProjectManager upsert
  -> ProjectStore restoreByRootPath
  -> 恢复同一 Project ID 与 Project Work
```

唯一事实 owner 是 kernel `ProjectManager`，持久化细节归 `ProjectStore`。server、client SDK、UI 和 CLI 只适配同一合同，不新增缓存或平行状态。

## 持久化与兼容

- 注册表版本从 v2 升为 v3，结构为活动 `projects` 与 `removedProjects`。
- v1 仍先补稳定 ID，v2 迁移到 v3 时 `removedProjects` 为空；迁移保持显式启动动作，list 仍是纯读。
- 移除和恢复都沿用临时文件加 rename 的原子替换。
- 旧运行时不支持 v3，属于随版本升级同步切换的内部本地持久化合同，不维护双写或回退格式。

## 用户交互与失败反馈

- Project 页面标题区提供“从项目列表移除”按钮，名称直接说明影响范围。
- 点击后显示危险操作二次确认，正文明确：本地目录、历史会话和 Project Work 不删除；历史会话仍可在会话列表使用；重新添加同一目录会恢复原项目。
- 确认按钮为危险色“移除项目”；取消不产生请求。
- 成功后刷新唯一 projects query、提示成功并导航到 `/projects`；失败时保留当前页面并显示错误。
- HTTP 与 CLI 还必须收到精确匹配的 `confirmProjectId` / `--confirm <project-id>`，不能只依赖前端确认。

## CLI 与文档合同

新增 `nextclaw projects remove <project-id> --confirm <project-id> [--json]`。使用 `remove` 而非 `delete`，与“保留目录、会话和工作数据”的产品语义一致。同步维护中英文命令全集、两份自管理 USAGE 资源和 `nextclaw-self-manage` skill。

## 功能地图

| 场景         | 可见行为                           | owner                           | 返回/失败                |
| ------------ | ---------------------------------- | ------------------------------- | ------------------------ |
| 打开 Project | 标题区可见“从项目列表移除”         | UI 页面                         | 无项目时不显示动作       |
| 点击移除     | 展示完整影响说明与取消/移除        | ConfirmDialog                   | 取消后保持原状           |
| 确认成功     | 项目消失、提示成功、返回项目选择态 | ProjectManager + projects query | 不删除目录/会话/工作数据 |
| 请求失败     | 项目仍可见，显示错误               | ProjectManager / UI mutation    | 可再次尝试               |
| 重启         | 已移除项目不因历史会话恢复         | ProjectStore + startup import   | 历史会话仍在时间视图     |
| 显式重新添加 | 恢复同一 ID 和原 Project Work      | ProjectManager                  | 目录无效时显式失败       |

## Active acceptance contract

- contract-id：`project-deletion-v1`
- parent-goal：用户可安全、明确地从 NextClaw 移除 Project，并在验证后交付到主干。
- scope-revision：1（用户补充要求名称清晰并二次确认）

| ID   | Required | 合同                                                             | Status  | 当前证据                |
| ---- | -------- | ---------------------------------------------------------------- | ------- | ----------------------- |
| PD-1 | true     | UI 提供清晰命名的移除入口及影响完整的二次确认                    | passed  | 页面组件测试覆盖入口、确认、取消与失败保留 |
| PD-2 | true     | 精确确认后项目从活动 registry/API/UI 消失，失败不产生假删除      | passed  | kernel、HTTP、SDK 与 UI 定向测试通过       |
| PD-3 | true     | 本地目录、历史会话与 Project Work 不删除，启动导入不自动复活项目 | passed  | manager 测试与跨进程 CLI 冒烟通过          |
| PD-4 | true     | 显式重新添加同一路径恢复同一 Project ID                          | passed  | manager 测试及 CLI 冷启动恢复同 ID         |
| PD-5 | true     | CLI 复用 kernel owner 并要求精确 Project ID 确认                 | passed  | CLI 注册测试、错误确认与真实命令冒烟通过   |
| PD-6 | true     | 中英文用户文档、自管理资源和 changeset 与真实合同同步            | passed  | 命令全集同步测试和构建资源同步通过          |
| PD-7 | true     | 触达包的定向测试、TypeScript 编译与维护性审查通过                | passed  | 53 项定向测试、六包 tsc、lint 与 diff-only Review 通过 |
| PD-8 | true     | 已提交分支由主线协调流程合入并推送 `origin/master`               | not-run | 用户已授权，待 Delivery |

## 非目标

- 不删除或移动 Project 本地目录及其中任何文件。
- 不删除、改写或批量解绑历史会话。
- 不新增项目归档、重命名、权限或远程同步模型。
- 不为移除能力新增独立 service、adapter 或前端 store。

## 最小验证

- v1/v2 注册表迁移、移除、重启导入抑制、显式恢复同 ID 的 kernel 测试。
- HTTP 确认校验与状态码、client SDK 请求、CLI 精确确认测试。
- UI 入口、确认/取消、成功导航、失败保留的组件测试，并检查实际 DOM 的按钮语义与可访问名称。
- 触达 TypeScript packages 的 `tsc`、定向测试、文档同步检查和 diff-only maintainability guard。
