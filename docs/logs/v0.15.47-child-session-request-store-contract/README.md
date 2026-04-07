# v0.15.47 Child Session Request Store Contract

## 迭代完成说明

- 收敛了 `spawn` 子会话与 `sessions_request` 的底层 session store 契约：`SessionManager` 不再只能隐式依赖 `NEXTCLAW_HOME`，新增了显式 `homeDir` / `sessionsDir` 注入能力。
- 将真实运行入口中的网关 session manager 改为复用启动时解析出的显式 home，避免 child session 的可继续寻址能力依赖后续环境变量状态。
- 为 child session 追加请求补了一条真实 runtime 复现场景测试，覆盖：
  - 同一 backend 内先 `spawn` 再 `sessions_request(child)`
  - backend 重建后继续 `sessions_request(child)`
  - ambient `NEXTCLAW_HOME` 变化，但 runtime 复用同一显式 home 时仍可继续 `sessions_request(child)`
- 顺手把本轮触碰到的 [spawn.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/spawn.ts) 实例方法改成箭头 class field，消除治理违例。
- 续改补上了 `spawn` tool completion 的时序竞态修复：child session 第一次最终回复完成后，原 `spawn` tool result 现在会立即回写，不再额外等待 source session 先变 idle，避免工具卡片偶发性长期停留在“执行中”。
- 同步新增 [session-request-delivery.service.test.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/session-request/session-request-delivery.service.test.ts) 锁定这条竞态，并保留现有 `resume_source` 等待 idle 的行为约束。
- 同批次继续收紧 `spawn` 文案：明确它的行为是“立即创建并启动 child session、先返回 running handle、child 完成后自动把结果回写到原 tool call 并恢复当前会话”，避免描述只讲“continue when it finishes”但没说清楚中间时序和效果。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw test src/cli/commands/ncp/runtime/create-ui-ncp-agent.child-session-request.test.ts`
  - 通过，3 个 runtime 场景全部通过。
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/session-request/session-request-delivery.service.test.ts src/cli/commands/ncp/runtime/create-ui-ncp-agent.subagent-completion.test.ts src/cli/commands/ncp/runtime/create-ui-ncp-agent.child-session-request.test.ts`
  - 通过，`spawn` 完成态回写、父会话恢复、child session follow-up 三条回归链均通过。
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
  - 通过，system prompt 中的 `spawn` 行为说明已覆盖“立即返回 running handle + 完成后回写并恢复”。
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-core tsc`
  - 通过。
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw tsc`
  - 通过。
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
  - 通过；仅保留历史 warning：
  - [context.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/context.ts) 接近预算上限。
  - [sessions.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/sessions.ts) 仍是历史超预算文件，但本次未继续恶化。
  - [manager.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/session/manager.ts) 接近预算，需要后续继续拆缝。
  - `agent/tools` 与 `chat` 目录仍是历史 warning，本次未新增平铺度。

## 发布/部署方式

- 不适用。本次只完成 session store 契约修复与 runtime 复现验证，没有执行发布。

## 用户/产品视角的验收步骤

1. 在绘画/会话页面中，让 AI 调用 `spawn` 创建一个 child session，并等待该 child session 首次执行完成。
2. 再让 AI 继续对这个 child session 发起 `sessions_request` 追加任务，确认不会再出现 `Target session not found`。
3. 重启一次承载 NCP agent 的 backend 后，再对同一个 child session 继续发起 `sessions_request`，确认依然可命中。
4. 若运行环境中存在 session home 的切换/重建，只要 runtime 仍绑定同一显式 session home，child session 仍然可以像正式会话一样被继续追加消息。
5. 让 AI 调用 `spawn` 创建 child session，等 child session 第一次最终回复完成后，确认原 `spawn` 工具卡片会稳定切到“已完成”，刷新界面后也不会回退成“执行中”。
6. 查看 `spawn` 工具说明与模型可见的 session orchestration 提示，确认它明确说明了“先立即返回运行中的 child handle，再在 child 完成后自动恢复当前会话”。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。没有对子会话额外打 if/flag 补丁，而是直接把根本的 session store 真相源从“隐式环境变量”收敛成“可显式注入的契约”。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有新增第二套 child-session request 链，也没有给 `sessions_request` 塞 special-case；只是在既有 `SessionManager` 上补齐显式注入能力，并把真实入口接过去。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到。新增 1 个 runtime 复现测试文件用于锁定这条历史高风险链路；非测试代码净增控制在最小必要范围内。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。`SessionManager` 现在显式承担“session store root 解析”职责，网关入口显式决定 home；没有再把 child session 特判分散到 broker / UI / tool 描述层。
- 目录结构与文件组织是否满足当前项目治理要求：本次未新增新的目录平铺问题；`packages/nextclaw-core/src/session/manager.ts` 因新增显式 store 解析逻辑接近预算，后续可以继续拆出 session path 解析 helper。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：434 行
    - 删除：8 行
    - 净增：+426 行
  - 非测试代码增减报告：
    - 新增：30 行
    - 删除：8 行
    - 净增：+22 行
  - no maintainability findings
  - 可维护性总结：这次主要增长来自一条完整的 runtime 复现场景测试，用来锁死 child session 的继续 request 契约；生产代码只在 `SessionManager` 和真实入口做了最小必要收口，没有新增第二套 session 路径，也没有通过 child 特判把复杂度转移到别处。
  - 续改补充（spawn 完成态竞态修复）：
    - 可维护性复核结论：通过
    - 本次顺手减债：是
    - 代码增减报告：
      - 新增：216 行
      - 删除：7 行
      - 净增：+209 行
    - 非测试代码增减报告：
      - 新增：3 行
      - 删除：7 行
      - 净增：-4 行
    - no maintainability findings
    - 可维护性总结：这次续改本质上是删除一个不必要的等待门槛，而不是再加一层补丁逻辑。增长主要来自把竞态条件显式固化成单测；生产代码净减 4 行，职责边界仍然清楚，剩余债务只是在 `resume_source` 链路上保留了超时 warning 作为可观测性补充。
