# 前端优化优先级计划

## 背景

本计划沉淀对 `packages/nextclaw-ui` 前端优化方向的阶段性调查结论。判断对象不是单个视觉问题，而是 NextClaw 作为 AI 时代个人操作层时，前端主工作台是否能稳定承接统一入口、意图到执行闭环、自感知和能力编排。

当前前端已经具备 `AppPresenter`、feature manager、Zustand store、DocBrowser、SideDock、共享 UI primitive 等基础结构。主要问题不是没有架构，而是部分高频主链路仍停留在页面或业务 container 中编排，导致 owner 不完整、组件过重、后续新增能力容易继续堆到 React 层。

## 指导思想

- 产品愿景优先：优先优化能增强统一入口、意图到执行闭环、自感知和真实调度能力的前端链路。
- 正确 owner 优先：状态归 store，业务动作和跨模块编排归 manager / presenter，组件主要负责连接和展示。
- 单一主链路优先：同一事实、动作或状态变更不应长期存在页面 hook、callback registry、manager 多套平行入口。
- 删除和收敛优先：优化不是新增更多包装层，而是删除重复中转、收敛职责、减少页面级编排。
- 交互可理解性优先：紧凑工作台可以减少文字，但 icon-only、禁用态、危险操作必须具备可访问名称、tooltip / popover 和统一确认路径。
- 先测再做性能：没有真实卡顿证据前，不把 memo、虚拟列表或渲染专项放到第一刀。

## 优先级排序

### P0：收敛 Chat 主运行链路 owner

最高优先级。Chat 是 NextClaw 的第一入口，当前 `NcpChatPage` 仍同时承担 route selection、agent hook、send envelope、restore draft、materialize route、UI binding、snapshot sync 等职责。`ChatStreamActionsManager` 目前更像通过 `bind` 注入的 callback registry，而不是完整 runtime action owner。

目标：

- 让 `NcpChatPage` 退回页面挂载与 owner 连接层。
- 将 send / abort / resume / materialize / restore draft 的编排收敛到明确的 Chat runtime binding owner。
- 判断 `ChatStreamActionsManager` 应升级为真实 owner，还是合并到更合适的 NCP chat runtime owner。
- 删除不必要的 callback 转发和页面级业务分支。

验收：

- 页面不再直接组装 NCP send envelope 的完整业务流程。
- 发送、停止、恢复、草稿恢复、根会话 materialization 有单一 owner。
- 定向测试覆盖发送成功、发送失败恢复草稿、无 session materialize、stop / resume 基本行为。

### P1：瘦身 Chat 输入区 container

第二优先级。`ChatInputBarContainer` 是用户最高频输入入口，目前同时承担 query 派生、模型 / skill view model 构造、附件上传、focus request、send disabled、toolbar 构造和 DOM ref 协调。

目标：

- 保留 `ChatInputBarContainer` 作为业务 container，但只让它做订阅、传参和 DOM ref 桥接。
- 将模型选项、thinking 选项、skill picker、toolbar、send / stop availability 的 view model 构造沉到 input manager 或纯 builder。
- 保持 `ChatInputBar` 仍是纯展示 / 通用交互组件，不读取业务 store。

验收：

- 输入区 view model 构造可以独立单测。
- container 行为更接近“读 snapshot -> 生成 view props -> 渲染”。
- 不新增 ad hoc `useEffect` 作为业务补丁点。

### P2：建立 Marketplace workflow owner

第三优先级。Marketplace 是生态入口，但当前页面仍集中管理搜索 debounce、scope / sort、分页、安装 / 卸载 pending、详情加载、DocBrowser 打开、scene route 展示。

目标：

- 建立 marketplace page controller / manager，统一处理 search、scope、sort、pending action、detail open 和 DocBrowser 内容加载。
- 页面只保留路由参数、查询订阅和渲染分支。
- 清理 Marketplace 中内联 `{ zh, en }`、`language.startsWith(...)` 等临时 i18n 拼接，回到 i18n owner。

验收：

- Marketplace 页面不再是安装、管理、详情加载的实际 workflow owner。
- 安装、卸载、详情打开、scene route 有可测试的 view model / workflow。
- 用户可见文案不再在组件内临时拼双语。

