# 密钥管理

密钥管理用于保存 API Key、token 和其他敏感值。它的目标是减少明文散落，让配置更容易轮换和检查。

## 什么应该放进密钥管理

- 模型提供方 API Key
- 渠道 token
- 平台登录凭据
- 需要在多个配置中复用的敏感值

## 基本原则

- 不把密钥写进公开文档、聊天记录或截图里。
- 一个密钥只服务它应该服务的能力。
- 需要撤销时，能明确知道影响范围。
- 定期用诊断命令检查引用是否可解析。

## 常用检查

```bash
nextclaw secrets audit
nextclaw doctor
```

## 和配置的关系

配置说明“使用哪个密钥”。  
密钥管理保存“密钥本身从哪里来、怎么解析”。

## 相关文档

- [配置手册](/zh/guide/configuration)
- [配置模型提供方](/zh/guide/model-selection)
- [命令索引](/zh/guide/commands)
