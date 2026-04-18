# NextClaw Platform

用户前端站点（独立于管理后台）。

当前已采用与 `platform-admin` 对齐的经典工作台结构：

- 左侧固定导航
- 顶部固定全局栏
- 中间内容区独立滚动
- 用户侧首批页面：
  - `我的实例`
  - `账号`
- 登录页与分享页也统一到同一套 NextClaw 暖中性色视觉语言

技术栈：
- React + TypeScript
- TanStack Query
- Zustand
- Tailwind（shadcn 风格组件组织）

产品定位：
- 这是 `NextClaw Account` 的用户入口站点。
- 用户通过“邮箱 + 密码”登录。
- 新账号通过邮箱验证码验证后设置密码完成注册。
- 忘记密码通过邮箱验证码验证后设置新密码。
- 登录后可以查看设备列表、从网页中打开已连接的 NextClaw 设备，并查看账单能力。

## 本地运行

```bash
pnpm -C apps/platform-console install
pnpm -C apps/platform-console dev
```

默认通过 Vite 代理到 `http://127.0.0.1:8787`：
- `/platform/*`
- `/v1/*`
- `/health`

可通过环境变量覆盖：

```bash
VITE_PLATFORM_API_BASE=http://127.0.0.1:8790 pnpm -C apps/platform-console dev
```

生产构建默认 API 域名：`https://ai-gateway-api.nextclaw.io`（见 `.env.production`）。
发布命令（根目录）：

```bash
pnpm deploy:platform:console
```

上线前前置条件：
- 后端必须已经配置真实邮件提供方并能发送注册/重置密码验证码。
- 不要在生产环境依赖 `console` 邮件模式。

管理后台独立站点请使用：`apps/platform-admin`。

## 构建与检查

```bash
pnpm -C apps/platform-console build
pnpm -C apps/platform-console lint
pnpm -C apps/platform-console tsc
```

UI 冒烟：

```bash
PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4173 pnpm smoke:platform:console
```
