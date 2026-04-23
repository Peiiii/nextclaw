# Smoke Scripts

用于存放真实运行链路的轻量 CLI 冒烟脚本，既包含面向运行中服务的验证，也包含直接走 CLI / provider 的真实能力校验。

## 关键入口

- `pnpm smoke:ncp-chat`
  - 用于验证运行中的 NextClaw 服务是否能通过指定 `session-type + model` 返回真实回复。
- `pnpm smoke:startup-readiness`
  - 用于冷启动测量“从启动开始到可用”的基线时间。
  - 默认隔离 `NEXTCLAW_HOME`，并同时输出 `UI API 可达 / auth status ok / health ok / ncpAgent.ready / bootstrap ready` 五个时间点。
- `pnpm smoke:prompt-cache`
  - 用于验证真实模型的 prompt cache telemetry。
  - `provider-direct` 模式：直连 provider，适合隔离 provider 本身是否吐出 `*_cached_tokens`。
  - `ncp-chat` 模式：走真实 NCP 产品链路，并从 `~/.nextclaw/logs/llm-usage.jsonl` 判读缓存 telemetry。
  - 当前 `ncp-chat` 模式默认复用同一个 NCP session 做多轮请求，因为这更接近真实会话使用，也与 MiniMax 在产品链路里出现缓存命中的形态一致。

## 目录预算豁免

- 原因: 当前目录聚合的是少量直接可执行的 smoke 入口与其紧邻工具模块。`chat-capability-smoke` 为了匹配真实 NCP HTTP 协议拆出 `*.utils.mjs`，`prompt-cache-smoke` 也已按 `prompt-cache/` 子目录拆成薄入口加分职责 runner，属于优先降低单文件复杂度、避免继续堆积大文件的最小必要增长；后续若同类脚本继续增加，应继续按运行域拆子目录而不是恢复平铺。
