# 2026-02-12 一键启动 start 命令

## 背景 / 问题

- 希望用户只运行一次命令即可同时启动 gateway、UI 后端与前端

## 决策

- 新增 `nextclaw start` 命令，默认启用 UI 后端并尝试启动 UI 前端 dev server
- 前端目录通过约定路径或 `NEXTCLAW_UI_DIR` 寻找，找不到则提示手动启动
- `start` 默认不打开后端 URL，优先打开前端 URL
- UI 静态资源打包进 `nextclaw`，安装版可直接通过 UI 后端访问前端页面

## 变更内容

- CLI 新增 `start` 命令，集成 UI 后端 + 前端 dev server 启动逻辑
- 使用 `VITE_API_BASE` 透传后端地址给前端
- 文档补充 start 的使用方式
- UI 后端支持托管静态资源（若存在 `ui-dist`）
- 构建时复制 `nextclaw-ui` 产物到 `nextclaw/ui-dist`

## 验证（怎么确认符合预期）

```bash
pnpm -C /Users/peiwang/Projects/nextbot build
pnpm -C /Users/peiwang/Projects/nextbot lint
pnpm -C /Users/peiwang/Projects/nextbot tsc

# smoke-check（非仓库目录，跳过前端）
NEXTCLAW_HOME=/tmp/nextclaw-start-smoke pnpm -C /Users/peiwang/Projects/nextbot/packages/nextclaw dev start --no-frontend --no-open --ui-port 18805 &
sleep 2
curl -s http://127.0.0.1:18805/api/health
curl -s http://127.0.0.1:18805/ | head -n 2
pkill -f "nextclaw.*start" || true
```

验收点：

- build/lint/tsc 全部通过
- `/api/health` 返回 ok
- `/` 返回 HTML

## 发布 / 部署

- 本次未发布

## 影响范围 / 风险

- Breaking change：否
- 风险：前端 dev server 缺失时只能提示手动启动
