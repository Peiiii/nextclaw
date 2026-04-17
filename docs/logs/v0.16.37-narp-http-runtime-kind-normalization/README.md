# v0.16.37 NARP HTTP Runtime Kind Normalization

## 迭代完成说明

本次迭代把现有 HTTP-backed agent runtime 主链路收口到 `NARP` 命名体系，但没有新起第二套 registry，也没有迁移既有 `native / codex / claude-code` runtime。

本次完成内容：

- 保持现有 `registerNcpAgentRuntime -> UiNcpRuntimeRegistry -> /api/ncp/session-types` 主链路，不新增第二套 registry。
- 将 `nextclaw-ncp-runtime-plugin-http-client` 的唯一 kind 从 `http-runtime` 直接收口为 `narp-http`。
- 删除本轮曾短暂引入的 alias/兼容桥接设计，回到单一路径合同。
- 更新 HTTP runtime 与 Hermes HTTP runtime 回归测试，统一使用 `narp-http`。

相关设计/施工文档：

- [Unified Agent Runtime Registry, NARP, And Hermes Skill Design](../../plans/2026-04-16-protocol-backed-runtime-family-and-hermes-skill-design.md)
- 本轮曾引用的 `NARP Minimal Implementation Spec` 已在后续 builtin/ACP 收口时删除，避免继续把读者带回已废止的过渡实现心智

核心落点文件：

- `packages/nextclaw/src/cli/commands/ncp/ui-ncp-runtime-registry.ts`
- `packages/nextclaw/src/cli/commands/ncp/plugin-runtime-registration.controller.ts`
- `packages/nextclaw/src/cli/commands/plugin/plugin-extension-registry.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/plugin-capability-registration.ts`
- `packages/extensions/nextclaw-ncp-runtime-plugin-http-client/src/index.ts`

## 测试/验证/验收方式

已通过：

- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-http-client exec vitest run src/http-runtime-plugin.test.ts`
- `pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/runtime/create-ui-ncp-agent.http-runtime.test.ts src/cli/commands/ncp/runtime/create-ui-ncp-agent.hermes-http-runtime.test.ts`

已执行但未通过，且阻断原因为仓库既有治理债务/本批次无关变更：

- `pnpm lint:maintainability:guard`
  - 失败原因为仓库中多个既有新文件/既有大文件已超过预算，包含 `packages/nextclaw-ncp-runtime-adapter-hermes-http/*`、`packages/nextclaw-ncp-runtime-http-client/*`、`packages/ncp-packages/nextclaw-ncp-toolkit/src/chat/consume-ncp-reply.ts` 等，并非本次改动引入。
- `pnpm check:governance-backlog-ratchet`
  - 失败原因为 `docFileNameViolations` 当前为 `13`，高于 baseline `11`，属于仓库当前基线问题，不是本次 `NARP` 收口造成。

补充说明：

- 本次没有保留任何 `http-runtime -> narp-http` 的运行时桥接，因此不再需要 registry alias 单测。

## 发布/部署方式

本次不涉及独立发布流程变更。

若要让产品使用这次收口后的 runtime：

1. 确保 `nextclaw-ncp-runtime-plugin-http-client` 已启用。
2. 继续按原方式提供 HTTP runtime 配置。
3. 前端和运行时统一使用 `narp-http`。
4. 若外部配置或会话数据仍引用 `http-runtime`，应一并迁移到 `narp-http`，系统不会再做隐式兼容。

## 用户/产品视角的验收步骤

1. 启动本地 NextClaw 开发环境，并启用 HTTP runtime plugin。
2. 打开会话类型列表，确认 HTTP/Hermes 类型的底层值为 `narp-http`。
3. 使用 `narp-http` 创建会话并发送消息，确认能正常收到回复。
4. 对 Hermes HTTP adapter 场景执行一次真实模型路由回归，确认 provider route 和回复链路正常。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是，在当前用户要求的最小实现边界内，选择了“复用既有 registry，但不加兼容桥”这一条更可预测的路径，避免把旧值兜底逻辑扩散到运行时。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。最终删除了本轮刚加上的 alias/兼容设计，只保留 `narp-http` 单一路径，没有额外 fallback。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。相较上一版方案，移除了 `UiNcpRuntimeRegistry` 的 alias 分支、删掉了对应测试文件，也没有保留 compat 相关测试。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。HTTP plugin 现在只声明唯一 `kind`，registry 也只负责唯一 `kind` 分发，职责边界比“主 kind + alias”更直接。
- 目录结构与文件组织是否满足当前项目治理要求：本次变更范围内基本满足，但仓库全局仍存在既有 maintainability budget 与 doc filename ratchet 问题；这些问题已被守卫真实暴露，本次未顺手清理，因为与 `NARP` 收口目标无直接耦合，且用户当前要求是先完成 runtime 方案和实现闭环。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：本次已做独立复核，结论是当前方案相较“再造 registry / 新起 Hermes 核心 runtime”明显更简单、更稳、更可维护；未继续推进的债务主要是仓库既有守卫失败项，不属于本次最小施工范围。
