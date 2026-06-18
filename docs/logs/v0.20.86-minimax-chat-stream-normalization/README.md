# v0.20.86 MiniMax Chat Stream Normalization

## 迭代完成说明

本次修复 `pnpm docker:start` 后 Docker UI 中 `native + minimax/MiniMax-M3` 对话在已经收到正文后报 `Premature close` 的问题。

根因：

- MiniMax Chat Completions SSE 会发送正文、usage 与 `finish_reason:"stop"`，但不会发送 `data: [DONE]`。
- Docker Linux/aarch64 环境中 OpenAI SDK 走到 `node-fetch` stream shim，会把这种 EOF 判定为 `ERR_STREAM_PREMATURE_CLOSE`。
- 宿主机 `pnpm dev` 路径没有报错，是因为宿主机流读取实现容忍这种 EOF；同一 provider/model/key 并没有失败。

确认方式：

- Docker NCP journal 复现到 `message.text-delta -> run.error("Premature close")`。
- Dev NCP journal 对照为 `message.text-delta -> message.text-end -> message.completed -> run.finished`。
- Docker 内直接用 global `fetch` 读取 MiniMax SSE 可以正常读到 `finish_reason:"stop"`，但用 OpenAI SDK stream iterator 会抛 `ERR_STREAM_PREMATURE_CLOSE`。

修复方式：

- 将 Chat Completions stream 路径从 OpenAI SDK iterator 切换到 NextClaw 自己的 OpenAI-compatible SSE reader。
- 明确协议合同：已经观察到 `finish_reason` 的 EOF 视为正常结束；没有终止信息的坏流仍失败。
- 将 Chat/Responses 共用的 SSE 帧读取和请求构造收敛到 `sse-stream.utils.ts`，删除 Responses 侧重复 reader。

方案文档：

- `docs/designs/2026-06-19-minimax-chat-stream-normalization.design.md`

## 测试/验证/验收方式

定向单测：

- `pnpm -C packages/nextclaw-core test -- src/features/llm-providers/providers/__tests__/openai.provider.test.ts`
- 结果：1 个 test file 通过，14 个 tests 通过。

类型与 lint：

- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-core lint`
- 结果：`tsc` 通过；lint 0 errors，仍有既有 warning。

治理检查：

- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- 结果：均通过。

Docker 实链路验证：

- `pnpm docker:start`
- `pnpm smoke:ncp-chat -- --session-type native --model minimax/MiniMax-M3 --base-url http://127.0.0.1:18891 --prompt "Reply exactly OK" --timeout-ms 120000 --json`
- 结果：`ok: true`，`assistantText: "OK"`，`terminalEvent: "run.finished"`，不再出现 `Premature close`。

可维护性检查：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --no-fail --paths ...`
- 结果：文件预算阻塞已通过；仍记录非测试代码净增 `+107` 行的 line-growth exemption。

## 发布/部署方式

本次不执行发布，不提交，不推送。

发布判断：

- 这是用户可见 bugfix，已添加 `.changeset/minimax-chat-stream-normalization.md`。
- 影响包：`@nextclaw/core` patch。
- 后续统一 NPM 发布时由 changesets 聚合版本与依赖包更新。

## 用户/产品视角的验收步骤

1. 运行 `pnpm docker:start` 启动 Docker 版本。
2. 打开 `http://127.0.0.1:18891`。
3. 选择 `native + minimax/MiniMax-M3` 发起对话。
4. 预期消息能完成，事件流最终为 `run.finished`，不再在 UI 中显示 `Premature close`。

## 可维护性总结汇总

本次是运行链路 bugfix，不新增独立产品功能。

正向减债动作：

- 删除 Responses stream 中重复的 SSE frame reader、payload parser 和请求错误构造。
- 将 Chat/Responses 的 OpenAI-compatible SSE 请求和帧读取收敛到 `sse-stream.utils.ts`。
- `stream.utils.ts` 从超出预算风险回落到 305 行，避免单文件继续膨胀。

代码增减报告：

- 总代码：新增 334 行，删除 172 行，净增 162 行。
- 非测试代码：新增 279 行，删除 172 行，净增 107 行。
- 测试代码：新增 55 行，删除 0 行，净增 55 行。

line-growth exemption：

- 本次非测试净增 `+107` 行，原因是必须引入 NextClaw 自有 Chat Completions SSE reader，才能绕开 Docker/Linux 下 SDK `node-fetch` stream shim 对 MiniMax EOF 的误判。
- 已检查并处理的近域删减：删除 Responses 侧重复 SSE reader 和重复请求错误构造；抽出共享 `sse-stream.utils.ts`；保留 provider 只做协议选择与 event 产出。
- 继续压缩会损害清晰度：如果把 SSE reader、请求构造、Chat chunk 归一化硬塞回同一文件或内联到 provider，会重新制造 owner 混杂，并降低坏流缺少 `finish_reason` 时的可观察性。
- 后续观察点：`openai.provider.ts` 仍接近 600 行预算，后续如继续扩展 wire API，应优先拆分 Chat/Responses provider 分支 owner。

可维护性复核结论：保留债务经说明接受。

## NPM 包发布记录

本次未发布 NPM 包。

需要进入后续统一发布：

- `@nextclaw/core`：patch，原因是修复 OpenAI-compatible Chat Completions stream 在 Docker/MiniMax 下的用户可见中断问题。
