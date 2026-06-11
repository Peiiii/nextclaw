# Panel Apps 空态引导

## 迭代完成说明

- 为 Panel Apps 列表增加首次空态引导，只在总列表确实为 0 时展示。
- 空态说明 Panel Apps 的用途、两种创建入口：让 NextClaw 生成，或把 `*.panel.html` / `*.panel` 应用放进 panels 目录。
- 将“筛选结果为空”和“新用户一个应用都没有”分开：已有应用但收藏/最近打开为空时，显示普通空结果，不误导为首次引导。
- 补齐中英文 i18n 文案，并新增组件测试锁定首次空态与筛选空态的分支。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec vitest run src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx`
  - 结果：通过，1 个测试文件、2 个测试通过。
- `pnpm --filter @nextclaw/ui exec eslint src/features/panel-apps/components/panel-apps-list.tsx src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui build`
  - 结果：通过；保留 Vite 既有 large chunk warning，不是本次阻塞。
- `pnpm --filter @nextclaw/ui lint`
  - 结果：通过；存在 32 个历史 warning，均不在本次触达文件。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/panel-apps/components/panel-apps-list.tsx packages/nextclaw-ui/src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx packages/nextclaw-ui/src/shared/lib/i18n/locales/zh-CN/doc-browser.json packages/nextclaw-ui/src/shared/lib/i18n/locales/en-US/doc-browser.json`
  - 结果：通过，无可维护性问题。
- `git diff --check`
  - 结果：通过。
- `pnpm clean:generated`
  - 结果：通过，生成产物保持 clean。
- `pnpm release:notes:check`
  - 结果：命令不存在；已按 release notes skill 手工判断并新增 `.changeset/panel-app-empty-guide.md`。

## 发布/部署方式

- 本次未执行发布或部署。
- 不涉及数据库 migration。
- 不涉及线上 smoke。
- 已新增 `.changeset/panel-app-empty-guide.md`，后续随统一 NPM 发布进入 `@nextclaw/ui` patch 变更说明。

## 用户/产品视角的验收步骤

- 打开右侧 Apps / Panel Apps 入口，且 workspace 中没有任何 panel app。
- 确认页面展示“创建你的第一个面板应用 / Create your first panel app”引导、创建方式和 panels 目录。
- 新增一个 panel app 后刷新，确认列表展示应用卡片，不再展示首次引导。
- 在已有应用但当前筛选分类为空时，确认只显示“当前分类暂无面板应用 / No panel apps in this view”。

## 可维护性总结汇总

- 本次是新增用户可见能力，不按非功能改动的非测试净增 `<= 0` 硬门槛处理。
- scoped maintainability guard：
  - 结果：通过；统计口径内总代码 `+197 / -5 / net +192`，非测试 `+82 / -5 / net +77`，无可维护性 findings。
- 按 git 触达文件口径：总计 `+212 / -5 / net +207`；其中新增测试 `+114`，非测试与 i18n `+98 / -5 / net +93`。
- 可维护性复核结论：通过。
- 本次顺手减债：是。将总列表为空与筛选为空拆成两个明确分支，减少原先 `entries.length === 0` 同时承担两种语义的歧义。
- no maintainability findings。空态 UI 保持在 Panel Apps feature 组件内，没有新增全局组件、后端接口、自动创建路径或平行 owner；后续如果多个页面都需要同类 first-use guide，再评估是否沉到 shared empty-state primitive。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`。
- 发布状态：未发布。
- 后续处理：随下一次统一 NPM 发布批次发布 patch。
