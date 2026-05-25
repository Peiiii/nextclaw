# v0.19.29 设置页定时任务入口移除

## 迭代完成说明

- 删除设置导航配置中的“定时任务”入口。
- 保留主工作台侧边栏和 `/cron` 主界面的定时任务能力。
- 产品判断：定时任务属于主工作台的可执行自动化能力，不应在设置页里保留一条跳转到主界面的重复入口。
- 同步更新设置页与设置侧边栏测试，锁定移动设置列表和桌面设置导航中不再出现 `/cron` 设置入口。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/app/components/layout/settings-entry-page.test.tsx src/app/components/layout/sidebar.layout.test.tsx`
  - 结果：通过，2 个测试文件 6 个测试通过。
- `pnpm --filter @nextclaw/ui tsc --noEmit`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui exec eslint src/app/configs/app-navigation.config.ts src/app/components/layout/settings-entry-page.tsx src/app/components/layout/settings-entry-page.test.tsx src/app/components/layout/sidebar.layout.test.tsx`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui lint`
  - 结果：失败；阻塞来自既有无关 lint debt，例如 `chat-message-list.container.tsx` 未使用类型、若干旧测试的 `import()` type annotation、React ref render 访问等，不来自本次触达文件。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/app/configs/app-navigation.config.ts packages/nextclaw-ui/src/app/components/layout/settings-entry-page.tsx packages/nextclaw-ui/src/app/components/layout/settings-entry-page.test.tsx packages/nextclaw-ui/src/app/components/layout/sidebar.layout.test.tsx`
  - 结果：通过，0 errors，0 warnings。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。

## 发布/部署方式

- 未发布。
- 本次只涉及前端导航配置与测试，等待后续统一前端或 NPM 发布批次带出。
- 不涉及数据库 migration、远程部署或线上 API 冒烟。

## 用户/产品视角的验收步骤

1. 打开 NextClaw 设置页。
2. 检查桌面设置侧边栏和移动端设置列表。
3. 预期：设置页中不再出现“定时任务 / Cron Jobs”入口。
4. 回到主界面侧边栏或访问 `/cron`。
5. 预期：主界面的定时任务能力仍可进入。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 规则做收尾判断。
- 总代码增减：新增 9 行，删除 8 行，净增 1 行。
- 非测试代码增减：新增 0 行，删除 6 行，净增 -6 行，满足非功能改动门槛。
- 正向减债动作：删除。移除设置页重复产品入口，减少一条需要理解和维护的导航分支。
- 质量与可维护性提升证明：定时任务入口回到主工作台单一路径，设置页不再承担主工作台能力的二次跳转。
- 为何不是单纯压缩行数：删除的是已不需要的设置导航项及其图标依赖，测试同步锁定产品边界，没有牺牲可读性或把复杂度转移到其它位置。

## NPM 包发布记录

不涉及 NPM 包发布。
