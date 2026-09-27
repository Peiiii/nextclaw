# Bibo Exa 网络搜索

## 迭代完成说明

用户要求按照Exa官方build-with-exa Skill给Bibo接入网页搜索并直接上线；实验期不以紧额度阻碍体验。[设计与验收合同](../../designs/2026-09-27-bibo-exa-search.design.md)维护EXA-01～05，线上验收待部署闭合。

复用kernel web_search，Exa使用auto与highlights；Bibo Worker验证账号token并原子预留搜索预算，平台key只在Worker Secret。每账号每天100次、全站每天1000次/每月10000次；模型对应每人每天250次/全站2000次。来源链接随回答走原会话、结构化空间与R2保存链路。

## 测试/验证/验收方式

Worker、网页、runner、core类型检查，定向ESLint，Bibo44项测试与core2项测试通过。覆盖鉴权、固定上游选项、失败脱敏、120并发仅100成功、全站日/月预算及UTC重置、模型与搜索独立计数，内置身份更新及自定义身份保留。真实SQLite快照/空间恢复/会话删除和桌面手机客户端smoke通过。

独立开发运行完成Harness→搜索代理→真实Exa→真实DeepSeek回答，两次请求均返回200与8条带highlights的结果，回答引用Cloudflare官方来源。线上旧模型额度429已复现，因此不能把旧线上模型结果当作新版本通过。发布后smoke会独立验证模型流、搜索鉴权、Agent搜索/文件创建、已保存来源、刷新和桌面手机。

## 发布/部署方式

发布范围为Bibo Worker、Container、静态帮助与中英文用户文档；不涉及NPM、NextClaw runtime、desktop更新，不增加Cloudflare付费资源或DO迁移。使用干净冻结远程master的`pnpm -C apps/bibo-hosted deploy`，生产身份与验证结果部署后补充。

## 可维护性与经验

diff-only guard零error，三项现有目录/临界文件warning；新增搜索归feature，预算复用既有DO且使用独立状态key。审查无开放finding。主工作区用户thought草稿哈希与任务前一致，本任务全部处于隔离worktree。

用户明确纠偏初期额度应服务试验体验，已落实到搜索和依赖的模型额度、边界测试和用户帮助；事实与决策留在本设计及服务README，不上升为全仓库流程。发布前发现本地主线落后，已保留草稿并迁移远程新个人空间能力；不为一次恢复新增规则。

## 用户/产品视角验收

打开https://app.bibo.bot并登录，直接输入“搜索Cloudflare AI Search的最新官方说明，并附来源链接”。预期得到检索后的回答与可点击官方来源，刷新后回复仍在；任务、日程和文件功能继续可用。

AUTOMATION_INTERVENTIONS: 0（部署前准备）。
