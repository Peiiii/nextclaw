# 先选接入方式

第一次配置模型时，先选一条最容易成功的路。不要一开始就比较所有 provider。

## 推荐选择

| 你的情况 | 建议路径 |
|----------|----------|
| 想最快体验 | 直接使用内置 OpenCode Zen 免费试用，无需 API Key |
| 已经有 API Key | 直接配置对应 provider |
| 想本地运行 | 使用 Ollama 路径 |
| 想接 Claude Code / Codex / Hermes | 看专门集成教程 |

## 最小判断

使用内置免费试用时，只需要确认模型能在 UI 中正常回复。接入自己的提供方时，再确认：

- 是否能获得认证信息
- 是否知道要用哪个模型
- 是否能在 UI 里得到一次正常回复

免费试用由公共网关提供，限额和模型可能变化，也不适合发送敏感或机密信息。需要稳定配额、明确数据合同或指定模型时，请配置自己的提供方。

## 下一步

- [配置模型提供方](/zh/guide/model-selection)
- [本地 Ollama + Qwen3](/zh/guide/tutorials/local-ollama-qwen3)
- [Claude Code / Codex / Hermes 集成](/zh/guide/tutorials/claude-codex-hermes)
