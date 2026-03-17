# `@nextclaw/ncp-react-ui` 设计文档

## 摘要

新增一个包，目录为 `packages/ncp-packages/nextclaw-ncp-react-ui`，包名为 `@nextclaw/ncp-react-ui`。

这个包定位为 NCP Agent 应用的 React 展示层积木，只包含纯展示组件与样式 token，不包含传输层、运行时编排、会话持久化、业务流程或 demo 专属行为。

第一阶段只有一个消费方：`apps/ncp-demo/frontend`。

本设计基于并进一步收窄以下两份设计文档的分层约束：

- [NCP 定位与愿景](../designs/2026-03-17-ncp-positioning-and-vision.md)
- [NCP Agent 应用积木化原则](../designs/2026-03-15-ncp-agent-app-building-block-principles.md)
- [Create Agent UI with NCP Client and Toolkit](../designs/2026-03-23-create-agent-ui-with-ncp-client-and-toolkit.md)

## 目标

构建一套可复用的 UI 积木，让后续 Agent 应用在搭建前端时，不必每次从零重写聊天界面，而是直接复用稳定的 React 展示组件。

目标分层如下：

1. `@nextclaw/ncp` 提供协议类型。
2. `@nextclaw/ncp-react` 提供 React 绑定与运行时 hook。
3. `@nextclaw/ncp-react-ui` 提供展示组件。
4. `apps/*` 负责组装运行时、展示层与应用自身业务逻辑。

## 非目标

- 不把 `useHydratedNcpAgent` 或任何 hook 从 `@nextclaw/ncp-react` 挪到新包。
- 不把会话创建、删除、seed 加载、持久化逻辑放进新包。
- 不让 `@nextclaw/ncp-react-ui` 依赖 `NcpHttpAgentClientEndpoint`。
- 不把 `packages/nextclaw-ui` 中的产品级 UI 直接搬入新包。
- 第一阶段不让除 `ncp-demo` 之外的其它应用消费该包。
- 第一阶段不引入 `AgentChatPage` 这类预制业务壳层。

## 为什么要单独建包

### 为什么不直接扩展 `@nextclaw/ncp-react`

`@nextclaw/ncp-react` 的职责是 React 绑定层，负责暴露 hook 和框架接入能力。如果把可视组件也塞进去，`框架绑定` 与 `展示积木` 的边界会被打乱，未来只想要运行时绑定的消费方也会被迫引入视觉层。

### 为什么不直接复用 `@nextclaw/ui`

`@nextclaw/ui` 已经是产品级 UI 包，里面包含 presenter/store/business state 等产品实现判断，层级过高，也过于耦合，不适合作为中立的 NCP UI 积木来源。

### 为什么以 `ncp-demo` 作为起点

`apps/ncp-demo/frontend/src/ui` 已经是当前仓库里最接近“纯展示层”的地方，包括：

- `chat-header.tsx`
- `chat-input.tsx`
- `error-box.tsx`
- `message-bubble.tsx`
- `message-list.tsx`
- `message-part.tsx`
- `session-actions.tsx`
- `session-card.tsx`
- `session-list.tsx`

这些文件已经接近目标抽象层级。后续工作重点不是重新发明，而是把边界再卡紧，把类型从 demo 专属形态整理成可复用形态。

## 包定位

### 推荐分层

推荐层级顺序如下：

1. `@nextclaw/ncp`
2. `@nextclaw/ncp-toolkit`
3. `@nextclaw/ncp-react`
4. `@nextclaw/ncp-react-ui`
5. `apps/*`

### 负责什么

`@nextclaw/ncp-react-ui` 负责：

- 渲染 `NcpMessage` 与 `NcpMessagePart`
- 根据 props 渲染 chat composer 和操作区
- 渲染 session list 与 session item
- 导出包级样式与 CSS token
- 在仍然属于纯展示层的前提下，提供轻量布局积木

