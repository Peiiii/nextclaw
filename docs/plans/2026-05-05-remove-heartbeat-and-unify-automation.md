# Remove Heartbeat And Unify Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 删除 `Heartbeat` 作为独立产品/runtime 概念，统一收口到 `cron + session binding + automation skill`。

**Architecture:** 保留 `CronService` 作为唯一后台自动化调度主路径，删除 `HeartbeatService`、`HEARTBEAT.md`、heartbeat ack/token 以及相关 bootstrap/template/config 特例。用户需要“周期 follow-up / 定期检查”时，通过现有 `cron` 能力和一个很薄的 automation setup skill 来完成，而不是保留第二套 heartbeat 机制。

**Tech Stack:** TypeScript, Zod schema, NextClaw runtime context/bootstrap, CLI workspace templates, UI i18n/docs, cron skill/tool。

---

## Scope

- 删除 runtime heartbeat 调度链路与专用 handler
- 删除 `HEARTBEAT.md` 模板、bootstrap 注入、config schema 中的 `heartbeatFiles`
- 删除 heartbeat prompt / ack token / 文本约定
- 删除用户可见的 Heartbeat 文案、说明、模板引用
- 保留并强化 `cron` 作为唯一自动化能力
- 增强或新增一个很薄的 automation skill，用于把自然语言需求翻译成 cron job

## Non-Goals

- 不新增第二套 automation runtime
- 不保留“兼容 heartbeat 旧行为”的隐藏 fallback
- 不把 `HEARTBEAT.md` 改名后继续作为平台内建文件保留

## Design Decisions

1. `Heartbeat` 不是产品能力，只是历史上的特殊预置自动化。
2. `cron` 已经支持 `sessionId` / `agentId` 绑定，应成为唯一自动化主路径。
3. 如果用户想要“每 30 分钟看看某件事”，应该由 skill 创建一个 cron job，而不是保留后台文件轮询器。
4. 如果后续仍想支持“读某个文件做巡检”，那也应作为 cron job 的 message/template 约定，而不是平台级 `HEARTBEAT.md`。

## Task 1: 写方案文档并冻结删除边界

**Files:**
- Create: `docs/plans/2026-05-05-remove-heartbeat-and-unify-automation.md`

**Step 1: 明确删除对象**

列出以下对象必须一起删除或收口：
- `packages/nextclaw-core/src/heartbeat/*`
- gateway heartbeat startup/wiring/handler
- `HEARTBEAT.md` template/workspace generation
- bootstrap context default files + `heartbeatFiles`
- heartbeat ack token / prompt / context rules
- docs/UI/product wording 中的 `Heartbeat`

**Step 2: 明确替代路径**

- runtime：`CronService`
- conversation continuity：`sessionId`
- setup UX：`cron` skill 或薄 wrapper automation skill

## Task 2: 删除 runtime heartbeat 主链路

**Files:**
- Delete: `packages/nextclaw-core/src/heartbeat/service.ts`
- Delete: `packages/nextclaw-core/src/heartbeat/service.test.ts`
- Modify: `packages/nextclaw/src/cli/shared/services/gateway/service-gateway-context.service.ts`
- Modify: `packages/nextclaw/src/cli/shared/services/gateway/cron-job-handler.service.ts`
- Modify: `packages/nextclaw/src/cli/shared/services/gateway/tests/cron-job-handler.service.test.ts`
- Modify: `packages/nextclaw/src/cli/shared/services/gateway/service-startup-support.ts`
- Modify: `packages/nextclaw/src/cli/shared/services/runtime/runtime-command.service.ts`

**Step 1: 先删测试与引用关系**

- 删除 heartbeat service 测试文件
- 删除 heartbeat handler 测试块
- 删除 `createHeartbeatJobHandler` 的导出与测试引用

**Step 2: 删除 gateway heartbeat wiring**

- 从 gateway context 中移除 `HeartbeatService` import / type / field
- 删除 `createGatewayHeartbeat(...)`
- 不再在 startup context 上挂 `heartbeat`

**Step 3: 删除启动流程 heartbeat**

- 移除 `startHeartbeat` 参数
- 删除启动日志 `✓ Heartbeat: every 30m`
- 删除 runtime command 中 `gateway.heartbeat.start()`

**Step 4: 保持 cron 路径单一**

- 确保 background automation 仅剩 `cron`
- 不保留 legacy fallback 或兼容空壳 heartbeat service

## Task 3: 删除 heartbeat 配置、bootstrap 与模板特例

**Files:**
- Modify: `packages/nextclaw-core/src/config/schema.ts`
- Modify: `packages/nextclaw-core/src/config/schema.labels.ts`
- Modify: `packages/nextclaw-core/src/config/schema.help.ts`
- Modify: `packages/nextclaw-core/src/runtime-context/bootstrap-context.service.ts`
- Modify: `packages/nextclaw-core/src/agent/context.service.ts`
- Modify: `packages/nextclaw-core/src/agent/reply/reply-tokens.utils.ts`
- Modify: `packages/nextclaw/src/cli/shared/services/workspace/workspace-manager.service.ts`
- Modify: `packages/nextclaw/templates/AGENTS.md`
- Delete: `packages/nextclaw/templates/HEARTBEAT.md`
- Modify: `packages/nextclaw-server/src/ui/types.ts`
- Modify: `packages/nextclaw-ui/src/shared/lib/api/types.ts`

