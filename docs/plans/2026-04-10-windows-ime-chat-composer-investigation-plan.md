# Windows Chat Composer IME Investigation Plan

## 背景

- 症状：Windows 桌面端聊天输入区在中文输入法场景下无法连续输入拼音；候选窗会在输入首个字母后立即消失。
- 已知边界：
  - `macOS` 正常。
  - 英文输入基本正常。
  - 问题集中在聊天输入区，而非全局文本输入能力。
- 产品影响：聊天输入框是 NextClaw 作为统一入口的核心入口；Windows 中文输入失效会直接破坏最基础的意图表达链路。

## 当前判断

- 当前聊天输入区使用的是自定义 `contentEditable` tokenized composer，而不是原生 `textarea` 直通。
- 高概率根因不是 Electron 主进程，而是 `Windows IME + Chromium/Electron + contentEditable` 的事件顺序与我们自己的 DOM 重绘/selection 同步发生冲突。
- 更具体地说，Windows 上可能出现：
  - `keydown` / selection sync / render 先发生；
  - `compositionstart` 或稳定的 `isComposing` 标记稍后才建立；
  - 组件在这段窗口内重新 render surface，清掉了浏览器维护的预编辑态，导致候选窗立即收起。

## 修复目标

- 组合输入开始前后的过渡窗口里，composer 不应因为 selection 同步、render tick 或 DOM 回读而打断 IME 预编辑态。
- 继续保持已有行为：
  - 普通英文输入正常；
  - slash 菜单、token 插入、删除与发送快捷键不回退；
  - 组合输入结束后仍能正确落盘最终中文字符。

## 实施步骤

1. 先补回归测试，模拟更接近 Windows 的事件顺序，而不是只覆盖理想化的 `compositionStart -> input -> compositionEnd`。
2. 收紧 runtime 的“是否允许重绘/同步 selection”条件，让 IME 预编辑阶段及其临近窗口不触发破坏性 DOM 同步。
3. 优先选择删除/收敛现有不稳定同步点，而不是再叠加一层平台特判。
4. 仅在确有必要时增加最小必要的 composition guard 状态。

## 验证

- 受影响单测：`chat-input-bar.test.tsx` 及必要的 runtime/controller 测试。
- 静态验证：`tsc`。
- 维护性验证：`pnpm lint:maintainability:guard` 与独立 maintainability review。
- 产品验收：
  - Windows + 搜狗输入法输入 `nihao`，候选窗不闪退，可正常上屏“你好”。
  - 输入区已有 token 时，中文输入仍稳定。
  - 英文输入、回车发送、Shift+Enter、slash 菜单不回退。

## 长期目标对齐 / 可维护性推进

- 这次不做“为了兼容 Windows 再叠一层平台分支”的补丁式修复，优先把 composer 的 DOM ownership 边界收紧，让输入期不被不必要的重绘打断。
- 优先删除或收敛脆弱同步点，而不是增加新的隐藏兜底。
- 如果最终仍需要新增 guard，也要把它放在输入 runtime 的单一边界里，避免把 IME 复杂度扩散到 container/store/页面层。
