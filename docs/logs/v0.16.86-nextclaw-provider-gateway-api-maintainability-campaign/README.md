# 迭代完成说明

本迭代完成了 `workers/nextclaw-provider-gateway-api` 一轮以“目录结构、命名治理、确定性 lint 债务、维护性预算” 为主的非功能治理，没有新增用户能力。

本次命中的根因不是单点坏实现，而是几类历史债务叠加：

- 模块结构 contract 一开始没有按仓库既有规范声明，甚至一度出现了自造的 `organizationModel` 值；这会让目录治理失去统一约束。
- `src/` 根目录长期平铺，基线扫描时有 `25` 个直接源码文件，远超目录预算 `12`。
- controller / service / repository / utils / root entry 文件名长期不符合仓库后缀规则，导致一旦触碰相关文件，治理器会成片阻断。
- `pnpm -C workers/nextclaw-provider-gateway-api lint` 在起始状态下有 `33` 条 `nextclaw/prefer-top-level-context-destructuring` warning。
- 在重命名回正过程中，`src/services/` 一度从 `9` 个直接源码文件增长到 `13` 个，越过硬预算，需要真实拆子树而不是继续靠 README 例外止血。
- 当把该 worker 继续往严格 `package-l1` 推进时，又确认了另一个更深层根因：源码层虽然可以使用 `@/` alias 满足协议导入规则，但原始 `tsc` 产物不会自动把 alias 落成相对路径，导致 `dist` 下的 Node 定向测试链路无法直接运行。

