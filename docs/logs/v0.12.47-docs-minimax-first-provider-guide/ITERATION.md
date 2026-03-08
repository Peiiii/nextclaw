# v0.12.47-docs-minimax-first-provider-guide

## 迭代完成说明（改了什么）

- 新增文档：`/zh/guide/tutorials/minimax` 与 `/en/guide/tutorials/minimax`，主题为“安装后第一步先配置 API Provider（以 MiniMax 为例）”。
- 在教程总览页新增入口：
  - `apps/docs/zh/guide/tutorials.md`
  - `apps/docs/en/guide/tutorials.md`
- 在快速开始页补充“安装后不知道先做什么”直达链接：
  - `apps/docs/zh/guide/getting-started.md`
  - `apps/docs/en/guide/getting-started.md`
- 在“配置后做什么”页顶部补充未配置 Provider 用户的分流入口：
  - `apps/docs/zh/guide/after-setup.md`
  - `apps/docs/en/guide/after-setup.md`
- 在 VitePress 侧边栏新增对应导航项：
  - `apps/docs/.vitepress/config.ts`

## 测试/验证/验收方式

- 文档构建验证：`pnpm --filter @nextclaw/docs build`
- 文档双语镜像校验：`pnpm docs:i18n:check`
- 关键验收点：
  - 新页面可构建并生成静态站点；
  - `en/zh` 路径一一对应；
  - 教程总览、侧边栏、快速开始、after-setup 均可跳转到 MiniMax 文档。

## 发布/部署方式

- 文档变更合并后执行：`pnpm deploy:docs`
- 本次仅文档站内容更新，不涉及后端、数据库、migration。

## 用户/产品视角的验收步骤

1. 新用户按快速开始安装并执行 `nextclaw start`。
2. 打开文档站 `Quick Start/快速开始`，能看到“安装后第一步：MiniMax”入口。
3. 按文档完成 MiniMax Provider 配置与模型选择。
4. 发送测试消息并拿到预期回复（`MINIMAX-OK` 或等价语义）。
5. 回到“配置后做什么”继续后续动作（渠道接入、自动化等）。
