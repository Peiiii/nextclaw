# v0.8.62-ui-release

## 迭代完成说明（改了什么）

本次完成 UI 相关包发布闭环，执行了一键前端发布流程（`pnpm release:frontend`）。

- 自动生成并消费 UI changeset（`@nextclaw/ui` + `nextclaw`）。
- 实际发布包：
  - `@nextclaw/ui@0.5.48`
  - `nextclaw@0.8.62`
- 自动创建 Git Tag：
  - `@nextclaw/ui@0.5.48`
  - `nextclaw@0.8.62`

## 测试 / 验证 / 验收方式

- 发布流程内置校验（`release:publish` 内执行）：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 发布结果校验：`changeset publish` 输出 `packages published successfully`。
- 线上可用性冒烟（非仓库目录）：
  - 命令：`cd /tmp && npx -y nextclaw@0.8.62 --version`
  - 观察点：输出版本号 `0.8.62`。

## 发布 / 部署方式

1. 执行 `pnpm release:frontend`。
2. 脚本自动串行执行：
   - `node scripts/release-frontend.mjs`
   - `pnpm release:version`
   - `pnpm release:publish`
3. 远程 migration：不适用（本次仅 UI/NPM 包发布，无后端或数据库结构变更）。

## 用户/产品视角的验收步骤

1. 在 npm 检查版本：`@nextclaw/ui@0.5.48` 与 `nextclaw@0.8.62` 已可见。
2. 在任意非仓库目录执行：`npx -y nextclaw@0.8.62 --version`。
3. 验收标准：
   - npm 可检索到目标版本；
   - CLI 可正常启动并返回版本号。

## 文档影响检查

- 功能文档更新：不适用。
- 原因：本次仅执行既有 UI 发布流程，无新增/变更用户功能与使用方式。
