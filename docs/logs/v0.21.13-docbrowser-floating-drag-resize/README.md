# v0.21.13 DocBrowser Floating Drag Resize

## 迭代完成说明

本次优化 Dock Browser 的 Float 浮窗交互：

- Float 状态下，TabStrip header 的空白区域现在可以拖拽移动浮窗。
- Float 状态下，header 可拖拽空白区显示 `grab/grabbing` cursor，tab 仍显示点击 cursor。
- Docked 状态下的“悬浮窗口”操作图标从最大化语义改为 `PictureInPicture2`，避免把“脱离侧栏变浮窗”误表达成“最大化”。
- Float 状态下操作按钮 tooltip 恢复可见：根因是 tooltip portal 的 `--z-tooltip=700` 低于浮窗 `z-index=9999`，本次将浮窗、modal、popover、tooltip 收敛为共享 z-index token，并保证 `tooltip > popover > modal > backdrop > floating panel`。
- Float 状态下点击需要 `nextclaw.client` 授权的面板应用时，授权 Dialog 现在会完整显示在浮窗上方；此前 shared Dialog 固定 `z-50`，overlay 落在浮窗后方、content 也被浮窗盖住，用户只能看到背景被遮罩，无法完成授权，所以应用不会继续打开。
- 将“icon-only 操作的 tooltip / popover 在 docked、floating、fullscreen、portal 等承载状态下都必须可见”和“Dialog / modal 必须完整高于触发它的浮窗，content 必须高于 overlay”沉淀到 `frontend-interaction-quality` skill。
- Tab 按钮、关闭按钮、返回/前进/新建/停靠/关闭等操作仍保持原有点击语义，不会被误触发成拖拽。
- Float 状态下补齐四个角落 resize handle：左上、右上、左下、右下。
- 将四边和四角 resize 收敛到同一个矩形计算函数，统一处理最小尺寸、视口边界和固定边稳定性。

根因与确认：

- Float 拖拽能力已经存在于 `DocBrowser`，但 TabStrip 的滚动区域无条件阻止 pointerdown 冒泡，导致 header 空白区域无法启动拖拽。
- Resize 逻辑之前只声明并渲染了 `bottom-right` 角落，其余角落没有进入 `FloatingPanelResizeEdge` 合同。
- 面板应用打开链路本身会先走 `ensurePanelAppClientGrant -> serviceActionAuthorizationManager.requestAuthorization`；Float 状态异常不是应用打开逻辑丢失，而是授权 Dialog 的 portal 层级低于浮窗，形成“遮罩可见、弹窗不可见”的半打开状态。
- 修复保持在现有 DocBrowser 浮窗 owner 与 shared TabStrip 展示 owner 内，没有新增平行 manager 或状态链路。

## 测试/验证/验收方式

- `NODE_OPTIONS=--no-experimental-webstorage ./node_modules/.bin/vitest run src/shared/components/doc-browser/__tests__/doc-browser.test.tsx src/shared/components/ui/__tests__/dialog.test.tsx src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx`：通过，3 个测试文件，22 个用例；覆盖 header 空白区拖拽入口、tab 点击不被拖拽抢占、drag cursor、悬浮操作图标语义、四边 resize、新增角落 resize、Dialog 层级 token，以及面板应用授权成功后继续打开。
- `node -e ...design-system.css z-index token check`：通过，确认 `--z-tooltip=10150 > --z-popover=10100 > --z-modal=10050 > --z-modal-backdrop=10000 > --z-floating-panel=9999`。
- 内置浏览器冒烟：刷新 `http://127.0.0.1:5180/chat` 后确认运行实例加载到最新 z-index token；点击“应用”打开面板应用列表，切换到 Float 后确认浮窗 `position=fixed`、`z-index=9999`；点击已授权的“读书笔记”应用可直接打开 `/api/panel-apps/.../content` iframe，未出现异常遮罩态。当前本地数据里 `clientDeclared=true` 的应用均已 `clientGranted=true`，所以未授权授权弹窗分支由上面的组件测试覆盖。
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`：通过。
- `./node_modules/.bin/eslint --max-warnings=0 ...DocBrowser / Tooltip / Popover / Select 相关源码与测试文件`：通过。
- `git diff --check -- ...DocBrowser 相关源码、changeset 与迭代记录`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...DocBrowser / Dialog / Tooltip / Popover / Select / PanelAppsList 相关源码与测试文件`：通过，Errors 0，Warnings 3；提醒测试文件因新增行为覆盖增长较多、`doc-browser.tsx` 仍接近 500 行预算、`shared/components/ui` 已有历史目录预算例外。
- `node scripts/governance/checks/lint-new-code-governance.mjs -- ...DocBrowser / Tooltip / Popover / Select 相关源码与测试文件`：通过。
- `node scripts/governance/backlog/check-governance-backlog-ratchet.mjs`：通过。

