# v0.15.18-session-scoped-project-context

## 迭代完成说明

- 本次把会话里的 `project_root` 从“只影响 cwd 的字段”升级成了真正的 session-scoped project context 主链路，相关方案见 [Session-Scoped Project Context Implementation Plan](../../plans/2026-04-02-session-scoped-project-context-implementation-plan.md)。
- 在 [`packages/nextclaw-core/src/session/session-project-context.ts`](../../../packages/nextclaw-core/src/session/session-project-context.ts) 新增统一的 `SessionProjectContextResolver`，集中解析：
  - `hostWorkspace`
  - `effectiveWorkspace`
  - `projectRoot`
  - project bootstrap / skills 根目录
- 在 [`packages/nextclaw-core/src/agent/skills.ts`](../../../packages/nextclaw-core/src/agent/skills.ts) 把既有 `SkillsLoader` 升级成 session-scoped loader：
  - 当前只保留 `project` / `workspace` 两个来源
  - skill identity 改为唯一 `ref`
  - 同名 skill 不再覆盖、合并或去重
  - `requested_skill_refs` 成为首选协议，名字选择仅保留兼容入口
- 在 [`packages/nextclaw-core/src/runtime-context/bootstrap-context.ts`](../../../packages/nextclaw-core/src/runtime-context/bootstrap-context.ts) 与 [`packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts`](../../../packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts) 中，把 prompt 上下文重组为清晰分块：
  - `# Project Context`
  - `# Host Workspace Context`
  - requested / available skills manifest 中显式携带 `<ref>`
- 在 [`packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts`](../../../packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts) 中新增 `RuntimeUserPromptBuilder.buildSessionPromptContext(...)`，把原来散落在多条 runtime 链路中的：
  - requested skills 解析
  - session project context 解析
  - scoped `SkillsLoader` 装配
  - runtime prompt 构建
  收敛到一个 core class 里。
- 运行时消费者统一改造为走同一套 session prompt context 构建入口：
  - [`packages/extensions/nextclaw-engine-plugin-codex-sdk/src/index.ts`](../../../packages/extensions/nextclaw-engine-plugin-codex-sdk/src/index.ts)
  - [`packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts`](../../../packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts)
  - [`packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts`](../../../packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts)
  - [`packages/nextclaw-openclaw-compat/src/plugins/runtime.ts`](../../../packages/nextclaw-openclaw-compat/src/plugins/runtime.ts)
- 在 [`packages/nextclaw-core/src/runtime-context/layered-skills-loader.ts`](../../../packages/nextclaw-core/src/runtime-context/layered-skills-loader.ts) 中把旧的 layered loader 收敛成兼容壳，不再作为另一套主实现继续扩张。
- Server 侧新增 session-scoped skills 接口与 draft session 支持：
  - [`packages/nextclaw-server/src/ui/session-project/session-skills.ts`](../../../packages/nextclaw-server/src/ui/session-project/session-skills.ts)
  - [`packages/nextclaw-server/src/ui/router/ncp-session.controller.ts`](../../../packages/nextclaw-server/src/ui/router/ncp-session.controller.ts)
  - `GET /api/ncp/sessions/:sessionId/skills?projectRoot=...`
- UI 聊天侧不再用 marketplace installed skills 充当真相源，而是改为查询 session-scoped skills，并把选中的唯一 ref 回传给 runtime：
  - [`packages/nextclaw-ui/src/api/ncp-session.ts`](../../../packages/nextclaw-ui/src/api/ncp-session.ts)
  - [`packages/nextclaw-ui/src/hooks/useConfig.ts`](../../../packages/nextclaw-ui/src/hooks/useConfig.ts)
  - [`packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`](../../../packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx)
  - [`packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page-data.ts`](../../../packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page-data.ts)
  - [`packages/nextclaw-ui/src/components/chat/adapters/chat-input-bar.adapter.ts`](../../../packages/nextclaw-ui/src/components/chat/adapters/chat-input-bar.adapter.ts)
- 在同批次续改中，把会话 header 里的项目 tag 升级成统一交互入口：
  - 新增 [`packages/nextclaw-ui/src/components/chat/session-header/chat-session-project-badge.tsx`](../../../packages/nextclaw-ui/src/components/chat/session-header/chat-session-project-badge.tsx)
  - 点击项目 tag 会打开统一的 `Popover` 菜单，直接承载“设置项目目录 / 清除项目目录”
  - 右上角 [`packages/nextclaw-ui/src/components/chat/session-header/chat-session-header-actions.tsx`](../../../packages/nextclaw-ui/src/components/chat/session-header/chat-session-header-actions.tsx) 收缩为不重复的动作；保留“设置项目目录”作为常驻入口，但移除重复的“清除项目目录”
  - 为避免继续散落重复菜单样式，抽出轻量展示组件 [`packages/nextclaw-ui/src/components/chat/session-header/chat-session-header-menu-item.tsx`](../../../packages/nextclaw-ui/src/components/chat/session-header/chat-session-header-menu-item.tsx)
