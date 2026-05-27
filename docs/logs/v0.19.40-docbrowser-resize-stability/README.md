# v0.19.40-docbrowser-resize-stability

## 迭代完成说明

本次修复文档浏览器浮窗 resize 抖动和跳变问题。

根因是浮窗尺寸和位置由多条路径同时写入：拖拽/缩放事件会更新 `floatSize`、`floatPos`，同时另一个 effect 会在宽度变化后重新把 `x` 吸回右侧边距，导致从左侧、右侧或角落缩放时位置被非当前手势的同步逻辑覆盖。

修复方式：

- 删除宽度变化触发的浮窗位置重算 effect。
- 将浮窗位置和尺寸收敛为单一 `floatRect` 状态。
- 使用统一 pointer interaction 记录拖拽/缩放起点，由同一条 `pointermove` 链路计算 drag、left、right、bottom、bottom-right 几何。
- 左侧 resize 固定右边缘，右侧 resize 固定左边缘，底部 resize 固定顶部边缘。
- 保留 docked 模式继续使用共享 `ResizableRightPanel`。

根因确认方式：

- 代码链路确认到旧 effect 会在 `floatSize.w` 变化时写 `floatPos.x`。
- 新增回归测试覆盖右侧缩放时左边缘不变、左侧缩放时右边缘不变。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/shared/components/doc-browser/doc-browser.test.tsx src/shared/components/resizable-right-panel/resizable-right-panel.test.tsx`
  - 通过，2 个测试文件、6 个用例通过。
- `pnpm --filter @nextclaw/ui exec eslint src/shared/components/doc-browser/doc-browser.tsx src/shared/components/doc-browser/doc-browser-panel-parts.tsx src/shared/components/doc-browser/doc-browser.test.tsx src/shared/components/resizable-right-panel/resizable-right-panel.test.tsx`
  - 通过。
- `pnpm lint:new-code:governance`
  - 通过。
- `pnpm check:governance-backlog-ratchet`
  - 通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.tsx packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser-panel-parts.tsx packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.test.tsx`
  - 通过，非测试代码净增 `-1` 行。
- `pnpm --filter @nextclaw/ui tsc`
  - 未通过；失败点是既有 `@nextclaw/client-sdk` / `@nextclaw/server` 导出与 alias 问题，以及既有 `ncp-attachments.utils.ts` implicit any。本次触达文件没有新增 TypeScript 错误。
- 浏览器冒烟：
  - 已启动 `pnpm --dir packages/nextclaw-ui dev --host 127.0.0.1 --port 5178 --strictPort false`，Vite 正常监听 `http://127.0.0.1:5178/`。
  - Chrome DevTools MCP 因本机 profile lock 未能打开页面；本轮以组件级 pointer 事件回归测试作为最贴近 resize 几何的可证明验收。

## 发布/部署方式

未发布。该改动属于 `@nextclaw/ui` 源码修复，后续随统一前端或 NPM beta 发布批次带出。

## 用户/产品视角的验收步骤

1. 打开文档浏览器并切换到浮窗模式。
2. 从右侧边缘向内/向外拖动，确认左边缘不跳变。
3. 从左侧边缘向内/向外拖动，确认右边缘不跳变。
4. 从底部边缘和右下角拖动，确认尺寸连续变化，无抖动或突然吸附。
5. 切回 docked 模式，确认右侧面板仍可通过左侧 handle 调整宽度。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 正向减债动作：简化、职责收敛。
- 浮窗几何从多组 state、多套 mouse handler、宽度联动位置 effect，收敛为单一 rect 和单一 pointer interaction 链路。
- 没有新增文件、目录或平行 resize owner。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 规则进行收尾判断。
- 非测试代码新增 `125` 行、删除 `126` 行、净增 `-1` 行；总计新增 `186` 行、删除 `128` 行、净增 `58` 行，净增长主要来自新增回归测试。

## NPM 包发布记录

不涉及 NPM 包发布。