`@nextclaw/ncp-react-ui` 不负责：

- `send / abort / replay` 等消息行为逻辑
- session 的读取与存储
- API client 初始化
- 路由同步
- provider/model 加载
- 业务状态管理
- 应用导航

## 设计原则

### 1. 纯展示优先

所有组件必须是纯展示组件。允许保留少量纯视图本地状态，例如 textarea 的交互状态、焦点处理、纯键盘行为；但不得承载 NCP 运行时状态、传输状态或持久化状态。

### 2. 直接使用 NCP 原生消息类型

消息渲染相关组件直接接收 `@nextclaw/ncp` 里的 `NcpMessage` 与 `NcpMessagePart`。在没有出现明确跨应用不兼容之前，不额外造第二套 message model。

### 3. 编排留在应用层

`ncp-demo` 继续保留容器层。新包只通过 props 接收数据与回调，不把应用逻辑反向塞进复用层。

### 4. 文件与目录统一使用 kebab-case

所有新建目录与文件必须使用 `kebab-case`。

示例：

- `packages/ncp-packages/nextclaw-ncp-react-ui`
- `src/chat/chat-input.tsx`
- `src/chat/message-list.tsx`
- `src/session/session-list.tsx`
- `src/styles/tokens.css`

React 组件导出名可以继续使用 PascalCase，但文件名和目录名保持 `kebab-case`。

### 5. 优先采用 CSS-first 可移植方案

第一阶段使用包内 CSS 与 CSS variables，而不是把包直接绑定到 Tailwind。这样可以保证该包能在不同 Vite React 应用中直接复用，不强制下游项目接受某个 utility framework。

## 第一阶段范围

第一阶段只做包骨架与最小可用组件迁移。

包含：

- `chat-header`
- `chat-input`
- `error-box`
- `message-bubble`
- `message-list`
- `message-part`
- `session-card`
- `session-list`
- `session-actions`
- 包级样式导出

不包含：

- 任何新的 runtime hook
- 多页面壳层
- 产品级顶部导航
- provider/settings UI
- storybook 或独立文档站接入

## 建议目录结构

```text
packages/
  ncp-packages/
    nextclaw-ncp-react-ui/
      package.json
      tsconfig.json
      eslint.config.mjs
      src/
        index.ts
        styles/
          index.css
          tokens.css
        types/
          session-list-item.ts
        chat/
          chat-header.tsx
          chat-input.tsx
          error-box.tsx
          message-bubble.tsx
          message-list.tsx
          message-part.tsx
        session/
          session-actions.tsx
          session-card.tsx
          session-list.tsx
```

说明：

- `index.ts` 只用于导出，不写业务逻辑。
- 文件继续保持单一职责与 `kebab-case`。
- 不是协议原生类型、但又需要复用的轻量类型，放在 `src/types` 下。

## 对外 API

第一阶段导出面要尽量小而稳：

```ts
export * from "./chat/chat-header.js";
export * from "./chat/chat-input.js";
export * from "./chat/error-box.js";
export * from "./chat/message-bubble.js";
export * from "./chat/message-list.js";
export * from "./chat/message-part.js";
export * from "./session/session-actions.js";
export * from "./session/session-card.js";
export * from "./session/session-list.js";
export type * from "./types/session-list-item.js";
import "./styles/index.css";
```

### 面向消息的 API

直接使用 NCP 原生类型：

- `NcpMessage`
- `NcpMessagePart`
- `NcpError`

### 面向 session 的 API

不要直接复用 `apps/ncp-demo/frontend/src/lib/session.ts` 里的 demo 私有 `SessionSummary`。

新包定义自己的轻量展示模型：

```ts
export type SessionListItem = {
  id: string;
  title: string;
  subtitle?: string;
  isActive: boolean;
};
```

`ncp-demo` 在消费时自行把自己的 `SessionSummary` 映射成 `SessionListItem`。

这样可以保证新包从第一天起就不和 demo 的存储结构耦合。

