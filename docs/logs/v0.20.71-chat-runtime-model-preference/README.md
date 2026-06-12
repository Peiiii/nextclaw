# v0.20.71 Chat Runtime Model Preference

## 迭代完成说明

本次修复 chat 输入栏模型偏好同步：

- 根因：recent model 记忆和历史会话 preferred model 同时参与输入栏同步时，切换判断读取了不同 owner 的 sessionKey；当历史会话 summary 稍后到达时，输入栏可能保留旧模型而不是切回该会话绑定模型。
- 确认方式：补充 `ChatSessionPreferenceSync` 回归测试，模拟进入历史会话时 summary 未到、随后带 preferred model 到达的顺序。
- 修复方式：preference sync 使用和 selected session 同源的 `selectedSessionKey`；只有 selected session summary 存在后才记录已处理 session，确保历史会话绑定模型优先于 recent fallback。
- 同时将 recent selection 持久数据归到 Zustand store owner，manager 只保留意图级读写；删除未被生产链路使用的旧 input bar controller 和过期 toolbar helper。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc --noEmit`
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/managers/__tests__/chat-input.manager.test.ts src/features/chat/managers/__tests__/chat-session-preference-sync.manager.test.ts src/features/chat/managers/__tests__/recent-selection.manager.test.ts src/features/chat/pages/__tests__/ncp-chat-page.test.ts src/features/chat/features/input/utils/__tests__/chat-input-bar.utils.test.ts`
- `pnpm -C packages/nextclaw-ui lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm lint:new-code:governance && pnpm check:governance-backlog-ratchet`
- Vite module smoke: `http://127.0.0.1:5174/@fs/.../chat-input-bar.container.tsx` 返回 200。

## 发布/部署方式

本次只修改 `@nextclaw/ui` 源码和测试，未执行部署。已添加 `.changeset/chat-runtime-model-preference.md`，等待后续统一 NPM 发布流程带出 patch 版本。

## 用户/产品视角的验收步骤

1. 在某个 runtime 的新会话中选择一个模型。
2. 再创建同 runtime 新会话，默认模型应使用最近选择。
3. 打开已有历史会话，输入栏应显示该历史会话自身绑定的模型。
4. 若历史会话没有有效绑定模型，才回落到同 runtime recent model 或全局默认模型。

## 可维护性总结汇总

已使用 post-edit maintainability guard。结果：总代码 `+409 / -537 / net -128`，非测试代码 `+294 / -353 / net -59`。本次正向减债是删除旧 input bar controller 死链路、删除过期 toolbar helper，并将 recent selection 持久化职责收敛到 store owner；保留的新增 hook 用于降低 `chat-input-bar.container.tsx` 的混合职责和文件长度。

## NPM 包发布记录

涉及 NPM 包：`@nextclaw/ui`。

发布状态：本次未发布，已通过 changeset 标记 `patch`，待统一发布。
