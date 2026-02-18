# 2026-02-18 Release nextclaw v0.5.2

## 背景

- 修复 VPS 场景中 `nextclaw start` 假启动与脏状态问题：
  - 后台子进程参数不兼容（`--ui-host`）导致启动即退出。
  - 主进程未确认就绪即写 `service.json`。

## 发布范围

- `nextclaw@0.5.2`

## 发布流程

```bash
pnpm release:version
pnpm release:publish
```

## 发布前校验

`release:publish` 自动执行：

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

## 发布后验收

```bash
npm view nextclaw version
# 期望: 0.5.2
```

VPS 回归（8.219.57.52）：

- `nextclaw --version` => `0.5.2`
- `nextclaw start --ui-port 18791` 成功
- `curl http://127.0.0.1:18791/api/health` => `{"ok":true,...}`
- `curl http://8.219.57.52:18791/api/health` => `{"ok":true,...}`

## 备注

- 本次为 npm 包发布，不涉及数据库/后端 migration。
