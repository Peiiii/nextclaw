# Spin Action 并发内存优化执行计划

## 上位设计与目标

- 上位设计：[WASI Service App 运行时与现有 Mini App 体系融合设计](../designs/2026-08-28-wasi-service-app-runtime.design.md)
- contract-id：`AC-SPIN-ACTION-MEMORY-2026-08-31`
- parent-goal：修正 NextClaw Spin Action Job 的运行时共享模型，在本地完成可重复的并发内存基准，对照 Native Rust Todo，输出真实边际指标并判断是否达到 `<= 1.5 MiB/并发 Action`（优秀）或 `<= 3 MiB`（可接受）。
- scope-revision：`1`
- scope-confirmation：用户明确同意本地测量，不要求本轮 Linux PSS。

## 范围

本计划修正 `nextclaw-wasmtime-runner` 的 Action Job 生命周期：共享 Tokio Runtime、Spin Engine、FactorsExecutor 和已加载 App/InstancePre；每个 Job 只保留独立 Store、Component instance 与调用上下文。同时建立同机 Native Rust 与 Spin Action 的可重复并发内存基准。

本轮不提交、推送、发布或部署，不重启用户现有 NextClaw 实例。Linux PSS 和三平台发布矩阵仍属于上位设计的发布验证，不阻塞用户明确要求的本地架构判别。

## 整体验收契约

- 必须成立：正式 `start-job` 路径复用同一 Engine、FactorsExecutor 和 App/InstancePre；并发 Job 保持独立 Store、权限、超时、取消和事件状态；同一本地环境输出 Native 与 Spin 的固定基线、1/2/4/8/10 并发峰值、单槽边际和完成后残留。
- 必须不发生：不能通过串行排队伪装十并发；不能复用可变 Store 或跨 Job 泄漏身份；不能破坏 KV、SQLite、AI host call、取消、超时、Resident 或 Provider 语义；不能用 macOS RSS 冒充 Linux PSS。
- 架构不变量：Kernel/runner 协议仍是产品边界；App identity 决定缓存失效；JobContext 归 per-instance state；每个并发 Action 保持独立 Store。
- 代表性场景：简单 Rust Component 连续热调用；1/2/4/8/10 个 Job 在 host-call 屏障处同时存活；两个 SQLite Job 并发写入；一个 AI Job 正常完成、另一个被取消；完成后重复批次不形成无界内存阶梯。
- 交付边界：本地源码、测试、基准脚本、设计/计划和实测报告；commit、push、发布和部署未获授权。
- 真实边界：macOS 没有 Linux `/proc/*/smaps_rollup`，本轮以同进程 warm-relative RSS 和可取得的物理 footprint 作为判别证据；跨 OS 绝对值需后续发布矩阵复验。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- | --- |
| SAM-001 | true | 一个 runner 只拥有一个 Tokio Runtime、Spin Engine 和 FactorsExecutor | passed | `main.rs` 只剩进程级 `new_multi_thread`、`Runner::new` 和 stdin reader thread；完整 smoke 同 PID | — |
| SAM-002 | true | 相同 App identity 的 Component/InstancePre 只加载一次，JobContext 逐实例注入 | passed | `HashMap<String, Arc<LoadedSpinApp>>` 缓存；Factor instance builder 注入 task；`load_uncached` 已删除 | — |
| SAM-003 | true | 十个 Job 在测量窗口真实同时存活且保持独立 Store/调用身份 | passed | 最终基准在十个不同 job/call/trace identity 的 host-call request 全部到达后测峰值，`liveJobsAtPeak=10` | — |
| SAM-004 | true | Job 成功、取消、超时、KV、SQLite、AI host call、Resident/Provider 代表性合同不退化 | passed | Release runner smoke 40 项检查通过，包含共享 runtime_info 回归检查 | — |
| SAM-005 | true | 输出 Native Rust 和 Spin 的同机固定基线及 1/2/4/8/10 并发增量 | passed | `action-job-memory-benchmark.tools.mjs` 最终矩阵，见下方实测结果 | — |
| SAM-006 | true | 100 批热调用不形成无界阶梯，完成后残留有明确测量 | passed | 交付二进制复验：100 批/1000 Job 的 batch 10-100 检查点固定为 57.41 MiB RSS / 43.52 MiB footprint | — |
| SAM-007 | true | 按每并发 Action 增量应用优秀/可接受/重估/失败分级并给出明确结论 | passed | 10 并发 `0.26 MiB/Action` physical footprint，判定 `excellent` | — |
| SAM-008 | true | Rust 构建、适用测试和 diff-only maintainability Review 通过 | passed | Rust 5 项、构建脚本 9 项、最终 diff-only Review 与治理检查通过；0 个 error，仅 2 个临近行数预算 warning | — |

