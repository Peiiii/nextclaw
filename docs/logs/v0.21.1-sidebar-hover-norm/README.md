# v0.21.1 Sidebar Hover Norm

## 迭代完成说明

本次恢复并扩展左侧栏行项目的 hover 规范，解决“定时任务”入口 hover 反馈不明显且与会话列表 item 不一致的问题。

根因与确认：

- 旧迭代 `v0.14.176-sidebar-item-reuse-hover-align` 已经沉淀过侧栏 item 统一使用灰阶 hover 的规范。
- 当前代码后续演进中，`SidebarNavLinkItem`、`SidebarActionItem`、`SidebarSelectItem`、settings 返回入口、聊天侧栏底部菜单和项目组加号重新漂移回 `hover:bg-accent hover:text-accent-foreground`。
- `accent` 在浅色侧栏背景中对比不足，因此截图里的“定时任务”hover 反馈不明显。

修复方式：

- 将左侧栏普通行项目 hover 统一为会话列表同款 `hover:bg-gray-200/60 hover:text-gray-900`。
- 将共享 collapsed rail 的普通 surface 同步到同一灰阶 hover，active / 选中态淡化为 `bg-gray-200/80 text-gray-900`。
- 不把普通导航 hover 提升为 primary/ring/shadow，因为那会比会话列表 item 重，误导成品牌强调或主行动。
- 保留主行动类按钮自己的 primary hover 语义，不与普通侧栏行项目混用。

## 测试/验证/验收方式

- 定向测试：`pnpm --filter @nextclaw/ui test -- src/app/components/layout/__tests__/sidebar.layout.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx`
  - 结果：2 个 test files 通过，29 个 tests 通过。
- 类型检查：`pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- Lint：`pnpm --filter @nextclaw/ui lint`
  - 结果：通过。
- 运行链路轻量验证：`curl http://127.0.0.1:5174/@fs/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/app/components/layout/sidebar-items.tsx | rg "hover:bg-gray-200/60|bg-gray-200/80 text-gray-900|group-hover:text-gray-700"`
  - 结果：5174 Vite dev server 已返回修改后的 sidebar item 模块，确认运行服务能解析到新的 hover class。
- 可维护性检查：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - 结果：0 errors，1 warning；warning 为 `sidebar.tsx` 接近 500 行预算，本次行数未增长。
- 治理检查：`pnpm lint:new-code:governance`
  - 结果：通过。
- Governance backlog ratchet：`pnpm check:governance-backlog-ratchet`
  - 结果：通过。

## 发布/部署方式

本次未执行发布、部署、提交或推送。

发布判断：

- 这是用户可见 UI 交互修复，已新增 `.changeset/sidebar-hover-norm.md`。
- 影响包：`@nextclaw/ui` patch。
- 后续统一 NPM 发布时由 changesets 聚合。

## 用户/产品视角的验收步骤

1. 打开聊天页左侧栏。
2. 鼠标悬停“定时任务 / 技能 / Agent 管理”。
3. 预期 hover 背景与会话列表 item 一样，是克制但明确的浅灰反馈，而不是过重的 primary/ring/shadow。
4. 悬停设置页返回入口、侧栏底部设置菜单和项目组加号，预期同类普通侧栏行项目使用同一灰阶 hover 规范。
5. 主行动类按钮仍保留自己的 primary hover 语义，不与普通行项目混同。

## 可维护性总结汇总

可维护性复核结论：通过。

- 代码增减报告：新增 22 行，删除 22 行，净增 0 行。
- 非测试代码增减报告：新增 20 行，删除 20 行，净增 0 行。
- 正向减债动作：简化 / 复用既有规范。
- 质量与可维护性提升证明：本次没有新增组件、helper 或视觉特例，而是把漂移的 hover token 回收到既有侧栏 item 规范，减少同一侧栏内多套 hover 语义并存。
- 保留观察点：`sidebar.tsx` 接近文件预算；本次未继续增长，后续若继续触达应优先拆分设置 header / footer action 展示职责。

## NPM 包发布记录

本次未发布 NPM 包。

需要进入后续统一发布：

- `@nextclaw/ui`：patch，原因是统一左侧栏普通行项目 hover 反馈，修复定时任务等入口 hover 不明显且与会话列表 item 不一致的问题。
