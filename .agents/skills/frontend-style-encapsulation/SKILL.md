---
name: frontend-style-encapsulation
description: 当修改前端样式、响应式布局、紧凑模式、Tailwind/CSS/container query、组件视觉状态，或用户质疑样式是否内聚、可移植、自洽时使用；尤其适用于 reusable UI package、shared component、跨宿主复用组件的样式 owner 判断。
---

# 前端样式内聚规则

## 目标

让前端样式成为组件合同的一部分，而不是散落在宿主全局 CSS、页面外壳或临时覆盖里。样式修复要提升组件自洽性、可移植性和长期可维护性。

## 修改前判断

- 先确认样式 owner：这个视觉状态属于组件自身、组件变体、宿主页面、主题系统，还是一次性页面编排。
- 如果样式描述的是组件在不同容器宽度、状态或密度下的固有表现，默认归组件 owner，不归宿主全局 CSS。
- 如果组件来自 reusable package 或 shared component，默认要求样式合同随组件一起走；宿主只负责布局位置、主题 token 和业务数据。
- 使用全局 CSS 前先证明它是全局主题、reset、字体、scrollbar、design token 或跨组件基础设施；否则优先回到组件 class、组件局部样式、variant API 或包内样式入口。
- 响应式判断优先基于真实约束容器，而不是整屏 viewport；右侧面板、dock、sidebar、split pane 都可能让组件进入窄容器。

## 实现规则

- 紧凑模式应有明确阈值和取舍：先保留核心操作，再收起次要文字，最后才隐藏低频控制；不要过早牺牲可读信息。
- 收起文字时必须保留可理解入口：图标、`aria-label`、tooltip、popover/select content 等要能表达当前含义或当前值；纯图标操作的体验细则走 `frontend-interaction-quality`，不要只依赖浏览器原生 `title`。
- 不要用宿主全局 CSS 反向选择 reusable 组件内部结构；这会制造隐式依赖，让组件离开当前 app 后行为丢失。
- 不要把一次 bugfix 写成硬编码覆盖。优先用组件已有设计体系、Tailwind container variant、CSS container query、组件 variant 或局部 class 表达稳定语义。
- 样式新增应贴近 DOM owner，不为了一个局部状态新建远距离 CSS 文件、全局选择器或页面级 wrapper。
- 如果必须新增全局样式，说明为什么组件 owner 不合适，并把 selector 限制在稳定语义类或主题层，不依赖临时 DOM 层级。

## 验证

- 对响应式布局，至少验证正常宽度、窄容器、极窄容器三个状态中的相关子集。
- 用户可见布局修复不能只靠单测；需要浏览器截图、Vite build、或最贴近真实链路的 DOM/CSS 验证之一。
- 如果真实登录态或真实页面被阻塞，明确说明阻塞点，并用同一构建管线的最小替代验证补足。
