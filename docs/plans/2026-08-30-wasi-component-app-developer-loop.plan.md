# WASI Component App 与运行环境交付计划

上位设计：

- [WASI Component App 开发闭环](../designs/2026-08-30-wasi-component-app-developer-loop.design.md)
- [Node 与 SQLite 运行合同](../designs/2026-08-30-node-sqlite-runtime-contract.design.md)

## 目标

一次交付“从零开发 Rust/WASI App”和“普通用户可靠安装 NextClaw”两条主链，并让正式发布自动证明它们。非目标是多语言 Guest SDK、自动修改用户工具链和本轮实际发版。

## 执行部分

1. **统一开发环境**：`.nvmrc`、worktree/命令启动脚本和 CI 共用 Node 事实源；验证新工作树自动就绪。
2. **移除原生 SQLite 安装风险**：迁移到 `node:sqlite`、升级 Desktop Electron、删除 native rebuild/copy 路径，并验证旧数据兼容与 Node 合同。
3. **补齐 Guest 开发链**：稳定 WIT/Rust 模板，完成 `create/doctor/build/check/test/dev/call/pack/install/enable`；组件和包检查共享 schema v2 bundle 事实源。
4. **补齐诊断与可观测性**：结构化错误码、Action 全集对账、失败日志和 action 运行指标从 Kernel owner 统一输出。
5. **发布门与文档**：正式 NPM/Runtime HTTP smoke 覆盖生成 Guest、构建、安装、启用、持久调用；中英文用户文档与 CLI 全集同步。
6. **最终验证与交付**：定向测试→类型检查→真实本地 E2E→diff review→迭代记录/changeset→提交。

## 恢复入口

所有工作留在 `codex/wasi-component-app-developer-loop` 隔离分支。中断后先读取本计划和两份上位设计，再从第一个未满足验收的执行部分继续；禁止跳过真实 E2E，用单元测试宣称完成。