**Step 1: 删除 schema 承认**

- 从 `ContextBootstrapSchema` 的默认 `files` 中去掉 `HEARTBEAT.md`
- 删除 `heartbeatFiles`
- 删除 label/help/type 中的 `heartbeatFiles`

**Step 2: 删除 bootstrap/context 特殊提示**

- 从 bootstrap 默认文件清单中移除 `HEARTBEAT.md`
- 删除 heartbeat poll prompt / ack 规则
- 删除 `HEARTBEAT_OK` token 常量

**Step 3: 删除 workspace 初始化模板**

- workspace manager 不再生成 `HEARTBEAT.md`
- `templates/AGENTS.md` 不再提 heartbeat tasks
- 删除 `templates/HEARTBEAT.md`

## Task 4: 以 skill 方式承接快捷体验

**Files:**
- Modify: `packages/nextclaw-core/src/agent/skills/cron/SKILL.md`
- Modify: `packages/nextclaw-core/src/agent/tools/cron-tool.service.ts`（仅当描述需要更清晰）
- Optional Create: `packages/nextclaw-core/src/agent/skills/automation-setup/SKILL.md`（仅当现有 cron skill 无法薄包装）

**Step 1: 先判断是否需要新 skill**

优先方案：
- 直接增强现有 `cron` skill

只有在以下条件成立时才新增 wrapper skill：
- 需要明显不同的用户心智入口
- 且 wrapper 只做意图翻译，不新增执行逻辑

**Step 2: 增强现有 cron skill**

至少补充以下引导：
- 周期 follow-up / periodic check 用 `cron`
- 要继续一个现有会话时传 `sessionId`
- 定期检查文件/任务时，把读取文件要求写进 `message`
- 不再提 `heartbeat`

**Step 3: 如果新增 wrapper skill，保持极薄**

- 名称偏 `automation-setup` / `session-follow-up`
- 底层只调用 `cron`
- 绝不实现独立 runtime

## Task 5: 统一清理用户可见文案与文档

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`
- Modify: `apps/docs/en/guide/cron.md`
- Modify: `apps/docs/zh/guide/cron.md`
- Modify: `apps/docs/en/guide/after-setup.md`
- Modify: `apps/docs/zh/guide/after-setup.md`
- Modify: `apps/docs/en/guide/advanced.md`
- Modify: `apps/docs/zh/guide/advanced.md`
- Modify: `apps/docs/zh/index.md`
- Modify: `packages/nextclaw-ui/src/shared/lib/i18n/chat-labels.utils.ts`

**Step 1: 文案收口**

- `Cron & Heartbeat` 改成 `Cron` 或 `Automation`
- 删除 heartbeat feature 描述
- 删除 `HEARTBEAT.md` 作为常见文件的说明

**Step 2: 替代说明**

- 补“如何用 cron + sessionId 做周期 follow-up”
- 如保留 skill，补一段“让 AI 帮你配置自动化”的说明

**Step 3: 只清理活跃用户面**

优先清理 README / guide / usage / template / UI 文案。
历史日志、旧设计、旧方案可保留为历史记录，除非它们会影响当前产品入口或运行行为。

## Task 6: 验证与回归

**Files:**
- Relevant tests under touched files

**Step 1: 运行最小相关测试**

优先运行：
- cron tool tests
- gateway cron handler tests
- runtime/bootstrap/context 相关 tests（如存在）

**Step 2: 运行治理验证**

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched-files...>`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

**Step 3: 做定向行为验证**

验证目标：
- 启动后不再打印 heartbeat
- cron 仍能创建/运行
- workspace init 不再生成 `HEARTBEAT.md`
- context/bootstrap 不再读 heartbeat file 特例

## Task 7: 迭代记录与可维护性收尾

**Files:**
- Update existing latest related log if still same batch, otherwise create new `docs/logs/v<semver>-<slug>/README.md`

**Step 1: 按 docs/logs 规则判定是否新建迭代**

这是代码改动，默认需要落迭代记录；但应先判定是否属于最近一次相关迭代的同批次续改。

**Step 2: README 必须写清**

- 改了什么
- 为什么删除 heartbeat 命中根因
- 如何验证
- 为什么 `HEARTBEAT.md` 一起删除
- 可维护性总结
- NPM 包发布记录

## Expected Outcome

- 系统中不再有 heartbeat runtime / template / config / prompt 特例
- `cron` 成为唯一后台自动化主路径
- 用户若需要周期 follow-up，可通过 `sessionId` 绑定的 cron job 完成
- skill 层提供便捷配置体验，但不新增第二套执行系统
