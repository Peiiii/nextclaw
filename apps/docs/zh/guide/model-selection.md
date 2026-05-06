# 配置模型提供方

模型提供方决定 NextClaw 调用哪个模型来回复你。第一次配置时，不要追求一步到位，先选一条最容易跑通的路径。

## 推荐选择顺序

1. 如果你想最快体验，先看 [先选接入方式](/zh/guide/tutorials/provider-options)。
2. 如果你有现成 API Key，配置对应 provider。
3. 如果你想本地运行模型，看 [本地 Ollama + Qwen3](/zh/guide/tutorials/local-ollama-qwen3)。

## 最小配置要完成什么

- provider 名称
- API base 或平台入口
- 认证方式
- 默认模型

保存后回到 UI，发一条真实消息验证。

## 什么时候需要多模型

先不要一开始就配置很多模型。多模型适合这些场景：

- 一个模型用于快速草稿
- 一个模型用于复杂推理
- 一个模型用于本地或离线场景
- 不同会话绑定不同模型

## 常见问题

### 配完之后没有回复

先运行：

```bash
nextclaw doctor
```

再确认：

- API Key 是否有效
- 模型名称是否在该 provider 下存在
- 默认模型是否已经保存

## 相关文档

- [配置手册](/zh/guide/configuration)
- [密钥管理](/zh/guide/secrets)
- [故障排查](/zh/guide/troubleshooting)
