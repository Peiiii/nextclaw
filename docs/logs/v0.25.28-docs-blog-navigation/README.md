# v0.25.28 文档站博客一级导航

## 迭代完成说明

- 文档站中英文顶部导航新增“博客 / Blog”直达入口，用户可以从任意文档页面直接进入博客总览。
- 根因是博客页面和独立侧栏已经存在，但全站一级导航没有暴露入口，用户必须预先知道 URL 才能访问。
- 修复落在唯一导航 owner `apps/docs/.vitepress/navigation/docs-navigation.config.ts`，保留“开始、工作方式、任务案例、安装与参考、更新、更多”等既有入口，不引入下拉菜单或第二套导航。

## 测试/验证/验收方式

- `pnpm exec eslint apps/docs/.vitepress/navigation/docs-navigation.config.ts`：通过。
- `packages/nextclaw/node_modules/.bin/tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --typeRoots packages/nextclaw/node_modules/@types --skipLibCheck apps/docs/.vitepress/navigation/docs-navigation.config.ts`：通过。
- `pnpm docs:i18n:check`：通过，82 个中英文 Markdown 页面保持镜像一致。
- `pnpm --filter @nextclaw/docs build`：通过。
- 隔离预览真实浏览器验收：桌面顶栏显示“博客”，点击后进入 `/zh/blog/`；390×844 移动视口展开菜单后显示“博客”，英文菜单同步显示 `Blog -> /en/blog/`。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

- 由本地 `master` 提交并推送 `origin/master`，触发 `.github/workflows/docs-deploy.yml`。
- workflow 构建一次不可变文档制品，并发布到 Cloudflare Pages 与阿里云 OSS + CDN；最终 verify job 校验双站 release identity 与关键路由。
- 不涉及数据库 migration、后端服务部署或 NPM 包发布。

## 用户/产品视角的验收步骤

1. 打开任意中文文档页面，确认桌面顶部导航直接显示“博客”，且没有下拉箭头。
2. 点击“博客”，确认进入 `/zh/blog/` 并看到博客文章列表。
3. 将页面缩窄到移动布局，展开顶部菜单，确认“博客”仍直接可见并可点击。
4. 切换英文，确认对应入口为 `Blog`，目标地址为 `/en/blog/`。

## 可维护性总结汇总

- 本次是新增用户可见导航能力，生产配置净增 2 行；没有新增组件、helper、状态、文件角色或平行导航链路。
- 导航事实继续由现有中英文 `NavItem[]` 维护，博客侧栏和内容结构保持原 owner；实现已达到最小可读形态。
- maintainability guard 判定导航配置不属于代码型守卫范围；主观复核无可维护性问题，文件、函数和目录数量均未增加。

## NPM 包发布记录

不涉及 NPM 包发布。`@nextclaw/docs` 是独立部署的文档应用，本次不添加 `.changeset`。