## 组件边界规则

### `message-part`

职责：

- 渲染单个 `NcpMessagePart`
- 支持当前 demo 已验证的 part 类型：
  - `text`
  - `reasoning`
  - `tool-invocation`
- 为未知 part 类型提供稳定 fallback

约束：

- 不做异步拉取
- 不做业务惰性加载
- 不引入超出当前 NCP 协议之外的 demo 私有格式假设

### `message-bubble`

职责：

- 渲染单条 `NcpMessage`
- 渲染 role 与 status 元信息
- 将 part 渲染委托给 `message-part`

约束：

- 不处理 grouping
- 不处理 stream reconciliation

### `message-list`

职责：

- 渲染消息列表
- 渲染空态文案

约束：

- 第一阶段不做自动滚动
- 第一阶段不做 virtualization

### `chat-input`

职责：

- 渲染输入框与主按钮
- 支持 `Enter` 发送、`Shift+Enter` 换行
- 通过 props 支持 `stop` 状态展示

约束：

- 不绑定 runtime
- 第一阶段不引入 model 选择、slash command、skills UI

### `chat-header`

职责：

- 渲染标题
- 通过回调与 disabled props 渲染纯展示按钮区

### `error-box`

职责：

- 渲染 `NcpError | null`
- 保持中立可复用

### `session-card` 与 `session-list`

职责：

- 渲染可交互的 session 列表项
- 通过回调暴露 select/delete/new/refresh

约束：

- 不直接依赖 demo 存储层类型

## 样式策略

第一阶段随包提供默认 stylesheet 与 CSS variables。

建议 token 类别：

- 颜色
- 边框
- 间距
- 圆角
- 字体
- `danger / ghost / primary` 等按钮状态

原则：

- 下游不接 Tailwind 也能直接用
- 应用层可以覆盖 token
- class name 保持包级可读、语义明确

建议实现方式：

- `tokens.css` 定义稳定前缀的变量，如 `--ncp-ui-*`
- `index.css` 用这些变量实现组件样式

## `ncp-demo` 迁移方案

第一阶段只有 `apps/ncp-demo/frontend` 消费新包。

### 迁移前

`ncp-demo` 当前结构：

- `src/components` 放容器组件
- `src/ui` 放展示组件

### 迁移后

`ncp-demo` 保留：

- `src/components/chat-panel.tsx`
- `src/components/sessions-panel.tsx`

`ncp-demo` 调整为：

- 用 `@nextclaw/ncp-react-ui` 替代本地 `src/ui/*` 导入
- 在本地做 `SessionSummary -> SessionListItem` 的映射

### 迁移步骤

1. 创建 `@nextclaw/ncp-react-ui`
2. 将选定的纯展示组件从 `ncp-demo` 迁入新包
3. 在 `ncp-demo` 中用 `SessionListItem` 替代对 `SessionSummary` 的直接 UI 耦合
4. 更新 `apps/ncp-demo/frontend/package.json`，以 `workspace:*` 依赖 `@nextclaw/ncp-react-ui`
5. 删除 `ncp-demo` 中已迁移的本地 UI 文件
6. 对新包与 `ncp-demo` 执行最小充分验证

## 实施阶段

### 阶段 1：包骨架与直接迁移

- 创建 `packages/ncp-packages/nextclaw-ncp-react-ui`
- 增加 package 配置、TypeScript 配置、ESLint 配置与导出入口
- 迁移选定的纯展示组件
- 增加包级 CSS token 与默认样式
- 更新 `ncp-demo` 以消费新包

退出条件：

- `ncp-demo` 是唯一消费方
- 已迁移 UI 文件从 `ncp-demo` 删除
- 用户可见行为不变

### 阶段 2：API 收口与稳固

- 进一步收紧 props 设计，提升长期复用性
- 明确 unknown message part 的扩展点
- 统一样式 token 命名
- 如确有必要，再增加有限的 class customization 点