这些根因通过以下证据被确认：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths $(find workers/nextclaw-provider-gateway-api/src -type f -name '*.ts' | sort)` 暴露了 `src/` 根目录预算告警和多个热点文件预算告警。
- `pnpm -C workers/nextclaw-provider-gateway-api lint` 直接暴露 `33` 条 context destructuring warning。
- `pnpm lint:new-code:governance -- ...` 在触达旧文件后连续暴露 file-role-boundaries、services 根层预算等历史命名/结构债务。

本次改动聚焦命中这些根因，而不是只处理表象：

- 包根配置 [`workers/nextclaw-provider-gateway-api/module-structure.config.json`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/module-structure.config.json) 已从伪协议/legacy 壳完全收口为真实 `contractKind: "protocol"` + `protocol: "package-l1"`。
- 把原先平铺在 `src/` 根层的领域目录彻底拆回合法职责目录，当前顶层只保留：
  - [`app`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/app)
  - [`configs`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/configs)
  - [`controllers`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/controllers)
  - [`repositories`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/repositories)
  - [`routes`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/routes)
  - [`services`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/services)
  - [`types`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/types)
  - [`utils`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/utils)
  - 以及必要入口文件 [`index.ts`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/index.ts) / [`main.ts`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/main.ts)
- 把整个 worker 内被触发的历史命名债务一并收正，避免“改一点炸一片”持续发生：
  - `controllers/*-controller.ts` 统一收敛为 `controllers/*.controller.ts`
  - `repositories/*-repository.ts` 统一收敛为 `repositories/*.repository.ts`
  - `platform-utils.ts`、`platform-service.ts`、`platform-auth-service.ts`、`remote-access-service.ts` 等文件统一收敛为合规后缀
  - `routes.ts` 最终收敛为 [`workers/nextclaw-provider-gateway-api/src/routes/app.routes.ts`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/routes/app.routes.ts)
  - `platform-auth-session-repository.ts` 最终收敛为 [`workers/nextclaw-provider-gateway-api/src/repositories/platform-auth-session.repository.ts`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/repositories/platform-auth-session.repository.ts)
- 清理全部 `params` 顶层解构 warning，使 worker lint 恢复为可通过状态。
- 为了把 `src/services/` 根层文件数重新压回预算内，新增 [`workers/nextclaw-provider-gateway-api/src/services/platform`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/services/platform) 子树，将平台认证/邮箱验证码相关 service 下沉进去；最终 `src/services/` 直接文件数回到 `12`，未再触发预算守卫。
- 严格协议续改中，继续把 `auth-browser`、`remote-quota`、`remote-relay` 三组文件按角色拆回 `configs / controllers / services / types / utils`，并删除了只用于临时豁免的 `services/README.md`。
- 同步更新定向测试与脚本引用：
  - `tests/run-remote-quota-policy-test.mjs` 重命名为 [`workers/nextclaw-provider-gateway-api/tests/remote-quota-policy-runner.test.mjs`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/tests/remote-quota-policy-runner.test.mjs)
  - `package.json` 的 `test:quota` 指向新的 runner
- 为了让严格 `package-l1` 的 `@/` alias 在运行链路里也成立，补齐了 build contract：
  - [`workers/nextclaw-provider-gateway-api/tsconfig.json`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/tsconfig.json) 现在显式声明 `@/* -> src/*`
  - [`workers/nextclaw-provider-gateway-api/scripts/rewrite-dist-aliases.mjs`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/scripts/rewrite-dist-aliases.mjs) 会在 `tsc` 后把 `dist` 内的 alias 重写成真实相对路径
  - [`workers/nextclaw-provider-gateway-api/src/app/gateway-api.app.ts`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/app/gateway-api.app.ts) 承接 worker 装配入口，使根层入口文件只保留薄壳边界
- 针对后续续改里暴露出的治理器漏检问题，继续补齐 `module-structure` 检测链路：
  - [`scripts/governance/module-structure/module-structure-contracts.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-contracts.mjs) 现在会拒绝 `legacy` contract 复用任何 `protocol-*` 组织模型名，也会拒绝 `contractKind: "legacy"` 同时声明 `protocol`
  - [`scripts/governance/module-structure/lint-new-code-module-structure.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/lint-new-code-module-structure.mjs) 不再因坏配置直接抛异常中断，而是产出结构化的 `invalid-module-structure-config` 阻断结果
  - [`scripts/governance/module-structure/module-structure-protocol-checks.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-protocol-checks.mjs) 顺手收拢了重复的协议边界校验分支，避免为了补规则继续膨胀治理脚本
  - `workers/nextclaw-provider-gateway-api` 现已真正满足 `package-l1`，不再存在 legacy 壳

最终结果：

- `src/` 根层直接源码文件数从 `25` 降到 `2`
- `src/services/` 根层直接文件数为 `11`
- worker lint / tsc / quota 定向测试 / new-code governance / maintainability guard 全部恢复通过
- `module-structure` 合同解析已新增一致性校验：`legacy` contract 不得再复用任何 `protocol-*` 组织模型名
- 当前 worker 已是严格 `package-l1` 协议模块，而不是任何形式的 legacy 例外

当前进展与过程记录见：

- [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/work/working-notes.md)
- [work/state.json](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/work/state.json)

# 测试 / 验证 / 验收方式

本次已通过以下验证：

- `pnpm -C workers/nextclaw-provider-gateway-api lint`
- `pnpm -C workers/nextclaw-provider-gateway-api tsc`
- `pnpm -C workers/nextclaw-provider-gateway-api test:quota`
- `pnpm lint:new-code:governance -- $(git diff --name-only --diff-filter=AMDR -- workers/nextclaw-provider-gateway-api | sort | tr '\n' ' ')`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths $(git diff --name-only --diff-filter=AMDR -- workers/nextclaw-provider-gateway-api | sort)`
- `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- `pnpm lint:new-code:governance -- scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/module-structure-protocol-checks.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs docs/designs/2026-04-19-module-structure-contracts.md workers/nextclaw-provider-gateway-api/module-structure.config.json docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/README.md docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/work/working-notes.md docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/work/state.json`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/module-structure-protocol-checks.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs docs/designs/2026-04-19-module-structure-contracts.md workers/nextclaw-provider-gateway-api/module-structure.config.json docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/README.md docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/work/working-notes.md docs/logs/v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign/work/state.json`
- `pnpm check:governance-backlog-ratchet`

验证结论：

- lint：通过
- tsc：通过
- quota 定向测试：`10/10` 通过
- new-code governance：通过
- maintainability guard：`0 error / 0 warning`
- module-structure 定向测试：`31/31` 通过
- governance backlog ratchet：通过
- 针对本次治理脚本续改的 maintainability guard：`0 error / 1 warning`，其中非测试代码净变化为 `-15` 行，仅保留 `module-structure-protocol-checks.mjs` 接近文件预算的提醒
- 针对本次严格 `package-l1` 续改的 maintainability guard：`0 error / 8 warning`，其中非测试代码净变化为 `-4187` 行；保留提醒仅来自历史热点大文件预算，不是本轮新增膨胀

# 发布 / 部署方式

本迭代只涉及 worker 内部结构、命名、lint 与测试路径治理，不涉及额外发布流程或 NPM 产物。

若后续需要部署该 worker，仍按现有常规流程执行即可：

- `pnpm -C workers/nextclaw-provider-gateway-api build`
- `pnpm -C workers/nextclaw-provider-gateway-api deploy`

# 用户 / 产品视角的验收步骤

1. 打开 [workers/nextclaw-provider-gateway-api/src](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src)，确认根层只剩 `app / configs / controllers / repositories / routes / services / types / utils` 与入口文件 `index.ts / main.ts`。
2. 打开 [workers/nextclaw-provider-gateway-api/src/controllers](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/controllers)、[repositories](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/repositories)、[services](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/services)、[utils](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/utils)，确认领域文件都已下沉到职责目录，而不是继续占据 `src/` 顶层。
3. 检查 [workers/nextclaw-provider-gateway-api/module-structure.config.json](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/module-structure.config.json)，确认当前是 `contractKind: "protocol"` + `protocol: "package-l1"`。
4. 运行 `pnpm -C workers/nextclaw-provider-gateway-api test:quota`，确认 quota 定向行为保持通过。
5. 运行 `pnpm -C workers/nextclaw-provider-gateway-api lint` 和 `pnpm -C workers/nextclaw-provider-gateway-api tsc`，确认治理后没有引入新的类型或 lint 回归。
6. 运行 `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`，确认 `legacy` 伪装协议的回归测试被拦住。

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。在不引入新用户能力的约束下，已把当前最确定、最反复触发的结构/命名/lint 债务一并收口，并把服务根层预算重新压回阈值内。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有增加新的抽象层或 fallback 逻辑，主要通过移动、重命名、子树收拢和局部结构修正来还债；在治理脚本续改里，也额外收拢了 `module-structure` 协议边界校验的重复分支，使该续改的非测试代码净变化为 `-15` 行。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。目录平铺度显著下降，`src/` 根层直接源码文件数从 `25` 降到 `2`；`src/services/` 直接文件数收回到 `11` 个，且根层领域目录已完全消失。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`auth-browser`、`remote-quota`、`remote-relay` 已不再占据 `src/` 顶层，而是按 `configs / controllers / services / types / utils` 角色重新落位；worker 入口装配也收进了 `app/` 与 `routes/`。

目录结构与文件组织是否满足当前项目治理要求：本轮范围内满足。`new-code governance`、`file-role-boundaries`、`flat-directories-subtree` 和 `maintainability guard` 均已通过；该 worker 现已是真实 `package-l1` 协议模块。仍保留的长期边界仅剩历史热点大文件预算，如 `platform.repository.ts`、`platform.utils.ts`、`remote.controller.ts` 等，后续可按独立批次继续拆。

若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核，结论为“通过”。判断依据不仅是守卫全绿，还包括：

- 本次没有新增用户能力，却实现了显著的非测试净删减
- 命名治理没有停留在只修当前 touched 文件，而是把当前 worker 被触发的历史命名债务整批收口
- 结构治理没有继续依赖例外 README，而是真实把领域目录拆回 `package-l1` 合法职责目录，并删除了临时 README 豁免
- 治理器续改没有停留在“把错误配置手工改对”，而是把 `legacy` 伪装 `protocol-*` 的检测缺口补进了 contract 解析层，并顺手压缩了协议结构校验分支
- 严格协议续改没有停在源码表层，而是把 alias / build contract 一并补齐，保证 `dist` 产物与 `test:quota` 链路都能继续通过

# NPM 包发布记录

不涉及 NPM 包发布。
