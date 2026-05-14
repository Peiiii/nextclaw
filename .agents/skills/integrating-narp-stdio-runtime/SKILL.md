---
name: integrating-narp-stdio-runtime
description: 当把 Codex、Claude Code、Hermes 或其他外部 agent runtime 通过 NARP stdio 接入 NextClaw，或讨论 narp-stdio runtime entries、stdio launcher、agent-side wrapper、迁移旧 agent-runtime 插件时使用。
---

# NARP Stdio Runtime Integration

## 目标

把外部 agent runtime 接到 NextClaw 的通用 `narp-stdio` 路径，同时保持核心系统只感知协议类型，不感知具体 provider/runtime 身份。

## 硬边界

- `core` / `kernel` / `service` 只应识别通用 runtime type，例如 `narp-stdio`，不得硬编码 `codex`、`claude` 或其他 provider/runtime id。
- 具体 runtime 身份只允许出现在：
  - `agents.runtimes.entries` 配置；
  - installer / repair / marketplace metadata；
  - 具体 provider wrapper package；
  - 测试或 smoke 的显式配置输入。
- Codex 和 Claude Code 的用户侧接入必须体现为两个独立 marketplace skill；公共 NARP 规则可以复用，但不要合并成一个“多 runtime 总入口”。
- `narp-stdio` host-side client 必须保持通用，不添加 provider 分支。
- agent-side 适配应体现为 wrapper，而不是把旧 agent-runtime plugin/provider 注册路径继续扩张。
- 旧 SDK runtime package 可以作为 library 被新 wrapper 依赖；不要为了 NARP 迁移直接改旧 SDK 包，除非旧包本身有阻塞复用的 bug。

## 实现顺序

1. 先写/更新计划，明确哪些文件不得触碰，尤其是旧 SDK 包和通用 stdio client。
2. 新增或复用通用 agent-side wrapper，把 `NcpAgentRuntime` 暴露成 NARP stdio 子进程。
3. 为具体 runtime 新增独立 wrapper package 和 `-narp` launcher。
4. 通过显式 runtime entry 配置接入：
   - `type: "narp-stdio"`
   - `config.wireDialect: "acp"`
   - `config.command: "<provider-narp-launcher>"`
5. 真实冒烟必须验证 entry 配置、launcher 可执行、以及真实模型回复三件事。

## 实现前事实核对

开始写 NARP stdio / bridge / runtime mapper 代码前，必须先做一轮短前置核对，避免靠后置失败推进：

- 结构核对：读取目标 package 的 `module-structure.config.json`、`tsconfig.json`、已有 role 目录和同类 mapper/bridge 文件落点；新增或重命名文件前先判断是否需要进入 `utils/`、`services/`、`controllers/` 等允许子树，以及是否需要包内 alias。
- 上游协议核对：先直连或 mock 一个最小 OpenAI-compatible/Anthropic/Responses stream，确认上游是否需要 `stream: true`、`stream_options`、provider 特有参数、thinking/reasoning 字段，以及错误响应形状。
- 模型路由核对：确认 provider route 中的用户侧模型 id 是否带 provider 前缀，进入上游前是否必须剥离或映射；不要假设 `provider/model` 可以直接发给 provider API。
- SDK raw event 核对：在改 NCP mapper 前，先确认 Codex/Claude/Hermes SDK/CLI raw event 是否已经暴露增量、是否会把 bridge 增量聚合成 snapshot。
- 构建入口核对：真实冒烟前确认 launcher/bin 指向当前源码构建出的 `dist`，不是旧全局安装版本；每次改 bridge/wrapper 后先重建相关 package。
- 本地配置核对：读取本机 provider 配置时只确认 `apiBase`、`wireApi`、model 列表和 enabled 状态，不输出 API key、Bearer token 或 extra header 值。

前置核对必须产出一个很短的实现判断：问题 owner 在 provider bridge、runtime SDK mapper、agent-side wrapper、host-side stdio client，还是 NextClaw 服务 SSE。只有 owner 明确后才进入代码修改。

## NARP Runtime 冒烟跑道

接入新 runtime 或调试现有 runtime 时，按能力分层验收，不要只跑文本回复：

- 文本：固定 marker，确认 `message.text-delta` 和最终 assistant text。
- 工具：固定一个安全命令或可控工具，确认 `tool-call-start`、`tool-call-result` 和最终 marker。
- 思考：带 `--thinking` 或对应 runtime thinking 参数，确认 `reasoning-start/delta/end` 和非空 reasoning text。
- 组合：对 agent runtime，至少跑一次“思考 + 工具 + 最终文本”同轮 smoke。

推荐先用 `smoke-testing-ncp-chat` 的 `--json` 输出写硬断言，再人工看细节。

### Codex / Claude Code 类 Agent Runtime 矩阵

对 Codex、Claude Code、Hermes 或同类外部 agent runtime，必须把 provider/model 和 runtime 能力分开验证：

