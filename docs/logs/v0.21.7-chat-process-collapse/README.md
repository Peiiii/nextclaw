# v0.21.7 Chat Process Collapse

## 迭代完成说明

本轮参考 Codex 的完成后折叠体验，为 chat assistant 完成态消息新增“已处理”过程摘要。完成后的 reasoning 与 tool-card 过程默认收起，最终回答保持可见；点击摘要行后可展开原始过程内容。

实现边界保持在视图投影层：`@nextclaw/ui` 只根据完成态 assistant message 的 parts 结构生成 `processSummary`，`@nextclaw/agent-chat-ui` 只按 view model 做纯展示，不修改 NCP 协议、历史数据或运行期状态。

按用户纠偏，折叠摘要采用 Codex 式轻量行内结构，只保留灰色文案、箭头和分隔线，不再使用圆角、边框或背景色卡片，避免 assistant 消息内形成嵌套卡片。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-message-list/__tests__/chat-message-process-collapse.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`

结果：以上命令均通过。`@nextclaw/ui` 的定向测试执行时仍输出既有 `--localstorage-file` warning，但测试通过，本次没有修改该启动参数。

## 发布/部署方式

本轮未执行部署、NPM 发布或桌面端发布。已新增 `.changeset/chat-completed-process-collapse.md`，声明 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` patch 变更，后续进入常规 NPM 发布闭环时由 changeset 消费。

不涉及数据库 migration、远程 deploy、runtime update manifest 或 desktop installer。

## 用户/产品视角的验收步骤

1. 打开包含已完成 assistant 消息的 chat 会话，且该消息包含 reasoning/tool 过程和最终回答。
2. 确认消息顶部显示 `已处理` 轻量摘要行，最终回答仍直接可见。
3. 确认摘要行不是卡片样式，没有额外圆角边框背景。
4. 点击摘要行，确认 reasoning 与工具过程重新展开。
5. 在 streaming/pending 消息上确认不会出现整段过程折叠，实时过程仍可见。

## 可维护性总结汇总

可维护性守卫结果：0 errors，0 warnings。守卫范围内行数统计为 total +467 / -136 / net +331，non-test +360 / -136 / net +224。

本次是新增用户可见能力，允许必要的非测试代码增长；同时做了两处减债：新增过程摘要推导时没有继续膨胀 `chat-message-list.container.tsx`，而是拆到 `chat-message-process-summary.utils.ts`；并把原 container 内的 chat 文案 view-model 构造抽到 `chat-message-texts.utils.ts`，使 container 回到 timeline 编排职责。

没有新增 store、manager、runtime service 或协议层状态，没有引入 parallel runtime truth。本轮不显示耗时，避免把相邻消息 timestamp 推导值包装成真实 run duration；后续若 NCP 持久化真实 run `startedAt` / `finishedAt`，可把 summary 来源替换为真实 metadata 后再显示耗时。

## NPM 包发布记录

适用。新增 changeset：

- `.changeset/chat-completed-process-collapse.md`
- `@nextclaw/agent-chat-ui`: patch
- `@nextclaw/ui`: patch

本轮未发布 NPM 包。
