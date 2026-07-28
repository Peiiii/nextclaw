# Agent Runtime 的 NextClaw 上下文注入

## 背景

NextClaw 已在 kernel 中统一组装产品指令、工作区信息、会话信息和 skill 清单，但外部 NARP runtime 只收到用户消息、模型路由和会话 metadata。Codex 与 Claude Code 因此只能感知各自原生环境，无法稳定感知 NextClaw 产品层上下文。

## 现状依据

- `AgentRunRequestManager` 在每轮运行前通过 `ContextProviderManager` 生成 `contextBlocks`。
- Native runtime 会把这些 block 组装成 system message。
- `NcpAgentRuntimeWrapper` 构造 `NcpAgentRunInput` 时没有携带 `contextBlocks`。
- NARP stdio `_meta.nextclaw_narp` 已承载 provider route、session metadata 和 tools，适合继续承载产品上下文。
- Claude Agent SDK 支持在 `claude_code` preset 后追加 system prompt；Codex app-server 支持独立的 `developerInstructions`，无需替换原生 base instructions。

## 核心判断

NextClaw context 是 kernel 生成的单一事实，不应由 Codex、Claude 或 CLI 重建。通用链路只负责透传；具体 runtime wrapper 只负责把同一事实映射到自身原生协议。

## 推荐方案

1. 给 `NcpAgentRunInput` 增加可选 `contextBlocks`。
2. `NcpAgentRuntimeWrapper` 根据 runtime entry 的有效开关决定是否携带这些 block。
3. NARP stdio host 通过 `_meta.nextclaw_narp.contextBlocks` 传输，agent-side wrapper 恢复为 `NcpAgentRunInput.contextBlocks`。
4. Codex wrapper 将 block 合并后写入 `developerInstructions`，保留 Codex 原生 base instructions。
5. Claude Code wrapper 使用 `{ type: "preset", preset: "claude_code", append }`，保留 Claude Code 原生 system prompt。
6. runtime entry 使用 `config.injectNextclawContext` 控制注入。字段缺失时有效值为 `true`，只有显式 `false` 才关闭。
7. CLI 提供 `nextclaw agents runtime config <runtime-id>` 查询，并通过 `--inject-nextclaw-context <true|false>` 修改。

## Owner 与数据流

```text
ContextProviderManager
  -> AgentRunRequestManager.contextBlocks
  -> runtime entry 注入策略
  -> NcpAgentRunInput.contextBlocks
  -> NARP stdio prompt meta
  -> provider wrapper
     -> Codex developerInstructions
     -> Claude Code preset append
```

- kernel runtime registry：解析 runtime entry 的有效开关值。
- kernel runtime contribution：把有效开关应用到 Native/NARP 执行入口。
- NCP/NARP 协议包：只定义和透传 block，不理解 Codex/Claude。
- provider wrapper：拥有最终协议映射。
- CLI/service：只负责校验 runtime id、展示有效值并调用统一 config mutation。

## 目录组织

不新增 manager、resolver 或 provider 分支。仅在 NARP wrapper 包增加一个纯 `utils`，统一合并 context block，避免 Codex 与 Claude 各自形成不同格式。

## 兼容与迁移

- 旧配置没有新字段时默认注入，不需要迁移。
- 显式 `false` 是唯一关闭方式，不读取别名。
- context 字段为可选，未升级的 runtime consumer 可继续忽略。
- Native 继续保持原有默认行为；配置关闭时仅移除 NextClaw context，不改变模型、工具或会话链路。

## 验收标准

- runtime entry 缺省值和显式 `false` 有单测。
- kernel wrapper 分别证明注入与关闭。
- stdio assembled test 证明 block 跨进程抵达 `_meta`。
- agent-side wrapper 证明 block 恢复到 NCP input。
- Codex test 证明使用 `developerInstructions` 且未设置 `baseInstructions`。
- Claude test 证明使用 `claude_code` preset `append`。
- CLI test 证明查询、写入、非法布尔值和未知 runtime 行为。
- 所有触达 TypeScript package 运行 `tsc`，并完成定向测试、CLI 隔离冒烟和治理检查。

## 非目标

- 本轮不把 NextClaw tools 转换成 Codex/Claude SDK 自定义工具。
- 本轮不复制 skill 到 `.codex` 或 `.claude` 目录。
- 本轮不改变外部 runtime 的会话身份、模型路由和权限策略。
