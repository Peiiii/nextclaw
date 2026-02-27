# 2026-02-27 v0.0.1-marketplace-bird-name-fix

## 迭代完成说明（改了什么）

- 修正 Marketplace `bird-su` 条目的显示名称：
  - 从 `Bird SU` 改为 `bird`（对齐上游 `SKILL.md` 的 `name: bird`）。
- 保持安装 spec 不变（仍指向上游目录路径）：
  - `openclaw/skills/skills/iqbalnaveliano/bird-su`
- 同步更新 `catalog.generatedAt`。

## 测试 / 验证 / 验收方式

- 数据校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api validate:catalog`
- 构建校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api build`
- Lint 校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api lint`
- TypeScript 校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api tsc`
- 冒烟（隔离目录 `/tmp`）：
  - `cd /tmp && PATH=/opt/homebrew/bin:$PATH node -e "..."`
  - 观察点：`id=skill-bird-su-openclaw` 条目存在且 `name=bird`。

## 发布 / 部署方式

1. 合并变更到 `main/master`。
2. 触发 Marketplace Worker 发布流程（按 [marketplace-worker-deploy](docs/workflows/marketplace-worker-deploy.md)）。
3. 发布后访问线上 Skills API 或 UI，确认显示名为 `bird`。

## 用户 / 产品视角的验收步骤

1. 打开 Skills Marketplace 页面。
2. 搜索 `bird`。
3. 确认条目名称显示为 `bird`（不是 `bird-su`）。
4. 点击安装，确认安装成功。
5. 在已安装技能中确认条目可见并可卸载。
