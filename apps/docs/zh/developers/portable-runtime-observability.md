# Job、Resident 事件与可观测性

Portable Runtime 会区分“调用者可以等待的短操作”和“调用返回后仍要继续的工作”。调用者可以直接等待结果时，用普通 Action；需要进度、输出重放和取消时，用持久化 Job；应用需要消费持续事件时，用 Resident。

## 持久化 Job

运行时会在分发长任务前生成 Job id。进度和输出 chunk 会和 Job 一起保留，终态不可逆。宿主在完成前重启时，未完成 Job 会恢复为 interrupted，不会被假装成成功。

Guest 可以通过宿主 WIT import 报告有界进度、发送有界输出 chunk，并检查是否已经请求取消。应在每个有意义的工作单元之间检查取消，并把持久数据留在可以安全查看或重试的状态。

通过已安装应用的 CLI 查看与 Panel、Agent 相同的记录：

```bash
nextclaw app jobs list <app-id> --json
nextclaw app jobs inspect <app-id> <job-id> --json
nextclaw app jobs watch <app-id> <job-id> --after <sequence> --json
nextclaw app jobs cancel <app-id> <job-id> --json
```

取消只是请求，不是推断出的终态。只有运行时确认后，才能把 Job 报告为已取消。

## 持久化 Resident 事件

Resident 通过宿主拥有的 inbox 接收事件。宿主会记录收到事件、在 Resident 通道上租出一个事件，然后要求 Component 返回类型明确的处理结果。Component 可以确认事件，或请求按可选延迟重试。投递至少一次，因此事件处理必须具备幂等性。

重试使用有上限的退避。耗尽次数的事件会成为死信；修复原因后，用户或得到授权的 Agent 可以查看并重放。

```bash
nextclaw app resident-inbox list <app-id> --dead-letters --json
nextclaw app resident-inbox replay <app-id> <event-id> --json
```

新的 Resident 通过 `service-app-v2` WIT world 返回类型明确的 `ack` 或 `retry`。兼容路径会继续运行旧 Component，但新 Resident 应使用包中随附的版本化 world。

## 运行时观察记录

每一次已安装应用调用都可以写入脱敏验证记录。它会标识应用、Component、操作、结果状态、耗时、runner 进程信息和有上限的诊断事实。它绝不能包含密钥值、原始密钥摘要、未脱敏私有文档或任意复制的敏感输入。

```bash
nextclaw app verification --app <app-id> --limit 20 --json
```

这些记录用于排查失败操作，也用于证明某个应用版本使用了某个 Runtime。它们不能替代应用自己的业务审计日志。

## 查看宿主可用的 Portable Runtime

NextClaw 会通过 UI 和 CLI 提供同一份当前运行时验证视图。它会把证据与活动应用、运行时、runner 和合同身份进行比对；过期记录不会被当作当前运行时的证据。

```bash
nextclaw app acceptance status --locale en --json
nextclaw app acceptance export --json
```

这个入口适合维护 Runtime 或排查安装问题，不是普通应用面向用户的主流程。

## 日志建议

日志里记录稳定的操作名、非敏感标识和可恢复错误码。不要记录请求头、密钥支持的配置值、用户文档绝对路径或完整输入。用户可见细节优先通过应用自己的结构化结果返回；运行问题通过验证记录诊断。

相关页面：[能力与安全边界](/zh/developers/portable-runtime-contracts) · [打包与分发](/zh/developers/portable-runtime-distribution)
