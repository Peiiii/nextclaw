# Chat Composer Lexical 平行迁移实现方案

> **执行要求：** 实施阶段必须按任务逐步执行，保持新旧实现并存，确认验证通过后再切换默认实现。

**目标：** 在不改变现有用户可见功能与交互的前提下，把当前 tokenized chat composer 底层从自研 `contentEditable` 实现平行迁移到 Lexical，并通过 `legacy/` 与 `lexical/` 目录拆分保证迁移边界清晰、切换成本低、回滚路径明确。

**整体架构：** 保持当前 `ChatInputBar` 的对外契约、可见交互、数据格式和上层接入方式不变，只把实现代码按目录拆成两套：旧实现放到 `legacy/`，新实现放到 `lexical/`。根目录只保留一层很薄的切换桥接层，最终切换默认实现时，尽量把变更控制在极小范围内。新实现通过 adapter 在现有 `ChatComposerNode[]` 与 Lexical editor state 之间双向转换，复刻当前的 inline skill/file token、slash 菜单、光标处插入、粘贴上传、发送/停止快捷键等行为。

**技术栈：** React 18、TypeScript、Lexical 0.43.x、Vitest、Testing Library

---

### 任务 1：先把迁移边界固化出来

**涉及文件：**
- 新增：`docs/plans/2026-04-10-chat-composer-lexical-parallel-migration-plan.md`
- 修改：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/*`

**步骤 1：明确目录拆分规则**

目标目录结构：

- `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/legacy/`
- `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/`
- 根目录只保留对外入口和实现切换层

**步骤 2：锁定公共契约不变**

以下内容默认不改：

- `ChatInputBarProps`
- `ChatInputBarHandle`
- `ChatInputBarTokenizedComposerHandle`
- `ChatComposerNode[]` 作为上层 composer 状态格式

### 任务 2：先把旧实现完整隔离到 `legacy/`

**涉及文件：**
- 迁移到 `legacy/`：
  - `chat-composer-runtime.ts`
  - `chat-composer-view-controller.ts`
  - `chat-composer-controller.ts`
  - `chat-composer-dom.utils.ts`
  - `chat-composer-surface-renderer.ts`
  - `chat-composer-keyboard.utils.ts`
  - `chat-input-bar-tokenized-composer.tsx`

**步骤 1：纯搬迁，不改行为**

先把当前旧实现整体移动到 `legacy/`，只修正 import 路径，不做行为改变。

**步骤 2：保留旧实现可继续被选择**

通过根目录桥接文件继续暴露旧实现，保证迁移期间现有测试和现有行为还能完整跑通。

### 任务 3：在 `lexical/` 中并行实现新版本

**涉及文件：**
- 新增：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-input-bar-tokenized-composer.tsx`
- 新增：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter.ts`
- 新增：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-composer-token-node.tsx`
- 新增：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-composer-plugins.tsx`
- 修改：`packages/nextclaw-agent-chat-ui/package.json`

**步骤 1：引入 Lexical 依赖**

引入同版本族依赖：

- `lexical`
- `@lexical/react`

**步骤 2：实现 token node**

为以下两类 inline 原子节点实现 Lexical node：

- skill chip
- file chip

要求是尽可能复刻当前渲染和操作语义，不让用户感知到底层已经换了实现。

**步骤 3：实现 adapter**

完成双向转换：

- `ChatComposerNode[] -> Lexical editor state`
- `Lexical editor state -> ChatComposerNode[]`

这是整个平行迁移的核心接缝层。

**步骤 4：实现 Lexical composer**

新实现必须覆盖当前已有行为：

- 初始化草稿恢复
- 普通文本输入
- 基于光标位置的 slash query 识别
- 点击或键盘选择 slash item
- 在保存的光标位置插入 file token
- 粘贴文件转交上传处理
- send / stop / shift-enter 行为
- 在 token 邻接位置删除前一个 token
- IME 输入稳定性由 Lexical 内核承担

### 任务 4：通过极薄桥接层完成切换

**涉及文件：**
- 修改：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-tokenized-composer.tsx`
- 修改：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.tsx`

**步骤 1：新增一个很薄的实现选择层**

根目录文件尽量保持实现无关，只负责在 `legacy` 和 `lexical` 之间选择实际实现。

**步骤 2：验证通过后再把默认值切到 Lexical**

只有在行为对齐确认完成后，才把默认实现切到 `lexical`，并暂时保留 `legacy` 目录作为可立即回滚路径。

### 任务 5：在删旧代码前先做行为对齐验证

**涉及文件：**
- 修改：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- 修改：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-selection.test.tsx`
- 补充或修改：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/` 下相关测试

**步骤 1：保住现有用户可见行为测试**

只改那些过度绑定旧 DOM 细节的断言，但以下行为必须继续覆盖：

- slash 菜单行为
- skill token 插入
- file token 按光标位置插入
- 粘贴文件
- IME 组合输入稳定性
- backspace 删除 token
- send / stop 行为

**步骤 2：补 adapter 对齐测试**

补充针对新 adapter 的测试，确保 `ChatComposerNode[]` 与 Lexical state 的双向转换没有语义漂移。

### 任务 6：完成迁移闭环

**涉及文件：**
- 修改或新增：`docs/logs/.../README.md`

**步骤 1：执行最小充分验证**

至少执行：

- `pnpm -C packages/nextclaw-agent-chat-ui test`
- 若依赖和构建链受影响，再补充目标 `tsc` / build 校验

**步骤 2：执行可维护性守卫**

代码改动完成后跑要求的 maintainability guard。

**步骤 3：补齐迭代记录**

记录以下内容：

- 本次如何重写底层实现
- 新旧实现如何并行共存
- 行为对齐是如何验证的
- 为什么旧实现暂时保留，后续删除入口是什么