## 阶段图

| 阶段 | 可验收结果 | 进入下一阶段的门 | 状态 |
| --- | --- | --- | --- |
| 基线与合同 | 当前链路反证、同机基线、active ledger | 基准能稳定复现当前成本 | 完成 |
| 共享生命周期实现 | Job 只创建 Store/instance/context | 生命周期统计与功能测试通过 | 完成 |
| 内存收敛 | 运行同一并发矩阵和重复批次 | 获得可重复的 Release 指标 | 完成 |
| 验证与 Review | 合同、构建、测试、指标和可维护性证据闭合 | Required IDs 全部有当前证据 | 完成 |
| 结果交接 | 明确达标等级、差距和下一决策 | 用户获得本地可复验命令与报告 | 完成（本地未提交交接） |

## 执行部分

### 1. 基准与可观察性

- Owner：`apps/nextclaw-wasmtime-runner/tools`
- 设计策略：复用上位设计与本计划内联测量合同。
- 输入：当前 Release runner、portable runtime lab Component、同机 Native Rust fixture。
- 交付：机器可读 JSON，记录 runner identity、环境、warm baseline、并发峰值、settled 值、每槽增量和真实同时存活数量。
- 验证：先在未优化实现上复现高边际成本，防止基准只会报告漂亮数字。

### 2. Spin 共享生命周期修正

- Owner：`apps/nextclaw-wasmtime-runner/src/main.rs`
- 设计策略：使用上位设计 5.6；若 Spin API 无法在 Factor instance builder 注入 JobContext，返回 Design，不复制第二个 executor。
- 输入：单 Runner、per-App cache、per-Job TaskHostContext。
- 交付：删除 Job 路径的 per-thread Runtime、per-Job Runner 和 `load_uncached`，从缓存 App 创建独立 Store/instance。
- 验证：生命周期统计、并发 host-call 屏障、取消/超时和 smoke。

### 3. 内存参数收敛

- Owner：同一 runner Engine 配置。
- 设计策略：只有结构修正仍未达到门槛时才逐项启用；每项保留独立前后证据。
- 候选：pooling allocator、CoW、resident page 归还、async stack/linear memory 上限和能力按需初始化。
- 交付：不牺牲隔离和真实并发的最小边际成本。
- 验证：同一基准矩阵，不更换 Guest 或 workload。

### 4. 验证、Review 与交接

- Owner：runner 定向验证与生命周期 Review。
- 交付：最终 JSON/Markdown 摘要、验收 ledger 更新、是否达标的明确判断。
- Review：确认没有双 executor、跨 Job 可变状态、无界缓存、测试后门或用排队伪装并发。

## 恢复入口

中断后从本文件的 Active acceptance ledger 开始，对照隔离 worktree `codex/spin-action-memory-optimization` 的 `git status`、最新 Release 基准 JSON 和当前未通过 ID。不得从口头总结推断完成，也不得跳过未优化基线直接宣称优化收益。

## 当前阶段门

