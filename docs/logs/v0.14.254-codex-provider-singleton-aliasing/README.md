# v0.14.254-codex-provider-singleton-aliasing

## 迭代完成说明

- 撤回此前在 Codex runtime plugin 内补 builtin provider 元数据的 fallback 方案，不再在插件内部引入第二套 provider 事实来源，也不再依赖 `@nextclaw/runtime` 去兜底。
- 将根因修复下沉到插件加载层：
  - 在 [`packages/nextclaw-openclaw-compat/src/plugins/plugin-loader-aliases.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/plugin-loader-aliases.ts) 中新增 first-party 单例规则。
  - 当插件自身包名属于 `@nextclaw/*` 时，即使插件目录里存在可运行的本地 `@nextclaw/core`，也必须强制 alias 到宿主进程的 `@nextclaw/core`。
  - 当前白名单仅包含 `@nextclaw/core`，避免把所有 `@nextclaw/*` 都一刀切 alias 到宿主，维持行为边界清晰可预测。
- Codex runtime plugin 回到单一事实来源：
  - [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts) 继续只使用 `resolveProviderRuntime(...)` 的解析结果。
  - 删除 fallback 辅助模块 [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-provider-spec.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-provider-spec.ts)。
  - 移除 plugin package 对 `@nextclaw/runtime` 的额外依赖，避免再次形成“native/codex 两套 provider 目录”的结构。
- 补充加载层回归测试：
  - 在 [`packages/nextclaw-openclaw-compat/src/plugins/loader.ncp-agent-runtime.test.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/loader.ncp-agent-runtime.test.ts) 中新增断言，验证 first-party 插件即使自带可运行的本地 `@nextclaw/core`，alias 结果也必须指向宿主 `@nextclaw/core`。
- 现场排查结论：
  - 原始报错 `Codex Exec exited with code 1: Error: Model provider \`minimax\` not found` 的根因，不是 MiniMax 配置缺失，而是 Codex 插件在真实加载时与宿主分叉成了两份 `@nextclaw/core` 单例，导致 provider registry 不一致。
  - 修复后，`codex + minimax` 已不再报 `provider not found`；链路继续向后执行，并暴露一个更靠后的 Codex 流式断连问题：`stream disconnected before completion: stream closed before response.completed`。这说明本次 provider 解析故障已被修通，剩余问题属于另一条后续链路。

## 测试/验证/验收方式

- 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/codex-runtime-plugin-provider-routing.test.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat test -- --run src/plugins/loader.ncp-agent-runtime.test.ts -t "aliases host @nextclaw/core for first-party plugins even when a runnable local copy exists"`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat tsc`
- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat build`
- 真实 smoke：
  - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:ncp-chat -- --session-type native --model minimax/MiniMax-M2.7 --port 18793 --prompt "Reply exactly OK" --json`
    - 结果：`PASS`，assistant text 为 `OK`
  - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:ncp-chat -- --session-type codex --model custom-1/gpt-5.4 --port 18793 --prompt "Reply exactly OK" --json`
    - 结果：`PASS`
  - `PATH=/opt/homebrew/bin:$PATH pnpm smoke:ncp-chat -- --session-type codex --model minimax/MiniMax-M2.7 --port 18793 --prompt "Reply exactly OK" --json`
    - 结果：不再出现 `Model provider minimax not found`，当前失败点前移到 `stream disconnected before completion: stream closed before response.completed`
- 已知验证现象：
  - `loader.ncp-agent-runtime.test.ts` 整文件在当前环境仍存在未释放资源导致的挂起现象；本次使用新增的精确测试名定向执行，验证 alias 规则本身通过。

## 发布/部署方式

- 本次未执行正式发布。
- 若要让源码态开发服务拿到本次修复，需要至少完成：
  - `pnpm -C packages/nextclaw-openclaw-compat build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
  - 重启 NextClaw API 进程，使插件加载层重新创建 alias map
- 若后续正式发版，至少需要联动发布：
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`

## 用户/产品视角的验收步骤

1. 重启当前 NextClaw 开发服务或生产服务，确保 Codex plugin 加载的是本次更新后的构建产物。
2. 在聊天页新建 `Codex` 会话。
3. 选择 `minimax/MiniMax-M2.7` 后发送一条最小消息，例如 `Reply exactly OK`。
4. 预期不再出现 `Model provider minimax not found`。
5. 若仍失败，但错误已经变成流式断连、bridge 或 upstream completion 相关问题，则说明 provider 解析层已经修通，剩余问题应继续转到 Codex streaming/bridge 链路排查。
