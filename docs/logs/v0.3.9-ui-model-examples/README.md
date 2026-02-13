# 2026-02-12 UI model examples

## 背景 / 问题

- 前端模型输入缺少真实示例，用户不知道如何填写

## 决策

- 在模型输入框增加两个真实示例

## 变更内容

- 更新模型输入的 placeholder 和示例提示

## 验证（怎么确认符合预期）

```bash
pnpm -C /Users/peiwang/Projects/nextbot build
pnpm -C /Users/peiwang/Projects/nextbot lint
pnpm -C /Users/peiwang/Projects/nextbot tsc

# smoke-check（非仓库目录）
NEXTCLAW_HOME=/tmp/nextclaw-ui-model-smoke pnpm -C /Users/peiwang/Projects/nextbot/packages/nextclaw dev start --ui-port 18814 > /tmp/nextclaw-ui-model-smoke.log 2>&1
sleep 2
curl -s http://127.0.0.1:18814/api/health
NEXTCLAW_HOME=/tmp/nextclaw-ui-model-smoke pnpm -C /Users/peiwang/Projects/nextbot/packages/nextclaw dev stop
```

验收点：

- build/lint/tsc 全部通过
- `/api/health` 返回 ok

## 发布 / 部署

- 本次未发布

## 影响范围 / 风险

- Breaking change：否
- 风险：无
