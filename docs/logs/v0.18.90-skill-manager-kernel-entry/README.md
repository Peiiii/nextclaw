# v0.18.90 Skill Manager Kernel Entry

## 迭代完成说明

本轮把 skill 读取能力从 `nextclaw-service` 的散点访问收敛到 `@nextclaw/kernel` 的 `SkillManager`：

- `SkillManager` 作为 skill 能力统一入口，构造时接收 workspace，并在构造阶段持有 `SkillsLoader`。
- service 侧不再直接访问 `SkillsLoader` 或内部路径配置，改为通过 `SkillManager` 查询、加载和解析内置 skill。
- 删除 service runtime 下的 `skills-loader.utils.ts` 中转。
- marketplace skills 模块从假 `marketplace.service.ts` 改为真实角色 `marketplace.utils.ts`，避免为了满足 `.service.ts` 治理规则新增空心 service class。
- 将“禁止 fake owner / fake class 只为通过治理”的教训沉淀到 `role-first-file-organization`、`file-naming-convention`、`nextclaw-clean-implementation`。

根因：之前把“`.service.ts` 需要 class”误读成形式约束，新增了没有真实状态、生命周期或流程所有权的 `BuiltinSkillResolverService`。用户指出这是严重教训后，确认根因不是缺少 class，而是文件角色命名和 owner 判断错误。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service test -- --run src/cli/commands/skills/skills-query.service.test.ts src/cli/commands/skills/marketplace.install.test.ts src/cli/commands/skills/marketplace.publish.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/app/nextclaw-kernel.ts src/managers/skill.manager.ts`
- `pnpm -C packages/nextclaw-service exec eslint src/shared/services/runtime/runtime-command.service.ts src/cli/commands/skills/skills-query.service.ts src/cli/commands/skills/marketplace.utils.ts src/cli/commands/skills/index.ts src/cli/commands/skills/marketplace-command-options.utils.ts src/cli/commands/skills/marketplace.install.test.ts src/cli/commands/skills/marketplace.publish.test.ts`
- `pnpm -C packages/nextclaw-service exec eslint src/cli/commands/skills/marketplace.utils.ts src/cli/commands/skills/marketplace-client.ts src/cli/commands/skills/skills-query.service.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-service lint`：通过，有 24 个既有 warning。
- `node scripts/governance/lint-new-code-governance.mjs -- <本轮触达路径>`：通过。
- `pnpm lint:new-code:governance`：失败在并行改动的 `packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/progressive-plugin-loader-context.ts` 与 `scripts/dev/dev-plugin-overrides-support.test.mjs`，本轮触达路径的定向治理通过。
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

未执行发布或部署。本轮是内核入口和 service 调用侧重构，仍需随项目后续统一发布闭环进入 NPM/桌面交付。

## 用户/产品视角的验收步骤

- 在 CLI 查询 skill 列表、查看 skill metadata、读取 skill 内容时，行为应与重构前一致。
- 安装 marketplace 内置 skill 时，应能通过 kernel `SkillManager` 找到本地内置 skill 目录。
- 外部调用方不需要感知 skill 根目录、workspace 路径解析或 `SkillsLoader` 的内部配置细节。

## 可维护性总结汇总

- 使用了 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`。
- 代码增减：总计 `+127 / -143 / net -16`；非测试代码 `+125 / -141 / net -16`。
- 正向减债动作：删除、复用、职责收敛。
- 维护性收益：删除 service 内部 loader wrapper，把 skill 路径配置和 loader 生命周期收敛到 kernel `SkillManager`；同时移除 fake service class，文件角色回到真实 `utils`，并把 `marketplace.utils.ts` 从 437 行降到 380 行。
- 保留债务：`packages/nextclaw-service/src/cli/commands/skills` 仍处于目录文件数预算边界；`marketplace.utils.ts` 已低于 400 行预算但仍接近预算线，本轮只做同问题域最小不冲突修复。

## 红区触达与减债记录

### packages/nextclaw-service/src/cli/commands/skills/marketplace.utils.ts

- 本次是否减债：是。
- 说明：删除无真实 owner 的 `BuiltinSkillResolverService`，把文件角色从 fake service 修正为 utils；同时把文件写入/内容编码逻辑收敛到既有 marketplace client 模块，文件行数从 437 行降到 380 行，低于 400 行预算。
- 下一步拆分缝：后续可按 install / publish / file collection / built-in resolution 拆分 skills marketplace 命令工具模块。

### packages/nextclaw-service/src/cli/commands/skills

- 本次是否减债：有限减债。
- 说明：目录文件数没有继续增加，`marketplace.service.ts` 改为 `marketplace.utils.ts` 属于角色修正，不新增直接文件数量。
- 下一步拆分缝：后续应把 marketplace install / publish / query 等职责拆入子目录，降低 command root 平铺压力。

## NPM 包发布记录

不涉及 NPM 包发布。
