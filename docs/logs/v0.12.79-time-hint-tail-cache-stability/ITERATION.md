# v0.12.79-time-hint-tail-cache-stability

## 迭代完成说明（改了什么）

- 移除了 system prompt 中每轮变化的动态时间行（`Current time: ...`），避免破坏前缀缓存稳定性。
- 新增“后置时间提示”机制：仅当用户消息命中时间语义时，在当前轮 `currentMessage` 末尾追加本地时间提示。
  - 格式：`[time_hint_local_minute] YYYY-MM-DD HH:mm ±HH:MM (TimeZone)`
  - 精度：分钟级。
  - 注入位置：用户消息尾部（非 system 前缀）。
- 扩展 provider usage 透传能力：保留并透传 upstream 返回的数值型 usage 字段（含潜在 cache 命中字段），不再仅限 `prompt/completion/total` 三项。

改动文件：

- `packages/nextclaw-core/src/agent/context.ts`
- `packages/nextclaw-core/src/agent/loop.ts`
- `packages/nextclaw-core/src/providers/chat-completions-normalizer.ts`
- `packages/nextclaw-core/src/providers/openai_provider.ts`

## 测试/验证/验收方式

- 影响面判定：本次改动触达核心运行链路（agent prompt 组装、provider usage 解析），需执行 `build`、`lint`、`tsc` 与最小冒烟。
- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build`（通过）
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core lint`（通过，存在既有 warning，无新增 error）
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`（通过）
- 冒烟测试：
  - 使用 `AgentLoop + stub providerManager` 进行双消息验证：
    - 时间询问消息会追加 `[time_hint_local_minute]`。
    - 非时间询问消息不追加。
    - system prompt 不再包含 `Current time:`。
  - 观察结果：满足预期。

## 发布/部署方式

- 本次仅为核心包代码改动，未执行发布。
- 发布时按仓库既有流程执行（changeset/version/publish）。
- 线上验证建议：同会话连续发送相似请求，观察 provider usage 中 cache 命中字段是否提升。

## 用户/产品视角的验收步骤

1. 启动含本次改动的 runtime。
2. 在同一会话发送时间相关问题（如“现在几点了”），确认回复语义正确且未出现 system 动态时间污染。
3. 在同一会话发送非时间问题（如“写个 hello world”），确认不会注入时间提示造成额外噪音。
4. 使用可观测 usage 的上游（如 DeepSeek 支持缓存统计的端点）连续发送相似请求，检查 cache 命中字段是否从长期 0 改善。
