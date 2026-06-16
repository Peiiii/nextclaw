# Working Notes

## 当前目标

优化新会话欢迎入口，并持续推进 30+ 项代码可维护性、清晰度、解耦可插拔和克制 UI 优化。当前任务不是一次性小 UI patch，而是一个需要持续验证和留痕的优化战役。

## 当前事实

- 用户明确纠偏：welcome 应是 chat 内部子 feature，不应继续留在父级 `components/`。
- 已将 welcome 展示组件、容器测试和显示规则迁入 `packages/nextclaw-ui/src/features/chat/features/welcome/`。
- 已补充 `collapsible-feature-root-architecture`：前端 feature 内的稳定入口/面板/欢迎页若拥有自己的容器、展示部件、测试和业务上下文选择逻辑，应进入 `features/<subfeature>/`。
- 当前验证：
  - `@nextclaw/ui` welcome/conversation/input 定向测试通过，54 tests。
  - `@nextclaw/agent-chat-ui` input bar 定向测试通过，22 tests。
  - `@nextclaw/ui tsc` 通过。
  - `@nextclaw/agent-chat-ui tsc` 通过。
  - `@nextclaw/ui lint` 通过，剩余 31 个既有 warning。
  - `@nextclaw/agent-chat-ui lint` 通过，剩余 9 个既有 warning。
  - `@nextclaw/ui build` 与 `@nextclaw/agent-chat-ui build` 通过。
  - governance、ratchet、generated-clean、path-scoped maintainability guard 通过。
  - 本地 dev UI 冒烟通过：project / agent / session type 均在 welcome 入口可见，project popover 可选择历史项目且选择后关闭。
  - panel/welcome 边界测试通过，`chat-conversation-panel.test.tsx` 已从 854 行降到 824 行。

## 关键约束 / 不变量

- 复用现有 `ChatInputBarContainer` 和 `ChatInputManager.send` 主链路。
- project 选择属于 welcome/session 上下文，不属于 input bar 内部职责。
- 默认 project root 来自配置 query 中的 `config.agents.defaults.workspace`。
- 新会话空白 draft 发送时必须能把默认 workspace 传给 send 链路。
- 任何新增抽象必须减少真实复杂度，不能只搬运参数。

## 优化清单

已落地或正在落地：

1. 将 welcome 从父级 `components/chat-welcome.tsx` 迁为 `features/welcome` 子 feature。
2. 删除父级 welcome 组件与旧测试落点，避免重复入口。
3. 将 welcome 展示拆成 `ChatWelcome`、project picker、agent picker、capability grid。
4. 将 welcome 业务容器迁到 welcome 子 feature。
5. 将 welcome 容器测试迁到 welcome 子 feature。
6. 将 welcome 显示条件抽成 `shouldShowChatWelcome` 纯 util。
7. 为 welcome 显示条件补单测。
8. `ChatConversationPanel` 只装配 welcome，不内联 welcome 判断细节。
9. `ChatConversationContent` 接收 `welcomeSlot`，不直接依赖 presenter/agents/input store。
10. 新增 `ChatInputBar` `embedded` surface，复用 composer 而不是重做输入。
11. 欢迎页只传入嵌入式 input slot，非 welcome 态仍使用底部 input。
12. `ChatInputBarContainer` 仅同步 query state 与 presentation surface，不承载 project picker。
13. `ChatInputStore` 增加 `defaultProjectRoot`，把默认 workspace 纳入 input snapshot。
14. `useChatInputBarQueryState` 从 config query 读取默认 workspace。
15. `ChatInputManager.resolveProjectRootForSend` 在无 sessionKey 时使用默认 workspace。
16. `ChatInputManager.setPendingProjectRoot` 作为 project 选择写入 owner。
17. 欢迎页 project 选择复用 `ChatSessionProjectDialog`。
18. welcome 容器在创建 draft session 时优先使用显式 project，其次默认 workspace。
19. 为 welcome draft 默认 workspace 创建补测试。
20. 为显式 project 覆盖默认 workspace 补测试。
21. 为 project 选择写入 input manager 补测试。
22. 面板测试只断言 welcome 内嵌 input，不再测试 project 选择细节。
23. i18n 增加 welcome project picker 文案。
24. skill 规范补充子 feature 落点判断。
25. 抽出 welcome draft agent/project/session type 解析 util，降低容器心智负担。
26. 为 draft agent runtime 同步补 welcome feature 专属测试，减少 conversation panel 负担。
27. 从大 panel 测试移除 welcome agent/runtime 细节断言。
28. 新增 welcome session type picker，直接复用配置化 session type options。
29. session type 显式选择优先于 agent runtime 推断，agent 切换只同步建议类型。
30. project picker 从单按钮升级为历史项目 popover。
31. project popover 列表区限制高度并自行滚动。
32. project popover 底部固定“打开文件夹”操作，继续复用 path picker dialog。
33. agent picker trigger 从头像-only 升级为头像+名称。
34. 新增 project history options util，从 sessionsQuery 原始数据聚合，避免受 sidebar 搜索过滤影响。
35. 为 project history options 补单测。
36. 为 welcome session type 切换补展示层测试。
37. 为 project popover 历史列表、滚动区和打开文件夹入口补展示层测试。
38. 修复 `useChatQueryStore` selector 的 `?? []` 新数组导致的无限渲染风险。
39. 修复 session type resolver 把 `null` 误归一为 `native` 的优先级问题。
40. 修复 project 历史选择后 popover 未立即关闭的问题，并补展示层回归测试。
41. 进一步瘦身 `chat-conversation-panel.test.tsx`，删除已迁入 welcome 容器测试覆盖的 create draft 断言。

候选下一批：

42. 为 `ChatWelcomeProjectPicker` 单独补默认 badge / disabled 状态测试。
43. 为 `ChatInputBar` `surface` 行为补更明确测试名。
44. 检查 `ChatInputBarContainer` 是否还有可拆出的纯映射 helper，降低 container 文件复杂度。
45. 检查 welcome UI 移动端高度与滚动体验，避免居中输入在小屏溢出。
46. 检查 project label 长路径截断和 title 可访问性。
47. 检查 default workspace 为空时的 placeholder 行为。
48. 整理 staged/unstaged 状态，避免旧迁移版本留在 index。
49. 补 `.changeset` 判断：用户可见 UI 与 agent-chat-ui API 变更大概率需要 changeset。
50. 完整 lint/governance/maintainability guard/review。
51. 本地 dev UI 冒烟，验证 welcome 居中、project selector、session type selector 和发送链路。

## 已排除项

- 不把 project selector 放进 `chat-input-bar.container.tsx` 内部。
- 不复制一套 welcome 专用 composer。
- 不把 QoderWork/Codex 截图做成完全复刻，只借鉴布局与项目上下文入口。

## 下一步

优先处理 42-47：继续消化接近预算的测试与 container 文件，把剩余候选做成小批次可验证优化。
