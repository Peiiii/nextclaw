# 接入聊天入口

渠道让你不只在本地 UI 使用 NextClaw，也能从日常聊天入口里调用它。

第一次接渠道时，只选一个你每天真正会打开的平台。不要同时接一堆渠道。

## 接入前先确认

你需要先完成：

- [快速开始](/zh/guide/getting-started)
- 一个可用的模型提供方
- `nextclaw status` 显示服务正在运行

## 接入思路

1. 在 UI 或配置中选择渠道类型。
2. 填入该渠道需要的账号、token 或登录信息。
3. 保存配置。
4. 用 `nextclaw channels status` 检查连接状态。
5. 在目标聊天入口发送一条测试消息。

## 选择哪个渠道

优先选择你最常用的入口：

- 团队协作：Slack、飞书、企业微信
- 个人消息：Telegram、Discord
- 自建或实验场景：Webhook、MCP 或其他扩展入口

## 常见失败点

- token 填错或过期
- 渠道平台没有给足权限
- 本机网络无法访问目标平台
- 服务没有持续运行

## 相关文档

- [飞书配置](/zh/guide/tutorials/feishu)
- [密钥管理](/zh/guide/secrets)
- [故障排查](/zh/guide/troubleshooting)
