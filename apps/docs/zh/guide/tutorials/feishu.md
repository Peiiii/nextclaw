# 飞书配置

飞书适合把 NextClaw 接进团队协作入口。第一次配置时，只做最小可用接入。

## 配置前确认

- NextClaw 已经跑通
- 模型 provider 可用
- 你有飞书应用或接入所需权限

## 配置步骤

1. 准备飞书应用信息和凭据。
2. 在 NextClaw 中添加飞书渠道。
3. 保存配置。
4. 运行 `nextclaw channels status`。
5. 在飞书里发送一条测试消息。

## 常见问题

- 权限范围不足
- token 或 app secret 填错
- 回调地址不可达
- 服务没有保持运行

## 相关文档

- [接入聊天入口](/zh/guide/channels)
- [密钥管理](/zh/guide/secrets)
- [故障排查](/zh/guide/troubleshooting)
