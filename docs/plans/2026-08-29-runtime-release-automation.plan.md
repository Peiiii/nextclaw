# Runtime 发布全自动化执行计划

日期：2026-08-29

上位设计：[Runtime 发布全自动化设计](../designs/2026-08-29-runtime-release-automation.design.md)

## 目标、范围与非目标

目标是让 stable product release 一次 dispatch 后无人值守闭环，并把正式 Runtime promotion 目标压到两分钟。范围包含 prepared Runtime、promotion orchestration、真实旧版升级验证、workflow/skill 合同和发布留痕；不包含 Desktop 发布优化或 Runtime 协议变化。

`plan: required`：任务跨 prepare、Runtime workflow、published validation、规则资产和真实发布恢复，单批无文档无法可信交接。

## 执行部分

### 1. 修复 published upgrade 夹具

- owner：`packages/nextclaw/scripts/verify-published-npm-runtime-update.mjs`
- 输入：已发布 current/previous version、官方 GitHub Release asset、隔离 home。
- 结果：fresh cache、有界 Registry 重试、官方上一 Runtime seed、真实 check/download/apply/new-process 验证。
- 验证：新增 Node test；运行脚本定向测试。
- 设计策略：复用上位设计，无新分叉。

### 2. 把冷构建前移到 exact-source prepare

- owner：`npm-release-prepare.yml` 与 prepared artifact contract。
- 输入：同一 source SHA 的 versioned NPM release tree。
- 结果：四平台已签名、已冒烟的 immutable Runtime artifacts。
- 验证：workflow 静态合同测试、artifact identity 检查、原有 release orchestration tests。
- 设计策略：复用上位设计；若 prepared tree 无法在跨平台安全导入，返回 Design，不创建平行 version owner。

### 3. 正式发布改为 promotion-only

- owner：`release-beta-runtime.mjs`、`npm-runtime-update-release.yml`、`release.yml`。
- 输入：prepared source SHA、prepared run id、target version、release tag。
- 结果：stable 正式路径跳过冷构建，发布 assets/manifests，完成公网验证和真实升级验证。
- 验证：Node orchestration tests、workflow contract、dry-run。
- 设计策略：复用上位设计；beta/显式 recovery 保留现有冷构建。

### 4. 固化 skill 与治理合同

- owner：`nextclaw-npm-release`。
- 输入：本次真实失败基线与自动化实现。
- 结果：skill 只声明一次 dispatch、Actions owner、单次有界 wait、禁止临时自定义验证和最终状态门；确定性细节链接 owning references/scripts。
- 验证：skill progressive-loading、治理 ratchet、release action environment contract。
- 设计策略：轻量内联，不新增 skill。

### 5. Validation、Review 与 Delivery

- 运行定向 Node tests、workflow YAML 解析、matching `tsc`、skill/governance 检查。
- 执行 diff-only maintainability review，关闭 findings。
- 更新同一发布事故迭代记录，提交、推送到远程 master，并运行 mainline reconcile。

## 恢复入口

中断后从 `git status`、本 plan 的首个未完成部分和相应定向测试继续。若 prepare/promotion 合同已提交但真实 release 尚未运行，不重复实现；使用下一次 stable release 的结构化 timing 作为两分钟预算验收。已发布 `0.45.3` 不因验证脚本修复而重复发布。
