# v0.26.2 收敛 AI 运行元数据展示

## 迭代完成说明

- AI 回复仍然保留实际运行模型和完整 `ai_execution` 元数据。
- 当运行没有可展示的 token 数量时，消息页脚只展示模型，不再持续显示“Token 用量不可用”。
- “查看运行元数据”继续展示输入、输出、缓存、总量和用量状态；缺失值保持“暂无”，用量状态保持“不可用”。
- 运行元数据弹窗统一使用 `@nextclaw/agent-chat-ui` 的 shadcn 风格 Dialog primitive；遮罩、容器、标题、说明、关闭按钮和居中动画不再由消息业务组件重复拼装。
- 根因是 footer summary builder 把 `usage.status = unavailable` 这一低频调试事实直接拼进了高频消息页脚，并在没有任何 token segment 时再次补入同一占位。
- 用户提供的真实界面截图和修前定向测试共同确认了该行为；修复删除 footer 专用 unavailable 分支与文案，让无 token 的唯一展示路径回到“只显示模型”，因此处理的是展示 owner，而不是隐藏或改写上游元数据。
- 弹窗动画的直接根因是 reusable Dialog 同时使用居中 `translate` 和会接管 `transform` 的 `animate-in`，却遗漏 shadcn 居中弹窗配套的 slide 变量；动画期间位置从未居中状态开始，结束帧再跳回。结构性根因是 primitive 只包了 Radix Content，Header 与关闭控件仍泄漏给业务组件。

## 测试/验证/验收方式

- 修前基线：定向测试在新验收合同下收到 `gpt-5 · undefined`，对应旧实现依赖 unavailable footer 文案的分支；用户截图同时证明真实界面显示了“Token 用量不可用”。
- 定向测试：execution summary、message texts 和 message list container 共 3 个测试文件、25 个用例通过。
- reusable Dialog 修前回归测试按新合同失败，明确缺少 `duration-200` 和居中进入/退出 slide classes；修后 Dialog owner 与 message list 共 2 个测试文件、20 个用例通过。
- assembled 边界验收：同一消息容器中的完整用量消息继续显示输入/输出统计；不可用消息只显示模型，详情行仍显示用量状态不可用。
- `@nextclaw/ui` 与 `@nextclaw/agent-chat-ui` 的 TypeScript 检查和 package lint 均通过；`@nextclaw/ui` 生产构建通过，构建产物已清理并通过 generated-clean 检查。
- `lint:new-code:governance` 与 governance backlog ratchet 通过。
- 本地源码页面 `http://127.0.0.1:5174/chat/sid_bmNwLW1ycjVka3Z2LTYxYzRhZTRh` 已加载当前 Vite 源码。真实消息通过“更多操作 → 查看运行元数据”打开统一 Dialog，字段显示输入 `36k (35976)`、输出 `124`、缓存 `128`、总量 `36.1k (36100)` 和已报告状态；打开后 250ms 保持居中且无结束跳位，关闭后 260ms 从 DOM 移除。

## 发布/部署方式

- 新增 `.changeset/hide-unavailable-token-summary.md`，标记 `@nextclaw/ui` 与 `@nextclaw/agent-chat-ui` patch。
- 本次未发布 NPM 包、未部署，也未重启任何现有 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 打开一条模型信息存在、但 token 用量状态为不可用的 assistant 消息。
2. 确认页脚显示模型，但不显示“Token 用量不可用”或其它 token 占位。
3. 点击“更多操作 → 查看运行元数据”，确认弹窗从页面中心平滑缩放进入，没有从右下方跳回中心。
4. 确认标题、说明、字段列表和关闭按钮使用统一 Dialog 结构；按 Esc、点击遮罩或关闭按钮均可退出并恢复焦点。
5. 确认用量状态仍显示“不可用”，缺失的 token 字段显示“暂无”。
6. 打开一条有完整 token 用量的消息，确认输入/输出统计仍按 `k`、`m`、`b` 单位展示。

## 可维护性总结汇总

- 本次是用户可见 bugfix，footer 生产逻辑通过删除 unavailable 分支和专用 i18n key 实现；弹窗复用通过补全既有 Dialog primitive 并删除业务组件手写 modal 骨架实现，没有新增平行组件、helper、adapter 或兼容路径。
- token 事实 owner、消息 metadata、详情弹窗和 more actions 均未改变；只收敛现有 presentation owner 的高频展示规则。
- Dialog 的视觉和交互 owner 收敛到 `default-skin/dialog.tsx`；消息 action 只保留菜单、open 生命周期、选中详情与字段内容。open 状态和详情数据分离，退出动画不再因清空数据而先变成空壳。
- maintainability guard 检查 9 个 TypeScript 文件：总代码 `+165 / -107 / 净增 58`，其中非测试代码 `+79 / -80 / 净减 1`，满足非功能改动生产语义代码不得净增的门槛。
- guard 为 `0` 个 error、`3` 个 warning：message-list 目录仍是已登记的历史预算例外且文件数没有增加；agent-chat-ui 测试当前 `845` 行、变更前 `842` 行；nextclaw-ui 容器测试当前 `841` 行、变更前 `842` 行。两个测试文件的后续拆分缝均是把 fixture/builder 与行为用例分开。
- 主观可维护性复核无新增 finding。正向减债包括删除 footer unavailable 分支、label contract、中英文专用文案，以及 message action 内重复的关闭按钮和 modal 结构；组件类型保持模块级稳定，没有新增 effect、helper、adapter、兼容分支或平行 Dialog owner。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，用于修正不可用 token 状态的消息页脚展示，待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，用于统一运行元数据弹窗 primitive 并修正居中动画，待统一发布。
- Changeset：`.changeset/hide-unavailable-token-summary.md`。
- 本次未执行 NPM 发布。
