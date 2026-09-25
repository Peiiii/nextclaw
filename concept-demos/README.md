# 概念演示

## 公开设计空间

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
