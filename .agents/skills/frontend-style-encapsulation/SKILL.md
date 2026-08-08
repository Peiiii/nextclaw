---
name: frontend-style-encapsulation
description: 当修改前端样式、shared UI、设置界面、响应式/紧凑布局、输入焦点、配色、Tailwind/CSS/container query，或裁决 reusable component 的样式 owner 时使用。
---

# 前端样式内聚

样式是组件合同的一部分。先判断视觉状态属于组件、组件 variant、主题、宿主布局还是一次性页面编排；固有状态和容器响应默认归组件，宿主只负责位置、token 和业务数据。全局 CSS 只承载主题、reset、字体、scrollbar、token 等基础设施。

## Shared UI 边界

- 基础组件纯展示、业务无关，只处理样式、布局、状态、可访问性和通用交互；不读业务 store/query、路由和业务文案，也不理解 marketplace/provider/agent/session。
- props 使用 `variant/size/tone/isActive/isLoading/disabled/label` 等 UI 语义；业务实体、业务 action 和状态机留在 feature component。
- 重复按钮、链接、标签、空态、提示、列表骨架、卡片壳和工具栏动作优先进入 shared UI owner，再由业务层取数、翻译、权限判断和编排。
- 颜色表达稳定语义：primary、destructive、muted 等；背景与前景成对验收，不以单个低饱和色值证明协调。

## 实现合同

- 响应式优先依据真实约束容器，而非 viewport；正常、窄和极窄状态按任务相关子集验证。
- 紧凑模式依次保留核心动作、收起次要文字、隐藏低频控制；文字收起后仍有图标、aria-label、tooltip 或 popover 表达含义/当前值。
- 文本输入容器聚焦前后 border width/color、background、shadow 和 ring 完全不变。填充型输入使用 `border-0`，不以透明边框占位；描边型保持静态描边。
- 不用宿主全局 selector 反向依赖 reusable component 内部 DOM；局部状态用组件 class、variant、container query 或包内样式入口。
- 新样式贴近 DOM owner。必须全局化时说明原因，并只依赖稳定语义类/主题层，不依赖临时 DOM 层级。

## 设置界面

触达设置/配置页时以 `docs/designs/2026-07-18-settings-visual-system.design.md` 为视觉合同：

- 统一使用 shared settings primitives 和 `SettingsPage` 画布，业务页不自拼根级宽度、居中、间距或分栏高度；结构差异用组件 variant。
- 普通结构是“分区 -> 分组 -> 设置行”，不为每项套 Card。一行一个意图：左侧标题/说明、右侧控件，窄容器转上下。
- 页面画布无描边；分组用浅背景和圆角，行间最多一条低对比分隔；容器嵌套不超过两层，选中优先填充。
- 列表—详情页复用 `ConfigSplitPage`：整体最多一条外边界，列表与详情最多一条分隔，列表项默认无边框。
- shared primitive 只用 token，保持业务无关；业务标题和说明走 i18n。后端 schema/uiHint 的派生标签不得覆盖前端用户文案，静态 locale 扫描不能替代 DOM 验收。
- MCP 商品、release notes、警告/错误和代码块可有独立语义表面，但不反向成为普通设置项默认样式。

## 验证

- 文本输入：真实 DOM 比较聚焦前后 border/background/shadow；填充型 border width 为 `0px`。
- 已有用户认可原型：相同关键视口整页截图对照层级、间距、尺寸、边界、滚动 owner 和交互态；偏差要收敛或明确有意取舍。
- 主题：真实整页逐一切换，检查 shell、header、navigation、content、文字和控件；先消除固定色与 token 的 owner 冲突。
- 设置页：覆盖桌面、窄桌面、侧面板后的窄容器和相关移动端，检查边框预算、信息层级与操作可达。
- 配色：在相关明暗主题记录背景/前景计算值并看实际组合。
- 用户可见布局不能只靠单测；使用浏览器截图、真实 DOM/CSS 或最贴近链路的构建证据。真实页面阻塞时说明缺口和替代证据。
