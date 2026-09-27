# NextClaw Desktop 稳定版发布

## 迭代完成说明

状态：进行中。用户授权发布桌面端稳定版；不重发 NPM。

控制面冻结于远程 master `3dfc2764d9be5ed378fd0b4aa834cbeb6fe06d91`；产品产物冻结于已发布 `nextclaw@0.57.3` 提交 `bdeef19c5a88917f89bb8ef6fde749fd8fdcadc5`，Desktop `0.0.299`。后续共享源码变化不混入安装包。

预检确认 NPM latest 为 0.57.3，但该版本缺少桌面发布要求的双语文档与结构化 JSON。本批补齐同版本说明，通过显式 notes-file / release-notes-url 传入独立桌面发布入口，保持产品提交不可变。

## 测试/验证/验收方式

planned-path preflight、docs:i18n:check（167 对页面）、docs build、lint:new-code:governance、governance backlog ratchet 和双语 GitHub 正文校验已通过。桌面打包验证、五平台安装/启动冒烟、精确资产集合与公开更新渠道由既有发布 owner 执行，结果待补。

## 发布/部署方式

使用 `pnpm release:desktop:stable`，channel=stable，target 为上述已发布提交。文档通过现有 Docs Deploy workflow 发布；隐藏 Draft 仅在完整 assets 验证后公开。发布后运行 `pnpm release:reconcile:mainline`，保护主工作区既有 WIP。

## 用户/产品视角的验收步骤

发布闭合后，从 GitHub Release 下载对应平台安装包；启动后核对 Runtime 0.57.3，发送消息时确认输入区不再被接收确认卡片撑高。安装、启动与更新协议由自动冒烟证明；本批不新增产品实现。

## 可维护性总结汇总

复用既有发布、版本说明与主线协调 owner，只补文档和发布记录，不改变源码、目录边界或发布机制。文档沿用日期命名和 JSON schema；无新增产品行为，不添加 changeset。源码 maintainability 检查不适用；治理检查与 docs 验证均通过。

## NPM 包发布记录

不涉及 NPM 包发布。消费已发布 `nextclaw@0.57.3` stable identity。
