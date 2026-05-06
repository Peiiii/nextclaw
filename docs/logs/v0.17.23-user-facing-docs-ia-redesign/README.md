# v0.17.23-user-facing-docs-ia-redesign

## 迭代完成说明

- 本次对公开文档站 `apps/docs` 做了一次面向用户的信息架构重整，不再把文档站主路径建立在命令表面之上。
- 新增了中英文的用户主路径页面：
  - `运行与托管 / Runtime & Hosting`
  - `后台运行与自启动 / Background & Autostart`
  - `核心命令 / Core Commands`
- 重写了中英文 `commands.md` 的定位，使其从“看起来像新手主入口的命令页”收口为“完整命令索引 / 查询型参考页”。
- 调整了中英文文档站侧边栏，把主导航改成更接近用户任务流的结构：开始使用、接入与配置、使用与自动化、运行与托管、学习与资源、参考与排错、进阶、项目。
- 同步改写了 `getting-started`、`after-setup`、`advanced`、`remote-access`、`docker-one-click` 的入口链接与叙事，让用户主路径优先指向任务页，而不是直接把人推到命令索引。

根因不是“某一页缺一段自启动文案”，而是过去公开文档站、完整命令参考和 AI 自管理真相源之间边界不够清晰，导致用户发现路径不稳定。  
这次修复针对的是文档结构层根因，而不是继续在旧页面上追加局部补丁。

## 测试/验证/验收方式

- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
- 结果：
  - VitePress 构建完成
  - 新增页面、更新后的导航和内部链接可通过构建
  - 仅出现既有的 chunk size warning，不阻塞发布

本次为 docs-only 改动：

- `tsc`：不适用，未触达 TypeScript 源码、类型边界或运行链路代码
- 运行时冒烟：不适用，本次未改产品运行逻辑

## 发布/部署方式

- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`
- 部署结果：成功
- Cloudflare Pages 预览地址：
  - `https://0ff24fc7.nextclaw-docs.pages.dev`

本次发布只涉及文档站部署，不涉及后端、数据库、NPM 包或桌面发布闭环。

## 用户/产品视角的验收步骤

1. 打开文档站中文侧边栏，确认出现 `运行与托管` 分组，且其中包含：
   - `运行与托管总览`
   - `后台运行与自启动`
   - `远程访问`
2. 打开中文 [核心命令](/zh/guide/core-commands) 页面，确认只保留少量高频命令，而不是完整命令大全。
3. 打开中文 [命令索引](/zh/guide/commands) 页面，确认它明确声明自己是查询型参考，并包含更完整的命令主题分组。
4. 从中文 [上手](/zh/guide/getting-started) 和 [配置后做什么](/zh/guide/after-setup) 出发，确认用户可自然走到：
   - `运行与托管总览`
   - `后台运行与自启动`
   - `远程访问`
5. 打开英文对应页面，确认中英文结构一致：
   - `/en/guide/core-commands`
   - `/en/guide/runtime-hosting`
   - `/en/guide/background-autostart`
   - `/en/guide/commands`

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否遵循“面向用户主路径最小暴露、完整索引旁路承载”的原则：是。
- 是否减少了公开文档站的信息架构混杂：是。过去“命令页既像参考又像上手入口”的角色冲突已被显式拆开。
- 是否需要 `post-edit-maintainability-review`：不适用。本次未触达源码、脚本、测试或运行链路配置，属于 docs-only 重构。
- maintainability guard：不适用。原因同上，本次改动范围为公开文档站内容与导航调整。

## NPM 包发布记录

不涉及 NPM 包发布。
