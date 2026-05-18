# v0.18.76 Agent Creation Default Prompt

## 迭代完成说明

- 将 Agent 管理台“新增 Agent”预填提示从问卷式收集信息，调整为直接创建默认示例 Agent。
- 新提示只保留最小意图：不要追问用户，创建完成后简单说明能力。
- 同步更新 Agent 管理台组件测试断言，确保入口预填的是直接创建示例 Agent 的提示。

## 测试/验证/验收方式

- `pnpm --dir packages/nextclaw-ui exec eslint src/features/agents/components/agents-page.tsx src/features/agents/components/agents-page.test.tsx`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/agents/components/agents-page.tsx packages/nextclaw-ui/src/features/agents/components/agents-page.test.tsx`：通过，0 errors / 0 warnings。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm --filter @nextclaw/ui test -- agents-page.test.tsx`：未通过，原因是当前工作区无关的 `nextclaw-ncp-toolkit` agent 文件路径状态导致 Vite 无法解析 `agent-conversation-state-manager.js`。
- `pnpm --filter @nextclaw/ui tsc`：未通过，原因是当前工作区无关的 `use-ncp-agent-runtime.test.tsx` 仍引用不存在的 `agent-conversation-state-manager.ts` 路径。
- `pnpm --filter @nextclaw/ui lint -- ...`：该命令触发包级全量 lint，暴露已有无关 lint 债务；随后已补跑 touched-file ESLint 并通过。

## 发布/部署方式

- 未发布。
- 本次仅为前端预填提示与测试断言调整，等待后续统一发布或用户明确要求发布。

## 用户/产品视角的验收步骤

1. 打开 Agent 管理台。
2. 点击“新增 Agent”。
3. 页面跳转到新会话，输入框中应预填直接创建默认示例 Agent 的简短提示。
4. 提示应明确“不问我问题”。

## 可维护性总结汇总

- 本次改动复用既有 `AGENT_CREATION_PROMPT` 和 `startAgentCreationDraft` 链路，没有新增交互分支、状态或组件。
- 代码增减：总计 +2 / -2 / net 0；非测试 +1 / -1 / net 0。
- 可维护性 guard 通过；本次正向动作是用单一默认提示替代问卷式提示，避免在前端引入额外配置入口或分支逻辑。

## NPM 包发布记录

- 不涉及 NPM 包发布。
