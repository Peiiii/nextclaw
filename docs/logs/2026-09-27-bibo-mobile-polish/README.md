# Bibo 界面细节统一与上线

## 迭代完成说明

界面实现及本地验收完成，发布进行中。用户要求统一优化 BB 网页的字体、间距、布局与交互，最终选用普通文字 14px，并明确授权发布上线。范围见[问题与方案清单](../../designs/2026-09-27-bibo-mobile-polish.design.md)。

普通字号原先分散为 12／13／14／16px，由公共 theme 的 `--text-base` 统一拥有；正文、代码、导航、会话名、表单及输入面板共用，突出标题和空间密集元素保留例外。抽屉模块 40px 行距，独立触控操作 44px；任务首行对齐、窄屏筛选布局、概览状态标签与正文滚动区域均已修正。

会话导航原有三处运行阶段 guard；仅删除禁用会把后台事件写入当前页面。现有 ChatOwner 记录运行会话、历史快照和请求身份，事件及失败恢复按原会话归属，切换不抢路由或覆盖草稿。服务端账号同时一条生成请求的约束保持真实表达。

## 测试/验证/验收方式

本地 Worker／client／runner 与公共 UI tsc、Vite 构建、product／routing／composer／Markdown chat smoke 通过。14px 调整后构建、三份 tsc、product smoke 复跑通过；桌面和手机实际样式读数确认普通字号，窄屏无页面横溢。后台增量、提交、失败和空会话创建竞态由真实 React／SDK SSE 事件回放覆盖。真实手机系统键盘与 ChatGPT 同视口像素差异未实测。

## 发布/部署方式

计划精确提交本批、合并同期主线并验证，从干净冻结的远程 master 执行 Bibo `deploy:client`。本批仅网页、静态帮助页和公共 UI，runner、容器及 Worker 到容器协议不变；保留线上镜像。部署前容器 `a03967fb-95da-496d-8c90-a4b4a010667a`，镜像 `sha256:b32bcfb2cde302b69944695df41ee5395ee3f27a6d1d6acc36cc1515f55b381a`、version 22、active、5 实例；部署后核对身份、静态资产和桌面／手机页面。

## 用户/产品视角的验收步骤

打开 https://app.bibo.bot/，检查会话、任务和输入面板的统一字号；手机打开抽屉和任务筛选核对间距。进入长对话滚动，输入框保持可见；生成时切换其他会话、编辑草稿，再切回原会话查看回复。失败仍可重试。文件 Markdown 与聊天正文使用同一字号。

## 可维护性总结汇总

复用公共组件配方和唯一 ChatOwner，没有第二套状态或传输路径。diff-only maintainability 为 0 错误、3 条既有预算提醒；定向 ESLint 和主观审查无未关闭 finding。目录改动只有既有设计文档、changeset 与本批发布记录，均通过 planned-path preflight。主工作区其他想法 WIP 保留；发布不包含 NextClaw 文档站、NPM、runtime channel 或桌面安装器。

## NPM 包发布记录

不涉及 NPM 包发布。Bibo 与 personal-agent-ui 均为 private workspace package，本批添加两包 patch changeset，版本记录交后续统一批次。
