# 项目 SQLite 统一存储执行计划

上位设计：[项目 SQLite 统一存储设计](../designs/2026-09-03-project-sqlite-unification.design.md)

## 目标与范围

完成 `PSU-1` 至 `PSU-5`：把项目注册迁移到现有工作项 SQLite 数据库，保留旧 JSON
一次性迁移，并关闭 UI 提前请求可观察到迁移中间态的缺口。不包含 WebSocket 修复、数据库
改名或工作项外键重建。

## 执行部分

### 1. SQLite 项目注册 owner

- Owner：`ProjectStore`
- 输入：现有项目类型、SQLite 公共 store、v1/v2/v3 JSON 格式
- 结果：schema、一次性事务迁移、纯 SQLite CRUD、初始化并发门
- 设计策略：复用上位设计
- 验证：store/manager 定向单测证明 `PSU-1`、`PSU-2`、`PSU-4`、`PSU-5`

### 2. Kernel 对象图与生命周期收敛

- Owner：kernel manager factory 与 `NextclawKernel`
- 输入：同一个数据库路径与旧 JSON 路径
- 结果：两个 store 共用数据库，kernel 显式初始化且所有提前调用仍被 store 门保护
- 设计策略：复用上位设计
- 验证：启动相关测试与并发首次读取测试证明 `PSU-3`

### 3. 收尾验证与 Review

- Owner：development validation/review
- 输入：完整 diff 与验收映射
- 结果：定向测试、kernel TypeScript 编译、diff-only maintainability 检查与 findings 处理
- 设计策略：不新增设计；若发现新的持久化 owner 或迁移分叉，返回上位设计更新
- 交付边界：不提交、不推送、不部署，除非用户另行授权

## 中断恢复

继续时先检查本计划三部分状态与 `git diff`；未完成的最早部分为恢复入口。若迁移测试已
通过但对象图尚未收敛，不得把 JSON/SQLite 双写状态视为可交付中间态。
