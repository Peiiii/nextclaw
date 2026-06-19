# v0.20.89 Chat Input Surface Trigger Loop

## 迭代完成说明

本次修复 chat 输入面板插件化后的输入卡死回归。

根因：旧 slash 逻辑只把 trigger open/dismiss/start 作为 `ChatInputBar` 内部局部状态，父层最多消费 query；插件化后新增 `onInputSurfaceTriggerChange`，把每次 editor update 解析出来的新 trigger 对象直接上抛给 `useChatInputSurfaceState`。即使 key/query/start/end 没变，对象引用也会变化，真实页面在 `/xxx` 删除、光标移动或 IME 输入时会不断触发父层 state/render/inputSurface 解析，再回灌到 composer 链路，最终让主线程卡死。

修复方式：不改 Lexical 旧同步合同，不新增 content-signature/pending-selection 保护；只在新增的 input surface trigger state owner 内做等价 trigger 去重。相同 `key/marker/query/start/end` 的 trigger 不再调用 React state setter，只有语义变化才更新父层插件面板状态，从而恢复旧 slash 链路“无语义变化不上抛”的行为。

已确认不是后端、panel app 加载或菜单渲染问题：真实浏览器页面卡死时 DevTools `evaluate_script` 也会超时；修复后同一页面路径可以立即返回 DOM 状态。

后续同批次补充修复两个输入面板问题：其一，composition 期间不再把临时 Lexical editor update 同步到 slash/input-surface React 状态，避免父层 rerender 用受控旧 `nodes` 打断中文输入法；compositionEnd 后仍由既有 `publishSnapshot` 一次性同步最终文本。其二，原 Popover anchor 是输入框上沿的一条 0 高线，当欢迎页空间碰撞让面板向下展示时会从输入框上沿开始，覆盖输入区域；已改为锚定整个输入矩形，使向上展示贴输入上方、向下展示贴输入下方。

最终方案进一步收敛为 `ChatInputSurfaceHost` session owner：composer 只发布 editor snapshot 与输入原因，host 根据 trigger spec 判断是否创建/销毁 input surface session，`ChatInputSurfaceMenu` 自己管理 active item、键盘移动和确认选中。删除、selection sync、programmatic update 不能从无到有创建面板；只有实际插入 marker（如 `/`、`@`）能创建新 session。面板关闭、Esc、空格离开 trigger、选中 item 后即销毁 session，下一次输入 marker 会挂载全新 menu 实例并默认第一行 active。

同批次继续修复菜单 pointer 交互：候选项不再用 `mouseenter` 更新 active，避免面板打开时静止鼠标刚好压在某一行上就抢走默认第一项；真实移动鼠标时改由 `pointermove` 更新 active。候选项选择提前到 `pointerdown` 并 `preventDefault()`，避免 composer blur 先关闭/卸载面板导致后续 `click` 丢失；这条共享菜单合同同时覆盖 `/` skill 与 `@` panel app。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/input-surface/__tests__/chat-input-surface-host.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-composer-keyboard.utils.test.ts src/components/chat/ui/chat-input-bar/__tests__/chat-slash-menu.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/input/hooks/__tests__/use-chat-input-surface-state.test.tsx src/features/chat/features/input/input-surface-plugins/__tests__/panel-app-reference-plugin.test.ts`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/ui tsc --noEmit`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本批 input surface 相关文件>`：通过；严格 `--non-feature` 门槛因必要新增 `ChatInputSurfaceHost` 报非测试净增 `+137`，已在本记录下方写明行数豁免。
- `pnpm clean:generated && git diff --check`
- Chrome DevTools 真实页面冒烟：`http://127.0.0.1:5174/chat?slash-delete-fix=1`
  - 输入 `/xxx` 后按 Backspace：文本为 `/xx`，selection offset 为 `3`，listbox 仍打开，页面脚本立即响应。
  - 输入 `/你` 后光标左移并输入 `好`：文本为 `/好你`，selection offset 为 `2`，页面未卡死。
  - 输入 `/` 后按 Escape：文本保持 `/`，selection offset 为 `1`，listbox 关闭；继续输入 `a` 后文本为 `/a`，listbox 保持关闭。
- Chrome DevTools 真实页面冒烟：`http://127.0.0.1:5174/chat?ime-slash-fix=1`
  - 输入 `/` 后继续输入中文字符：文本为 `/你`，selection offset 为 `2`，listbox 仍为技能面板。
  - 已确认页面加载的 transformed source 中 `isComposingRef.current` guard 位于 `syncSlashState(...)` 之前。
  - 当前窗口中面板向上展示，未复现欢迎页向下翻转；下翻场景的根因通过 Popover anchor 矩形合同修复，并由组件测试锁定 anchor 不再是 0 高线。
