# 官网主界面展示优化设计

## 背景

官网当前的截图与首页叙事偏早期：首屏同时展示安装命令、社群入口、空态聊天页、Provider、渠道和技能页。它能证明 NextClaw 有配置和接入能力，但不能让新用户第一眼理解 NextClaw 是一个承接任务的个人操作层。

本轮先做本地优化版，不提交。目标是让首页优先展示主界面和真实工作流，降低设置页、Provider 管理和渠道配置在首屏的权重。

## 现状依据

- `apps/landing/src/main.ts` 的首页首屏当前堆叠四张截图：chat、provider、channels、skills browser。
- `apps/landing/en/index.html` 与 `apps/landing/zh/index.html` 的社交分享图当前指向 Provider 管理截图。
- `nextclaw-chat-page-*.png` 是主界面截图，后续应优先用 `SCREENSHOT_USE_REAL_APP_DATA=1` 连接当前本地实例刷新，确保官网展示有真实会话、技能和配置数据；mock 模式只作为 CI / 无本地数据时的可复现 fallback。
- `nextclaw-providers-page-*.png` 能说明配置能力，但不适合作为官网主图或社交预览图。

## 核心判断

官网首页应先回答“用户进入 NextClaw 后如何把事情做完”，再回答“它背后能接哪些 Provider、渠道和部署方式”。

对外页面不呈现内部讨论过程，不写“我们认为旧截图放偏了”这类元话语。对外只呈现用户能感知的事实：从一个目标开始，在主界面里组织上下文、调用技能/工具、查看结果并继续推进。

## 推荐方案

1. 首屏使用主界面截图作为第一视觉资产，但产品图要以完整预览形式呈现，形成“NextClaw 是工作入口”的第一印象。
2. 首屏不再把产品截图做成半透明背景；产品图应作为完整、可识别的预览图出现，避免既不像背景也不像截图的混合状态。
3. 首屏不再展示大块终端安装动画，但必须保留“安装方式”入口；桌面下载作为主行动，npm 与 Docker 作为可发现的次级路径。
4. 新增主界面展示区，按工作流展示：任务工作台、技能详情浏览器、技能市场。
5. 新增接入面展示区，说明模型提供商、自定义模型、微信/飞书/QQ/钉钉等消息渠道，以及技能、MCP、CLI、定时任务等能力如何接入同一个工作台。
6. 新增具体用例启发区，卡片必须写用户真实会做的任务，例如群聊问题处理、内部会议纪要整理、网页资料调研、定时简报、本地项目排查和客户反馈整理；不能把“安装技能”“接入模型”“统一入口”“连接渠道”这类能力入口混进用例区。
7. 功能区改为更底层的支撑说明，避免和用例区重复。
8. 新增独立安装方式路由 `/en/install/`、`/zh/install/`，集中展示桌面版、npm 命令行安装和 Docker 部署入口；首页只保留跳转入口，下载页只保留轻提示，避免安装细节抢占产品介绍。
9. Provider、渠道、部署和生态对比不放回首屏，但需要在中段以 logo/chip 方式呈现真实支持面，避免官网显得能力单薄。
10. 社交分享图从 Provider 管理图切到主界面图；首页展示图使用截图刷新脚本生成的当前 UI 资产。

## Owner 与数据流

- 页面 owner：`apps/landing/src/main.ts` 的 landing copy 与 render 结构。
- 样式 owner：`apps/landing/src/style.css` 的站点级视觉 token 与少量站点 utility。
- 元信息 owner：`apps/landing/en/index.html` 与 `apps/landing/zh/index.html`。
- 本轮不引入后端数据流，不改变下载页 release 拉取逻辑；下载页只补充 npm / Docker 的发现入口。

## 目录组织

本轮属于单页面 landing 调整，继续在现有 `apps/landing` owner 内完成：

- 设计文档：`docs/designs/2026-07-05-landing-main-interface-refresh.design.md`
- 首页实现：`apps/landing/src/main.ts`
- 站点样式 token：`apps/landing/src/style.css`
- 社交元信息：`apps/landing/en/index.html`、`apps/landing/zh/index.html`

## 兼容与迁移

- 不改路由结构。
- 下载页保留原有桌面端 release 拉取与系统检测逻辑，只补充其它安装方式入口。
- 保留旧公开图片路径，避免影响未检查到的外部引用；首页展示只引用本轮刷新出的主界面相关截图。
- 旧截图资产暂不删除，避免影响已发布页面或未检查到的外部引用。

## 验收标准

- 本地首页首屏第一视觉是主界面，不再是 Provider 设置页或安装命令终端。
- 首页信息顺序为：主界面价值 -> 完整产品预览 -> 主界面截图故事 -> 模型/渠道/技能接入面 -> 具体用例启发 -> 底层支撑能力 -> CTA / FAQ / 社群；安装方式作为首屏按钮和独立路由存在，不在首页铺开详情。
- 社交分享图指向主界面截图。
- `pnpm --filter @nextclaw/landing tsc` 通过。
- `pnpm --filter @nextclaw/landing build` 通过。
- `pnpm --filter @nextclaw/landing lint` 尽可能通过；若被既有问题阻塞，记录阻塞项。
- 本地 dev server 可打开 `/zh/` 与 `/en/` 查看效果。

## 非目标

- 本轮不伪造产品界面；官网展示截图通过 `SCREENSHOT_USE_REAL_APP_DATA=1 pnpm screenshots:refresh` 从真实本地 UI 实例生成，mock 数据只作为 fallback。
- 本轮不发布官网、不提交、不推送。
- 本轮不重做下载页 release 逻辑，只补安装方式发现区。
- 本轮不解决所有 SEO 文案，只修正首页主叙事和社交图方向。

## 后续实现顺序

1. 调整首页首屏结构和主界面截图权重。
2. 更新中英文首页文案与功能分组。
3. 更新 OpenGraph / Twitter 图片与描述。
4. 本地构建、类型检查、lint 和浏览器冒烟。
5. 启动 dev server，给出本地查看地址。
