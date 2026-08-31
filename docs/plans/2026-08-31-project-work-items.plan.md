# 项目工作项能力执行计划

## 上位设计与目标

- 上位设计：主工作区中的 `docs/designs/2026-08-31-project-work-items.design.md`。
- 目标：让用户在项目会话、项目页和 CLI 中操作同一套持久化工作项；工作项不依赖事件历史扫描，也不向项目目录写入数据。
- 核心 owner：NextClaw kernel 的 `ProjectWorkManager`；SQLite store 只拥有持久化事实，Server、Client、CLI、Agent Tool 和 UI 都调用同一 manager 合同。
- 非目标：run plan / AI 临时 todo、工作项与 run 关联、跨项目工作项、外部任务系统同步、旧 marker 工作项自动导入。

## 验收合同

contract-id: `project-work-items-v1`

| ID     | Required | 可观察验收标准                                                                                                                                                                                      | 证据                                           |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| PWI-01 | yes      | 项目注册后自动拥有默认状态；工作项、状态、活动与 artifact 关联在重启后仍可读取，且项目目录没有新增跟踪文件                                                                                          | kernel manager/store 测试、重启测试、目录断言  |
| PWI-02 | yes      | 项目会话才暴露 `project_work_list/get/create/update`；无项目会话不暴露；写入活动记录包含可信 session 来源                                                                                           | tool provider/tool 测试、session metadata 测试 |
| PWI-03 | yes      | HTTP 与 CLI 复用 kernel owner；CLI 的每个 work 子命令强制 `--project` 且只连接运行中的本地服务，不从 cwd 推断、不创建第二写入者                                                                     | controller/client/CLI 测试、命令树同步检查     |
| PWI-04 | yes      | 项目页 Work 支持创建、浏览、编辑、改状态、attention、删除/恢复、查看历史、关联/解除多个 artifact；状态设置支持 CRUD、排序和迁移；所有展示工作项的入口点击后都打开同一个详情抽屉，不在页面内平铺详情 | UI 组件/hook 测试与真实构建                    |
| PWI-05 | yes      | 每次已提交 mutation 只发布实时变更通知；UI 订阅后失效相应 query；读取不回放事件历史                                                                                                                 | manager event 测试、hook 订阅测试              |
| PWI-06 | yes      | Work 与轻量 Overview 不再依赖完整 observation 扫描；Artifacts、Skills、Agreement 入口保留并按需加载；旧 marker 不再作为 Work 真值                                                                   | page 测试、请求断言                            |
| PWI-07 | yes      | 自定义状态 category 保持固定生命周期语义，任意状态迁移都追加不可变 activity；重复 review/revision 可从时间线看到                                                                                    | manager 状态/活动测试                          |
| PWI-08 | yes      | artifact 路径必须位于项目 root 内且真实存在；同一工作项可关联多个文档并可解除                                                                                                                       | manager 路径边界测试、UI/CLI 测试              |
| PWI-09 | yes      | 中英文用户文档、CLI 能力全集、i18n 与用户可见 changeset 同步                                                                                                                                        | 文档构建/同步测试、changeset 检查              |
| PWI-10 | yes      | 受影响包定向测试、TypeScript 检查、治理检查和 diff-only maintainability review 无阻塞 findings                                                                                                      | 验证与 Review 输出                             |

## 执行顺序

### 1. Kernel 权威模型与持久化

- owner：`packages/nextclaw-kernel/src/features/projects`。
- 输入：稳定 project id、必需 root path、上位设计的数据模型。
- 交付：通用 SQLite driver、四张表、默认状态、CRUD、乐观版本、活动时间线、artifact 边界校验、post-commit event。
- 设计策略：复用上位设计；没有新状态 owner 或持久化分叉时不另建设计。
- 验证：manager/store 定向测试覆盖 PWI-01、PWI-05、PWI-07、PWI-08。

### 2. 会话绑定与条件工具

- owner：SessionManager 与 ProjectToolProvider。
- 输入：project root 到稳定 project id 的规范化绑定。
- 交付：session metadata 同时保存 `project_id` 与 `project_root`；四个通用工具只在项目上下文出现。
- 设计策略：复用上位设计；不引入 run 关系、独立 start/status tool 或隐式 cwd。
- 验证：session 与 tools 测试覆盖 PWI-02。

### 3. Server、Client 与 CLI 单链路

- owner：kernel manager；Server 只做校验/传输，Client 与 CLI 只做入口适配。
- 输入：kernel 公共类型与 manager 方法。
- 交付：REST CRUD、client SDK、CLI `projects work` 子命令。
- 设计策略：复用上位设计；CLI 在线服务不可用时明确失败，不增加 offline fallback。
- 验证：controller/client/command 测试覆盖 PWI-03、PWI-08。

### 4. 项目页体验与实时刷新

- owner：Project Work query/mutation hook 与 Work 组件；组件负责展示和用户输入，不拥有业务状态。
- 输入：client SDK 与 `project.work.changed` 事件。
- 交付：完整工作项和状态设置体验；统一详情抽屉由列表、看板、概览等所有工作项入口复用；Work/Overview 从轻量数据读取，其余既有标签保留并延迟 observation。
- 设计策略：复用上位信息架构；若现有组件暴露新的用户工作流分叉，先回到 Design 更新上位合同。
- 验证：hook、组件、页面测试覆盖 PWI-04、PWI-05、PWI-06。

### 5. 文档、治理、统一验证与 Review

- owner：各 package 文档/测试事实源与 development lifecycle。
- 输入：冻结后的实际命令树和用户行为。
- 交付：中英文说明、changeset、全套定向验证、diff-only maintainability review。
- 设计策略：不新增产品语义；只同步已经实现和验证的事实。
- 验证：PWI-09、PWI-10。

## 中断与恢复

- 恢复入口：先查看本文件验收表和 `git diff --stat`，再从第一个没有验证证据的 PWI 编号继续。
- 每一部分必须在进入下一部分前至少完成定向测试；最终统一运行受影响包 typecheck/test 和治理检查。
- 若实现证据改变唯一 owner、生命周期、API 或用户工作流，停止扩写实现，先更新上位设计和本计划。

## 交付边界

- 本次完成本地代码、测试、文档和 changeset；未经用户授权不 commit、push、建 PR、发布或重启当前 NextClaw 实例。
- Delivery 只报告已实际证明的范围和残余风险；任何未通过的 Required 条目都不得表述为完成。
