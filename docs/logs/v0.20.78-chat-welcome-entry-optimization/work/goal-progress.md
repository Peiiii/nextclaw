# Goal Progress

## 当前目标

把新会话欢迎页升级为居中意图入口后，继续优化 chat 入口体验：模型选择器支持搜索与收藏置顶，收藏持久化收敛到 kernel 通用偏好 KV manager，并让欢迎页/输入栏相关浮层在小高度设备上不超出可见区域。

## 明确非目标

- 不重写 chat composer / send 主链路。
- 不把 project 选择塞进输入组件内部。
- 不为了凑数量做无意义 UI 花活或表层格式化。
- 不碰、不提交当前工作区中未提交的 Codex desktop visibility 改动。
- 不把模型收藏写成前端 localStorage 特例。
- 不为一个模型选择器发明只能服务单点的窄抽象。
- 不用窗口监听或屏幕尺寸特判修复浮层位置，优先使用浮层自身的可用空间合同。

## 冻结边界 / 不变量

- welcome 是 `features/chat/features/welcome` 子 feature。
- conversation panel 只能装配 welcome，不能持有 welcome 业务规则。
- `ChatInputManager` 仍是发送 projectRoot 的业务 owner。
- 偏好持久化归 kernel manager，UI 只能通过 API/query 消费。
- 模型收藏只是通用偏好 KV 的一个 key，不进入专用 runtime / model 硬编码。
- 技能、模型、slash、welcome project/session type 等 chat 入口浮层必须尊重触发点上下文的可用高度，内部列表滚动。
- 每项优化必须能对应到代码证据、测试证据或规则沉淀。

## 已完成进展

- 1-41：welcome 子 feature 迁移、嵌入 input surface、默认 workspace/projectRoot 链路、显示规则 util、会话类型选择、历史项目下拉、agent 名称展示、真实页面冒烟、panel/welcome 测试瘦身、相关测试与规范补充。
- 42：欢迎页批次已提交为 `dd91bfbf5 feat(chat): add welcome context entry`。
- 43：新增 kernel 通用偏好 KV manager/store 草案，并接入 server preferences route 与 UI preference API。
- 44：模型选择器 view-model 增加收藏优先分组、搜索文案和通用 option action 合同。
- 45：欢迎页能力卡片改为 prompt suggestion，点击后填入输入框并聚焦，发送时继续走原会话创建主链路。
- 46：输入栏技能选择、模型搜索、slash 技能菜单、welcome 项目/会话类型菜单改为基于 Popover available height 的动态高度约束。
- 47：`focusComposerAtEnd(nodes?)` 扩展为可按外部 composer nodes 定位，修复欢迎卡片填入 prompt 后光标没有稳定落到新内容末尾的问题。
- 48：chat slash menu 触达后顺手收敛跨目录 import 到 `@agent-chat-ui/` alias，满足 module-structure drift 治理。
- 49：模型搜索、普通 select、技能选择、slash、welcome project/session type 浮层统一增加 `collisionPadding=12` 与设计高度上限，避免小高度设备贴边或顶到视口边界。
- 50：开始新一轮维护性减债：preference API 类型从共享大 `types.ts` 迁入 `preferences/` 子目录，ChatInputManager 测试按 focus 主题拆 describe，tokenized composer 准备整理 imperative handle 依赖。
- 51：tokenized composer 改为边界解构与稳定回调，清掉新增 React Compiler / props 读法风险。
- 52：输入区主组件与 textarea 组件同步改为边界解构，并把旧 textarea 跨目录相对导入收敛到 `@agent-chat-ui/` alias。
- 53：已复跑 agent-chat-ui 输入区 29 个测试、agent-chat-ui tsc/lint、UI 侧 37 个定向测试、UI tsc/lint；当前 lint 仅剩未触达旧警告。
- 54：真实 DOM 枚举发现欢迎页 Agent 选择器也是同类入口浮层，已补上 `collisionPadding=12` 与 Radix available-height maxHeight 合同。

## 当前下一步

复跑 governance / generated clean / maintainability guard，并用真实页面 DOM 验证模型、技能、slash、project、agent、session type 的小高度浮层边界。

## 锚点计数器

0/20
