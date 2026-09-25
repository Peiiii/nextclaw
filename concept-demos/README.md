# 概念演示

这里保存与正式产品入口隔离的可交互概念演示。每个演示拥有自己的目录、静态资源、Cloudflare Wrangler 配置和部署说明，可独立部署到 `*.workers.dev`；不复用正式产品 Worker 或域名路由。

| 演示 | 入口 | 说明 |
| --- | --- | --- |
| Bibo Personal Agent 界面 | [`bibo-personal-agent/public/index.html`](bibo-personal-agent/public/index.html) | 四种早期视觉探索，正按完整产品方案重做；保留工作桌初稿 |

新增演示时创建独立子目录，并使用唯一的 Worker 名称。演示中的数据、操作和真实产品能力必须明确区分；部署前从本地入口验证主要交互和手机布局，部署后核对公开 URL 及资源响应。正式产品的发布流程不从这里触发。
