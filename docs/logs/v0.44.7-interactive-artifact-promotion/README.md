# v0.44.7 聊天内互动成果官网展示

## 迭代完成说明

官网首页新增“聊天里的互动成果”展示。访问者可拖动一个控制项，看到工作节奏曲线、资料/推演/行动分配与会话内成果卡同步变化，从而理解 NextClaw 的图表、计划和临时小工具可以留在同一任务中继续调整。

设计冻结见 [聊天内交互式成果展示设计](../../designs/2026-08-27-interactive-artifact-promotion.design.md)，用户可见变更见 [interactive artifact promotion changeset](../../../.changeset/interactive-artifact-promotion.md)。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/landing tsc` 通过。
- `pnpm --filter @nextclaw/landing build` 通过。
- Playwright 在 `1512 × 828` 与 `390 × 844` 视口验证：键盘可将滑块推到两端，图表标记、工作分配、会话结果卡同步更新；页面无横向溢出，滑块焦点可见。
- landing ESLint 无 error；`apps/landing/src/main.ts` 仅保留既有的 max-lines warning，本次净增为 0。

## 发布/部署方式

- 先将官网范围精确提交、由主线协调器回流并推送 `origin/master`。
- 从固定的 `origin/master` 提交在隔离 worktree 执行 `pnpm deploy:landing`，部署 Cloudflare Pages 项目 `nextclaw-landing`。
- 部署完成后记录预览地址、正式域验证结果与实测耗时。

## 用户/产品视角的验收步骤

1. 打开 `https://nextclaw.io/zh/`，向下浏览到“聊天里的互动成果”。
2. 用鼠标、触摸或键盘拖动“把任务从探索推向执行”。
3. 确认曲线、资料/推演/行动占比与右侧会话中的成果条同步变化。
4. 在手机宽度下确认滑块可聚焦、内容不横向滚动，成果卡仍完整可读。

## 可维护性总结汇总

展示静态渲染归 `utils/interactive-artifact.utils.ts`，DOM 输入与更新归 `controllers/interactive-artifact.controller.ts`；入口文件只调用 controller，避免继续扩大既有超长入口。没有新增运行时协议、状态持久化、通用框架或平行展示路径。

定向 maintainability guard 无 error。`main.ts` 保留历史文件预算 warning，但本次净增为 0；全仓新代码治理检查若被并行 Kernel/Desktop WIP 阻断，不将其归因于本批官网文件。

## NPM 包发布记录

不涉及 NPM 包发布。本次是官网内容与交互展示更新，由 Cloudflare Pages 独立部署；changeset 用于下一次统一产品发布时保留用户可见记录。