- Playwright 真实页面冒烟：`http://127.0.0.1:5174/chat?input-surface-smoke=2`
  - mock `GET /api/panel-apps` 后输入 `@`：第一项 `Task Board` 的 `aria-selected=true`，第二项为 `false`。
  - 按 ArrowDown：第二项 `Daily Notes` 变为 `aria-selected=true`，说明键盘焦点由 menu 实例内部管理。
  - 按 Escape：面板销毁。
  - 输入 `@task ` 后面板关闭，再 Backspace 删除空格：面板未重新出现。
  - 清空后输入 `/` 并插入中文字符：composer 文本为 `/你`。
- Playwright 真实页面冒烟：`http://127.0.0.1:5174/chat`
  - mock `GET /api/panel-apps` 后输入 `@`：第一项 `Task Board` 默认 active。
  - 记录第二项位置，关闭并清空后把鼠标移动到该位置，再重新输入 `@`：active 仍为第一项 `Task Board`，静止鼠标不再抢 focus。
  - 鼠标点击第二项 `Daily Notes`：composer 插入 `Daily Notes` token。
  - 输入 `/` 后鼠标点击第一项 skill：composer 插入对应 skill token。
  - `pnpm lint:maintainability:guard` 当前未全绿；失败点是工作区已有 `packages/nextclaw-kernel/src/managers/__tests__/session.manager.test.ts` 函数长度违规，非本次 input surface 菜单修复文件。

## 发布/部署方式

本次只完成源码修复与本地验证，未执行部署。

已新增 changeset：`.changeset/fix-input-surface-trigger-loop.md`，`@nextclaw/ui` patch，等待后续统一 NPM 发布。

## 用户/产品视角的验收步骤

1. 在 chat 输入框输入 `/xxx`，按一次删除，确认页面不卡死，输入内容变为 `/xx`。
2. 在 chat 输入框输入 `/` 后用中文输入法输入中文，确认中文能正常进入 `/` 后面，光标不跳到 `/` 前。
3. 在 `/你` 中把光标移动到 `/` 后面再输入一个字，确认页面不冻结，文本顺序符合光标位置。
4. 在只输入 `/` 时按 Escape，确认候选面板关闭但输入框内容不被清空，并且继续输入不会重新弹出已 dismissed 的面板。
5. 在欢迎页输入 `/`，如果面板向下展示，确认面板顶部从输入区域下边缘开始，不覆盖输入区域。

## 可维护性总结汇总

本次遵守“旧逻辑对齐优先”：撤回了最初尝试加入 Lexical content-signature/pending-selection 保护的方向，没有继续在编辑器核心上叠补丁；最终修复点收敛到插件化新增的 input surface session owner。

正向减债动作：职责收敛与必要解耦抽象。删除 `ChatInputBar` / composer keyboard controller 里的 slash menu active index、open/select 分支，把 session 生命周期收敛到 `ChatInputSurfaceHost`，把 active item 状态内聚到 `ChatInputSurfaceMenu`。回归测试补在 host、menu、keyboard controller、input surface hook 和 panel app plugin 真实 owner 上。

可维护性风险：`ChatInputSurfaceHost` 通过 imperative menu handle 转发 keydown；这是 menu 实例能力边界，不参与 render 状态。后续如果继续扩展 input surface trigger，应继续保持“marker 输入事件创建 session，关闭即销毁；删除/sync/selection 不能复活”的合同；composition 期间不能把临时 editor update 同步到父层面板状态。

本次 pointer 修复未新增业务分支，仍保持共享菜单唯一 owner。`/` 与 `@` 不各自维护点击选择或 hover focus 逻辑，避免未来新增 trigger 时复制同类事件顺序 bug。

行数豁免记录：严格按非功能改动门槛运行 maintainability guard 时，本批 input surface 相关文件非测试净增 `+137` 行。原因是新增 `ChatInputSurfaceHost` 作为独立 session owner（162 行）后，原生产源码删除/简化合计已净减 `25` 行；若为了行数把 host 合回 `ChatInputBar`，会重新让输入区感知面板生命周期，违背本轮核心架构目标。已检查同域旧状态路径、keyboard controller 菜单分支和 hook 样板，能删的旧路径已删除；剩余增长属于必要解耦抽象，而不是平行实现或补丁分支。

## NPM 包发布记录

需要后续统一 NPM 发布。

- `@nextclaw/ui`：patch，修复用户可见输入面板卡死回归，保持 skill 与 panel app reference 插件状态同步稳定；当前仅新增 changeset，尚未发布。
- `@nextclaw/agent-chat-ui`：patch，修复中文输入法 composition 期间的 input surface 状态同步干扰、欢迎页向下翻转定位，以及 `@` panel app 面板重新打开时默认焦点不在第一行的问题；当前仅新增 changeset，尚未发布。