- runtime entry：显式配置 `type: "narp-stdio"`、`wireDialect: "acp"`、`command: "<runtime>-narp"`，确认 host 只知道 NARP stdio。
- launcher：临时 bin 指向当前源码构建出的 launcher，确认不是旧全局二进制或旧插件路径。
- provider route：用同一个 runtime 分别跑目标 provider 和一个已知可用对照 provider，定位问题是 provider 字段形状还是 runtime 事件暴露。
- 文本能力：固定 marker，确认真实模型回复，不接受 mock 或空响应。
- 工具能力：要求 agent 使用真实工具或命令执行，并断言 tool-call start/result；Claude Code 这类运行时要确认非交互 permission 配置，Codex 要确认 approval/sandbox 配置。
- 思考能力：断言 raw SDK/CLI event 和 NCP SSE 都有 reasoning；如果服务层没有，先看 raw SDK/CLI，不要直接改 NCP translator。
- 思考展示修复必须同时做正反验收：既要证明异常 raw reasoning 不会以乱码/无空格内部自述展示，也要证明 provider 正常提供 thinking 时 NCP 仍有非空 `reasoning-delta`；禁止用整体丢弃 reasoning item 的方式修展示问题。
- 组合能力：至少一次同轮覆盖 thinking + tool + final text，避免单项通过但 agent loop 组合失败。

结论表述要具体到 runtime 和 provider，例如“Claude Code NARP + MiniMax 工具/思考通过”“Codex NARP + 某 provider 文本通过但 raw SDK 缺 reasoning”，不要泛化成“Codex 已全部通过”。

## 分层盲测方法

NARP 调试必须优先找到第一个错误 hop，而不是在最后的事件表面补丁：

1. 上游 provider 直连：确认模型原始响应、扩展参数和字段形状。
2. bridge 直测：确认 chat/responses/anthropic 等桥接层输出目标协议对象。
3. runtime SDK/CLI raw event：直接读取 Codex/Claude/Hermes 原始事件，确认 bridge 输出是否被 runtime 暴露。
4. agent-side NARP wrapper：确认 `NcpAgentRuntime` 事件被翻译成 ACP/NARP update。
5. host-side stdio client：只验证通用协议收发和 `_meta` 透传，不加入 provider 特判。
6. NextClaw 服务 SSE：最终用真实服务 smoke 验证用户可见链路。

每轮实验只验证一个假设。例如：如果问题在 bridge 输出形状，那么 bridge 直测应该已经缺字段；如果 bridge 正确但 raw SDK event 缺失，那么 owner 是 runtime SDK/CLI 兼容层。

## 隔离环境规则

真实冒烟默认使用隔离环境，避免污染或误读：

- 用临时 `NEXTCLAW_HOME` 放最小配置和 workspace。
- 用临时 bin 目录指向当前源码构建出的 `-narp` launcher。
- 对会读取用户目录的 CLI，必要时设置隔离 `CODEX_HOME`、运行时 HOME 或等价环境。
- 每次修改 wrapper/bridge 后重建 dist；per-session runtime 可新开会话加载新 dist，长期进程必须重启。
- 烟测输出不得泄漏 API key、bearer token、extra headers。

## Bridge 和 Reasoning 经验

不同 provider 的“思考”字段不一定等价于目标协议里的 reasoning item。调试时必须同时确认：

- 请求上游时是否传了 provider 必需的 thinking 参数。
- provider 原始响应是 raw chain、reasoning details、summary，还是嵌在 `content` 里的标签。
- bridge 输出是否符合下游 runtime 真正消费的协议形状。
- runtime SDK/CLI raw event 是否真的暴露 reasoning item。
- 如果 raw reasoning 变成不可读无空格英文，禁止在 mapper 展示层统一改写成高层摘要；必须先切分 provider 原始流、bridge 输出和 SDK/CLI raw event，定位是哪一层丢失空白或改写内容，再在第一个错误 hop 修复。
- 流式协议解析不得使用会 `.trim()` 内容字段的通用 reader 读取 delta；reasoning/text/tool argument 这类用户或模型生成内容必须保留原始空白。

已知经验：MiniMax M2 系列的 OpenAI ChatCompletions 原生格式会把 thinking 放入 `<think>` 标签；要分离字段需传 `reasoning_split: true`。当桥到 OpenAI Responses 给 Codex 使用时，仅填 `reasoning.content.reasoning_text` 不够，Codex CLI/SDK 读取的是 `reasoning.summary[{ type: "summary_text", text }]`。判断类似问题时，用 provider 直连、bridge 直测、Codex raw event 三段对照，不要在 NCP event translator 里伪造 reasoning。

## 漂移检查

改完后必须搜索触达的核心路径：

```bash
rg -n 'codex|claude|nextclaw-codex|nextclaw-claude' packages/nextclaw-core/src packages/nextclaw-kernel/src packages/nextclaw-service/src
```

如果命中来自新硬编码、默认 entry 注入、provider kind 特判或注册跳过逻辑，必须删除或移到配置/installer/wrapper 包。
