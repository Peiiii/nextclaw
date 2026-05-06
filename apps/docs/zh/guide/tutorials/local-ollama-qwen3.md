# 本地 Ollama + Qwen3

本地模型适合想减少外部依赖、测试离线能力或控制数据边界的用户。

## 使用前确认

- 本机已安装 Ollama
- 本机资源足够运行目标模型
- NextClaw 已经能启动并打开 UI

## 配置步骤

1. 在 Ollama 中拉取并运行模型。
2. 在 NextClaw 中添加本地 provider。
3. 指向本地 Ollama 地址。
4. 选择对应模型。
5. 发送一条真实消息验证。

## 注意事项

本地模型的速度和质量取决于机器资源。  
如果第一次只是想快速体验，云端 provider 可能更省事。

## 相关文档

- [配置模型提供方](/zh/guide/model-selection)
- [故障排查](/zh/guide/troubleshooting)
