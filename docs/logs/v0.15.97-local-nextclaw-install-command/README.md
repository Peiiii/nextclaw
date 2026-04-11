# v0.15.97-local-nextclaw-install-command

## 迭代完成说明

- 为根目录新增可直接执行的本地安装命令：`pnpm local-install:nextclaw`
- 补齐脚本 [`scripts/local-install-nextclaw.mjs`](../../../scripts/local-install-nextclaw.mjs)，让该命令真正完成以下动作：
  - 构建 `nextclaw` 及其 workspace 依赖
  - 使用 `pnpm link --global` 把本地仓库里的 `packages/nextclaw` 链接到全局环境
  - 自动补齐 `PNPM_HOME` 到可用的全局 bin 目录，绕开本机未执行 `pnpm setup` 时的失败
  - 安装后立即执行 `nextclaw --version` 验证全局命令可用
- 这次没有继续走 tarball 全局安装方案，因为它会把内部依赖重新解到已发布版本，不能保证体验到当前仓库里的本地改动

## 测试/验证/验收方式

- 命令：`pnpm local-install:nextclaw`
- 结果：通过
- 关键观察点：
  - `pnpm -r --filter nextclaw... build` 完成
  - `pnpm -C packages/nextclaw link --global` 完成
  - `nextclaw --version` 输出 `0.17.6`
- 维护性守卫：`pnpm lint:maintainability:guard`
- 结果：通过；仅保留仓库既有目录预算 warning，无本次新增阻断

## 发布/部署方式

- 不适用
- 本次改动只增加本地开发安装命令，不涉及 npm 发布、桌面发布、线上部署或环境迁移

## 用户/产品视角的验收步骤

1. 在仓库根目录执行：`pnpm local-install:nextclaw`
2. 等待构建和全局链接完成
3. 直接执行：`nextclaw --version`
4. 若需要进一步体验，再直接执行你要的真实命令，例如 `nextclaw --help`、`nextclaw start` 或其它本地验证命令

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次是沿着“统一入口更易被本地验证”的方向推进了一小步，把原本分散的手工构建、全局链接、可执行校验收敛成一个根命令，降低了使用 NextClaw 作为默认入口时的本地验证摩擦。
- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：77 行
  - 删除：0 行
  - 净增：+77 行
- 非测试代码增减报告：
  - 新增：77 行
  - 删除：0 行
  - 净增：+77 行
- no maintainability findings
- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是；没有新增第二条安装路径，而是保留单一入口，只补一个小脚本把现有构建与链接动作收口
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：总代码与脚本文件数有最小必要增长；这是为了把原本依赖人工组合的多步命令收敛为一个稳定入口。同步偿还的维护性债务是“本地安装流程靠人工记忆”的隐性复杂度
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是；新增逻辑只放在单一脚本中，没有把本地安装细节散落进多个 package，也没有新增额外抽象层
- 目录结构与文件组织是否满足当前项目治理要求：基本满足；`scripts/` 目录仍存在仓库级扁平化历史债务，但本次只新增一个根自动化入口脚本，未继续扩散职责边界
- 是否基于独立于实现阶段的 `post-edit-maintainability-review` 填写：是；结论为“通过，无新增维护性问题”，但需继续关注 `scripts/` 目录长期平铺告警
- 可维护性总结：
  - 这次没有把复杂度搬到别处，而是把“本地安装 nextclaw”这件事收敛成一个能直接记住的根命令。
  - 代码净增只有一个小脚本，增长已是当前可行路径里的最小必要量。
  - 后续若 `scripts/` 目录继续增长，应再统一整理根级自动化脚本分组。
