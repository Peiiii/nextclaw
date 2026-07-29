# v0.26.39 可视化文档模块

## 迭代完成说明

- 文档站新增中英文“可视化结果 / Visualizations”模块，并放入现有“NextClaw 如何工作”导航组，帮助用户在没有主动点名 Skill 时理解 NextClaw 何时会选择表格、Mermaid、图片、HTML 或 Panel App。
- 内容采用“适用场景、如何描述目标、结果出现位置、继续修改、结果校验”的单一总览结构，并复用真实产品截图和现有任务示例样式。
- “查看任务结果”和“数据分析”页面增加交叉入口；具体任务页继续负责操作流程，总览页负责媒介选择和能力发现，没有建立重复的教程体系。
- 本次没有新增组件、样式、provider、registry 或运行时分支。内容归双语 Markdown 指南页，发现入口继续归现有 `docs-navigation.config.ts`。

## 测试/验证/验收方式

- `apps/desktop/node_modules/.bin/tsc --noEmit --skipLibCheck --moduleResolution Bundler --module ESNext --target ES2022 apps/docs/.vitepress/navigation/docs-navigation.config.ts`：通过，定向验证导航配置的 TypeScript 类型。
- `pnpm exec eslint apps/docs/.vitepress/navigation/docs-navigation.config.ts`：通过。
- `pnpm -C apps/docs build`：通过，VitePress 完成中英文页面构建和内部链接检查。
- 本地预览冒烟：`http://127.0.0.1:4179/zh/guide/visualizations` 与 `/en/guide/visualizations` 均返回 200；中英文标题、侧栏入口、Panel Apps 关联和三张引用图片均可访问。
- `pnpm exec playwright screenshot --viewport-size="1728,1117" --full-page http://127.0.0.1:4179/zh/guide/visualizations /tmp/nextclaw-visualizations-docs-zh.png`：通过；桌面宽度下标题、侧栏、本页目录、对照表、示例块和图片布局正常。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm clean:generated && pnpm check:generated-clean`：通过，构建生成物已清理。
- GitHub Actions [Docs Deploy](https://github.com/Peiiii/nextclaw/actions/runs/30465606800)：通过；构建、Cloudflare 全球站、国内 OSS/CDN 与双域一致性校验全部成功。
- 线上定向验收：`docs.nextclaw.io` 与 `docs.nextclaw.net` 的中英文可视化页面、页面标题、导航关联和主截图均返回 200。

## 发布/部署方式

- 功能提交 `fa9bc8a87b40d1828b846db78a9d68b9b3658720` 已推送到 `origin/master`，并由 `docs-deploy.yml` 发布同一不可变构建。
- 部署 tree hash 为 `ce1b434ec16fae93961019938314bdf1caa67e12e1ef916977fc89fe1dbefa99`；全球站 `docs.nextclaw.io` 与国内站 `docs.nextclaw.net` 的 release manifest 已确认一致。
- 第一次 CI verifier 访问国内域名时发生 10 秒连接超时；两路发布 job 均已成功，本地正式验证器随即通过。只重跑失败的 verify job 后，工作流整体成功，没有重复修改或发布新的构建。
- 不涉及数据库 migration、后端部署、Desktop installer、runtime update 或线上 API 冒烟。

## 用户/产品视角的验收步骤

1. 打开文档站“NextClaw 如何工作”，确认“可视化结果”位于 “Skills 与 MCP” 和 “Panel Apps” 之间。
2. 打开中英文页面，确认能看到真实产品截图、媒介选择对照表和可直接复制的请求示例。
3. 从“查看任务结果”或“数据分析”进入可视化总览，确认相关文档能双向串联。
4. 核对页面明确保留简单回答使用文字的原则，不把可视化误导为每轮强制行为。

## 可维护性总结汇总

- `post-edit-maintainability-guard` 判断不适用：本次没有源码、脚本、测试或运行链路配置改动；导航调整属于文档站内容索引。
- `post-edit-maintainability-review` 不适用：没有新增运行时抽象、函数、分支、状态或组件。
- 内容复用现有导航 owner、指南目录、提示块样式和产品截图，只新增一份中英文总览并通过交叉链接接入既有任务文档，未扩大前端代码或目录职责。
- 本次属于新的用户可见文档能力，新增内容已经收敛到可解释能力边界所需的最小结构。

## NPM 包发布记录

不涉及 NPM 包发布。本次没有修改可发布 workspace 包或产品运行时，因此无需添加 Changeset；文档站部署本身即为用户可见交付。
