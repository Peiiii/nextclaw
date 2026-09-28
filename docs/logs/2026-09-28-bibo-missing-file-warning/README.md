# Bibo 文件误报修复与部署

- 状态：completed。用户反馈个人空间中的现有文件持续显示“对象不存在或已删除”；提交 `28bdd7dc2961ba0dd5428b251fb3c03620331e89` 已部署至 [Bibo](https://app.bibo.bot/files)。
- 根因边界：文件打开的 404 写入全页面共用错误；恢复的失效文件标签即使与当前真实文件无关，也会污染其页面提示。刷新会从浏览器布局恢复旧文件 ID，因此误报可再次出现。未读取用户私有文件，无法断言哪个 ID 在其账号失效。
- 修复：失效且无草稿的恢复标签自动移除；文件打开失败只归属该文件，打开正常文件时清除这条提示。保留真实文件和未保存草稿。
- 验证：Bibo Worker、网页、runner 的 TypeScript 检查通过；Vite 构建、定向 store 回归、桌面/手机本地浏览器冒烟与线上 1280/390px 复验通过。全量 `pnpm -C apps/bibo-hosted test` 为 34/37 通过，失败来自隔离工作区未构建的 `@nextclaw/ncp-agent-runtime` 产物与现有 Node 测试入口不支持 CSS 导入；本次回归用例经 CSS 空加载的测试打包运行通过。
- 发布：从已推送的远程 `master` 冻结提交执行 `deploy:client`，Worker version `22c7a887-1200-46d2-af14-a19fe774a699`；线上入口提供的主 JS 为 `index-DCjeRopg.js`，与本次构建一致。发布前后容器应用版本均为 22，镜像均为 `sha256:b32bcfb2cde302b69944695df41ee5395ee3f27a6d1d6acc36cc1515f55b381a`。线上资源、文件恢复回归及 inbox 布局冒烟通过。
- 范围：仅 Bibo 网页和宿主 Worker 静态资源；未改用户文件、索引或容器。回退可将 Worker 切回上一版本，不需回滚容器。`AUTOMATION_INTERVENTIONS: 0`。
