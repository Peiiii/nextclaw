# v0.18.72-journal-corruption-recovery

## 迭代完成说明

- 修复 `GET /api/ncp/sessions/:id/messages` 在单个 NCP journal JSONL 行损坏时直接返回 500 的问题。
- 本次现场故障会话为 `cron:a9e2ee22`，对应 journal 文件中混入了一行裸 HTML，导致 reader `JSON.parse` 抛错并中断整份会话恢复。
- `NcpAgentSessionJournalStore` 的 reader 现在会跳过损坏的非空行，记录 warning，并继续恢复后续合法事件，避免一个坏行拖垮整个会话。
- `NcpAgentSessionJournalStore` 的 writer 改为统一经过 `serializeJournalEntry(...)` 写入，写入前完成 JSON stringify 与 round-trip object 校验，确保 metadata/event 都以单行合法 JSONL entry 落盘。
- 已对本机损坏文件做一次性恢复：移除 `cron_a9e2ee22.jsonl` 中不可解析的 HTML 行，并保留原文件备份。
- 删除 `getSessionSummary` 旁路方法，统一继续走 summary index / list summary 主路径，减少同责任域重复恢复入口。

## 测试/验证/验收方式

- 现场复现：
  - 修复本机数据前，请求 `http://127.0.0.1:55667/api/ncp/sessions/cron%3Aa9e2ee22/messages?limit=300` 返回 `HTTP/1.1 500 Internal Server Error`。
  - 定位到 `/Users/peiwang/.nextclaw/sessions/.ncp-agent-journal/cron_a9e2ee22.jsonl` 第 23 行为非法 JSONL 裸 HTML。
- 本机数据恢复：
  - 移除坏行后检查 journal 坏行数为 `0`。
  - 同一 API 请求返回 `HTTP/1.1 200 OK`，响应包含 `ok: true` 与 `total: 21`。
  - 备份文件：`/Users/peiwang/.nextclaw/sessions/.ncp-agent-journal/cron_a9e2ee22.jsonl.bak-2026-05-18T14-33-08-336Z`。
- 自动化验证：
  - `pnpm --filter @nextclaw/kernel test -- src/stores/ncp-agent-session-journal.store.test.ts src/services/ncp-agent-session-store-adapter.service.test.ts`
  - `pnpm --filter @nextclaw/kernel tsc`
  - `pnpm --filter @nextclaw/kernel lint`
  - `git diff --check`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.ts packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.test.ts packages/nextclaw-kernel/src/services/ncp-agent-session-store-adapter.service.ts packages/nextclaw-kernel/src/stores/ncp-agent-legacy-session.store.ts`
  - `pnpm check:governance-backlog-ratchet`
- 已知阻塞：
  - `pnpm lint:new-code:governance` 被本轮无关的既有 touched 文件 `packages/nextclaw-openclaw-compat/src/plugins/runtime-npm.ts` 阻塞，错误为该文件缺少批准的 secondary suffix。本轮触达的 `@nextclaw/kernel` 文件已通过 package lint、tsc、定向测试与 maintainability guard。

## 发布/部署方式

- 本次未执行 NPM 发布、desktop 发布或 runtime update channel 发布。
- 本机损坏会话已经通过数据修复恢复可读。
- 源码修复需要随下一次 `@nextclaw/kernel` 所在发布批次进入安装态，才能让其他环境获得 reader 容错与 writer 合同校验。
- 不涉及数据库 migration、远程 deploy 或线上 API 冒烟。

## 用户/产品视角的验收步骤

1. 打开 NextClaw 当前本机服务。
2. 进入 `cron:a9e2ee22` 会话。
3. 页面应正常展示历史消息，不再出现 “Non-JSON response (500 Internal Server Error)”。
4. 对仍含单行坏 JSONL 的其他历史 journal，reader 应跳过坏行并保留后续合法消息。
5. 新写入的 HTML/tool result payload 应保持为一条合法 JSONL event，不应把 payload 内容拆成裸行写入。

## 可维护性总结汇总

- 本次为非新增用户能力的 bugfix。
- 本轮相关文件代码增减：新增 146 行，删除 41 行，净增 105 行。
- 非测试代码增减：新增 33 行，删除 40 行，净增 -7 行，满足非功能改动生产代码净增不大于 0 的门槛。
- 测试代码增减：新增 113 行，删除 1 行，净增 112 行。
- 正向减债动作：删除 `getSessionSummary` 旁路方法，避免 journal store、legacy store 与 adapter 继续维持重复 summary 恢复入口。
- reader 容错与 writer 合同都保留在 `NcpAgentSessionJournalStore` owner 内，没有把事故特判下沉到 API route 或 UI 层。
- maintainability guard 通过，但提示 `ncp-agent-session-journal.store.ts` 已接近 400 行预算，本次没有继续拆文件，以避免为窄修复引入额外 owner 漂移。

## NPM 包发布记录

- 本次未执行 NPM 发布。
- 后续若发布，需要把 `@nextclaw/kernel` 及直接受影响的消费包纳入发布评估。
