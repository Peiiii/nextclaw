# NextClaw Admin Console

独立管理后台站点（仅管理员）。

当前已采用“NextClaw 视觉语言 + 经典后台模板”的控制台结构：

- 左侧固定导航
- 顶部固定全局栏
- 中间内容区独立滚动
- 页面按统一框架组织为工具栏、内容面板、表格/双栏工作台
- 当前首批页面：
  - `总览`
  - `Marketplace 审核`
  - `用户与额度`
  - `充值审核`

技术栈：
- React + TypeScript
- TanStack Query
- Zustand
- Tailwind（shadcn 风格组件组织）

## 本地运行

```bash
pnpm -C apps/platform-admin install
pnpm -C apps/platform-admin dev
```

默认通过 Vite 代理到 `http://127.0.0.1:8787`：
- `/platform/*`
- `/v1/*`
- `/health`

可通过环境变量覆盖：

```bash
VITE_PLATFORM_API_BASE=http://127.0.0.1:8790 pnpm -C apps/platform-admin dev
```

生产构建默认 API 域名：`https://ai-gateway-api.nextclaw.io`（见 `.env.production`）。
发布命令（根目录）：

```bash
pnpm deploy:platform:admin
```

## 构建与检查

```bash
pnpm -C apps/platform-admin build
pnpm -C apps/platform-admin lint
pnpm -C apps/platform-admin tsc
```

UI 冒烟：

```bash
PLATFORM_ADMIN_BASE_URL=http://127.0.0.1:4177 pnpm smoke:platform:admin
```
