# Bibo 概览品牌形象上线

## 迭代完成说明

用户要求官网形象进入应用概览，并明确授权落地上线。概览复用官网紫色大眼睛角色，加入「日常，多一个我。」与真实摘要；摘要使用 Router Link，原收件箱、任务、对话入口保持。桌面卡片固定两列，消除自动网格多出的一列空白；手机保留紧凑形象。设计见 [方案](../../designs/2026-09-27-bibo-overview-brand.design.md)。

## 测试/验证/验收方式

- Worker、client、runner 三个 TypeScript 检查通过；client 生产构建通过。
- 定向 ESLint、diff maintainability（无 findings）、治理检查与 backlog ratchet 通过。
- 本地产物在 1440、390、320px 检查角色、摘要链接、键盘进入收件箱并后退、无横向溢出；经典／简约主题截图、减少动态效果通过。
- 完整 product smoke 在独立端口执行，桌面／手机主循环完成，后续手机抽屉检查因找不到「打开菜单」超时；该抽屉及聊天路由不在本次改动范围。原始全套不报告通过。另以仓库外脚本跳过该项，保留其它原始检查，最终退出码 0：桌面／手机聊天、保存、滚动、失败恢复、跨页长标题、文件与主题检查通过。期间发现窄桌面双列挤压，已在 1100px 以下使用单列并通过复验。
- 预览端口曾被其它任务占用；已固定本任务独立端口 15297／15298，未停止其它服务。截图位于 `/tmp/bibo-overview-{1440,390,320}.png` 与 `/tmp/bibo-overview-neutral.png`。

## 发布/部署方式

用户已授权上线。发布入口为 `pnpm -C apps/bibo-hosted deploy:client`，从与远程 master 一致的干净冻结提交 `f8ae48414b7860632d1b41f6096614fe989ef7f4` 运行。已部署 Worker 版本 `3686be64-b4a9-4b89-9981-9b491f43aadf`。线上 JS `index-BQ9eQGQS.js`、CSS `index-C-KMrBFj.css` 与本地产物一致。

真实测试账号登录后，在 1440／390／320px 完成概览形象、摘要入口跳转和后退，无浏览器异常或横向溢出。此次真实账号为空空间，验证其开始对话入口；有数据收件箱入口由本地产品 fixture 验证。线上截图位于 `/tmp/bibo-overview-live-{1440,390,320}.png`。发布后 Container version 22 及镜像 digest 与发布前完全相同。

实现已推送 `origin/master`。主工作区存在其它任务的活跃改动，reconcile 返回 `LOCAL_WORKTREE_RETRYING`，自动 retry worker 接管快进，不覆盖 WIP。本任务主区没有遗留草稿。使用既有发布入口，`AUTOMATION_INTERVENTIONS: 0`。

发布前 Worker 版本 `b676d794-1e8e-43ed-baf0-b6ce681d5ade`；Container application `a03967fb-95da-496d-8c90-a4b4a010667a`，version 22，镜像 digest `sha256:b32bcfb2cde302b69944695df41ee5395ee3f27a6d1d6acc36cc1515f55b381a`。无迁移、后端镜像或 NextClaw 文档站部署。

## 用户/产品视角的验收步骤

登录 https://app.bibo.bot/，刷新概览：顶部显示紫色 Bibo 和真实摘要；点摘要到收件箱／任务／对话，后退仍回到概览。手机缩小角色但保留完整内容。AI 负责证明渲染与导航，趣味和审美由用户判断。

## 可维护性总结汇总

角色只属于应用概览的展示，不增加状态、接口、组件包或运行资源；复用既有数据 owner 和 Router。SVG 随应用打包，不依赖官网在线资源。复盘：最初凭旧本地源码判断页面不存在，后通过远程 master 和现网纠正；这是一次漏用已有事实核对方法，不增加常驻规则。

## NPM 包发布记录

不涉及 NPM 包发布。Bibo 为私有托管应用，changeset 记录用户可见变化，中英文用户文档已同步。
