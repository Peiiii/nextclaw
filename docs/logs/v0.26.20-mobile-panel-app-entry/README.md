# 移动端面板应用入口

## 迭代完成说明

移动端底部导航新增“应用”入口，点击后复用现有全屏 DocBrowser 打开应用列表，并可继续选择具体面板应用。

根因是桌面端的 SideDock 和聊天侧栏底部菜单都包含应用入口，但移动端布局同时不渲染 SideDock，也跳过聊天侧栏底部菜单；移动端全局底栏又没有等价入口，导致应用列表和面板应用不可发现。

修复继续使用 `openApps -> DocBrowserManager` 这条既有主链路，没有新增移动端专用页面、路由或第二套打开协议。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/platforms/mobile/components/__tests__/mobile-bottom-nav.test.tsx src/platforms/mobile/components/__tests__/mobile-app-shell.test.tsx src/platforms/desktop/components/__tests__/desktop-app-shell.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- 触达文件 ESLint
- 390×844 真实页面验收：底栏显示“对话 / 技能 / Agent 管理 / 设置 / 应用”；点击“应用”后显示全屏“面板应用”列表；继续点击“唐诗”后成功加载面板应用 iframe；页面无横向溢出。
- 360×800 极窄视口验收：五个入口均为 66px 宽，底栏完整位于视口内，页面无横向溢出。

## 发布/部署方式

本次不直接发布或部署。`@nextclaw/ui` 需要随下一次统一 NPM patch 发布。

## 用户/产品视角的验收步骤

1. 将 NextClaw 窗口缩小到移动端布局，或在移动设备上打开。
2. 在底部导航点击“应用”。
3. 确认出现“面板应用 / 服务应用”列表。
4. 点击任意面板应用，确认应用在全屏面板中打开。

## 可维护性总结汇总

- 复用了现有应用打开 owner，没有新增路由、页面、状态或 fallback。
- 删除了移动底栏重复的路由匹配实现，改为复用导航配置中的 canonical matcher。
- 简化了底栏导航项的冗余内层视觉 wrapper，使新增入口后的生产代码仍保持净减。
- `post-edit-maintainability-review` 结论为通过：代码新增 59 行、删除 37 行、净增 22 行；排除测试后的生产代码新增 30 行、删除 33 行、净减 3 行；无可维护性 finding。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch 发布。
- 当前状态：待统一发布。
