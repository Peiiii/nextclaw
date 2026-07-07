# v0.22.15 Panel App iframe 焦点归属修复

## 迭代完成说明

本次修复 Panel App 内联展示时，用户点击钢琴等交互应用后，键盘输入仍进入外层 chat composer，而不是触发 Panel App 内部按键的问题。

根因不是外层输入框主动抢焦点，而是 Panel App 本身运行在 iframe 内。钢琴 Panel App 的鼠标按键逻辑会在 `mousedown` 上阻止默认行为；浏览器因此不会把 DOM focus 从外层 composer 切到 iframe。后续键盘事件仍归外层 composer，Panel App 内部注册在 iframe window 上的 `keydown` 监听自然收不到事件。

确认方式：

- 检查实际 piano Panel App 构建产物，确认它在 iframe 内监听 `window.keydown`，并在鼠标按键上阻止默认行为。
- 用最小 iframe Playwright 复现实验证明：iframe 内部 `mousedown.preventDefault()` 后，外层当前输入框会继续持有焦点。
- 用真实 piano Panel App 内容路径做浏览器冒烟：未聚焦 iframe 时按 `A` 会进入外层输入框；父页面在 pointer 进入 Panel App iframe 时聚焦 iframe 后，按 `A` 会进入 iframe 内部键盘监听。

修复方式：

- 新增 Panel App iframe 工具 owner，统一承载 Panel App iframe sandbox 合同和 iframe focus 转交逻辑。
- 内联 Panel App iframe 在 pointer 进入时聚焦 iframe 和 `contentWindow`，让键盘归属转到 Panel App。
- 右侧 DocBrowser 中的 Panel App tab 也接入同一逻辑，但普通 docs/content iframe 不启用该行为。
- 删除内联和右侧 Panel App 各自维护 sandbox 字符串的重复实现，收敛到同一个 Panel App owner。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/features/chat/features/message/components/__tests__/chat-inline-panel-app-card.test.tsx src/shared/components/doc-browser/__tests__/doc-browser.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- Playwright 真实 piano Panel App iframe 冒烟：未修复路径下外层输入框收到 `A`；聚焦 Panel App iframe 后外层输入框为空，iframe 内部收到 `A`。

## 发布/部署方式

不涉及单独部署。该修复进入常规前端构建产物后随下一次 UI/桌面发布带出。

## 用户/产品视角的验收步骤

1. 在 chat 中内联打开一个支持键盘操作的 Panel App，例如 piano。
2. 先让外层 chat composer 处于可输入状态。
3. 用鼠标点击或进入 piano Panel App 区域。
4. 按下 piano 支持的键盘按键，例如 `A`。
5. 预期结果：Panel App 内部响应按键，外层 composer 不应输入该字符。
6. 在右侧 Panel App tab 中重复同样操作，键盘也应归 Panel App 所有。

## 可维护性总结汇总

- 已使用 post-edit maintainability guard 做定向检查：10 个触达文件，0 error，1 个既有预算 warning。
- 非测试生产代码 `+27/-27`，净增 0 行，满足非功能修复不增加生产语义代码的约束。
- 本次没有新增全局焦点状态、轮询或跨层事件代理；只在 Panel App iframe host 边界转交键盘归属。
- 同步删除重复 sandbox 合同和 iframe `scrolling="auto"` 显式默认值，内联 Panel App 和右侧 Panel App 复用同一 owner。
- `doc-browser.tsx` 仍接近文件预算上限，本次只增加 1 行透传，后续若继续扩展 DocBrowser 应优先拆分子 owner。

## NPM 包发布记录

本次不直接执行 NPM 发布，但属于用户可见 UI bugfix，已新增 `.changeset/panel-app-keyboard-focus.md`，标记 `@nextclaw/ui` patch，等待后续统一发布带出。
