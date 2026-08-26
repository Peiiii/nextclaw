# v0.44.1 官网产品实证与安装体验升级

## 迭代完成说明

本次把官网首页、产品截图、下载与安装和社群入口收敛为一套一致的用户路径。根因来自连续的桌面端实屏验收：旧首页首屏没有稳定展示完整产品主体，后续截图被重复边框和留白包裹；下载、安装方式和首次打开说明分散在不同页面与卡片中；社群入口也缺少统一 owner。这些局部组件各自成立，但组合后形成“一页半”、内容碎片化和导航无法返回的问题。

首页现采用自然 `100svh` 的左右结构，左侧只保留产品定位、简短说明和主次行动，右侧直接展示真实浅色工作台；后续产品实证改成无框编辑式的左右交替布局。下载与安装统一由 `/zh/download/` 和 `/en/download/` 承载，桌面版、npm 和 Docker 使用可固定、可高亮、带滚动阴影的同一导航；旧 `/install/` 仅保留 canonical/noindex 兼容跳转。官网顶部和页尾统一提供微信社群入口，不再并列 Discord 社群入口。

设计冻结见 [官网首屏产品实证设计](../../designs/2026-08-26-landing-hero-product-proof.design.md)，近期产品样本与原始截图见 [官网首屏近期参考调研](../../thoughts/2026-08-26-landing-hero-reference-research.thought.md)，用户可见变更见 [landing product proof changeset](../../../.changeset/landing-product-proof-refresh.md)。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/landing tsc` 通过。
- `pnpm --filter @nextclaw/landing build` 通过。
- 官网触达 TypeScript 文件定向 ESLint 零 error；`main.ts` 保留一项既有 max-lines warning，本次没有新增 lint error。
- `git diff --check` 通过。
- Playwright 在 `1512 × 827`、`1100 × 900` 和 `390 × 844` 三个视口完成首页实屏验收：标题、行动与产品主体可见，无横向溢出，下一节不进入首屏。
- 中英文下载合并页完成桌面和移动端验收；安装方式导航固定位置、当前项高亮和滚动阴影均符合预期。
- `/zh/install/` 与 `/en/install/` 均跳转到对应下载页的 `#install-methods`，且兼容页使用 `noindex` 与统一 canonical。
- 首页与集成页的大图统一检查为父层无内边距、图片无重复边框；桌面端左右交替、移动端上文下图。
- 中英文顶部导航和移动菜单中的微信社群入口可达；页面只保留一个微信二维码社群区，没有 Discord 社群链接。

## 发布/部署方式

- 先把官网范围精确提交并通过主线协调器合入、推送 `origin/master`，不纳入工作区内其它 Kernel、Desktop 或 UI 构建改动。
- 从已推送的固定 `origin/master` 提交创建隔离 worktree，执行 `pnpm deploy:landing` 部署 Cloudflare Pages 项目 `nextclaw-landing`。
- 部署完成后验证正式域首页、下载页、旧安装地址跳转和关键社群入口；实际部署地址、提交和耗时将在部署后补记。
- 本轮不发布 NPM、Runtime channel 或 Desktop。

## 用户/产品视角的验收步骤

1. 桌面端打开中文或英文官网首页，不滚动即可看见产品定位、两个行动和完整真实工作台，下一节不应露出。
2. 点击“下载桌面版”进入统一下载与安装页，在顶部安装方式导航切换桌面版、npm 与 Docker；向下滚动时导航保持可见，并高亮当前部分。
3. 从旧 `/zh/install/` 或 `/en/install/` 地址进入，应自动到达对应下载页的安装方式区域。
4. 继续浏览首页产品实证，确认文字与截图左右交替、没有多余大卡片边框和相框留白；移动端应统一为上文下图。
5. 从官网顶部或移动菜单点击“加入社群”，应到达微信二维码区域，官网不再要求用户在多个社群渠道间选择。

## 可维护性总结汇总

本轮把“下载与安装”收敛为一个路由 owner，旧安装页只承担兼容跳转；首页与集成页共享同一产品实证布局语义，社群入口共享同一微信锚点。没有新增第二套安装内容、固定像素 Hero 高度或嵌套截图框架。

定向 TypeScript、构建和 ESLint 已通过。完整 maintainability guard 的 landing 范围没有新增 error；工作区中的既有 Kernel 文件预算越界属于并行未提交工作，本轮未修改或掩盖。`apps/landing/src/main.ts` 仍有历史 max-lines warning，后续如继续扩展官网交互，应优先按页面行为 owner 拆分，而不是继续向入口文件叠加。

## NPM 包发布记录

不涉及 NPM 包发布。本次是官网内容、视觉与信息架构更新，由 Cloudflare Pages 独立部署；changeset 用于下一次统一产品发布时保留用户可见记录。
