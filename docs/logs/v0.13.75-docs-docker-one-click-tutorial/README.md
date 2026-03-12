# v0.13.75-docs-docker-one-click-tutorial

## 迭代完成说明（改了什么）
- 在文档站新增 Docker 一键部署教程（中英文）：
  - [中文教程](../../../apps/docs/zh/guide/tutorials/docker-one-click.md)
  - [English tutorial](../../../apps/docs/en/guide/tutorials/docker-one-click.md)
- 将新教程接入文档导航：
  - 更新 VitePress 侧边栏中英文 `Learn & Resources / 学习与资源` 条目。
  - 更新教程总览页中英文列表，新增 Docker 教程入口。

## 测试/验证/验收方式
- 文档站构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/docs build`
  - 结果：通过（VitePress build complete）。
- 链接覆盖点：
  - 侧边栏可访问 `/zh/guide/tutorials/docker-one-click` 与 `/en/guide/tutorials/docker-one-click`。
  - 教程总览页可访问上述链接。

## 发布/部署方式
- 本次仅完成文档源文件更新与本地构建验证，未执行发布。
- 如需上线文档站，按现有 docs 发布流程部署 `apps/docs`。

## 用户/产品视角的验收步骤
1. 打开中文文档教程总览页，确认出现“Docker 一键部署教程”。
2. 进入教程，确认包含一键命令：`curl -fsSL https://nextclaw.io/install-docker.sh | bash`。
3. 在教程里确认有启动后 URL 输出示例（UI/API/Gateway）。
4. 切到英文文档，确认也有对应 Docker 教程与侧边栏入口。
