# 概念演示

## 公开设计空间

总入口按设计稿目录组织：紧凑列表显示名称、项目、状态、更新时间，支持即时搜索、项目／状态筛选、更新时间／名称排序与每页 20 条分页。默认当前采用优先，同组按最近更新时间。更新时间取设计文件的 Git 最近提交，不用页面打开时间伪装更新；演示部署时间单独展示。新增、更新设计稿时须同步目录元数据与部署记录。

- 总入口：`https://design.bibo.bot`，由 `design-gallery/` 独立部署。
- 每个实例使用四级域名：`studio.design.bibo.bot`（当前选定）、`workdesk.design.bibo.bot`（对比存档）、`inbox/day/brief/desk/original.design.bibo.bot`（早期探索）。
- 同一产品的静态稿共用资产 Worker，通过 `entry.js` 将域名根路径导向对应原型。不同产品可使用独立 Worker；所有域名显式绑定 Custom Domain，不使用通配路由覆盖正式产品。
- Cloudflare 自动配置 DNS／HTTPS。新增实例同步维护 gallery、域名映射和 Wrangler routes；不存在的页面返回 404。
- 各域名 localStorage 独立，演示数据不跨实例同步。发布范围仅静态示例，不接真实个人数据。

这里保存与正式产品入口隔离的可交互概念演示。每个演示拥有自己的目录、静态资源、Cloudflare Wrangler 配置和部署说明，可独立部署到 `*.workers.dev`；不复用正式产品 Worker 或域名路由。

| 演示 | 入口 | 说明 |
| --- | --- | --- |
| Bibo Personal Agent 界面 | [`bibo-personal-agent/public/index.html`](bibo-personal-agent/public/index.html) | 四种早期视觉探索，正按完整产品方案重做；保留工作桌初稿 |

新增演示时创建独立子目录，并使用唯一的 Worker 名称。演示中的数据、操作和真实产品能力必须明确区分；部署前从本地入口验证主要交互和手机布局，部署后核对公开 URL 及资源响应。正式产品的发布流程不从这里触发。
