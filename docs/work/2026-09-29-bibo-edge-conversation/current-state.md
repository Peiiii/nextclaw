# 当前执行状态

## 身份与入口

- 交付：Bibo 零容器普通对话与 NextClaw 可移植对话架构；状态：进行中；最近核对：2026-09-29。
- 验收以 [`BIBO-EDGE-2026-09-29`](acceptance-contract.md) 为准；设计见[整体架构草案](../../designs/2026-09-28-bibo-personal-space-persistence-and-latency.design.md)，过程与数字见[迭代日志](../../logs/2026-09-29-bibo-edge-conversation/README.md)。
- 用户已授权完成代码、主干集成及上线；生产迁移和性能证据未过门前不切换旧用户状态 owner。

## 执行现场

- 本任务工作区：`/Users/peiwang/.codex/worktrees/bibo-reply-latency/nextbot`，分支 `codex/bibo-reply-latency`，当前提交 `e4d03fad7`。`148f0c124` 的合同与日志提交已合并新远程主干 `ca02c2a1c`，但本分支尚未推送；源码和后续证据另有未提交改动。
- 主工作区 `/Users/peiwang/Projects/nextbot` 有其它活跃 WIP；不得覆盖或混入。发布工作区 `/Users/peiwang/.codex/worktrees/bibo-hotfix-release/nextbot` 冻结在已部署的 `b2d3ddc62`；不拿它构建尚未审查的新架构。
- 已部署的仅是假忙局部修复：Worker 版本 `d91d0d9c-475b-4c1b-83f6-466a08fe2537`，`deploy:client` 用时 37.67 秒。真实账号模型、搜索、文件、桌面和手机冒烟通过，特定用户旧会话未直接复验。

## 已有证据与限制

- 历史 24 小时日志可配对首字样本仅 10 次：中位 3.44 秒，最慢 15.26 秒。首次模型请求前中位约 2.36 秒、最慢 14.75 秒；n=10 不能作为稳定 p95/p99。现有每条聊天仍启动用户容器并在完成后重做全量 R2 快照。
- 本地 workerd 通过同一 `DefaultNcpAgentRuntime` 和 `DefaultNcpAgentConversationStateManager` 完成真实模型流（单次 4.54 秒）与伪模型两轮工具调用；该结果不等于生产性能。实际 Bibo 工具定义已抽为一个工厂，Node 使用原 JSON Schema，Worker 用现有 `validateArgs` 扩展点避开 Ajv 动态代码生成，伪工具轮次通过。
- Bibo 文件正文可通过新增存储接口写入 DO KV，并与结构化索引在同一事务提交；Node 仍走原本地文件路径。定向测试覆盖读、写、移动、删除、失败回滚及原 1 MiB UTF-8 上限；三套 Bibo TypeScript 与定向 ESLint 通过。此接口尚未接入生产 DO，运行级原子提交也未实现。
- 直接把 Kernel 的 `AgentRunModelInputBuilder` 导入 workerd 失败：包根和上下文依赖带入原生 `sharp`。简单改为动态 import 仍被 Wrangler 打进启动 bundle，已撤回实验代码。需要给共享语义建立真正可移植的公共入口，不能在 Bibo 复制上下文投影/压缩。

## 当前阻塞和下一步

1. 冻结[执行计划](../../plans/2026-09-29-bibo-edge-conversation.plan.md)与迁移/回滚设计，明确会话 NCP journal、身份/记忆、文件正文、DO UI 会话与 Agent 送达的权威来源和校验值。
2. 给 NextClaw 通用模型输入、上下文投影/压缩建立不加载 Node 原生包的公共合同，让现有 Node 宿主与 Worker 消费同一实现；双端合同测试通过后接入真实 Bibo 工具、模型、搜索和显示事件。
3. 完成 run 级暂存与原子提交、旧 R2 快照批量迁移、回滚演练、生产同口径基线和灰度。BE-01 至 BE-08 均保持开放，不能因局部修复或原型通过提前标为完成。

## 验证与发布状态

- 本分支最新文件和工具接口的定向测试 14/14、Bibo 三套 `tsc`、定向 ESLint、`git diff --check` 通过；正式源码 Review 和发布门尚未进行。
- 旧假忙修复在生产完成一条真实账号端到端冒烟；BE-03 仍是 `failed`，其余 BE 项为 `not-run`。零容器新路径尚未上线，尚无可信的新旧 p95/p99、每百条资源量或生产降费结果。