## 发布/部署方式

本次仅修改前端源码、测试、changeset 和迭代记录，未执行发布、部署、远程 migration 或 runtime update。

## 用户/产品视角的验收步骤

1. 打开 Dock Browser 并切换到 Float 状态。
2. 确认 Docked 状态下“悬浮窗口”按钮不再使用最大化图标，而是使用 picture-in-picture 语义图标。
3. 切换到 Float 状态，hover 返回/前进/新建/回 Dock/关闭等 icon-only 操作，确认 tooltip 仍显示在浮窗上方。
4. 移动鼠标到 header 空白区域，确认 cursor 变为可拖拽图标；按住拖动，确认浮窗可以移动。
5. 点击 tab 标题、关闭 tab、返回/前进/新建/停靠/关闭等按钮，确认仍执行原有操作。
6. 分别拖拽左上、右上、左下、右下四个角落，确认都能同时调整相邻两条边。
7. 拖拽四条边，确认原有边缘 resize 行为没有回退。
8. 在 Float 状态下打开需要 `nextclaw.client` 授权的面板应用，确认授权 Dialog 内容与遮罩都显示在浮窗上方；授权后应用继续进入目标面板，而不是停留在应用列表遮罩态。

## 可维护性总结汇总

- 本次是用户可见交互能力补齐，生产代码净增属于必要实现。
- 代码增减报告：相关源码与测试合计 `+365 / -97 / net +268`；非测试源码 `+143 / -55 / net +88`。
- 正向可维护性动作：复用既有浮窗 interaction 状态；将 resize / move 几何逻辑抽到 `utils/doc-browser-floating-panel.utils.ts`；`doc-browser.tsx` 从 480 行降到 465 行，避免越过 500 行预算。
- 结构取舍：新增文件采用 `.utils.ts`，因为它只承载无状态几何计算；没有新增 manager / service / store，也没有新增 barrel。
- 规范沉淀：更新 `frontend-interaction-quality` skill，把 icon-only tooltip / popover 在 floating / fullscreen / portal 场景下必须保持可见，以及 Dialog / modal 必须完整高于触发浮窗写入交互规则；该规则是前端交互场景规则，不进入 AGENTS 常驻内核。
- `post-edit-maintainability-guard` 结果为 Errors 0、Warnings 3；主观复核结论为通过。剩余观察点是 `doc-browser.tsx` 仍接近预算、测试文件因新增行为覆盖增长较多、`shared/components/ui` 有历史目录预算例外；后续若继续增长应优先拆 panel shell / iframe toolbar 责任，并把测试 fixture / builder 从行为用例里拆出。

## NPM 包发布记录

需要后续统一 NPM 发布：

- `@nextclaw/ui`：已新增 `.changeset/doc-browser-floating-drag-resize.md`，patch，原因是补齐 Dock Browser Float 状态的拖拽、四角 resize、图标语义和浮窗上方 tooltip / popover / Dialog 层级用户可见交互。

未在本轮执行 NPM 发布。