### P3：统一 icon action、确认和 disabled reason

第四优先级。项目已有 `IconActionButton`、tooltip、confirm dialog 等 primitive，但部分页面仍手写 icon button、原生 `title`、`window.confirm`，导致紧凑模式下操作含义和危险确认不统一。

目标：

- icon-only 操作统一使用 shared action primitive 或等价模式。
- 危险操作统一使用 confirm dialog，不再用 `window.confirm`。
- 禁用按钮若仍可见，应尽量解释不可用原因。
- 删除页面级重复 tooltip / button 样式。

验收：

- 高频页面的 icon-only 控件具备 aria-label 和 tooltip / popover。
- 危险操作确认体验一致。
- ProviderForm、RuntimeControl、Agents、Panel Apps、Service Apps 等页面不再各自手写一套操作控件语义。

### P4：ProviderForm 和设置页状态 owner 化

第五优先级。`ProviderForm` 把远端 provider 配置镜像到一组 local state，并同时处理表单草稿、认证轮询、测试连接、删除确认和保存 payload。

目标：

- 区分远端配置事实、表单草稿、认证会话、保存 payload 四类 owner。
- 将认证轮询和保存 payload 构造移出 JSX 组件主流程。
- 统一删除确认和操作按钮 primitive。

验收：

- ProviderForm 主体更接近表单渲染和用户输入连接层。
- 保存 payload、认证轮询、删除确认具备单独可测边界。
- 不用 effect 做复杂业务迁移；必要 effect 只同步外部系统。

### P5：DocBrowser 浮窗逻辑渐进收敛

第六优先级。DocBrowser 已经有 store / manager，是相对成熟的统一入口能力面；但浮窗拖拽、resize、iframe message、URL input 仍集中在组件中。

目标：

- 不单独为了“干净”大重构。
- 后续扩展 panel app、docs、resource viewer 时，顺手把浮窗交互和 iframe message 逻辑沉到更明确的 interaction owner / hook。
- 保持共享 resize primitive 的通用性，不把 iframe 特例塞回业务内容。

验收：

- 新增 DocBrowser 能力不继续膨胀 `doc-browser.tsx`。
- 拖拽、resize、iframe message 的测试或浏览器冒烟能覆盖关键交互。

### P6：真实性能专项

第七优先级。当前没有证据表明最大痛点是渲染性能，因此不应先做盲目 memo 或虚拟列表。

目标：

- 在 owner 收敛后，对 Chat message list、sidebar session list、Marketplace grid、DocBrowser iframe 做真实测量。
- 只对有数据支撑的瓶颈做专项优化。

验收：

- 有实际 profiler、浏览器冒烟或可复现卡顿证据。
- 性能改动不引入新的宽 props、双写状态或额外中转层。

### P7：视觉体系和样式一致性收敛

最后优先级。当前确实存在 `rounded-2xl`、卡片、渐变、shadow 和页面局部样式分散问题，但视觉统一应跟随 shared primitive 和页面 owner 收敛推进。

目标：

- 优先把重复视觉骨架沉到 shared UI primitive。
- 页面只负责布局和业务组合，不反向覆盖 reusable 组件内部结构。
- 紧凑工作台保留核心任务、当前值和主要动作。

验收：

- 视觉收敛减少重复 JSX / class，而不是只改一批颜色和圆角。
- 响应式验证覆盖正常宽度、窄容器和极窄容器的相关状态。

## 推荐第一刀

第一刀建议做 `P0 + P1` 的小闭环：先让 Chat send / runtime binding 更像真实 owner，再把输入区 view model 构造从组件中拿出来。这样直接作用于最高频主路径，也最符合 NextClaw “统一入口 + 意图到执行闭环”的产品方向。

## 非目标

- 不先做单纯视觉换肤。
- 不先做没有测量依据的性能专项。
- 不通过新增空心 wrapper 或 callback proxy 来伪装 owner 收敛。
- 不在本计划阶段修改源码；具体实现应另起执行任务并按标准交付流程验证。

## 后续升级条件

当开始执行其中某个优先级时，应将对应范围拆成更具体的实现计划或迭代记录。若完成源码、测试或运行链路配置改动，收尾阶段再按迭代留痕规则判断是否进入 `docs/logs`。
