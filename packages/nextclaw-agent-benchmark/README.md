# Agent 真实任务基准

私有 workspace package，不发布到 NPM，不被产品运行时依赖。用途是用固定的小型真实任务追踪 NextClaw 的缓存、token、成本和耗时，并与官方 DeepSeek Harness 在同模型下对照。

## 运行与查看

五阶段累计实验使用同一 worker / fixture / 用量 owner，不与历史报告拼接。进入本包目录运行：

```sh
pnpm exec tsx --conditions=development --tsconfig ../../scripts/dev/dev-runtime.tsconfig.json src/diagnostics/staged-study.manager.mjs /absolute/new-result-dir /absolute/dsh-sdk-dir --dry-run
# 核对固定 21 样本、2048 输出上限与 USD 0.25 总预算后，去掉 --dry-run 执行。
```

首次将当前源码与 HEAD 的原始内容冻结到 manifest 和独立临时副本，只在副本按 S0–S5 恢复累计改动。未知产品修改会在付费前拒绝分类。manifest 保留源码、基线 SHA、阶段分组与指纹；复跑使用新结果目录，同目录只续跑未完成样本，不选择性重跑失败。临时副本是本机运行依赖，重现前须保留它；manifest 中的完整源码可供归档核查。报告 changes 包含相邻阶段与原版的绝对及相对变化。短任务未触发压缩时，不推断压缩收益；重复次数为一，不输出统计显著性。密钥只传子进程环境，不写入报告。

前提：仓库依赖已安装，Python 3 可用，`~/.nextclaw/config.json` 已配置官方 DeepSeek。模型固定为 `deepseek-v4-flash`，实际思考模式须为 enabled/high；观察器在发出请求前核对条件。

DSH 是可选外部工具，不加入 workspace 依赖树。只需首次安装一次：

```sh
npm install --prefix ~/.nextclaw/benchmarks/deepseek-harness --ignore-scripts @deepseek-ai/dsh-sdk-client@0.1.2-rc.1
```

在仓库根目录：

```sh
pnpm benchmark:cache list
pnpm benchmark:cache run --dry-run
pnpm benchmark:cache run
pnpm benchmark:cache show /path/to/report.json
pnpm benchmark:cache compare /path/to/before/report.json /path/to/after/report.json
pnpm benchmark:cache run --baseline /path/to/before/report.json
```

`list`、`show`、`compare`、`--dry-run` 不请求模型。默认真实运行三项任务 × 两个 harness，共享 USD 0.05 预算及 48 次请求上限，每项任务 120 秒超时。预算按请求前保守预留、usage 到达后结算；缺失 usage 不释放预留。默认结果写入 `~/.nextclaw/benchmarks/results/<UTC 时间>/`，也可用 `--output <新目录>` 指定；已有预算文件不会被覆盖。`--dsh-sdk-dir` 指向已有独立 SDK 安装目录，`--home` 选择凭据来源。凭据仅通过环境传入隔离子进程，报告与配置不保存 key。

`--tasks files,config` 用于较小的诊断子集。任务子集会改变报告的条件指纹，不能直接与完整三任务基准比较。历史五文件 smoke 保留在 `pnpm smoke:prompt-cache --transport task-suite`，通过本 package 的公共入口运行；它的旧黄金值与三任务黄金值不是同一口径。

## 指标与判定

成本验收目标：同批双方全部任务通过且用量完整时，NextClaw 总估算费用不超过 DSH 的 105%。报告分别记录 `executionPassed` 与 `costParity`，运行成功但成本超标仍以失败退出。5% 是项目优化目标，不是统计置信区间；保留每项任务和全部失败成本，不通过更换任务或预热空转达标。

环境合同为 `clean-home-v1`：每个任务的两边分别使用全新的系统 HOME、NextClaw/DSH 数据目录、XDG 配置/缓存目录及工作目录，只共享指定任务输入与供应商凭据。保留各自内置工具和内置 skills，不加载用户安装的全局 skills、历史或项目规则。worker 在请求前核对真实路径（兼容 macOS 临时目录软链接）及空全局技能目录。仅隔离 `NEXTCLAW_HOME` 不足以屏蔽 `~/.agents/skills`；早期继承系统 HOME 的报告不能与此版本直接做回归比较。

核心指标：固定任务集中 **全部缓存输入 token / 全部输入 token**，包含首次请求，按 token 加权。任何任务失败、重复、缺失或用量不完整时，核心分数标记不可判定，不能只统计成功任务或挑选最后一次调用。

报告同时保存：完成任务数、总输入/缓存输入/未缓存输入/输出/思考/总 token、API 调用次数、估算费用、任务总耗时、启动耗时、模型请求耗时、结束原因、逐项验收、代码 revision/脏状态/源码指纹、DSH SDK 版本、任务版本与提示指纹。输出 token 已包含思考 token，不能再次相加。费用为带日期的供应商价格 × 原始 usage，区别于账单实扣。

