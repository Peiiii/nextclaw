# v0.25.19 官网 Agent Runtime 展示

## 迭代完成说明

本迭代在官网主页面增加 Agent 与 Agent Runtime 的独立展示区，说明 Agent 负责身份、主目录、记忆与技能，Runtime 决定本次会话由 Native、Codex、Claude Code、OpenCode 或 Hermes 中的哪一种执行引擎运行。展示使用本地真实实例生成的中英文产品截图，并纳入现有截图刷新脚本，后续界面变化时可以按场景重新生成。

运行时选择器同步使用 OpenCode 官方图标，并把无专属图标时的 Native 回退样式调整为与当前雾蓝主题一致。官网区块去掉了重复的 `Agent Runtime` 与“NextClaw 的独特价值”标签，标题直接表达内容，减少无效层级。

本次继续沿用现有落地页内容 owner，将主页区块组合从入口文件抽出；没有新增页面框架、第二套截图流程或重复图片副本。

## 测试/验证/验收方式

- `@nextclaw/kernel` 运行时展示定向测试通过，4 个用例全部通过；`tsc` 与定向 ESLint 通过。
- `@nextclaw/ui` 会话类型选项定向测试通过，4 个用例全部通过；`tsc` 与定向 ESLint 通过。
- `@nextclaw/landing` production build 通过，中英文 Agent Runtime 图片均生成带内容哈希的构建资源。
- 使用真实本地 NextClaw 实例重新生成中英文截图，并确认 OpenCode 官方图标与 Native 回退图标均出现在选择器中。
- 在 `http://127.0.0.1:5175/zh/#agent-runtime` 与 `#compare` 完成浏览器验收：两个重复标签均不存在，标题上边距为 `0px`，页面内容与布局正常。
- scoped new-code governance、governance backlog ratchet、maintainability guard 与 `git diff --check` 通过。

## 发布/部署方式

- 只部署 `@nextclaw/landing` 到 Cloudflare Pages，不发布 NPM 包，也不触发 runtime 或桌面端更新通道。
- 部署完成后验证 Cloudflare Pages 部署地址与 `https://nextclaw.io/zh/` 正式域名，并复核 Agent Runtime 与独特价值两个区块。
- 图片通过 Vite 内容哈希进入构建产物，正式页不会继续引用旧截图缓存地址。

## 用户/产品视角的验收步骤

1. 打开 `https://nextclaw.io/zh/#agent-runtime`，确认页面直接以“为每次任务选择合适的执行引擎”为标题，不再显示重复的 `Agent Runtime` 小标签。
2. 查看右侧真实产品截图，确认 Agent 与 Runtime 是两个独立选择项，运行时列表包含 Native、Codex、Claude Code、OpenCode 与 Hermes。
3. 确认 OpenCode 使用专属图标，Native 默认图标在雾蓝主题下清晰但不过重。
4. 继续打开 `https://nextclaw.io/zh/#compare`，确认“NextClaw 有哪些独特价值？”直接作为区块标题，不再重复显示分类标签。

## 可维护性总结汇总

这是新增官网展示能力并收敛现有入口职责的用户可见改动。守卫统计源码总变更 `+360/-164`，非测试源码变更 `+346/-162`；增长集中在一个主页区块组合模块、一个声明式展示配置和一个截图场景配置，没有新增 manager、service、adapter 或平行数据源。

可维护性守卫为 0 error、2 warning。两个 warning 都是已有文件预算：`apps/landing/src/main.ts` 本次减少 123 行，`scripts/docs/refresh-product-screenshots.mjs` 本次减少 3 行，均未恶化。运行时图标事实继续归 Kernel registry，UI 只消费 presentation；截图场景继续归统一刷新脚本。未使用的 `apps/landing/public` 截图副本与对应输出目标已删除，官网与仓库只保留 `images/screenshots` 的单一图片来源。

## NPM 包发布记录

- `@nextclaw/kernel`：增加 OpenCode 官方图标映射；已添加 patch changeset，本次不发布。
- `@nextclaw/ui`：调整 Native 回退图标样式；已添加 patch changeset，本次不发布。
- `@nextclaw/landing`：私有部署单元，不进入 NPM changeset；本次随官网直接部署。
