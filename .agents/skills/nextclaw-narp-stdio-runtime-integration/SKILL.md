---
name: nextclaw-narp-stdio-runtime-integration
description: 当把 Codex、Claude Code、Hermes 或其他外部 agent runtime 通过 NARP stdio 接入 NextClaw，或触达 narp-stdio entry、launcher、agent-side wrapper 和旧 runtime 插件迁移时使用。
---

# NARP Stdio Runtime Integration

## 架构合同

- core/kernel/service 只识别通用 `narp-stdio`，不得硬编码具体 runtime/provider id。
- runtime 身份只存在于 `agents.runtimes.entries`、installer/repair/marketplace metadata、具体 wrapper package 和显式测试配置。
- Codex、Claude Code 等用户入口保持独立 marketplace skill；公共 NARP 协议实现复用，不合并用户入口。
- host-side stdio client 保持通用；provider 差异属于 agent-side wrapper/bridge。
- 旧 SDK runtime package 可作为 library 复用；除非它有阻塞 bug，不因迁移顺手修改。
- 配置使用 `type: "narp-stdio"`、`config.wireDialect: "acp"` 和具体 `config.command`。

## 实现顺序

1. 冻结不得触达的通用 client、旧 SDK 和核心边界。
2. 复用通用 agent-side wrapper，把 `NcpAgentRuntime` 暴露为 NARP stdio 子进程。
3. 为具体 runtime 提供薄 wrapper package 与 `<runtime>-narp` launcher。
4. 通过显式 runtime entry 注册，不在核心注入默认 provider 分支。
5. 真实验收同时证明 entry、launcher 可执行、launcher 指向当前待验构建物和模型真实回复。

## 实现前核对

- **结构**：读取目标 package 的 module structure、tsconfig、现有 role 目录和同类 bridge/mapper 落点；新增路径走目录 preflight。
- **上游协议**：用最小直连/mock 确认 stream、provider 参数、thinking/reasoning 字段和错误形状。
- **模型路由**：确认用户模型 id 是否带 provider 前缀，以及上游前的剥离/映射位置。
- **raw event**：改 NCP mapper 前先看 SDK/CLI 是否暴露目标增量，还是把 bridge 增量聚合为 snapshot。
- **构建入口**：确认 launcher/bin 指向当前源码构建的 dist，不是旧全局版本；改 bridge/wrapper 后重建相关包。
- **配置安全**：只核对 apiBase、wireApi、model 和 enabled，不输出 key、token 或 extra headers。

核对后先判断第一个错误 owner：provider bridge、runtime SDK mapper、agent-side wrapper、host-side stdio client 或服务 SSE；owner 不明确时不修改业务代码。

## 能力验收

完成当前 runtime 集成 slice 后返回生命周期，由 Validation 阶段选择 NCP Chat 冒烟合同。按本次目标断言：

- 文本：固定 marker、text delta 和最终文本；
- 工具：tool-call start/result 与最终 marker；
- 思考：reasoning start/delta/end 与非空 reasoning text；
- 组合：agent runtime 至少一轮 thinking + tool + final text；
- 流式：增量随上游到达，不能完成后一次吐出；
- 连续性：同一产品 session 稳定映射同一 runtime session。触达绑定/恢复时验证首轮 marker、重启、追问，并核对持久化 runtime id；触达模型切换时再验证切换 provider/model 后上下文和 runtime id 不丢。

结论必须写成 `runtime + provider/model + capability`，不能用一个 provider 代表 runtime，也不能用文本成功代表工具或思考。

## 分层缩圈

按 `provider 直连 -> bridge -> SDK/CLI raw event -> agent-side wrapper -> host-side stdio -> service SSE` 找第一个错误 hop；每轮只验证一个假设。若用户问题发生在 dev URL，必须用进程证据确认真实子进程来自当前仓库，而不是转发到全局包。

真实冒烟默认隔离 `NEXTCLAW_HOME` 和 launcher bin；必要时隔离 runtime home。修改后重建 dist，长期进程重启或新开 session，输出全部脱敏。

## Bridge 与 Reasoning

- 分别确认上游 thinking 参数、provider 原始字段、bridge 目标形状和 SDK/CLI raw event。
- 不可读 reasoning 先在三段流中定位首次空白丢失或改写，不在展示 mapper 统一伪造摘要；内容型 delta reader 不得 `.trim()` 文本、reasoning 或 tool arguments。
- 修一个同构 bridge 后横向搜索 sibling runtime 的 stream reader、normalizer 和 event mapper。
- MiniMax M2 的 ChatCompletions 可能需 `reasoning_split: true`；桥到 OpenAI Responses/Codex 时要核对 runtime 实际消费的 `reasoning.summary` 形状，不能只填另一个 reasoning 字段。

## 漂移检查

```bash
rg -n 'codex|claude|nextclaw-codex|nextclaw-claude' packages/nextclaw-core/src packages/nextclaw-kernel/src packages/nextclaw-service/src
```

若命中来自新 provider 硬编码、默认 entry 注入、kind 特判或注册绕过，移到配置、installer 或 wrapper owner。
