---
name: frontend-interaction-quality
description: 当设计、修改或评估前端交互体验、操作按钮、hover/focus/active/disabled 状态、tooltip、popover、菜单、键盘可达性、紧凑模式下的操作可理解性，或用户指出“这个操作不知道是什么”“体验不统一”“交互规范”时使用。
---

# 前端交互体验质量规则

## 目标

让用户在任何密度和布局下都能理解当前可做什么、操作会发生什么、系统处于什么状态。交互规范应优先沉到组件合同和共享 primitive，而不是靠页面临时补丁。

## 判断顺序

- 先确认交互 owner：这是通用 primitive、共享组件、业务组件，还是一次性页面编排。
- 如果同一种操作骨架在多个地方出现，优先复用已有按钮、tooltip、菜单、popover、dialog 或 action primitive；不要复制一套相似 JSX。
- 如果问题只出现在某个组件的紧凑、hover、禁用或图标态，默认由组件自己负责，不让宿主全局 CSS 或页面 wrapper 兜底。
- 先保证可理解性和可达性，再调整视觉精致度；不要用 hover 效果替代操作含义说明。

## 操作控件规范

- 纯图标按钮必须同时具备可访问名称和可见解释：`aria-label` 或等价文本负责读屏/键盘，tooltip 或 popover 负责鼠标悬停可理解性；不要只依赖浏览器原生 `title`。
- 紧凑模式收起文字时，必须保留当前值或操作含义的解释入口；高频直接操作优先 tooltip，涉及当前值、选项集合或二级动作时优先 popover/menu/select。
- 禁用按钮如果仍然可见，应尽量解释含义或不可用原因；实现 Tooltip 时注意 disabled 元素可能不能直接触发 hover。
- hover、focus-visible、active、disabled 状态要表达同一语义层级；不要只给 hover，不给键盘焦点。
- 危险、不可逆、跨系统或会丢失数据的操作，应有明确文案、确认或可撤销路径；普通导航和轻量切换不要过度打断。

## 信息密度与反馈

- 窄容器里优先保留主任务、当前值和主要动作；次要说明可以收起，但入口不能消失到需要猜。
- 状态变化要有即时反馈：loading、pending、success、error、empty、disabled 不能只靠按钮是否变灰来暗示。
- 同一操作区里的 icon-only 行为应统一 tooltip 方向、延迟、文案粒度和按钮尺寸。
- 文案优先说用户结果，不说内部实现；例如“移出 SideDock”优于“切换 dock state”。

## 可折叠卡片/行交互

- 展开/收起的点击区域必须是整行或整个卡片头部，不要只用小箭头（~14px）作为唯一点击目标；箭头仅作视觉指示。
- 折叠状态下必须默认显示关键内容预览（如 `line-clamp-2`），不要把所有信息都藏在展开后面——否则折叠态等于空壳。
- 当整行可点击时，行内的独立操作按钮（Switch、菜单、Dropdown 等）必须阻止冒泡或被排除在展开逻辑之外：用 `data-no-expand` 属性 + `closest('[data-no-expand]')` 做事件委托隔离，避免点击操作误触发展开。
- 可交互的卡片/行应有 hover 视觉反馈（如 Tailwind `group` + `group-hover`）暗示可点击；展开状态应有边框或背景色变化，让用户感知当前状态。
- 不要把展开/收起做成路由跳转或 modal——内联展开（inline expand）最适合信息密度渐进展示的场景。

## 收尾检查

- 新增或修改 icon-only 控件后，检查是否有 `aria-label`/可见文本、tooltip/popover、键盘焦点样式和禁用态。
- 用户可见交互改动至少做一个贴近链路的验证：组件测试、浏览器冒烟、截图或 Story/DOM 验证。
- 如果本次只修一个局部，也要判断是否需要把规则沉到 shared primitive、skill 或治理脚本；不能只口头说“以后注意”。
