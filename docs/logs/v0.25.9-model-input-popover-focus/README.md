# v0.25.9 模型输入候选面板焦点修复

## 迭代完成说明

- 修复默认模型输入框获得焦点后，再次点击输入框会让候选面板立即关闭的问题。
- 根因是共享 `SearchableModelInput` 使用 `PopoverAnchor` 定位候选面板，但没有把输入框与右侧切换按钮声明为同一个交互面；面板打开后，Radix 会把再次点击输入框判定为外部交互并关闭面板。
- 修前在当前产品实例中确认输入 DOM 节点始终连接、焦点仍在原输入框，但第二次点击会让 Popover 和模型候选按钮从 DOM 消失，因此排除了组件重挂载和后台抢焦点。
- 修复落在共享模型输入组件：候选面板忽略来自自身 anchor 的 outside interaction，页面外部点击、右侧切换按钮和候选项仍沿用原有关闭语义，没有增加延时、焦点恢复或页面级兜底。

## 测试/验证/验收方式

- 修前定向基线：新增的连续点击回归在第二次点击后找不到 `model-1` 候选按钮，测试稳定失败。
- `pnpm -C packages/nextclaw-ui test src/shared/components/common/__tests__/searchable-model-input.test.tsx`：修后 2/2 通过。
- `pnpm -C packages/nextclaw-ui test src/shared/components/common/__tests__/searchable-model-input.test.tsx src/features/settings/pages/__tests__/model-config-page.test.tsx src/features/agents/components/__tests__/agents-page.test.tsx`：3 个测试文件、11 个测试全部通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：通过。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet`：通过。
- 真实源码页面 `http://127.0.0.1:5174/model`：第一次点击 `Default Model` 输入框后候选面板存在；保持焦点再次点击后，输入 DOM 仍连接且候选面板继续存在；点击右侧切换按钮仍能关闭面板。
- `pnpm check:generated-clean`：通过，未产生需要提交的生成产物。

## 发布/部署方式

- 本次执行本地 commit；未执行 push、前端发布、NPM publish、Desktop 打包、宿主重启或运行时重启。
- 数据库 migration、后端部署和运行时更新不适用；当前源码开发实例已通过 HMR 消费修复，已安装产品实例需要后续 UI/NPM 版本发布后获得修复。

## 用户/产品视角的验收步骤

1. 打开“设置 → 模型”，进入“默认模型”区域。
2. 点击右侧模型输入框，确认模型候选面板打开。
3. 保持输入框焦点，再次点击同一个输入框，确认候选面板不会闪现后消失。
4. 点击右侧展开/收起按钮，确认面板仍可正常关闭和重新打开。
5. 点击一个候选模型或页面外部区域，确认面板按原有交互正常关闭。

## 可维护性总结汇总

- 使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 收口；定向统计为总代码 `+33/-10`、净增 23 行，排除测试后生产代码 `+9/-10`、净减 1 行。
- 正向减债动作是简化同文件的模型选项清洗与去重实现；修复继续由现有共享组件内聚负责，没有新增 helper、wrapper、状态源、文件或平行关闭路径。
- 检查范围没有文件级、目录级、函数级、命名职责或红区阻塞项，也没有警告。组件类型、`key`、父级结构和输入 DOM 身份保持稳定。

## NPM 包发布记录

- `@nextclaw/ui`：已添加 patch changeset `.changeset/model-input-popover-focus.md`，尚未发布，待后续统一发布。
- 其它 NPM 包：不涉及。
