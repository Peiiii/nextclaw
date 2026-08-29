# v0.44.12 Native Agent 固定工具调用预算

## 迭代完成说明

- 根因是 2026-08-26 的运行时成本治理首次把休眠的 `agents.defaults.maxToolIterations` 接入 native runtime，而旧实例配置长期保留初始值 `20`；因此同一实例升级到 `nextclaw@0.45.0` 后，没有发生任何用户配置变更，也会在第 21 个工具调用前突然失败。
- 根因由远程实例配置、备份时间线、版本更新时间和两次真实 run 错误共同确认：旧值至少从 2026-02-18 起存在，0.45.0 更新后两分钟内首次出现 `configured maximum 20`，此前版本没有消费该字段。
- 修复没有迁移旧值，也没有增加兼容别名、warning 或 fallback。Core schema 将 defaults/profile 中的旧字段作为未知字段剔除；kernel、server、UI 和 run metadata 删除该合同；native runtime 成为唯一 owner，并固定使用 `1000` 次工具调用预算。
- 这直接修复根因而非隐藏错误提示：旧 JSON 中无论写 `20`、`1000` 或其它值，都不能再进入 run spec 或改变 native runtime 行为。
- 稳定设计见 [Native Agent 固定工具调用预算设计](../../designs/2026-08-29-fixed-native-tool-call-budget.design.md)；原 [运行时成本失控治理设计](../../designs/2026-08-26-runtime-cost-containment.design.md) 已标注被本设计取代的工具预算部分。

## 测试/验证/验收方式

- Core 配置边界测试 2 项通过：直接 schema 解析和真实 `config.json` loader 均会忽略 defaults/profile 的旧字段；使用完整规范配置的文件不会因这两个字段触发专门迁移或改写。
- Native runtime 定向测试 10 项通过：固定常量为 `1000`，整次 run 共享一个预算，第 1001 个调用不会启动，错误明确标识为固定上限；相关 runtime 回归组累计 23 项通过。
- Kernel request/run-spec 定向测试 12 项通过，证明请求组装与 metadata 不再传递该字段；Agent 配置与详情 UI 定向测试 5 项通过，证明保存载荷和界面均不再暴露入口。
- `@nextclaw/core`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` 的 TypeScript 检查通过；全部触达 TypeScript/脚本文件 targeted ESLint 通过，仅保留 4 个既有大文件 warning，没有新增 lint error。
- diff-only maintainability 检查为 0 error、9 warning，本批总计净删除 30 行、非测试代码净删除 45 行；warning 均为既有文件或目录预算，未被本次恶化。主观 owner/合同复核无 finding。
- 未在用户远程安装态复验修后行为，因为本任务只授权修复、验证和提交，未授权发布、部署或重启；同一远程 URL 的最终验收需等待包含本 changeset 的版本部署。

## 发布/部署方式

- 本批形成隔离分支提交并准备 patch changeset；未 push、发布、部署或重启本地/远程 NextClaw。
- 用户远程实例当前仍运行已发布版本，只有后续正常版本发布并部署后才会获得本修复。

## 用户/产品视角的验收步骤

1. 在包含本修复的版本中保留旧 `config.json` 里的 `agents.defaults.maxToolIterations: 20`，启动 native Agent 长任务。
2. 确认 Agent 超过 20 次工具调用后继续运行，不出现旧的 `configured maximum 20` 错误。
3. 在配置 API、设置页和 Agent 详情中确认不再显示或返回工具调用上限字段。
4. 用隔离压力测试跨过 1000 次真实工具调用，确认第 1001 个调用不会启动，并产生固定安全预算错误。

## 可维护性总结汇总

- 本批删除从配置 schema 到 runtime 的跨层参数传递，让 native runtime 常量成为唯一事实源；没有新增 adapter、migration、deprecated alias、配置开关或兼容分支。
- 内部命名从不准确的 `tool iteration` 收敛为 `tool call`，预算对象仍复用现有 execution manager 生命周期，没有增加文件或目录跳转。
- 新增仅包括一份配置回归测试、稳定设计、changeset 和本迭代记录；生产代码与 UI 合计显著净删除，代码、分支、函数、文件和目录扩张均未恶化。
- 文件命名与 planned-path governance preflight 通过。自动 guard 的既有预算 warning 已触发主观复核，结论为无可维护性发现。

## NPM 包发布记录

- `@nextclaw/core@0.17.12`：当前版本已发布；需要 patch 发布以废弃配置 schema 字段，状态为待统一发布。
- `@nextclaw/kernel@0.12.1`：当前版本已发布；需要 patch 发布以删除 run spec、metadata 和配置解析链路，状态为待统一发布。
- `@nextclaw/ncp-agent-runtime-next@0.1.22`：当前版本已发布；需要 patch 发布以固定 native runtime 工具调用预算，状态为待统一发布。
- `@nextclaw/server@0.20.1`：当前版本已发布；需要 patch 发布以删除 API 配置合同，状态为待统一发布。
- `@nextclaw/ui@0.22.1`：当前版本已发布；需要 patch 发布以删除设置和 Agent 详情入口，状态为待统一发布。
- `nextclaw@0.45.2`：当前版本已发布；需要 patch 发布以把上述修复交付给安装态用户，状态为待统一发布。
- 本任务未修改 registry、tag、GitHub Release 或 runtime channel。
