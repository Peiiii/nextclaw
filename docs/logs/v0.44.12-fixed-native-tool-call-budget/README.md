# v0.44.12 Native Agent 固定工具调用预算

## 迭代完成说明

- 根因是 2026-08-26 的运行时成本治理首次把休眠的 `agents.defaults.maxToolIterations` 接入 native runtime，而旧实例配置长期保留初始值 `20`；因此同一实例升级到 `nextclaw@0.45.0` 后，没有发生任何用户配置变更，也会在第 21 个工具调用前突然失败。
- 根因由远程实例配置、备份时间线、版本更新时间和两次真实 run 错误共同确认：旧值至少从 2026-02-18 起存在，0.45.0 更新后两分钟内首次出现 `configured maximum 20`，此前版本没有消费该字段。
- 修复没有迁移旧值，也没有增加兼容别名、warning 或 fallback。Core schema 将 defaults/profile 中的旧字段作为未知字段剔除；kernel、server、UI 和 run metadata 删除该合同；native runtime 成为唯一 owner，并固定使用 `1000` 次工具调用预算。
- 这直接修复根因而非隐藏错误提示：旧 JSON 中无论写 `20`、`1000` 或其它值，都不能再进入 run spec 或改变 native runtime 行为。
- 稳定设计见 [Native Agent 固定工具调用预算设计](../../designs/2026-08-29-fixed-native-tool-call-budget.design.md)；原 [运行时成本失控治理设计](../../designs/2026-08-26-runtime-cost-containment.design.md) 已标注被本设计取代的工具预算部分。
- 修复已随 `nextclaw@0.45.3` 发布。发布事故同时暴露 Runtime release 能力面缺口：正式发布后才冷构建四平台产物，父流程又用空 `NEXTCLAW_HOME` 冒充旧版升级，并复用发布前 Registry cache。`0.45.3` NPM 与 Runtime assets 实际发布成功，但 parent workflow 因错误夹具未输出 `NEXTCLAW_STABLE_READY`。
- 自动化根因由 [stable parent run](https://github.com/Peiiii/nextclaw/actions/runs/33258359378) 和 [Runtime child run](https://github.com/Peiiii/nextclaw/actions/runs/33258568765) 的结构化 job timing、失败步骤及公网 manifest 共同确认。长期修复见 [Runtime 发布全自动化设计](../../designs/2026-08-29-runtime-release-automation.design.md)：四平台冷构建前移到 exact-source prepare，stable 正式阶段只 promotion；published validation 自动使用 fresh cache、预置官方上一版 Runtime 并完成真实升级，不再依赖操作者临时命令或轮询推进。

## 测试/验证/验收方式

- Core 配置边界测试 2 项通过：直接 schema 解析和真实 `config.json` loader 均会忽略 defaults/profile 的旧字段；使用完整规范配置的文件不会因这两个字段触发专门迁移或改写。
- Native runtime 定向测试 10 项通过：固定常量为 `1000`，整次 run 共享一个预算，第 1001 个调用不会启动，错误明确标识为固定上限；相关 runtime 回归组累计 23 项通过。
- Kernel request/run-spec 定向测试 12 项通过，证明请求组装与 metadata 不再传递该字段；Agent 配置与详情 UI 定向测试 5 项通过，证明保存载荷和界面均不再暴露入口。
- `@nextclaw/core`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` 的 TypeScript 检查通过；全部触达 TypeScript/脚本文件 targeted ESLint 通过，仅保留 4 个既有大文件 warning，没有新增 lint error。
- diff-only maintainability 检查为 0 error、9 warning，本批总计净删除 30 行、非测试代码净删除 45 行；warning 均为既有文件或目录预算，未被本次恶化。主观 owner/合同复核无 finding。
- `nextclaw@0.45.2 → 0.45.3` 已按真实用户状态完成隔离升级：官方旧 Runtime 预置后，check 返回 `update-available`，download-only 未切换 current pointer，apply 返回 `restart-required`，新进程版本为 `0.45.3`，Portable Service App runner 可执行且 `counter_read` 调用成功。
- 发布自动化定向 Node tests 50 项通过；workflow YAML 通过 `actionlint`，`packages/nextclaw` tsc 和触达 MJS targeted ESLint 通过，skill progressive-loading 与治理检查在本批收尾执行。

## 发布/部署方式

- 修复由 GitHub Actions `release.yml target=product` 自动发布：NPM job 3 分 25 秒，正式 Runtime parent job在 16 分 51 秒后因旧升级夹具失败；四平台 Runtime child 本体成功，用时 14 分 37 秒，其中 Windows Portable Runtime 构建 8 分 35 秒最慢。
- `nextclaw@0.45.3`、GitHub Release 四平台 assets、stable Pages manifests 和中英文 release notes 均已公开；Desktop 不在本次 product release 范围。
- 发布时间预算 `missed`：旧链路在正式阶段冷构建，远超两分钟。自动化改造把这段冷构建前移到 master push 后的 `npm-release-prepare`，正式 Runtime promotion 只下载 exact prepared artifacts、上传 release assets 并切换 stable manifests；workflow 输出 `nextclaw.runtime-promotion/v1` 实测时间和 120 秒预算状态。

## 用户/产品视角的验收步骤

1. 安装或升级到 `nextclaw@0.45.3`，保留旧 `config.json` 里的 `agents.defaults.maxToolIterations: 20`，启动 native Agent 长任务。
2. 确认 Agent 超过 20 次工具调用后继续运行，不出现旧的 `configured maximum 20` 错误。
3. 在配置 API、设置页和 Agent 详情中确认不再显示或返回工具调用上限字段。
4. 用隔离压力测试跨过 1000 次真实工具调用，确认第 1001 个调用不会启动，并产生固定安全预算错误。

## 可维护性总结汇总

- 本批删除从配置 schema 到 runtime 的跨层参数传递，让 native runtime 常量成为唯一事实源；没有新增 adapter、migration、deprecated alias、配置开关或兼容分支。
- 内部命名从不准确的 `tool iteration` 收敛为 `tool call`，预算对象仍复用现有 execution manager 生命周期，没有增加文件或目录跳转。
- 新增仅包括一份配置回归测试、稳定设计、changeset 和本迭代记录；生产代码与 UI 合计显著净删除，代码、分支、函数、文件和目录扩张均未恶化。
- 文件命名与 planned-path governance preflight 通过。自动 guard 的既有预算 warning 已触发主观复核，结论为无可维护性发现。
- 发布自动化复用 existing prepared NPM tree 和 Runtime workflow，没有新增平行 release service、人工 runbook 或 fallback。Actions 是唯一执行 owner；Agent 只做一次 parent dispatch 和最终回执。正式 stable 缺少 exact prepared artifacts 时 fail closed，beta/显式 recovery 才保留冷构建入口。

## NPM 包发布记录

- `@nextclaw/core@0.17.13`：已发布，包含配置 schema 废弃。
- `@nextclaw/kernel@0.12.2`：已发布，包含 run spec、metadata 和配置链路删除。
- `@nextclaw/ncp-agent-runtime-next@0.1.23`：已发布，包含 native runtime 固定工具调用预算。
- `@nextclaw/server@0.20.2`：已发布，包含 API 配置合同删除。
- `@nextclaw/ui@0.22.2`：已发布，包含设置和 Agent 详情入口删除。
- `nextclaw@0.45.3`：已发布并交付本次工具调用预算修复；GitHub Release 为 `nextclaw@0.45.3`，发布验收时 stable Runtime manifests 四个平台均指向 `0.45.3`。后续 `0.45.4` 已正常接替 registry latest，不改变本批交付归属。
- 本次发布自动化改造不改变已发布产品包内容，不新增 changeset；workflow/script/skill 合同在合入远程 `master` 后直接作用于下一次 release-bearing prepare 和 stable release。
