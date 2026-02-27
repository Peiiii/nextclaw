# 2026-02-27 v0.0.1-marketplace-bird-slug-fix

## 迭代完成说明（改了什么）

- 修正 Marketplace `bird` 技能条目的 slug：
  - `slug` 从 `bird-su` 改为 `bird`。
- 同步修正条目标识与安装命令参数：
  - `id` 从 `skill-bird-su-openclaw` 改为 `skill-bird-openclaw`。
  - `install.command` 中 `--skill` 从 `bird-su` 改为 `bird`。
- 保持 git 源路径不变（仍指向上游目录）：
  - `install.spec = openclaw/skills/skills/iqbalnaveliano/bird-su`
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
- 冒烟 1（真实安装命令，隔离目录 `/tmp`）：
  - `cd /tmp && PATH=/opt/homebrew/bin:$PATH npx --yes skild install openclaw/skills/skills/iqbalnaveliano/bird-su --target agents --local --json --skill bird`
  - 观察点：安装返回成功，`skill.frontmatter.name = bird`。
- 冒烟 2（catalog 断言，隔离目录 `/tmp`）：
  - `cd /tmp && PATH=/opt/homebrew/bin:$PATH node -e "..."`
  - 观察点：`slug=bird`、`name=bird`、`id=skill-bird-openclaw`。

## 发布 / 部署方式

1. 合并变更到 `main/master`。
2. 触发 Marketplace Worker 发布流程（按 [marketplace-worker-deploy](docs/workflows/marketplace-worker-deploy.md)）。
3. 发布后验证线上 Skills API/UI 返回 `slug=bird`。

## 用户 / 产品视角的验收步骤

1. 打开 Skills Marketplace 页面。
2. 搜索 `bird`。
3. 确认条目显示名是 `bird`，且详情中的 slug 语义对应 `bird`。
4. 点击安装，确认安装成功。
5. 在已安装技能中确认该条目可见且可卸载。
