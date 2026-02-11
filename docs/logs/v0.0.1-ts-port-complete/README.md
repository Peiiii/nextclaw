# 2026-02-11 TS 迁移收口（channels/bridge/provider 对齐）

## 背景 / 问题

- 首版 TS 迁移仍有渠道未落地、桥接命令缺失、部分 provider 逻辑与 nanobot 不一致

## 决策

- 严格按 nanobot 既有逻辑补齐渠道能力与模型前缀处理
- 桥接方案继续沿用 Node bridge，CLI 负责安装/构建/启动

## 变更内容

- 用户可见变化
  - 渠道完整可用：Mochat / DingTalk / QQ / WhatsApp / Feishu
  - CLI `channels login` 可直接拉起 bridge 进行扫码登录
- 关键实现点
  - 对齐 LiteLLM provider 标准/网关前缀策略
  - Feishu 支持卡片渲染（含表格）与消息 reaction
  - Mochat 增量订阅 + 轮询 fallback + 延迟合并回复
  - 新增内置 skills 目录（迁移 nanobot 现有 skills）
  - bridge 源码纳入 package 目录并随 CLI 可用

## 验证（怎么确认符合预期）

```bash
pnpm -C packages/nextbot tsc
pnpm -C packages/nextbot lint
pnpm -C packages/nextbot build

# smoke-check（非仓库目录）
NEXTBOT_HOME=/tmp/nextbot-smoke node /Users/peiwang/Projects/nextbot/packages/nextbot/dist/cli/index.js onboard
```

验收点：

- tsc/lint/build 全部成功
- `onboard` 在 `/tmp/nextbot-smoke` 生成 config/workspace 并提示下一步

## 发布 / 部署

- 本次未执行发布；如需发布 npm 包请参考 `docs/workflows/npm-release-process.md`

## 影响范围 / 风险

- Breaking change：否
- 风险：渠道依赖较多，需在实际环境配置 token/key 验证各通道连接
