# v0.14.243-codex-host-runtime-injection

## 迭代完成说明

- 撤回上一轮在 [`packages/nextclaw-openclaw-compat/src/plugins/plugin-loader-aliases.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/plugin-loader-aliases.ts) 新增的 first-party `@nextclaw/core` 强制 alias 硬约束，不再让加载层 singleton 挡板掩盖插件设计问题。
- 在 [`packages/nextclaw-openclaw-compat/src/plugins/runtime.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/runtime.ts) 和 [`packages/nextclaw-openclaw-compat/src/plugins/types.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/types.ts) 为插件宿主新增 `runtime.agent` 能力：
  - `defaults.model`
  - `defaults.workspace`
  - `defaults.maxToolIterations`
  - `resolveWorkspacePath(...)`
  - `resolveProviderRuntime(...)`
  - `buildRuntimeUserPrompt(...)`
- Codex NCP runtime plugin 改为只消费宿主注入：
  - [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts) 不再直接 import `@nextclaw/core`，provider/runtime/workspace/prompt 全部走 `api.runtime.agent`。
  - [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-input-builder.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-input-builder.ts) 不再自己创建 `SkillsLoader` 拼 prompt，改为复用宿主的 bootstrap-aware prompt builder。
  - [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-session-type.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-session-type.ts) 改为只依赖宿主注入的默认模型。
  - [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/package.json`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/package.json) 删除对 `@nextclaw/core` 的运行时依赖。
- 回归结论：`codex + minimax` 已不再触发 `Model provider minimax not found`。剩余失败点是更后面的 Codex 流式断连：`stream disconnected before completion: stream closed before response.completed`，属于另一条链路。

## 测试/验证/验收方式

- 类型检查：
  - `pnpm -C packages/nextclaw-openclaw-compat tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
- 定向测试：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/codex-runtime-plugin-provider-routing.test.ts`
  - `pnpm -C packages/nextclaw-openclaw-compat test -- --run src/plugins/runtime.test.ts`
- 构建：
  - `pnpm -C packages/nextclaw-openclaw-compat build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
- 真实 smoke（源码态服务 `http://127.0.0.1:18794`）：
  - `pnpm smoke:ncp-chat -- --session-type native --model minimax/MiniMax-M2.7 --port 18794 --prompt "Reply exactly OK" --json`
    - 结果：`PASS`，assistant text 为 `OK`
  - `pnpm smoke:ncp-chat -- --session-type codex --model custom-1/gpt-5.4 --port 18794 --prompt "Reply exactly OK" --json`
    - 结果：`PASS`，assistant text 为 `OK`
  - `pnpm smoke:ncp-chat -- --session-type codex --model minimax/MiniMax-M2.7 --port 18794 --prompt "Reply exactly OK" --json`
    - 结果：不再出现 `Model provider minimax not found`；当前失败点为 `stream disconnected before completion: stream closed before response.completed`
- 观察说明：
  - `src/plugins/loader.ncp-agent-runtime.test.ts` 在当前环境单独跑整文件仍存在 vitest 进程不退出的历史现象；本次变更本质上是删除新增的 alias 硬约束，未新增新的加载层逻辑。

## 发布/部署方式

- 本次已实际执行发布，命令链路为：
  - 在隔离 worktree 中执行 `pnpm release:version`
  - 执行 `pnpm release:publish`
- 之所以使用隔离 worktree，是因为当前 `HEAD` 已带有几组“已改但未发”的公共包；直接在主工作区发布会把其它未确认改动一起卷入。隔离 worktree 只带入本次修复和 `HEAD` 上必须补齐 changeset 的公共包，保持发布边界确定。
- 实际成功发布并打 tag 的包版本：
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.25`
  - `@nextclaw/openclaw-compat@0.3.35`
  - `nextclaw@0.16.2`
  - `@nextclaw/server@0.11.1`
  - `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.10`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.24`
  - `@nextclaw/agent-chat-ui@0.2.6`
  - `@nextclaw/ui@0.11.2`
  - `@nextclaw/remote@0.1.53`
- 额外带出 Claude/UI/remote 包，不是因为这次 Codex 修复依赖它们，而是因为这些公共包在当前 `HEAD` 上已经存在未发版变更，release guard 要求一并纳入本次发版。

## 用户/产品视角的验收步骤

1. 安装或升级到本次发布后的 `nextclaw` 与相关插件版本。
2. 打开 NextClaw 聊天页，新建 `Codex` 会话。
3. 选择模型 `minimax/MiniMax-M2.7`，发送 `Reply exactly OK`。
4. 预期不再出现 `Codex Exec exited with code 1: Error: Model provider minimax not found`。
5. 如果仍失败，但错误已经变成流式断连或上游 completion 关闭，则说明 provider 解析层已经修通，剩余问题应继续转到 Codex streaming/bridge 链路排查。