退出条件：

- 不需要重塑核心 props，就能支持第二个消费方接入

### 阶段 3：更高层的可选积木

- 视实际复用情况考虑更轻量的布局积木
- 视实际需要考虑更丰富的 message renderer
- 当导出面增长时，再评估子路径导出

退出条件：

- 阶段 1 与阶段 2 已经被至少一个真实消费方验证，而不仅是原始 demo

## 验证方案

由于后续实现会触达代码与用户可见行为，实施阶段必须做四层验证：

### 1. 包自身验证

- `pnpm -C packages/ncp-packages/nextclaw-ncp-react-ui build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react-ui lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react-ui tsc`

### 2. 消费方验证

- `pnpm -C apps/ncp-demo/frontend build`
- `pnpm -C apps/ncp-demo/frontend lint`
- `pnpm -C apps/ncp-demo/frontend tsc`

### 3. 行为冒烟验证

运行现有 `ncp-demo` smoke 路径，并确认：

- session 列表正常渲染
- session 切换正常
- send 正常
- stop 正常
- error 展示正常

### 4. 边界检查

确认新包中不包含以下内容：

- `useHydratedNcpAgent`
- `NcpHttpAgentClientEndpoint`
- session 持久化工具
- 路由逻辑
- 业务 manager/store

## 验收标准

只有同时满足以下条件，才算本设计被正确实现：

1. `@nextclaw/ncp-react-ui` 以独立包存在于 `packages/ncp-packages/nextclaw-ncp-react-ui`
2. 所有新增文件与目录都使用 `kebab-case`
3. 第一阶段只有 `ncp-demo` 消费该包
4. `ncp-demo` 不再从本地 `src/ui/*` 导入已迁移组件
5. 新包始终保持纯展示定位
6. 从用户视角看，demo 行为与迁移前一致

## 风险与缓解

### 风险 1：新包变成第二个运行时层

如果为了“方便”把 hook、endpoint 初始化或状态编排塞进来，`@nextclaw/ncp-react-ui` 会和 `@nextclaw/ncp-react` 重叠。

缓解：

- 明确禁止 runtime hook、endpoint setup、state orchestration 进入该包
- 容器层继续保留在 `ncp-demo`

### 风险 2：session 类型被 demo 持久化语义污染

如果新包直接依赖 `SessionSummary`，那它从第一天起就与 demo 私有存储结构绑定了。

缓解：

- 第一阶段只暴露 `SessionListItem` 作为自定义展示模型

### 风险 3：样式被单一应用锁死

如果只是原样复制 demo CSS，而没有 token 层，后续消费方只能 fork。

缓解：

- 第一阶段就引入 CSS variables 与默认 token

### 风险 4：范围膨胀成产品 UI

最容易发生的漂移，是顺手把 settings、providers、slash commands、workflow UI 一起塞进来。

缓解：

- 严格收窄第一阶段范围
- 只迁移 `ncp-demo` 中已经验证为通用的纯展示组件

## 延后事项

以下内容明确延后，不进入第一阶段：

- 更丰富的 message part renderer
- 可选 markdown renderer
- 可选 session sidebar shell
- 主题预设
- 子路径导出，如 `@nextclaw/ncp-react-ui/chat`
- 位于纯展示层之上的更高阶 scaffold 包

## 推荐结论

按方案 A 推进，并且严格按本文档约束落地：

- 新包名：`@nextclaw/ncp-react-ui`
- 新目录：`packages/ncp-packages/nextclaw-ncp-react-ui`
- 命名规则：文件与目录统一使用 `kebab-case`
- 初始消费方：仅 `apps/ncp-demo/frontend`
- 第一阶段：只迁移纯展示组件

这是当前最小、最稳、最不容易职责漂移的做法。它既能立刻沉淀可复用积木，又不会把运行时层、React 绑定层和产品 UI 层重新揉在一起。
