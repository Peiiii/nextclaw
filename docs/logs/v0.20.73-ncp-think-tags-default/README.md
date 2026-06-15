# v0.20.73-ncp-think-tags-default

## 迭代完成说明

- 将 `@nextclaw/ncp-agent-runtime-next` 的默认 reasoning normalization 从 `off` 调整为 `think-tags`。
- 根因：当前 live native NCP 会话中，模型把 `<think>...</think>` 作为普通 text part 持久化，说明 runtime 未把模型原生思考标记归一化为结构化 reasoning。
- 确认方式：从会话消息接口看到 assistant `parts` 里包含原始 `<think>` 文本，而不是 reasoning part；旧迭代 `v0.14.10-ncp-think-tag-reasoning-normalization` 也记录了该能力当时默认关闭。
- 本次修复针对根因而不是 UI 症状：默认值在 native runtime owner 内收敛，未修改前端展示、历史回放适配或旧 runtime 包；显式传入 `reasoningNormalizationMode: "off"` 时仍保留关闭能力。
- 补充 runtime-next 定向测试，覆盖“不传参数默认识别 `<think>`”与“显式 off 保留原始文本”两条合同。

## 测试/验证/验收方式

- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next test -- --run src/runtime/agent-runtime.service.test.ts`：通过，2 个测试覆盖默认开启和显式关闭。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next tsc`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next lint`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.test.ts packages/ncp-packages/nextclaw-ncp-agent-runtime-next/package.json pnpm-lock.yaml`：通过，非测试代码净增为 0。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `git diff --check -- packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.test.ts packages/ncp-packages/nextclaw-ncp-agent-runtime-next/package.json pnpm-lock.yaml`：通过。

## 发布/部署方式

- 不涉及立即部署。
- `@nextclaw/ncp-agent-runtime-next` 行为有用户可见变化，后续需要随统一发布流程发布。
- `@nextclaw/ncp` 未改动，不需要因本次变更单独发布。

## 用户/产品视角的验收步骤

1. 启动包含当前源码的 NextClaw。
2. 创建或进入 native NCP 会话，选择会输出 `<think>...</think>` 的模型。
3. 不配置 `reasoningNormalizationMode`，发送一条会触发模型思考输出的消息。
4. 预期思考内容进入 reasoning block，正文进入普通 assistant text，最终正文中不残留 `<think>` 标签。
5. 若 runtime 显式传入 `reasoningNormalizationMode: "off"`，预期仍按兼容合同保留原始 text。

## 可维护性总结汇总

- 本次是非功能行为默认值修复，非测试语义代码净增为 0。
- 正向取舍：把默认语义放在 runtime owner，避免 UI 层解析 `<think>` 或在消息 materialization 层补丁式修复。
- 抽象边界没有新增；只复用已有 reasoning normalization 模式与 stream encoder。
- 新增测试在 runtime-next 就近落位，没有扩大历史旧 runtime 包的治理触达面。
- 已使用 `post-edit-maintainability-guard` 与主观可维护性复核；目录、命名和 owner 边界满足当前治理要求。

## NPM 包发布记录

- `@nextclaw/ncp-agent-runtime-next`：待统一发布。原因是默认 reasoning normalization 行为发生用户可见变化。
- 其它包：不涉及 NPM 包发布。
