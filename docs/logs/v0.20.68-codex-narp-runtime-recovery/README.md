# v0.20.68 Codex NARP Runtime Recovery

## 迭代完成说明

本次修复 Codex NARP 会话在本地开发态出现 `EAGAIN`、`fork failed`、发送后长期停留在“思考中”的问题。

根因分为三层：

- Codex prompt timeout 后仍复用同一个缓存 runtime 和旧 `codex_thread_id`，重启或重试时会继续恢复到已卡住的 Codex 内部 thread。
- `last_activity_preview` 之前由旁路 contribution 监听 NCP 事件更新，和 session journal append 存在竞态，导致 assistant 消息已完成但会话列表仍显示 running。
- NARP stdio wrapper 在父进程热重载或异常断开时没有足够的生命周期兜底，旧 Codex controller 可能变成孤儿进程，持续积累后触发系统 fork 资源不足。

确认方式：

- 通过实际本地会话 `ncp-mq827hlj-4342143b` 观察到历史卡住状态、timeout、孤儿 controller 进程和 session preview 不一致。
- 通过 `/api/ncp/sessions/:id`、`/api/ncp/sessions/:id/messages`、`/api/agent-runs/send` 验证 Codex 会话在“运行时默认”模型条件下可完成回复。
- 通过进程表确认 ppid=1 的旧 Codex NARP controller 已清理，当前只保留由开发态 serve 进程管理的 controller。

修复方式：

- prompt timeout 时按配置清理指定 session metadata，本次用于清理 `codex_thread_id`，避免继续恢复坏 thread。
- runtime 报错后让 `AgentRunRequestManager` 丢弃缓存 runtime，下次重新创建。
- 把 activity preview 更新收敛到 `SessionManager` 的 durable NCP event 主链路，并按 session 串行化处理。
- `run.finished` 没有文本时，从 session journal 的最新 assistant message 补齐 preview `replyText`。
- stdio client dispose 等待子进程退出，wrapper 在父 stdio 断开时主动退出，减少 orphan process。
- 后续修正 stdio client 源码运行时的导入合同：将包内 `@/` alias 收敛为 `@stdio-runtime-client/`，并同步 `scripts/dev/dev-runtime.tsconfig.json`，避免 dev 根进程通过 `tsx` 加载源码时把 stdio runtime 内部 alias 当成外部 package 解析并触发 `ERR_MODULE_NOT_FOUND`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel test session-activity-preview-metadata.utils.test.ts session-activity-preview-ncp-event.utils.test.ts session.manager.test.ts agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server test router.ncp-agent.test.ts server-config.store.runtime.test.ts`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client test stdio-runtime.test.ts`
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client tsc`
- `pnpm -C packages/nextclaw-narp-stdio-runtime-wrapper test narp-stdio-runtime-wrapper.service.test.ts`
- `pnpm -C packages/nextclaw-narp-stdio-runtime-wrapper tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client exec tsx -e "import('./src/utils/stdio-runtime-input.utils.ts').then(() => console.log('stdio-runtime-input import ok'))"`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test`
- `pnpm dev`
  - 结果：通过真实 dev 启动 smoke，backend ready、frontend ready；已手动停止 smoke 进程。
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ncp-runtime-stdio-client/src/utils/stdio-runtime-input.utils.ts packages/nextclaw-ncp-runtime-stdio-client/tsconfig.json packages/nextclaw-ncp-runtime-stdio-client/vitest.config.ts packages/nextclaw-ncp-runtime-stdio-client/module-structure.config.json scripts/dev/dev-runtime.tsconfig.json`
- 本地接口验收：清空目标 Codex session 的 `preferredModel`，用 `/api/agent-runs/send` 在不携带 model 的运行时默认条件下发送 `你好`，确认 session 回到 `idle`、最新 assistant message 为 `final`、preview 为 `completed`。

## 发布/部署方式

本次未执行发布或部署。改动需要随下一次 NPM 发布进入运行态包。

## 用户/产品视角的验收步骤

1. 打开 Codex 会话。
2. 模型选择保持“运行时默认”。
3. 直接发送 `你好`。
4. 预期会话正常返回 assistant 回复，不长期停留在“思考中”。
5. 会话列表预览应显示最新 assistant 回复，而不是旧的 running 状态。

## 可维护性总结汇总

本次遵循单一链路优先原则，将 session activity preview 从旁路 contribution 收回到 `SessionManager` 的 durable NCP event 主链路，减少同一会话状态由多条 listener 并行写入的竞态。

正向减债：

- 删除旧 `SessionActivityPreviewContribution` 注册入口和对应旁路测试。
- 由 `SessionManager` 统一负责 journal append、runtime metadata patch 和 activity preview 更新。
- 为 runtime timeout recovery、preview 完成态补齐、stdio lifecycle 增加定向测试。
- 将 `nextclaw-ncp-runtime-stdio-client` 的内部别名从 generic `@/` 改为包级 `@stdio-runtime-client/`，让包内 tsconfig、vitest、module-structure 与根 dev-runtime tsconfig 使用同一导入合同。

可维护性风险：

- `SessionManager` 仍是热点文件，本次为了收敛 owner 有增量，后续应继续拆向更明确的 session event projection 内部 owner，但不能再回到旁路 listener。
- 本次已使用 post-edit maintainability guard/review 流程，最终检查结果以提交前命令输出为准。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：部分减债。
- 说明：该文件仍需触达，因为 server 额外敏感字段规则会把包含 `session` 的配置路径剔除；本次没有把 runtime timeout reset 规则堆进 `isSensitivePath` 主流程，而是把 core 通用敏感 key 白名单和 server extra-sensitive 例外分开处理，避免 `resetSessionMetadataOnPromptTimeout` 被 `/api/config` 过滤。
- 下一步拆分缝：把 server config view 的敏感字段策略拆到独立 `config-sensitive-path` utility，并按 provider/runtime/session 三个域拆分配置视图归一化，减少 `server-config.store.ts` 持续承载字段策略。

## NPM 包发布记录

需要随下一次 NPM 发布进入以下包，当前状态为待统一发布：

- `@nextclaw/kernel`：session event owner、runtime cache recovery、preview 更新。
- `@nextclaw/core`：允许 runtime timeout metadata reset 配置通过公共 config 视图透出。
- `@nextclaw/server`：stale running preview normalization、runtime config 透传。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：prompt timeout metadata reset、子进程 dispose 等待。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：源码运行时包级 alias 修复，避免 dev 启动阶段模块解析失败。
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`：父 stdio 断开时主动退出。
