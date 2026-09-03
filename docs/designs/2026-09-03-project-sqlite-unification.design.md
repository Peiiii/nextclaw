# 项目 SQLite 统一存储设计

## 背景与问题

项目注册信息当前写入 `projects/projects.json`，项目工作项写入
`projects/work-items.db`。这让同一个项目能力拥有两个持久化入口，并且服务会先开放
UI/API、再异步启动 kernel；旧 JSON 的迁移尚未完成时，`GET /api/projects` 可能直接读取
旧结构并报 `project registry has an unsupported structure`。

这不是 SQLite 的能力限制，而是项目注册在引入工作项数据库时没有一并迁移。

## 验收合同

- `PSU-1`：项目注册与项目工作项共同持久化在现有 `projects/work-items.db` SQLite
  数据库中，正常运行不再读写 `projects.json`。
- `PSU-2`：旧版 v1、v2、v3 `projects.json` 在首次数据库初始化时一次性、事务化、
  幂等迁移；项目 ID、名称、路径、模板、时间与移除状态均保留，v1 仅补齐稳定 ID。
- `PSU-3`：任何项目读取或写入都会等待同一个初始化 Promise；即使 UI 先开放，也不能
  观察到迁移中间态或旧结构错误。
- `PSU-4`：迁移失败必须显式报错并回滚数据库写入，源 JSON 不删除、不覆盖；成功后以
  数据库迁移记录为准，后续启动不再读取 JSON，避免旧数据复活。
- `PSU-5`：项目移除仍只改变注册状态、不删除目录和工作数据；显式重新添加同一路径时
  恢复原项目 ID。

## Owner 与主链路

`ProjectStore` 继续作为项目注册事实的唯一持久化 owner，但实现改为 SQLite。它与
`ProjectWorkStore` 使用同一个数据库文件，各自拥有不同表与不同领域事实，不新增第三层
repository、factory 或双写适配器。

最小完整路径：

1. `ProjectManager` 的首次 `initialize/list/add/remove` 调用进入 `ProjectStore.ensureReady()`。
2. store 打开 `work-items.db` 并建立 `projects` 与 `project_storage_migrations` 表。
3. 若迁移记录不存在，读取并严格解析旧 `projects.json`；在单个 SQLite 事务中插入项目并
   写入迁移记录。
4. 后续所有项目 CRUD 只访问 `projects` 表；`ProjectWorkStore` 继续访问同库的工作项表。
5. kernel 正常启动仍显式等待 `ProjectManager.initialize()`，但早到的 API 请求也由 store
   自身的初始化门保护。

## 数据模型与不变量

`projects` 表保存 `id`、`name`、唯一 `root_path`、可空 `template`、`created_at`、
`updated_at` 与可空 `removed_at`。`removed_at IS NULL` 表示活跃项目。

- 一个规范路径最多对应一个项目身份。
- 移除与恢复只切换 `removed_at`；恢复更新 `updated_at`，不生成新 ID。
- 列表只返回活跃项目，移除项目仍保留以阻止历史会话自动重新注册。
- 初始化并发由单个 Promise 合并；失败后维持失败结果，不暴露半初始化 owner。

## 兼容、失败与退出条件

旧 JSON 是已发布持久数据，因此保留窄范围迁移兼容。触发条件仅为数据库中缺少
`projects-json-to-sqlite-v1` 迁移记录；可观察信号为成功迁移日志；owner 为 `ProjectStore`。
迁移完成即退出兼容路径，运行时不再回退读取 JSON。

源文件成功后暂不自动删除，作为可人工恢复的旧版本备份；它不再是事实源。删除源文件或
重命名数据库不在本次范围，避免把数据格式统一扩大成不必要的文件搬迁风险。

## 候选与取舍

- 选择：让现有 `ProjectStore` 改为 SQLite，并与工作项 store 共用数据库。它保持现有领域
  owner，迁移范围最窄，同时消除 JSON 正常路径。
- 放弃：把项目 CRUD 全塞进 `ProjectWorkStore`。这会把注册和工作流两个领域职责混在一个
  class，并扩大 manager 依赖。
- 放弃：两个数据库文件。虽然都是 SQL，但仍保留跨文件生命周期和备份分裂，不符合统一
  存储目标。
- 延后：给现有工作项表补项目外键。SQLite 对既有表加外键需要重建表，当前故障与数据
  一致性证据不足以承担该迁移风险。

## 验证标准与非目标

测试覆盖空安装、v1/v2/v3 迁移、移除状态、迁移幂等、损坏 JSON 回滚、并发首次读取、
已有工作项数据库升级以及正常 CRUD；再运行 kernel 定向测试和 TypeScript 编译。

本次不修 WebSocket 断连指示器；它是独立的 transport/部署问题，在 SQLite 修复验证完成后
继续处理。
