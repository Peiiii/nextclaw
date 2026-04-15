# v0.16.27 Claude Nested Model Routing

## 迭代完成说明（改了什么）

- 修复 Claude 会话在遇到 `idealap/pai/glm-5` 这类嵌套上游模型路径时，把模型错误压成 `glm-5` 的问题。
- 将 Claude runtime 的实际执行模型收敛为路由结果里的 `runtimeModel`，让执行链只剥离最外层 provider 路由前缀，保留真实上游模型名，例如 `idealap/pai/glm-5` -> `pai/glm-5`。
- 同步调整 capability probe 的推荐模型透传，避免 probe 和 runtime 对模型名做不一致归一化。
- 为已触达的 Claude runtime helper 文件补齐 `*.utils.ts` 角色后缀，偿还 touched legacy file role-boundary 债务。
- 新增回归测试，覆盖 `idealap/pai/glm-5` 在 Claude 会话中最终传给 runtime 的模型仍为 `pai/glm-5`。
- 修复 `scripts/smoke/chat-capability-smoke.mjs` 仍把 `/api/ncp/agent/send` 当 SSE 读取的过时协议假设，改为先探测 session type ready，再按真实链路执行 `GET /stream` + `POST /send` 的两段式冒烟。

## 测试/验证/验收方式

- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`：通过。
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`：通过。
- `pnpm -C packages/nextclaw tsc`：通过。
- `pnpm -C packages/nextclaw test -- --testTimeout=60000 src/cli/commands/ncp/runtime/create-ui-ncp-agent.claude.test.ts`：通过，`8 passed`。
- `pnpm -C packages/nextclaw test -- src/cli/commands/ncp/compat/claude-session-type-describe.test.ts src/cli/commands/ncp/compat/claude-session-type-probe-defaults.test.ts`：通过，`3 passed`。
- `pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.7 --port 55667 --timeout-ms 180000 --json`：通过，`ok: true`，真实返回 Claude 会话回复并收到 `message.completed`、`run.finished`。
- `pnpm smoke:ncp-chat -- --session-type native --model minimax/MiniMax-M2.7 --port 55667 --prompt 'Reply exactly NATIVE_SMOKE_OK' --timeout-ms 180000 --json`：通过，`assistantText: NATIVE_SMOKE_OK`。
- `pnpm smoke:ncp-chat -- --session-type claude --model idealap/pai/glm-5 --port 18792 --timeout-ms 180000 --json`：当前本地环境无法完成真实验收。`/api/config` 中未配置 `idealap` provider，因此该链路的真实外部可用性无法在本机直接证明；嵌套模型名保留逻辑由新增回归测试覆盖。
- `pnpm lint:maintainability:guard`：`check-maintainability` 阶段已无 error；`scripts/smoke` 与 `packages/nextclaw/src/cli/commands/ncp/runtime` 的目录预算越界均已通过 `README.md` 显式记录豁免。完整命令仍退出 `1`，阻断点在当前工作区其它已触达文件的 `file-role-boundaries` 命名治理债，不是本次 Claude routing 或 smoke 脚本修正新增的问题。

## 发布/部署方式

- 本次改动位于 `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk` 源码与 `packages/nextclaw` 回归测试。
- 发布前需要确保插件包构建产物来自最新源码；本次已执行插件包 build。
- 若进入 npm 发布批次，按现有 release 流程发布相关包即可。
- 若只需本地验收，可直接对运行中的服务执行 `pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.7 --port 55667 --json`。

## 用户/产品视角的验收步骤

1. 配置一个 Anthropic-compatible gateway provider，例如 provider 名为 `idealap`，模型为 `pai/glm-5`。
2. 在 Claude 会话中选择或传入 `idealap/pai/glm-5`。
3. 发送消息。
4. 预期 Claude runtime 接收到的模型为 `pai/glm-5`，不会再退化成 `glm-5`。
5. 本地若只验证 Claude 插件是否还能正常对话，可运行 `pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.7 --port 55667 --json`，预期 `ok: true` 且出现 `message.completed`、`run.finished`。

## 可维护性总结汇总

- 本次已尽最大努力优化可维护性：是。修复没有继续新增一套分散的模型裁剪逻辑，而是把 runtime 所需模型收敛到 provider routing 的明确字段。
- 已优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。保留旧路由结构，仅补最小字段与传参；同时把触达旧文件补齐角色后缀，避免继续保留命名治理债。
- 代码量、分支数、函数数、文件数或目录平铺度：本次存在净增长，最小必要性来自新增回归测试、显式 `runtimeModel` 契约，以及把过时 smoke 脚本协议切到当前真实 NCP HTTP 模型；同步偿还了 Claude runtime helper 文件缺少角色后缀的治理债，并删除了脚本里“`/send` 直读 SSE”这一误导性旧假设。
- 抽象、模块边界、class / helper / service / store 职责划分：本次触达逻辑为无状态路由与归一化 helper，归入 `*.utils.ts` 更贴合职责；未新增 class，因为这里不拥有状态、生命周期或业务编排 owner。
- 目录结构与文件组织：本次直接触达的 Claude helper 已补齐 `*.utils.ts` 后缀；`scripts/smoke` 因拆出 smoke 工具模块触达目录预算，已补 `README.md` 豁免说明。当前完整治理命令仍被工作区其它文件的 role-boundary 债务阻断，需在对应批次处理。`claude-provider-routing.utils.ts` 接近 600 行预算，后续若继续触达，建议按候选发现、route 构建、模型归一化拆分。
- 独立可维护性复核：已执行。结论为通过；本次顺手减债是；总代码净增主要来自显式契约、回归测试与 smoke 协议修正，增长属于把隐藏失配显式化后的最小必要差异。
