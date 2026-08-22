# 工作记录

## 当前目标

交付 `@nextclaw/harness`、其 kernel 实现入口、`runNextclawTask`、`nextclaw exec` 和外部消费者示例，同时保持现有用户可见行为与持久化合同不变。

## 当前事实

- `NextclawKernel` 已拥有 `start()` / `dispose()` 和主要 runtime composition。
- `AgentRunClient` 已支持关联 run、流式 NCP event、最终回复和 `AbortSignal`。
- `dispatchPromptOverNcp()` 已是 CLI direct prompt 的 kernel 产品语义入口，但目前只返回文本，没有向上透传完整 reply/event。
- 现有 `nextclaw agent -m` 由 service 的 `runCliAgentCommand()` 调用同一 dispatch 链。
- `@nextclaw/kernel` 根入口已经暴露大量 manager；本批只在根入口新增经过约束的 Harness contract，外部安装与导入统一走轻量 `@nextclaw/harness` 根入口，不建立 Kernel 子路径。
- 当前不存在 `nextclaw exec` 命令。
- 改动前 kernel/service/nextclaw 的 TypeScript 检查，以及 AgentRunClient/CLI agent 定向测试均通过。

## 关键约束 / 不变量

- 不改变 `nextclaw agent`。
- 不新增第二套 agent loop、session store 或 event vocabulary。
- 默认 exec session 必须新建；只有显式 session id 才恢复。
- stdout 机器输出必须协议纯净。
- 不 commit、push、发布或重启产品实例。
- 工作区已有用户文档改动，必须保持并与本批精确区分。

## 证据 / 观察点

- `packages/nextclaw-kernel/src/services/agent-run-client.service.ts`：已有 reply、stream、abort correlation。
- `packages/nextclaw-kernel/src/features/ncp-dispatch/utils/nextclaw-ncp-dispatch.utils.ts`：现有 direct prompt owner。
- `packages/nextclaw-service/src/utils/cli-agent-runner.utils.ts`：既有 CLI agent dogfooding 链路。
- `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`：kernel lifecycle owner。
- 基线命令均为 exit 0，记录于当前任务对话与后续 README 验证区。

## 活跃假设

- additive structured dispatch result 足以支撑第一版 Harness，无需改动 session/run manager。
- CLI machine-output 隔离可以局限在独立 exec 进程的 controller，不需要修改全局 logging architecture。
- 当前 NCP 事件类型可以直接作为 experimental event surface；稳定 Platform event union 留待后续版本化。

## 已排除项

- 不直接把 `NextclawKernel` 全部 manager graph 宣称为 SDK。
- 不让新 exec 复用 `cli:default`。
- 不从现有交互式 agent command 分叉复制 agent execution。
- 不把核心逻辑复制到 facade package。

## 关键决策

- 外部入口使用独立 `@nextclaw/harness`，实现归 `@nextclaw/kernel` 根入口。
- 总负责人冻结设计、审查与验证；边界明确的实现交给用户指定的低成本模型。
- facade 只承担白名单导出、类型、semver 和文档；深层扩展 API 继续依据 external-consumer 证据决定。

## 下一步

1. 按 L3 风险执行 TypeScript、targeted lint、定向回归、package build、CLI 组装冒烟和外部消费者验证。
2. 清理验证过程产生的非交付生成物，并确认没有混入共享工作区的无关变更。
3. 进入 diff-only maintainability Review，关闭 finding 后再交接。

## 剩余缺口 / 交接提醒

- 需要在实现中确认 `dispatchPromptOverNcp()` 的 slash-command 结果如何映射为无 runId 的公共 result。
- 需要验证 kernel/extension 启动期间是否会向 stdout 打日志；若会，exec machine mode 必须重定向。
- 当前 agent run 主链没有统一 output schema 和外部 approval handler，本批不能宣称已支持。

## 实现快照

- NCP direct dispatch 已 additive 增加结构化 result 和 `onEvent`，旧文本函数复用新函数且签名保持不变。
- Kernel 根入口显式导出 Harness 公共合同；内部 service、factory dependency 和测试钩子未暴露。
- `@nextclaw/harness` 作为独立的轻量 facade package，只转发上述白名单，并用导出合同测试锁定边界。
- Harness 已实现幂等 start/dispose、启动失败回滚、one-shot finally dispose、默认 `exec:<uuid>`、事件/增量/取消和公共错误分类。
- service 只注入产品 home/config/version/activity sink；`nextclaw exec` controller 拥有 argv/stdin、format、timeout、SIGINT、stdout/stderr 和 exit code。
- 主 Agent 第一轮复核已修正测试钩子泄漏、伪 one-shot 释放测试、机器 stdout 日志污染和 dispose 未分类错误。
- 实现期定向 tsc 与 13 项合同测试由低成本模型报告通过；源码在主 Agent 补充 dispose、JSON error、SIGINT 合同后已变化，因此进入独立收尾验证重新取证。