`report.md` 是可读总览，`report.json` 是版本化数据合同，`cases/*/case.json` 与 `requests.jsonl` 保留逐请求证据。失败与截断样本也保存。默认回归门为同条件核心命中率下降超过 5 个百分点；它是初始工程门槛，不是供应商 SLA。耗时依赖机器与网络，只有同环境、同采集口径时才适合直接比较。不同价格窗口的费用也应结合每次请求的价格看待。

NextClaw 适配器直接运行产品公共 Harness，不在观察器中替换工具参数或增加产品提示。当前 kernel 原生请求采用完整参数按需查询，执行校验保留原 schema；该产品策略进入源码指纹。`installNextclawBenchmarkObserver()` 在载入 kernel 前同时安装观察器与 OpenAI SDK web shim，使流式模型调用和非流式压缩摘要都走同一计量及预算路径。仅捕获流式用量不能声称覆盖任务总费用。

2026-09-08 五阶段统一实验：统一 2048 输出上限，S0–S5 与 DSH 共 21 样本全部通过；原版 / 最终版 / DSH 费用 USD 0.022663784 / 0.008613148 / 0.009656344，缓存命中率 61.99% / 84.08% / 78.92%。相对原版费用低 62.0%，相对 DSH 低 10.8%，实测总费用 USD 0.094429860。短任务没有触发摘要，S4 不支持压缩因果收益结论。旧的 512 上限基线保留历史归档，不拼入本次曲线。数据是一次固定任务集观测，不把数字写死为测试期望。

本地隔离不能清空供应商缓存。报告额外显示各项首请求缓存 token 总和，并把这些 token 改按未命中价计算“首请求全冷估算”；保留其余实际请求，不替代真实成绩，不冒称全冷复测。上述基线 NextClaw 首请求共命中 6912 token，DSH 为 0；全冷敏感性费用为 0.010120476 / 0.009965920 USD，NextClaw 高约 1.6%，仍在 5% 内。缺价格、用量或任务失败时不输出此估算。

## 任务集 v1

此任务集偏短，五文件任务约 7 次模型调用，代码修复约 4–5 次。干净环境的五文件样本中，首轮占 NextClaw 总费用约 51%，因此它适合作为冷启动及工具历史回归诊断，不能将其费用差距外推为持续修复任务的总体差距。代表长任务的主基准仍需覆盖自然的调查、修改、测试和失败修正链路；不通过重复空转提高命中率。

| 任务 | 验收依据 | 每请求输出上限 |
|---|---|---:|
| files v1 | 逐文件发现下一文件、读取五文件、总和与追问正确、文件未变 | 512 |
| config v1 | 配置覆盖与日志交叉诊断正确、追问正确、文件未变 | 512 |
| repair v2 | 源码实际修改、外部 Python 验收通过、测试与 README 未变 | 1024 |

早期 repair v1 使用 512 上限，DSH 触顶后只解释而未修改文件，判为失败。该样本保留；v2 同时调整两边输出预算与任务提示，不能将两版直接当成回归比较。三项是小型回归样本，不是 SWE-bench 或 Terminal-Bench 排行榜成绩，也不是统计上充分的产品总体排名。

## 代码职责与扩展

- `src/app`：CLI、隔离进程编排、前置检查与结果落盘。
- `src/tasks`：固定输入、提示、版本、输出上限和外部验收；不依赖 harness。
- `src/adapters`：NextClaw 公共 Harness 与官方 DSH SDK 的生命周期接入；不计算成本。
- `src/measurement`：原始请求观察、缓存用量、价格、共享预算；不判断任务答案。
- `src/reporting`：完整性门、加权汇总、报告与历史对比；不发出 API 请求。
- `src/diagnostics`：旧固定前缀/五文件诊断的兼容实现。

内部跨目录导入使用 Node 原生 `#benchmark/` imports，外部消费者只使用 package 根入口。API 调用只允许隔离 worker 中的官方 Flash 路由。JSON 结构由 schema 版本区分；任务输入、验收或输出预算发生语义变化时升级任务版本。新增 harness 只实现 `start/run/close` 接入并记录真实版本，不能复制任务或费用计算。没有当前消费者前不建立通用插件注册框架、数据库或后台调度。

## 维护验证

```sh
pnpm -C packages/nextclaw-agent-benchmark test
pnpm -C packages/nextclaw-agent-benchmark lint
pnpm benchmark:cache run --dry-run
```

单元测试不花模型费用，验证分母口径、失败门、版本不可比、预算和修复验收。改变真实请求、工具历史、SDK 接入或用量采集时，另外执行有预算的对应真实任务；不得用 mock 分数替代真实结果。不要把大样本高成本任务加入默认集合，先通过显式子集试验确认成本与信息增量。