- 结果：可重复基准必须先证明当前 Job 链路的高成本，并能观察真实 live Job 数。
- 保持项：协议、权限、Store 隔离、取消/超时和现有 runner 不被重启。
- 场景：1/2/4/8/10 同时存活 Job；完成后稳定；同机 Native fixture。
- 本阶段不做：尚不启用 pooling 或缩减 Factor 集合，避免混淆结构收益。
- 待关闭缺口：本地 macOS 物理内存采样方式、并发屏障和当前 Release 基线。

## 本机实测结果

环境：macOS arm64、Rust `1.94.1`、Release runner `43,131,552` bytes、被测 Component `509,328` bytes。macOS 主口径为 `phys_footprint`，同时记录 RSS；它用于同机架构判别，不冒充 Linux PSS。

优化前后使用同一 Component、同一 `agent_start` Action 和同一 host-call 屏障。屏障只在十个不同 Job 均已实例化、进入 Guest 并发出 host-call 后采样，因此不是提交十次后串行排队。

| 并发 | 优化后总增量 RSS | 优化后每 Action RSS | 优化后总增量 footprint | 优化后每 Action footprint |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0.50 MiB | 0.50 MiB | 0.20 MiB | 0.20 MiB |
| 2 | 0.74 MiB | 0.37 MiB | 0.46 MiB | 0.23 MiB |
| 4 | 1.22 MiB | 0.31 MiB | 0.98 MiB | 0.25 MiB |
| 8 | 2.21 MiB | 0.28 MiB | 2.03 MiB | 0.25 MiB |
| 10 | 2.73 MiB | 0.27 MiB | 2.61 MiB | 0.26 MiB |

十并发核心对照：

| 指标 | 优化前 | 优化后 | 变化 |
| --- | ---: | ---: | ---: |
| 每 Action RSS | 16.82 MiB | 0.27 MiB | -98.4% |
| 每 Action physical footprint | 11.36 MiB | 0.26 MiB | -97.7% |
| 十 Action 总增量 RSS | 168.23 MiB | 2.73 MiB | -98.4% |
| 十 Action 总增量 physical footprint | 113.60 MiB | 2.61 MiB | -97.7% |
| 十 Action 完成后 footprint 残留 | 91.22 MiB | 0.58 MiB | 不再保留每 Job Engine/Runtime |

稳定性对照：最小 Native Rust Todo 二进制为 `286,032` bytes，单服务约 `1.30 MiB RSS / 0.92 MiB footprint`，十个独立服务合计 `13.00 / 9.20 MiB`；单服务 1000 次调用增加 `0.03 / 0.03 MiB`。Spin 最终连续 100 批、每批十并发，共 1000 个 Job：第 10、20……100 批稳定值均为 `57.41 MiB RSS / 43.52 MiB footprint`，相对 warm runner 一次性残留 `1.03 / 0.64 MiB`，没有阶梯增长。

判定：按冻结门槛，`0.26 MiB/并发 Action <= 1.5 MiB`，本机结果属于“优秀”。固定 warm runner 仍约 `43-46 MiB physical footprint`，本轮没有优化这部分；本结论只证明用户最关心的活跃 Action 边际成本和增长规律。

复验命令：

```bash
cargo build --release --manifest-path apps/nextclaw-wasmtime-runner/Cargo.toml
node apps/nextclaw-wasmtime-runner/tools/action-job-memory-benchmark.tools.mjs \
  --runner apps/nextclaw-wasmtime-runner/target/release/nextclaw-wasmtime-runner \
  --repeat-batches 100
```

## 被删除的噪声标准

- 没有把 wasm 文件大小作为运行内存代理，因为它不能证明 Store/Engine 的物理驻留。
- 没有把安装 100 个空闲 App 作为本轮门，因为用户明确关心活跃并发边际。
- 没有要求本轮完成 Linux、Windows 和发布验证，因为用户明确授权以本地架构判别为当前范围。
