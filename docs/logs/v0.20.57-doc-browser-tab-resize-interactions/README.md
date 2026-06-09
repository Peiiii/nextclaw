# v0.20.57 DocBrowser Tab 与 Resize 交互修复

## 迭代完成说明

本次修复两个 DocBrowser 交互问题：

- 当前 active tab 切换后，tab 标题会由共享 `CompactTabStrip` 自动滚入横向视野，避免调用方各自处理滚动细节。
- 内嵌 iframe 内容时，右侧面板 resize 更容易命中且拖拽过程更稳定：`ResizableRightPanel` 改为 pointer resize，拖拽中启用透明 shield 覆盖内容区；DocBrowser floating resize 边缘命中区从 6px 扩到 12px。

根因：

- tab strip 之前只渲染横向滚动容器，没有同步 active item 可见性的 DOM 行为。
- iframe 会接管内部指针事件；右侧面板 resize 开始前命中区偏窄，开始后若没有足够稳定的顶层 pointer/shield 接管，拖拽体验容易断。

确认方式：

- 通过代码链路确认 DocBrowser 使用共享 `CompactTabStrip` 和 `ResizableRightPanel`。
- 通过组件测试验证 active tab 滚入视野、DocBrowser floating resize 几何行为、右侧面板 pointer resize 与 shield 行为。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/shared/components/ui/tab-strip/__tests__/compact-tab-strip.test.tsx src/shared/components/doc-browser/__tests__/doc-browser.test.tsx src/shared/components/resizable-right-panel/__tests__/resizable-right-panel.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/shared/components/ui/tab-strip/compact-tab-strip.tsx packages/nextclaw-ui/src/shared/components/resizable-right-panel/resizable-right-panel.tsx packages/nextclaw-ui/src/shared/components/resizable-right-panel/__tests__/resizable-right-panel.test.tsx packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.tsx`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`

## 发布/部署方式

未执行发布或部署。该改动属于本地源码修复，待后续统一发布批次带出。

## 用户/产品视角的验收步骤

1. 在 DocBrowser 中打开多个 tab，并切换到横向滚动区域外的 tab，当前 tab 标题应自动进入可视区域。
2. 在 DocBrowser 中打开网页 iframe 内容后，拖动 docked 右侧面板左边缘，resize 应稳定跟随鼠标。
3. 切到 floating 模式后拖动面板四边，边缘命中应更容易，不应被 iframe 内容打断拖拽。

## 可维护性总结汇总

本次遵守“已有 owner 优先”：active tab 可见性落到共享 `CompactTabStrip`，右侧 resize 稳定性落到共享 `ResizableRightPanel`，DocBrowser 只保留 floating 边缘命中区调整。

代码增减以测试为主；非测试代码净增为 0。没有新增 manager、service 或业务抽象，也没有新增平行 resize 链路。

`post-edit-maintainability-review` 结论：通过。正向减债动作是复用与职责收敛：让共享 primitive 自己承担所属交互合同，而不是让 DocBrowser 调用方补丁式处理。

## NPM 包发布记录

不涉及 NPM 包发布。
