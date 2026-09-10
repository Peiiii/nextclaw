---
title: 接入 freellmapi（第三方免费 LLM 聚合）
---

# 接入 freellmapi

> **声明**：freellmapi 是第三方自托管免费 LLM 聚合服务，非 NextClaw 官方维护。
> 作者仅用于个人实验，无 SLA 保证，模型目录依赖远端 feed，可靠性由用户自行评估。
> NextClaw 不为其背书，也不承诺长期兼容。

## 快速接入

1. 部署 freellmapi 服务（见 [freellmapi 仓库](https://github.com/tashfeenahmed/freellmapi)）
2. 在 NextClaw 设置 → 供应商 → 添加自定义供应商
3. 填写以下配置：
   - **名称**：freellmapi
   - **API Base**：`http://localhost:3001/v1`（或你的部署地址）
   - **API Key**：你的统一 API Key
   - **模型发现**：开启「OpenAI 兼容目录抓取」
4. 点击「获取模型列表」批量导入

## 注意事项

- 默认 `localhost` 地址需要本地运行 freellmapi；远程部署请替换为实际地址
- 模型目录由 freellmapi 远端 feed 动态生成，可能随时变化
- 该服务无 SLA，中断时 NextClaw 无法兜底
