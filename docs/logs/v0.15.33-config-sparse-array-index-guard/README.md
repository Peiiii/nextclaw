# v0.15.33 config set 稀疏数组索引保护

## 迭代完成说明

- 修复 [`config-path.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/src/cli/config-path.ts) 中 `setAtConfigPath()` 允许写入稀疏数组的问题。
- 新行为改为显式拒绝跳号索引写入：
  - 允许写已有索引
  - 允许写 `current.length`，也就是顺序追加
  - 禁止直接写超出 `current.length` 的下标，避免生成带空洞的数组并在 JSON 持久化后变成 `null`
- 错误文案会直接指出这是稀疏数组写入，并要求按顺序设置索引，避免用户继续把配置文件写坏。
- 补齐测试覆盖：
  - 新增 [`config-path.test.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/src/cli/commands/config/config-path.test.ts)，锁定“连续索引成功、跳号索引失败”
  - 扩展 [`config.test.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/src/cli/commands/config/config.test.ts)，确认命令层报错时不会保存非法配置
- 顺手把 `setAtConfigPath()` 拆成更小的 helper，避免为了加保护逻辑继续放大单函数复杂度。

## 测试/验证/验收方式

- 受影响单测：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/config/config-path.test.ts src/cli/commands/config/config.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw tsc`
- 可维护性守卫：
  - `pnpm lint:maintainability:guard`
- 行为冒烟：
  - `pnpm -C packages/nextclaw exec tsx --tsconfig tsconfig.json <<'TS' ... TS`
  - 连续写入 `agents.list[0]` / `agents.list[1]` 时输出 `[{"id":"main"},{"id":"engineer"}]`
  - 跳号写入 `agents.list[3]` 时输出 `Error: Cannot set sparse array index 3 under "agents.list". Set indices in order.`，且对象只留下空数组壳 `{"agents":{"list":[]}}`
- 结果说明：
  - 单测通过
  - `tsc` 通过
  - maintainability guard 主体通过，但收尾卡在与本次改动无关的现有治理项：`packages/nextclaw/src/cli/runtime.ts:196:40` 的 context destructuring diff 检查
  - `pnpm -C packages/nextclaw lint` 未通过，失败点同样来自本次未触达的现有仓库问题，包括 [`nextclaw-agent-session-store.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/src/cli/commands/ncp/nextclaw-agent-session-store.ts) 与 [`runtime.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/src/cli/runtime.ts)
  - 直接通过 `dev:build` 走 CLI 入口的冒烟仍被现有 self-cli 解析链路阻塞，报 `ERR_PACKAGE_PATH_NOT_EXPORTED`；因此本次实际采用模块级行为冒烟来验证修复本身

## 发布/部署方式

- 本次未执行发布或部署。
- 后续随 `nextclaw` 包正常发布即可，无需数据库 migration、远程部署或额外环境变量调整。

## 用户/产品视角的验收步骤

1. 顺序执行：
   `nextclaw config set 'agents.list[0].id' '"main"' --json`
2. 再执行：
   `nextclaw config set 'agents.list[1].id' '"engineer"' --json`
3. 执行：
   `nextclaw config get 'agents.list' --json`
4. 确认输出中同时存在第 `0` 项与第 `1` 项，不再出现“只有最后一个生效”的误判。
5. 再执行：
   `nextclaw config set 'agents.list[3].id' '"researcher"' --json`
6. 确认命令立即失败，并提示必须按顺序设置索引，而不是把坏数据写进配置文件。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。修复点被收敛在路径写入层，没有去给 loader、schema 或命令层叠额外兜底。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。方案不是新增兼容分支去容忍坏配置，而是直接禁止生成坏配置；同时把新增逻辑拆进 helper，避免 `setAtConfigPath()` 继续膨胀。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。为防止稀疏数组写入新增了最小必要 helper 与测试，但测试放回既有 `config` 子目录，避免继续增加 [`src/cli`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/src/cli) 顶层平铺；核心收益是删除了“写入后再靠 schema 回滚”的隐性复杂度。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。约束只落在 `config-path` 这一真实负责路径赋值的地方，命令层只负责把错误显式暴露给用户，没有再造第二套校验。
- 目录结构与文件组织是否满足当前项目治理要求：部分未满足但本次没有继续恶化。`src/cli` 顶层仍超过目录预算，这属于既有债务；本次新增测试已放回 `commands/config` 子目录，未再把顶层摊平。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - no maintainability findings
  - 可维护性总结：这次改动把一个“写入时静默放行、加载时再炸”的不透明失败模式收敛成了立即、可预测的错误，并且没有把复杂度分散到更多层。保留债务主要是 CLI 顶层目录与其他既有文件预算问题，但这次修复没有继续恶化它们。
