# v0.15.23-release-registry-verification-hardening

## 迭代完成说明

- 本次没有重做 release 系统，而是把“线上 exact version 是否真的存在于 npm 官方源”收敛成发布链路里的正式真相源。
- 新增方案文档：[2026-04-04 Release Registry Verification Hardening Plan](../../../plans/2026-04-04-release-registry-verification-hardening-plan.md)。
- 新增 [`scripts/verify-release-published.mjs`](../../../../scripts/verify-release-published.mjs)：
  - 按当前 release batch 读取 public package 的精确 `pkg@version`
  - 直接对 npm registry 做 exact version 校验
  - 内置轮询窗口，吸收 `changeset publish` 之后的短暂传播延迟
  - 若仍有版本未出现在 registry，则明确失败并列出缺失包
- 强化 [`scripts/release-scope.mjs`](../../../../scripts/release-scope.mjs)：
  - 抽出当前 batch package 解析 helper，避免各 release 脚本重复实现
  - 新增 npm registry 读取与 exact version 查询 helper
  - 为 registry 查询补超时与进程级缓存，避免 `health report` 因重复查询而不必要拖慢
- 强化 [`scripts/report-release-health.mjs`](../../../../scripts/report-release-health.mjs)：
  - 保留“仓库卫生报告”职责
  - 但补充当前 batch 的 registry 状态摘要，明确区分“已经在线上”与“仍缺失线上版本”
  - 避免把“缺 tag / 仍在 batch”误读成“还没发布 npm”
- 更新根脚本：
  - [`package.json`](../../../../package.json) 新增 `release:verify:published`
  - `release:publish` / `release:publish:frontend` 现在都会在 `changeset publish` 后自动执行 registry exact version 核验，再继续 `changeset tag`
- 更新发布流程文档：[NPM Package Release Process](../../../../docs/workflows/npm-release-process.md)，把“发布后线上核验”从人工约定提升为标准脚本步骤。

## 测试/验证/验收方式

- 语法检查：
  - `node --check scripts/release-scope.mjs`
  - `node --check scripts/check-release-batch.mjs`
  - `node --check scripts/report-release-health.mjs`
  - `node --check scripts/verify-release-published.mjs`
- release 机制验证：
  - `pnpm release:check:groups`
  - 结果：通过
  - `pnpm release:verify:published`
  - 结果：通过，输出 `published 35/35 package versions`
  - `node scripts/report-release-health.mjs`
  - 结果：输出 `Repository release health is clean outside the current batch.`，并明确列出当前 batch 已在 `https://registry.npmjs.org/` 上发布的包
- registry 真实下载校验：
  - `npm pack nextclaw@0.16.32`
  - 结果：成功拿到 `nextclaw-0.16.32.tgz`
- 可维护性守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：通过；仅保留 `scripts/` 目录既有预算 warning，无新增 hard error

## 发布/部署方式

- 本次未执行新的 npm 发布、后端部署或数据库 migration。
- 本次交付的是 release 机制本身，后续正式发布流程改为：
  1. `pnpm release:version`
  2. `pnpm release:publish`
  3. 发布脚本内部自动执行：
     - `release:check`
     - `changeset publish`
     - `release:verify:published`
     - `changeset tag`
- 不适用项：
  - 数据库 migration：不适用
  - 服务部署：不适用
  - 线上 API 冒烟：不适用

## 用户/产品视角的验收步骤

1. 执行 `pnpm release:publish` 完成一次标准 npm 发布。
2. 观察发布输出，确认在 `changeset publish` 之后会自动进入 `release:verify:published`。
3. 若 exact version 尚未出现在 npm registry，脚本会继续轮询并明确列出缺失包；若全部到位，则输出 `published X/X package versions`。
4. 执行 `pnpm release:report:health`，确认输出不再只给出“健康/不健康”的模糊结论，而是会直接显示当前 batch 在 registry 上是“already published on registry”还是“still missing on registry”。
5. 如需再做一次真实线上取包确认，可执行 `npm pack <package>@<version>`，确认 tarball 可直接从官方源获取。

## 可维护性总结汇总

- 可维护性复核结论：通过
- 本次顺手减债：是
- no maintainability findings
- 可维护性总结：这次改动属于非新增用户能力的机制修正，但总代码增长控制在最小必要范围内，新增的主要是一个明确职责的 registry 验证脚本和少量共享 helper，没有把“发布真相”继续散落在临时命令或口头解释里。系统现在能清楚区分 `git tag` 状态和 `npm registry` 状态，复杂度没有被挪到运行时或人工操作层；保留的债务仅是 `scripts/` 目录继续增长这一既有结构压力，后续可在 release automation 达到一定规模后再统一收敛子目录。
- 本次是否已尽最大努力优化可维护性：是。没有继续依赖临时 `npm view` 手敲核验，而是把线上校验收敛进正式脚本与正式发布链路。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有新加第二套 release 流程，也没有给单次事故写特判，而是在既有 release batch helper 上补齐缺失的 registry 真相源。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：脚本目录文件数净增 1，属于最小必要增长；与此同时把 release batch 解析和 registry 查询收敛到共享 helper，并通过缓存与超时减少了重复逻辑和隐性卡死风险。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`release-scope` 继续作为 release 共享真相源，`verify-release-published` 只负责发布后线上核验，`report-release-health` 继续负责卫生报告但不再假装代表线上真相，边界更清楚。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。新增计划文档位于 `docs/plans`，新增自动化脚本位于 `scripts/` 的既有仓库级入口目录；`scripts/` 目录平铺压力仍在，但本次已通过单一职责脚本保持增量最小，并在 maintainability guard 中保留了明确的后续收敛缝。
