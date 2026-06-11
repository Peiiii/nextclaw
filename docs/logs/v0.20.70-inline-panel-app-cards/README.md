# v0.20.70 inline panel app cards

## 迭代完成说明

本次迭代为 `show_content` 的 `panel_app` 结果增加展示意图，不新增独立 panel card 协议，而是在现有 Panel App 协议上补充 `placement`：

- `placement: "side_panel" | "inline"` 被加入共享 UI 展示事件和 kernel 工具 schema；不引入 `auto`，由 AI 明确选择合适展示意图。
- 缺省行为保持原有 side panel，不破坏现有 `showContent(panel_app)` 链路。
- 当工具结果是 `content_type: "panel_app"` 且 `placement: "inline"` 时，Chat 消息内渲染受限高度的 iframe card。
- inline card 的“展开”动作会重新发起 `placement: "side_panel"` 的展示请求，交给既有 DocBrowser / right panel 打开。
- Chat runtime 收到 inline 展示事件时不自动打开右侧面板，避免 inline 与 side panel 双开。
- 同批次 bugfix：修复 `buildToolCard` 转换 shared chat view model 时丢失 `panelApp` 字段的问题；此前 `buildShowContentToolCard` 已经识别 inline Panel App，但最终渲染层只收到普通工具卡，导致不会显示 iframe card。

关键取舍：

- Panel App 本身已经是可嵌入 surface，card 不应成为第二套协议。
- 卡片空间有限，因此 inline 只承担轻量预览和短交互；重交互、尺寸不适合或用户主动展开时回到 side panel。
- Panel App iframe 继续复用现有 bridge manager、manifest entry 解析和 contentPath 生成逻辑，避免形成并行加载链路。
- 同批次 follow-up：工具描述补充了 agent-facing placement 选择语义，让 agent 在生成 mini tool、preview、dashboard、calculator、timer、form、picker 等轻量 Panel App 时主动选择 inline，而不是依赖用户手填 `placement`。
- 同批次 follow-up：将“天气卡片/轻量小工具/做完直接试”等场景的 inline 展示判断写入产品运行时内置 context provider，而不是项目 `.agents/skills`；真实 NextClaw agent 每轮能看到该交付 surface 指引。
- 同批次 follow-up：产品内置 `nextclaw-app-creator` skill 的主动展示规则改为 `show_content(type="panel_app", placement="inline")`，并通过 core skill loader 测试锁定该合同。
- 同批次 follow-up：按产品判断收敛掉 `placement: "auto"`，避免把展示责任推给模糊 resolver；AI 应理解 `inline` / `side_panel` 的效果并主动选择。
- 用户纠偏“拆分文件”后，将 inline iframe 组件、纯 URL/tab/sandbox 构造、panel app entry 匹配和 agent-chat-ui 专用工具卡分别落到独立文件，并把该教训沉淀到 `nextclaw-clean-implementation` skill。

## 测试/验证/验收方式

已完成验证：

- `pnpm --filter @nextclaw/shared tsc --noEmit`
- `pnpm --filter @nextclaw/shared lint`
- `pnpm --filter @nextclaw/core tsc --noEmit`
- `pnpm --filter @nextclaw/core test -- src/features/agent/features/tests/skills.test.ts`
- `pnpm --filter @nextclaw/kernel tsc --noEmit`
- `pnpm --filter @nextclaw/kernel test -- src/tools/show-content.tools.test.ts`
- `pnpm --filter @nextclaw/kernel test -- src/contributions/context-provider/providers/context-provider-contract.provider.test.ts src/tools/show-content.tools.test.ts`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/agent-chat-ui tsc --noEmit`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/tool-card/tool-card-panel-app.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui tsc --noEmit`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx src/features/chat/features/message/utils/__tests__/chat-message-show-content-tool-card.utils.test.ts src/features/chat/managers/__tests__/chat-thread.manager.test.ts src/features/chat/features/ncp/hooks/__tests__/use-ui-show-content-event.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/message/utils/__tests__/chat-message-show-content-tool-card.utils.test.ts`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm check:generated-clean`

本轮没有启动真实桌面或浏览器服务做人工 UI 冒烟；当前验收以类型、定向单测、lint、治理检查和 bridge 代码路径校验为主。

## 发布/部署方式

本次只修改本地源码、测试、changeset 和迭代记录，未执行部署、NPM 发布、desktop release 或 runtime update channel 发布。

后续发布应走统一 release 流程，由 changeset 驱动相关 package patch 版本更新。

## 用户/产品视角的验收步骤

1. 在对话中触发一个返回 `show_content` 且 `content_type: "panel_app"`、`placement: "inline"` 的工具结果。
2. 确认聊天消息中出现受限高度的 Panel App iframe card，而不是直接打开右侧面板。
3. 确认 inline card 内的 Panel App 能通过既有 bridge 正常工作。
4. 点击 inline card 的展开按钮，确认同一 Panel App 在右侧 DocBrowser / panel 中打开。
5. 触发未传 `placement` 的旧 `panel_app` 工具结果，确认仍按原行为打开 side panel。
6. 产品演示时，不直接要求用户指定 `placement`；让 agent 开发一个轻量小工具并要求“做完后让我直接试一下”，预期 agent 自己用 `show_content(panel_app, placement: "inline")` 在对话中展示。

## 可维护性总结汇总

本轮属于新增用户可见能力，生产代码净增长是预期结果，但实现上做了以下收敛：

- 没有新增 panel card 协议，复用 `panel_app` 与既有 bridge / right panel 展示链路。
- `placement` 作为展示意图进入共享 contract，而不是在 UI 私有层临时猜测。
- inline 专用 iframe 组件、agent-chat-ui 工具卡视图、panel app entry 匹配、iframe URL/tab 构造分别拆成独立文件。
- `ChatThreadManager` 只识别 inline 展示意图并阻止自动 side panel 打开，实际展示仍由消息渲染和 `ChatUiManager` 所属链路负责。
- 已将“新增/修改 UI surface 时先做角色化文件拆分”的教训沉淀进 `.agents/skills/nextclaw-clean-implementation/SKILL.md`。
- 已新增产品运行时 `Inline Interactive Surfaces` context，把“轻量工具完成后应主动 inline 展示”的判断从口头经验沉淀到真实 agent prompt。
- 已修正一次错误落点：项目 `.agents/skills` 不能影响产品内置 agent 行为；真实落点应是 kernel context provider 与 `@nextclaw/core` 的内置 app creator skill。

`post-edit-maintainability-guard` 已运行，通过但仍提示两个既有结构风险：

- `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list` 目录仍超过文件数预算，当前增量为 0；后续继续新增时应优先按工具卡、消息主体、列表容器等职责继续分目录。
- `packages/nextclaw-ui/src/features/chat/managers/chat-thread.manager.ts` 接近文件行数预算，本轮只增加 inline guard；后续若继续扩展展示语义，应拆出更明确的 show-content 协调模块。

## NPM 包发布记录

需要后续统一发布，当前未发布。

- `@nextclaw/agent-chat-ui`: patch，新增 inline panel app tool card 展示入口。
- `@nextclaw/core`: patch，更新内置 `nextclaw-app-creator` skill，使轻量 Panel App 创建后主动 inline 展示。
- `@nextclaw/kernel`: patch，扩展 `show_content` 工具 schema、结果 contract 与运行时 inline surface prompt。
- `@nextclaw/shared`: patch，扩展 UI show content placement 类型。
- `@nextclaw/ui`: patch，接入 inline Panel App iframe card、bridge 和展开到 side panel 行为。
