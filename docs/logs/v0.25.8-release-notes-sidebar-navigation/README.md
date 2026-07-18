# v0.25.8 Release Note 侧栏导航

## 迭代完成说明

- 文档站中英文 Release Note 页面左侧栏现在列出全部版本说明，并按文件日期与版本号从新到旧排列。
- 侧栏继续保留“全部更新”入口；版本项使用去掉重复日期后的标题，便于快速识别和跳转。
- 列表由 `notes/` 目录中的 Markdown frontmatter 自动生成。新增版本说明后无需再手工维护第二份侧栏清单；缺少标题时构建会明确失败。

## 测试/验证/验收方式

- `pnpm exec eslint apps/docs/.vitepress/navigation/docs-navigation.config.ts`：通过。
- `packages/nextclaw/node_modules/.bin/tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --typeRoots packages/nextclaw/node_modules/@types --skipLibCheck apps/docs/.vitepress/navigation/docs-navigation.config.ts`：通过。
- `pnpm --filter @nextclaw/docs build`：通过。
- 构建产物检查：中文与英文 v0.25.3 页面均包含 `16/16` 条版本说明链接。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

- 使用 `pnpm deploy:docs:global` 对应的 Cloudflare Pages 生产链路发布至 `docs.nextclaw.io`。
- 从本次提交的隔离 worktree 构建并部署，避免把工作区中的并行改动带入线上产物；部署后检查中英文版本说明页面及全部侧栏链接。

## 用户/产品视角的验收步骤

1. 打开任意中文或英文 Release Note 页面。
2. 确认左侧栏保留“全部更新”，并显示从 v0.25.3 开始的全部历史版本说明。
3. 点击任一版本，确认直接进入对应页面，当前版本保持高亮。
4. 切换中英文，确认侧栏标题和目标页面使用对应语言。

## 可维护性总结汇总

- 版本说明文件及其 frontmatter 是侧栏数据源；没有复制中英文静态版本清单，也没有新增组件、样式或平行导航 owner。
- 改动集中在既有 `docs-navigation.config.ts`，新增一个构建期生成函数，文件、函数和目录数量没有扩散。
- maintainability guard 将文档站导航配置判定为不适用；已完成主观可维护性复核，无可维护性问题。新增代码用于新的用户可见导航能力，且已收敛到最小实现。

## NPM 包发布记录

不涉及 NPM 包发布。
