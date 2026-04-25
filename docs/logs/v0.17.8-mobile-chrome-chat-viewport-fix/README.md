# v0.17.8 Mobile Chrome Chat Viewport Fix

## 迭代完成说明（改了什么）

- 修复了移动端 Chrome 下聊天页底部导航栏不可见、会话详情页输入面板底部被裁掉的问题。
- 根因已确认：
  - `MobileAppShell` 之前使用固定的 `h-screen`，对应的是传统 `100vh` 语义。
  - 在手机 Chrome 上，浏览器地址栏 / 底部工具栏会让可见视口小于 `100vh`，导致应用底部内容被压到可视区外。
  - 聊天列表页的底部导航栏和会话详情页的输入面板都挂在这个移动端壳子里，所以会同时受影响。
- 根因确认方式：
  - 检查 [mobile-app-shell.tsx](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.tsx) 发现根容器高度写死为 `h-screen`。
  - 对照移动端 Chrome 常见适配问题，`100vh` 与动态可见视口不一致，和“底部内容被浏览器 chrome 遮住”的现象完全吻合。
- 本次修复命中根因：
  - 将移动端壳子从 `h-screen` 改为 `h-[100svh] supports-[height:100dvh]:h-[100dvh]`。
  - 含义是：不再以旧的 `100vh` 作为基础高度；默认使用小视口高度兜底，在支持 `dvh` 的移动端浏览器上优先使用动态视口高度，让底部导航和聊天输入区跟随真实可见高度布局。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/platforms/mobile/components/mobile-app-shell.test.tsx`：通过，1 个测试文件 / 3 个测试通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.test.tsx`：通过，非测试代码 `+1 / -1 / net +0`。
- `pnpm release:version && pnpm release:publish`：通过，发布前自动完成 `@nextclaw/ui` 与 `nextclaw` 的 release check / build / tsc，并完成发布后 registry 校验。
- `pnpm view @nextclaw/ui version`：确认 npm registry 最新版本为 `0.12.18`。
- `pnpm view nextclaw version`：确认 npm registry 最新版本为 `0.18.9`。

## 发布/部署方式

- 本次改动影响 `@nextclaw/ui` 的移动端应用壳子布局。
- 已通过 Changesets 执行 NPM 发布。
- `@nextclaw/ui` 发布为 `0.12.18`。
- `nextclaw` 发布为 `0.18.9`，并携带重新构建后的 `packages/nextclaw/ui-dist` 前端构建产物。

## 用户/产品视角的验收步骤

1. 在手机 Chrome 中打开 NextClaw 移动端界面。
2. 进入聊天列表页，确认底部导航栏可见，不再被浏览器底栏压出屏幕。
3. 进入任意会话详情页，确认底部输入面板完整可见，不再有下半部分被裁掉。
4. 上下滚动或触发 Chrome 地址栏收起/展开，确认底部区域仍稳定贴合可见视口。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有引入额外 hook、样式工具类或布局补丁，只在移动端壳子根节点替换高度策略。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。非测试代码净增为 `0`，没有新增文件，测试只补了一条壳子类名回归断言。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。问题根因在移动端壳子，所以修复也留在壳子层，而没有把浏览器视口兼容逻辑散落到聊天组件内部。
- 目录结构与文件组织是否满足当前项目治理要求：满足。本次只触达既有移动平台组件与对应测试文件。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次是极小的兼容性修复，已通过独立 maintainability guard 验证且非测试净增为 `0`。

## NPM 包发布记录

- 本次是否需要发包：需要。
- 需要发布哪些包：
  - `@nextclaw/ui`：已发布，版本 `0.12.18`。
  - `nextclaw`：已发布，版本 `0.18.9`，用于同步携带最新 UI dist。
- 当前发布状态：已发布并通过 `release:verify:published` 与 `pnpm view` 复核。
- 阻塞或触发条件：无。
