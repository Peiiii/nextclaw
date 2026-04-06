## 目录预算豁免

- 原因：该目录是 UI API 的 HTTP 路由装配层，需要并列保留轻量 controller 入口文件，以维持按资源职责拆分的清晰边界；新增 `agents.controller.ts` 属于新资源入口，不应继续塞回已有 hotspot controller。
