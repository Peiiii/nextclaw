# 2026-02-12 UI 后端（Hono）与 CLI 集成

## 背景 / 问题

- 需要 nextclaw 提供 UI 配置后端，并复用 gateway 进程

## 决策

- 使用 Hono 搭建 UI REST + WS 服务
- `nextclaw ui` 命令启动 gateway + UI server
- UI 配置写入 config 文件，热重载接口保留为 best-effort

## 变更内容

- 新增 UI 模块：`src/ui/*`
- CLI 新增 `ui` 命令，并支持 `gateway --ui` 参数
- 配置新增 `ui` 节点
- 文档补充 UI 使用方式

## 验证（怎么确认符合预期）

```bash
pnpm -C /Users/peiwang/Projects/nextbot build
pnpm -C /Users/peiwang/Projects/nextbot lint
pnpm -C /Users/peiwang/Projects/nextbot tsc

# smoke-check（非仓库目录）
NEXTCLAW_HOME=/tmp/nextclaw-ui-smoke-3 pnpm -C /Users/peiwang/Projects/nextbot/packages/nextclaw dev ui --no-open --port 18803 &
sleep 2
curl -s http://127.0.0.1:18803/api/health
pkill -f "nextclaw.*ui" || true
```

验收点：

- build/lint/tsc 全部通过
- `/api/health` 返回 ok

## 发布 / 部署

- 本次未发布

## 影响范围 / 风险

- Breaking change：否
- 风险：`config/reload` 当前为 best-effort，需要后续完善
