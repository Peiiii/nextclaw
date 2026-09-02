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
6. **Marketplace 分发闭环（NC-165）**：让共享 artifact contract 接受并严格验证 universal WASI Service bundle，补齐 pending/review/catalog/Registry 投影；用真实生成 App 贯通 publish→review→download→空白环境 install→enable→Action 持久调用，并回归非法组合及 panel/native 兼容。
7. **开发体系防复发（NC-165）**：Design 对公开 schema variant 建立 producer 到最终 consumer 的传播矩阵；Validation 用首入口到末端消费的正向证据与关键非法组合反例证明传播完成，不能用分散单测代替。
8. **最终验证与交付**：定向测试→类型检查→真实本地 E2E→diff review→迭代记录/changeset→提交。

## NC-165 active acceptance contract

- contract-id：`NC165-E2E-r1`
- parent-goal：WASI Component App 能通过现有 Marketplace 发布、审核、Registry 安装并在全新环境真实运行，同时开发体系能阻止公开合同只适配局部链路的同类遗漏。
- scope-revision：`2`；用户在 2026-09-02 明确把开发体系完善加入当前目标。

| ID | Required | 合同 | Status |
| --- | --- | --- | --- |
| A1 | true | 合法 universal WASI schema v2 App 通过发布准入并进入 pending/review | passed |
| A2 | true | profile/protocol/distribution/entry/artifact/permissions 组合由正确 owner 严格校验 | passed |
| A3 | true | 审核后能进入现有 catalog/Registry，不能被旧 native-only 目录规则拒绝 | passed |
| A4 | true | Registry 下载结果与已发布 artifact 一致，并能在空白环境安装 | passed |
| A5 | true | 安装后显式 enable，真实 WASI Action 完成持久写读 | passed |
| A6 | true | panel-only 与 native-process 发布、审核和安装合同不回归 | passed |
| A7 | true | 用户文档与 changeset 准确说明 Marketplace WASI 分发能力及边界 | passed |
| A8 | true | Design/Validation skill 对公开合同 variant 的传播与端到端消费形成可执行防线 | passed |

验证证据（2026-09-03）：可维护性重构后从空白 D1/R2 状态重新迁移并启动本地 Worker；个人 App `nc165.github-issue-watcher@0.1.0` 提交后为 pending，审核前 Registry 返回 404，审核为 listed 后可从 v2 catalog 检索并取得 Registry 文档。下载 artifact SHA-256 为 `9a8d74a1435adfc43d519ca89f29900526943f442621fdf76c85e5b317841ab8`，与发布产物逐字节一致；全新 `NEXTCLAW_HOME` 经 CLI 完成 5/5 安装、enable、真实 WASI HTTP 同步 8 条 GitHub Issue、KV 写读，并在 disable/enable 后保持数据。app-runtime 93 项、Marketplace Worker 44 项、CLI 发布/安装相关 14 项测试通过；两侧 tsc、Worker lint/build、中英文文档构建、skill progressive-loading、new-code governance 与 maintainability guard 均通过。

## 恢复入口

原开发闭环工作位于 `codex/wasi-component-app-developer-loop`；NC-165 后续工作位于 `codex/nc-165-wasi-marketplace`。中断后先读取本计划、两份上位设计和 active acceptance contract，再从第一个未满足的 Required ID 继续；禁止跳过真实 Marketplace→Registry→运行 E2E，用分散单测或本地原始目录安装宣称完成。
