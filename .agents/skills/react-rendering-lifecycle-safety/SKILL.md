---
name: react-rendering-lifecycle-safety
description: 当编写、修改或审查 React 组件类型、动态 renderer/component map、列表 key、条件包装、streaming UI、ReactMarkdown、自定义 render prop，或 iframe/canvas/editor/audio/video/Panel App 等必须保持实例状态的界面时使用；也适用于排查流式更新导致焦点、文字选区、弹层或内嵌应用状态丢失。用于保证 React 元素身份、DOM 连续性和用户交互状态不被后台更新破坏。
---

# React Rendering Lifecycle Safety

## 目标

React 数据更新不应自动等价为结构重建。除非产品明确要求重置，流式输出、查询刷新、回调换引用和状态切换都必须保留历史内容与状态型表面的元素身份。

核心模型：React 用 `type + key + 父级位置` 识别元素。三者任一发生变化，都可能卸载旧 subtree 并重新挂载；`memo`、`useMemo` 和 `useCallback` 不能改变这条身份规则。

## 强制合同

### 1. 组件类型必须稳定

- 会作为 JSX 类型、Markdown renderer、component map entry 或 render registry value 使用的组件，默认在模块级声明。
- 动态数据、文案和回调通过 props、Context 或稳定 owner 读取；不得通过重新创建组件类型传递动态值。
- 禁止在组件 render、带动态依赖的 `useMemo` / `useCallback` 或普通 factory 中创建组件函数，再把它作为 JSX 类型或第三方 renderer 交给 React。
- `useMemo(() => ({ p: () => ... }), [callback])` 仍会在依赖变化时生成新的组件类型；它只缓存值，不提供组件身份合同。

### 2. `key` 和父级结构必须表达业务身份

- `key` 使用稳定业务 ID，不使用数组索引、时间戳、streaming 状态、加载阶段或每次 render 新生成的值。
- `pending -> streaming -> final`、查询刷新、排序反馈和局部内容追加，不得改变同一业务实体的 key。
- 不要因为状态变化在互不相同的 wrapper / group / portal 结构之间搬运同一 subtree；确需改变父级结构时，先判断是否会重置内部状态。

### 3. 状态型表面是硬生命周期边界

- iframe、Panel App、editor、canvas、audio、video、WebGL、文件预览和持有浏览器 selection 的文本节点，默认必须保留 DOM 实例。
- 动态分组、折叠、消息聚合和流程摘要不能吞并或跨越这些边界。
- 只有明确的重置、关闭、切换实体或用户主动刷新才能 remount；必须用语义化 key 或显式 reset action 表达，并有测试证明。

### 4. 后台同步不得接管用户交互状态

- 用户未操作时，不得调用 `focus()`、改写 DOM selection、恢复旧焦点或关闭当前弹层。
- editor/store/query 的后台同步只更新其拥有的数据；浏览器 `activeElement`、文字选区和外部弹层不归输入 owner 自动接管。
- 不要在每个 Popover、搜索框或预览区保存/恢复焦点来掩盖上游违约；先修真正触发 focus、selection 或 remount 的 owner。

## 实现检查

修改 React 渲染链路前，逐项确认：

1. 哪些 props、query wrapper、callbacks 会在流式或刷新期间换引用。
2. 这些动态值是否参与创建组件类型、renderer map、key 或父级分组。
3. 哪些 subtree 持有浏览器状态或第三方运行时状态，必须视为硬边界。
4. `loading / pending / streaming / final / error` 是否只改变 props 和可见内容，而不替换同一实体的结构身份。
5. 是否存在因历史焦点问题留下的 `onFocusOutside.preventDefault()`、selection restore 或定时 focus 补丁；根因修复后应删除。

## 根因排查

焦点或选区消失时，必须先区分两类问题：

- **DOM 被替换**：保存目标 `Node` / iframe 引用，更新后检查 `isConnected` 与 `currentNode === previousNode`。
- **DOM 未替换但焦点被转移**：检查 `document.activeElement`、Selection 的 anchor/focus node，以及谁调用了 `focus()` 或提交了 editor selection。

不能只凭“看起来像抢焦点”下结论。先证明是 remount、focus transfer，还是两者同时存在。

## 验证合同

涉及 streaming、renderer map、列表分组或状态型表面时，至少增加一条贴近风险的 DOM 身份回归：

- 保持文本内容不变，只替换动态 callback / query wrapper，断言 Text node 身份不变且 Selection 仍存在。
- 追加后续消息、reasoning 或工具结果，断言 iframe/editor/canvas 是同一节点。
- 覆盖 `pending -> streaming -> final`，而不只测试一个静态 render。
- 用户可见问题在条件允许时再做真实浏览器冒烟；单元测试必须直接断言节点身份，不能只断言内容仍可查询。

## 与其他 Skill 的关系

- 状态、query/store、streaming flow owner：联动 `mvp-view-logic-decoupling`。
- Popover、焦点、键盘和交互反馈：联动 `frontend-interaction-quality`。
- 组件拆分与抽象必要性：联动 `writing-beautiful-code`。
- bugfix 验证与浏览器验收：联动 `nextclaw-validation-workflow`。

## 输出要求

使用本 skill 后，说明：组件类型是否稳定、key/父级是否稳定、哪些 subtree 是硬生命周期边界、是否存在后台焦点/选区写入，以及节点身份如何被验证。
