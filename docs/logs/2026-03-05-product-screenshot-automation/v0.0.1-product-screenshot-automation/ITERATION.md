# v0.0.1-product-screenshot-automation

## 迭代完成说明（改了什么）

本次将“官网/GitHub 产品截图手工维护”改为“可重复执行的一键自动化”。

1. 新增截图自动化脚本 `scripts/refresh-product-screenshots.mjs`。
2. 新增命令 `pnpm screenshots:refresh`，一键生成多页面、中英文截图并同步到双目录：
   - `images/screenshots`
   - `apps/landing/public`
3. 新增 CI 工作流 `.github/workflows/product-screenshots.yml`：支持手动触发与每周自动触发，自动创建截图更新 PR。
4. 更新 `README.md` 与 `README.zh-CN.md`，增加截图自动化命令说明，并将“对话页截图”置于首位展示。
5. 更新 landing 截图展示顺序为“对话页 → 提供商 → 渠道”，不再展示 micro-browser dock 截图。
6. 新增流程文档 `docs/workflows/product-screenshot-automation.md`。

## 测试/验证/验收方式

执行顺序：

1. `pnpm screenshots:refresh`
2. `pnpm build`
3. `pnpm lint`
4. `pnpm tsc`

验收点：

1. 截图命令执行成功，且输出日志包含每个场景的落盘路径。
2. `images/screenshots` 与 `apps/landing/public` 中目标文件被更新。
3. `build/lint/tsc` 全部通过。

## 发布/部署方式

本次为自动化能力与静态资源流程改造，无后端/数据库变更。

1. 合并到主分支后，截图刷新可通过两种方式触发：
   - 手动触发 GitHub Actions `Product Screenshot Refresh`
   - 等待每周定时任务自动触发
2. 由工作流自动创建 PR，评审通过后合并即可完成截图资源发布入库。

## 用户/产品视角的验收步骤

1. 在本地执行 `pnpm screenshots:refresh`，确认无需手工截图。
2. 检查 `README.md`、`README.zh-CN.md`、landing 页面引用的截图是否为同一批次更新。
3. 在 GitHub Actions 手动运行 `Product Screenshot Refresh`，确认能自动生成截图更新 PR。