- 在同批次续改中继续修正了两个真实验收问题：
  - skills 请求链路原本会把空 `projectRoot` query 当成 override，导致 session 的持久化 `project_root` 虽然仍在，但本次 `/skills` 响应临时丢掉 project context，从而漏掉项目 `.agents/skills`
  - persisted session 更新项目目录后，前端原本不会主动让 `ncp-session-skills` 查询失效重拉，UI 可能继续展示旧的 skills 列表
- 在本轮 UI 收尾修正中，继续补齐了 session project header 的两个验收细节：
  - 右上角 more actions 保留“设置项目目录”，只移除重复的“清除项目目录”
  - 对 draft 与 persisted session 统一采用 session-scoped project override 语义；清除项目目录后，header tag 与 skills 请求都会立即按清空后的状态收敛，不再短暂或持续回退到旧项目
- 按本次产品决策，删除了 session skill 加载链路里的 builtin 概念，不再额外统计 core 内建 skills；session-scoped skills 现在只保留两个来源：
  - `project`
  - `workspace`
- 补充了回归测试，重点覆盖：
  - draft/new session 下通过 `projectRoot` 拉取 skills
  - project / workspace 同名 skill 并存且 ref 可区分
  - UI chat path 正确消费 session-scoped skills 与 ref
  - persisted session 更新项目目录后，skills 查询能够重新加载
  - 无 override 时不会发送空 `projectRoot` query

## 测试/验证/验收方式

- Core 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsc -p tsconfig.json --noEmit`
- Server 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server exec tsc -p tsconfig.json --noEmit`
- UI 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec tsc -p tsconfig.json --noEmit`
- Codex engine 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk exec tsc -p tsconfig.json --noEmit`
- Claude agent engine 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk exec tsc -p tsconfig.json --noEmit`
- Claude runtime 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk exec tsc -p tsconfig.json --noEmit`
- OpenClaw compat 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat exec tsc -p tsconfig.json --noEmit`
- Core 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core test -- --run src/session/project-root.test.ts src/agent/tests/context.test.ts src/agent/tests/runtime-user-prompt.test.ts`
- Server 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server test -- --run src/ui/router.ncp-agent.test.ts`
- UI 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/chat/adapters/chat-input-bar.adapter.test.ts src/components/chat/ncp/ncp-chat-page-data.test.ts`
- UI 续改验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/api/ncp-session.test.ts src/components/chat/ncp/ncp-chat-page-data.test.ts src/components/chat/adapters/chat-input-bar.adapter.test.ts`
- Header 交互验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/chat/hooks/use-chat-session-project.test.tsx src/components/chat/session-header/chat-session-project-badge.test.tsx src/components/chat/session-header/chat-session-header-actions.test.tsx src/components/chat/ChatConversationPanel.test.tsx`
- 可维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
- 验证结果：
  - 上述类型检查全部通过
  - Core / Server / UI 定向测试全部通过
  - `lint:maintainability:guard` 通过，`Errors: 0`
  - 当前剩余的是可解释 warning，而不是硬失败；其中最主要的 retained debt 是 [`packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts`](../../../packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts) 仍略高于 file budget，但已从 `553` 行下降到 `450` 行，`processDirect` 也从 `53` 条语句下降到 `31`

## 发布/部署方式

- 本次改动属于仓库代码与 UI/server/runtime 协同改造，不涉及独立 migration。
- 若后续需要对外发布，应按仓库既有发布流程统一发布受影响组件：
  - `@nextclaw/core`
  - `@nextclaw/server`
  - `@nextclaw/ui`
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/nextclaw-engine-plugin-codex-sdk`
  - `@nextclaw/nextclaw-engine-plugin-claude-agent-sdk`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`
- 本次交付未执行实际发布；当前状态是本地实现 + 验证完成，等待后续合并/发布闭环。

## 用户/产品视角的验收步骤

1. 在聊天 UI 中新建一个还未真正发出首条消息的 NCP 会话，先设置项目目录。
2. 打开技能选择器，确认可以直接看到该项目下 `.agents/skills` 中的 skills，而不是等第一条消息持久化后才出现。
3. 若 host workspace 与项目目录里存在同名 skill，确认两者会并列展示，显示名可以相同，但底层 ref 不同，选择时不会被合并或覆盖。
4. 发送一条消息，确认前端发送的是 `requested_skill_refs`，而不是仅靠名字猜测的 `requested_skills`。
5. 检查 prompt 构造结果或相关测试，确认项目自己的 `AGENTS.md` / bootstrap 文件进入 `# Project Context`，宿主 workspace bootstrap 文件进入 `# Host Workspace Context`，二者不会混写成单一上下文块。
6. 调用 `GET /api/ncp/sessions/:sessionId/skills?projectRoot=<absolute-path>`，确认 draft session 也能返回 session-scoped skills 列表。
7. 对一个已经持久化、并且 metadata 里已有 `project_root` 的 session，直接打开技能选择器，确认无需额外 override，也能返回项目 `.agents/skills`。
8. 修改一个 persisted session 的项目目录后，确认技能选择器会自动重拉 session skills，而不是继续停留在旧列表。
9. 检查同一个 session 的 skills 列表，确认来源只剩 `project` 与 `workspace`，不再出现额外的 `builtin`。
10. 对一个已绑定项目目录的会话，点击 header 里的项目 tag，确认会出现 `Popover` 菜单，并且可以直接执行“设置项目目录 / 清除项目目录”。
11. 确认右上角 more actions 无论是否已有项目目录，都保留“设置项目目录”入口，但不再重复展示“清除项目目录”。
12. 点击 tag 菜单中的“清除项目目录”后，确认成功提示出现，同时 header 里的项目 tag 立即消失，skills 列表也按无项目目录状态重新加载。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 1. 可维护性发现：session skills 链路原本混用了“持久化 metadata 回读”和“draft override”两种语义，一个空 query 就能影响单次响应中的 project context。
  - 为什么伤害长期维护：这种问题不会直接污染 session 存储，却会让用户看到“元数据明明还在，但功能像没生效”的错觉，排查成本高。
  - 更小更简单的修正方向：继续坚持“空值不代表 override”，并让 persisted session 与 draft session 共享一套清晰、可预测的 skills 读取语义。
