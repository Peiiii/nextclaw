# v0.0.5 Release

## 发布/部署方式

1. 发布并部署 `nextclaw-core`、`nextclaw-server`、`nextclaw-ui`、`nextclaw`（包含 UI 入口与网关运行时变更）。
2. 重启网关服务，确保新路由与新 runtime 逻辑生效。
3. 打开 UI 对话页验证发送中按钮状态：支持时可点 Stop；不支持时为禁用提示。
4. 执行一次 stop API 冒烟：`capabilities -> stream -> stop`。

## 变更类型判定

- 本次不涉及数据库或 migration。
- 涉及网关运行时行为，必须重启服务后生效。
