# v0.13.80 Landing Install Tabs Before Terminal

## 迭代完成说明（改了什么）
- 调整落地页首页结构顺序：将“桌面端下载 / npm 安装 / Docker 安装”切换按钮组移动到终端卡片之前。
- 保持“查看文档 / 查看 GitHub”按钮在终端卡片后方，不与安装切换按钮一起上移。
- 仅修改 `apps/landing/src/main.ts` 的首页模板结构与对应动画延时，不改动下载页逻辑。

## 测试/验证/验收方式
- 执行构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/landing build`
- 结果：构建通过，无 TypeScript / Vite 构建错误。

## 发布/部署方式
- 代码提交后推送到远端分支。
- 执行前端发布命令：
  - `PATH=/opt/homebrew/bin:$PATH pnpm deploy:landing`
- 发布后在线核验 `/en/` 与 `/zh/` 首页首屏顺序。

## 用户/产品视角的验收步骤
- 打开官网首页（中文或英文）。
- 首屏中应先看到安装切换按钮组（桌面端下载 / npm 安装 / Docker 安装）。
- 终端命令卡片应位于其下方。
- “查看文档 / 查看 GitHub”按钮应位于终端卡片下方。