- 1. 可维护性发现：[`packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts`](../../../packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts) 仍高于 file budget，且 `processDirect` 仍略高于语句预算。
  - 为什么伤害长期维护：Claude engine 入口仍同时承载配置解析、会话事件写入、SDK query 生命周期与 runtime orchestration，未来若继续往里叠逻辑，重新膨胀的风险最高。
  - 更小更简单的修正方向：如果后续继续触达 Claude engine 链路，应优先把“Claude engine config -> ClaudeAgentOptions”的构造再收敛成单一职责边界，而不是继续往 `processDirect` 里堆条件。
- 可维护性总结：这次改动的核心价值不是单点补丁，而是把 session project context、scoped skills、runtime prompt 装配、UI/server 技能真相源收回到一条统一主链路里，并在续改中继续删掉了 `builtin` 这层重复统计语义。虽然当前总 diff 仍是净增，但这部分增长对应的是一项真实的新会话能力与跨层统一抽象，不是给旧复杂度再套一层；同时 builtin skills 的重复枚举已经被删除，session 更新后的 skills 失效也被补齐。
- no maintainability findings
- 可维护性总结：本轮收尾没有再新增一层 project 同步通道，而是把已有 `pendingProjectRoot + pendingProjectRootSessionKey` 明确定义成统一的 session override 语义，顺手还删掉了 more-actions 里的重复清除入口与局部重复按钮样式。当前这组续改相对 `HEAD` 为 `53 insertions / 60 deletions`，属于净减代码；遗留观察点仍是 [`packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`](../../../packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx) 这个页面壳本身偏长，后续若继续触达聊天页编排，优先把与 session project 无关的派生段落继续抽回既有 manager / data hook，而不是再往页面函数里堆。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。此次 UI 续改没有把 tag 交互和菜单样式继续塞回既有 header 文件，而是把项目 tag 交互入口与菜单项展示下沉到 `session-header/` 子目录中的独立组件，避免 `ChatConversationPanel` 和 `chat-session-header-actions` 继续横向膨胀。
- 本次是否已尽最大努力优化可维护性：是。实现中没有继续新增平行 loader 或平行 prompt 构建器，而是优先改造既有 `SkillsLoader`、`runtime-user-prompt`、`project-root` 相关抽象，并把多个 runtime 消费方的重复逻辑回收到 core。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。最关键的删减包括：不再让 UI 自己猜 skills、把 layered skills 逻辑收敛回既有 `SkillsLoader`、把多 runtime 重复的 session prompt context 装配回收到一个 core class；没有再补一套新的 project context 体系。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：未完全做到总代码量净下降，本次 `git diff --shortstat` 为 `28 files changed, 1154 insertions(+), 762 deletions(-)`，属于净增。这部分增长的最小必要性在于：新增了 session-scoped project context、project skills、draft session skills API、skill ref 协议与相应测试；同时同步偿还了“多 runtime 各自拼 project context / skills”的维护性债务，并把 Claude engine 主文件与 `processDirect` 都做了明显收缩。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。业务相关的 session prompt context 装配被收敛到 core class `RuntimeUserPromptBuilder`，纯工具性的读取逻辑保持局部；没有再新增一层“ProjectSkillsLoaderV2”之类的平行补丁抽象。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足，但仍保留仓库既有 warning。新增 server 侧逻辑被下沉到 [`packages/nextclaw-server/src/ui/session-project/`](../../../packages/nextclaw-server/src/ui/session-project/) 子目录，避免继续把 router 目录摊平；不过 `packages/nextclaw-openclaw-compat/src/plugins`、`packages/nextclaw-ui/src/api`、`packages/nextclaw-ui/src/components/chat` 等目录仍存在历史平铺压力，本次没有进一步整理，是因为当前交付目标优先级在 session project context 主链路统一，后续如继续触达这些目录，应结合目录治理单独收口。
