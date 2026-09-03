# 项目 SQLite 统一存储

## 迭代完成说明

- 根因：项目注册仍以 `projects.json` 为事实源，而后来新增的项目工作项使用
  `work-items.db`，同一项目能力形成两个持久化入口。服务启动还会先开放 UI/API、再异步
  启动 kernel，导致旧 JSON 迁移完成前的项目列表请求直接读取旧结构并报错。
- 确认方式：核对 VPS 启动日志、项目 API 请求时间、service 启动顺序、
  `ProjectManager`/`ProjectStore` 和 `ProjectWorkStore` 的完整读写链路，确认 SQLite 能力没有
  技术限制，缺口是项目注册从未迁入已有数据库且初始化门不在 store 边界。
- 根因修复：`ProjectStore` 改为 SQLite，并与 `ProjectWorkStore` 共用
  `projects/work-items.db`；所有项目读写都等待同一个初始化 Promise。旧 v1/v2/v3
  `projects.json` 只在首次初始化时事务化导入，成功后由数据库迁移记录永久退出正常链路。
- 数据安全：迁移保留项目 ID、路径、模板、时间和移除状态；v1 仅补齐原本不存在的 ID。
  失败会回滚数据库写入，源 JSON 不删除、不覆盖。

## 测试/验证/验收方式

- `@nextclaw/kernel`、`@nextclaw/service`、`@nextclaw/server` TypeScript 检查通过。
- 相关 9 个测试文件、64 个用例通过，覆盖 v1/v2/v3 迁移、幂等、损坏恢复、并发首次读取、
  项目移除/恢复、同库工作项，以及 UI 在 kernel 启动前请求项目列表的 assembled route。
- 定向 ESLint、`git diff --check`、新代码治理和生成物边界检查通过。
- diff-only maintainability 最终为 0 error、2 warning；warning 是既有 404 行 kernel 文件
  未增长，以及 347 行项目 store 接近预算，均已完成主观复核。

## 发布/部署方式

- 实现与验证在隔离分支 `codex/unify-project-sqlite-storage` 完成，本批次合入并推送
  `origin/master`。
- 本次授权不包含 NPM 发布、runtime channel 更新、VPS 部署或服务重启。

## 用户/产品视角的验收步骤

1. 使用带旧 v1、v2 或 v3 `projects.json` 的用户目录启动新版 NextClaw。
2. 在 kernel 尚处于后台启动阶段时请求项目列表，确认接口等待迁移并返回原有项目。
3. 移除项目后重启，确认项目不会被历史会话或旧 JSON 重新注册；显式重新添加时恢复原 ID。
4. 创建和重启后读取工作项，确认项目注册和工作数据均来自同一个 SQLite 文件。
5. 损坏旧 JSON 时确认启动明确失败且文件原样保留；修复后重启可以重新迁移。

## 可维护性总结汇总

- 项目注册事实仍由 `ProjectStore` 单一 owner 管理，工作项事实仍由 `ProjectWorkStore` 管理；
  两者共享数据库但不双写同一事实，也没有新增 repository/factory/adapter 层。
- 删除了 JSON 保存、全量重写和常态兼容入口；旧格式解析只存在于有迁移记录退出条件的
  一次性边界。
- kernel、CLI 和提前到达的 API 共用同一初始化语义，状态生命周期比原来更集中。
- 文件与目录治理通过。自动检查的两个非阻塞 warning 已主观复核；当前没有第二个消费者
  能证明拆出迁移抽象会降低全生命周期复杂度。

## NPM 包发布记录

- `@nextclaw/kernel` 与 `@nextclaw/service` 已添加 patch changeset，状态为待统一发布。
- 本次不执行 NPM 包发布；实际版本与发布时间由后续统一发布批次决定。
