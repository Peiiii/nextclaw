# v0.23.10 Landing 产品选型对比

## 迭代完成说明

- 在官网首页的使用场景之后增加“产品对比”区，以任务起点、产品重心和优先适用条件三个维度并列介绍 WorkBuddy、Codex 与 NextClaw。
- 对比不使用胜负排名或无法核验的功能勾叉；WorkBuddy 与 Codex 分别链接其官方介绍，NextClaw 的六个具体场景分别链接对应产品文档。
- 根据本地验收反馈，将 NextClaw 从单纯的开源、自托管技术条件改为跨资料、数据、写作、代码、本地文件、消息渠道和定时任务的真实工作场景，并提供六个可核验示例。
- 桌面端将产品从纵向行排列改为三列排列，按“NextClaw -> WorkBuddy -> Codex”组织，让本站产品先进入视野；移动端同样优先展示 NextClaw。
- 首页桌面端与移动端导航增加“产品对比”入口，直接定位到该区。
- 对比内容进入独立配置 owner，页面渲染由纯渲染函数负责；同时提取页脚渲染，使既有超长 `main.ts` 和 `render` 方法没有继续增长。

## 测试/验证/验收方式

- `pnpm -C apps/landing tsc`：通过。
- `pnpm -C apps/landing lint`：通过，无错误；保留既有 `main.ts` 超长文件和超长方法 warning。
- `pnpm -C apps/landing build`：通过。
- 浏览器功能验收：在 `http://127.0.0.1:5175/zh/#compare` 检查桌面与 `390 x 844` 移动视口；三条对比路径、六个 NextClaw 具体场景均存在，无横向溢出和控制台错误。
- 外链核验：WorkBuddy、NextClaw 文档与 GitHub 链接返回 `200`；Codex 官方页可在浏览器访问，命令行请求受站点反自动化策略返回 `403`。
- maintainability guard：通过；`main.ts` 净减少 4 行，`render` 从 322 行降至 310 行，仍保留既有超预算 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- 全量收尾时重跑 `pnpm lint:new-code:governance` 与 `pnpm check:generated-clean`：均通过。

## 发布/部署方式

- 本迭代纳入当前 `master` 全量收尾提交并推送至 `origin/master`；本轮未部署官网。
- 官网发布时使用仓库既有 `pnpm deploy:landing` 流程。
- 不涉及后端、数据库或 migration。

## 用户/产品视角的验收步骤

1. 打开官网中文首页，点击顶栏“产品对比”。
2. 确认 WorkBuddy、Codex 与 NextClaw 都明确说明任务起点、产品重心和优先适用条件，没有主观胜负结论。
3. 确认每个竞品名称旁可以打开官方介绍；NextClaw 下方六个具体场景均可打开对应产品文档。
4. 在手机宽度打开同一入口，确认横向路径变为纵向阅读，文字和链接没有溢出或遮挡。

## 可维护性总结汇总

- 使用了 `post-edit-maintainability-review` 的标准复核口径。
- 新增能力本身需要新的内容、类型、渲染和样式，但大段双语内容没有留在应用入口，而是进入 `landing-comparison-content.config.ts`。
- 提取页脚渲染后，既有 `main.ts` 总行数和 `render` 方法长度都下降；没有新增状态、事件链路、路由类型或重复页面。
- 样式只使用现有雾蓝/绿色变量，NextClaw 仅做克制的边框和背景强调，没有引入竞品品牌色或新的设计体系。

## 红区触达与减债记录

### apps/landing/src/main.ts

- 本次是否减债：是。
- 说明：对比文案移出入口文件，并把页脚渲染移到既有页面渲染工具；文件净减少 4 行，`render` 方法减少 12 行。
- 下一步拆分缝：后续独立处理首页各 section 的装配与下载页大段模板，不在本迭代扩大重构范围。

## NPM 包发布记录

不涉及 NPM 包发布。
