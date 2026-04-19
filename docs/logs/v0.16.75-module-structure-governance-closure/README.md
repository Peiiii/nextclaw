# v0.16.75-module-structure-governance-closure

## 迭代完成说明

- 本次把“目录层级治理没有真正落地到默认主链路”的缺口补成了三段闭环：
  - 新增机器可读的模块结构 contract 数据源 [`scripts/governance/module-structure/module-structure-contracts.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-contracts.mjs)，并在同一批次续改中升级为“固定协议模板 + 包级声明”模型，而不是继续为每个包手写一整套自由白名单字段。
  - 现已支持固定协议模板 `frontend-l3`，并将 `packages/nextclaw-ui/src` 声明为采用该协议的包级结构根；这个声明会把前端 `L3` 协议的固定根骨架、`shared/` 规则、feature 出口规则与 platform 出口规则映射成可执行检查。
  - 本轮续改进一步把“包级声明”从中心脚本内联迁移为“模块根自管理配置文件”：
    - 治理器现在会向上发现模块根下的 `module-structure.config.json`，再按通用协议模板或 legacy contract 解析，不再由中心脚本手写“哪个模块采用哪个规则”。
    - `packages/nextclaw-ui/src` 已迁移为 [`module-structure.config.json`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/module-structure.config.json) 自声明 `frontend-l3`。
    - 同时纠正了一个设计偏差：没有继续给其它历史模块批量补 legacy 配置，因为那会把现状结构误固化为“被认可的长期架构”。现在保持为“只有明确 opt-in 的模块，才新增自己的配置文件进入强约束”。
    - 本轮继续把 CLI 规范正式落地为 `cli-command-first` 协议：`commands/` 等价于 `features/`，根骨架固定为 `app/ + commands/ + shared/`，并且对 CLI 使用严格 `contract-only` 语义，历史根债务一旦触达就直接报错，不再只给 warning。
  - diff-only 结构漂移检查 [`scripts/governance/module-structure/lint-new-code-module-structure.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/lint-new-code-module-structure.mjs) 现在不再只检查“根目录白名单”，还会对协议化包执行两类额外阻断：
    - 结构协议检查：例如 `features/` 下误放职责目录、`shared/lib/` 直放文件、platform 根缺 `index.ts(x)`、legacy root 下继续新增文件等。
    - 唯一导入入口检查：例如从 feature 外部 deep import `@/features/<feature>/...`、deep import `@/shared/lib/<module>/...`、deep import `@/platforms/<platform>/...`。
  - 新增协议辅助模块 [`scripts/governance/module-structure/module-structure-protocol-checks.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-protocol-checks.mjs)，把协议结构检查与导入边界检查拆成独立职责，避免主检查器继续膨胀。
  - 将该检查接入 [`scripts/governance/lint-new-code-governance.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-governance.mjs) 与根 [`package.json`](/Users/peiwang/Projects/nextbot/package.json) 的 `pnpm lint:new-code:governance` 主链路，再补充 PR workflow [`structure-governance.yml`](/Users/peiwang/Projects/nextbot/.github/workflows/structure-governance.yml)，让 review 阶段也能自动执行 diff-only 结构治理。
- 新增治理说明文档 [`docs/designs/2026-04-19-module-structure-contracts.md`](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-19-module-structure-contracts.md)，把 contract 字段、shared 容器边界和“什么时候先改 contract 再落目录”写成明确结构规范。
- 同批次续改补齐了 `packages/nextclaw` 的真实 CLI 入口迁移收尾，避免 `cli-command-first` 债务清理后继续残留旧入口引用：
  - 开发启动链路 [`scripts/dev/dev-runner.mjs`](/Users/peiwang/Projects/nextbot/scripts/dev/dev-runner.mjs) 现已改为从 `src/cli/app/index.ts` 启动，而不是继续引用已删除的 `src/cli/index.ts`。
  - 开发进程探测脚本 [`scripts/dev/dev-process-status.mjs`](/Users/peiwang/Projects/nextbot/scripts/dev/dev-process-status.mjs) 同步切到 `src/cli/app/index.ts` / `dist/cli/app/index.js`，保证 dev 状态识别与真实入口一致。
  - 发布制品校验 [`scripts/release/verify-package-release-artifacts.mjs`](/Users/peiwang/Projects/nextbot/scripts/release/verify-package-release-artifacts.mjs)、远端冒烟辅助 [`scripts/smoke/remote-relay-smoke-support.mjs`](/Users/peiwang/Projects/nextbot/scripts/smoke/remote-relay-smoke-support.mjs) 与相关自启动 / 启动测试样例已全部改到 `dist/cli/app/index.js`，不再保留旧 `dist/cli/index.js` 假入口。
- 同批次续改继续清算了 `packages/nextclaw/src/cli/commands/` 的命令根层债务，开始把 `cli-command-first` 从“能拦根目录”推进到“命令内部骨架也按协议收敛”：
  - 已把 `config-tests/`、`cron-support/`、`diagnostics-support/`、`platform-auth-support/` 与 `commands/shared/ui-bridge-api.service.ts` 这批最靠近根层的历史平铺债务收回命令本地职责目录或 CLI 共享层。
  - `config/`、`cron/`、`diagnostics/`、`platform-auth/` 现在都改成了统一骨架：根层只保留 `index.ts` 唯一出口，owner class 下沉到 `services/`，纯工具落到 `utils/`，共享测试随职责共置，而不是继续在命令根层平铺文件。
  - `shared/ui-bridge-api.service.ts` 已迁回 [`packages/nextclaw/src/cli/shared/services/ui-bridge-api.service.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/services/ui-bridge-api.service.ts)，`config-path` 测试也随之收回 [`packages/nextclaw/src/cli/shared/utils/config-path.utils.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/shared/utils/config-path.utils.test.ts)，避免命令目录再次承载跨命令共享能力。
  - 为了让协议导入边界也成立，本轮同时把 `remote-support/index.ts` 升级为明确的公共出口，补齐 `resolvePlatformApiBase`、`buildPlatformApiBaseErrorMessage` 与 `resolveNextclawRemoteStatusSnapshot` 的统一导出，避免继续 deep import `remote-support/*`。
- 根因记录：
  - 根因不是“仓库完全没有结构治理脚本”，而是此前只有命名治理、flat-directory、frozen-directory、topology report 等分散机制，没有一份模块级结构 contract 作为单一事实来源，也没有一条默认 diff-only gate 去判断“这个模块允许怎么长”。
  - 同时，早期 contract 还是“目录级白名单手写配置”形态，还没有上升到“固定协议模板 + 包级声明 + 唯一导入入口检查”这一层，所以即便补上了 root 白名单，也还不能严格表达你们现在确认的 `L3` 前端协议。
  - 这一点通过代码路径确认：`lint:new-code:governance` 之前没有任何 `module-structure` 检查，`.github/workflows/` 中也没有专门跑结构治理的 PR workflow；`check:topology` 虽存在，但当前全仓仍有 `26` 个既有 cross-layer violation，只能作为报告命令，不能直接粗暴接成 blocking gate。
  - 因此之前的真实状态是：规则/skill/README 已经写了很多，但目录层级约束没有形成“contract -> diff gate -> PR workflow”闭环，所以团队体感会等同于“没管”。
- 本次修复命中根因而不是只处理表象，因为新增的是“固定协议模板 + 包级声明 + diff gate + 导入边界 gate”本身，而不是再补一条口头规则或单目录例外说明。
- 这次续改对应的真实失败根因是：`packages/nextclaw/src/cli/index.ts` 已在 CLI 结构清理中移除，但开发脚本、发布校验脚本和部分测试数据仍把它当作事实入口，导致用户实际运行 `pnpm dev start` 时直接抛出 `ERR_MODULE_NOT_FOUND`。这次命中的是“入口单一事实来源没有彻底收敛”的根因，而不是只在一个触发点上做临时兜底。
- 这次续改继续暴露出的更深一层根因是：即便 CLI 已声明 `cli-command-first`，真实命令目录内部仍残留历史平铺文件、support 侧树与 deep import 习惯，导致一旦真正把协议检查接到阻断链路，命令内部会立刻暴露出“根层只剩 index / 命令之间必须走公共出口 / 职责文件必须落到角色目录”的欠债。这次命中的是 CLI 命令内部骨架尚未完成协议化收敛的根因，而不是继续靠豁免配置给历史结构开绿灯。
- 相关设计与说明：
  - [2026-04-02-structure-governance-hardening-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-02-structure-governance-hardening-plan.md)
  - [2026-04-19-module-structure-contracts.md](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-19-module-structure-contracts.md)

## 测试/验证/验收方式

- 已通过：`node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`node scripts/governance/module-structure/lint-new-code-module-structure.mjs -- packages/nextclaw-ui/src/module-structure.config.json scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/module-structure-protocol-checks.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`pnpm lint:new-code:governance -- packages/nextclaw-ui/src/module-structure.config.json scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/module-structure-protocol-checks.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`pnpm lint:new-code:governance -- packages/nextclaw/src/cli/gateway/controller.ts packages/nextclaw/src/cli/runtime.ts packages/nextclaw/src/cli/commands/service/service.ts`
- 已通过：`node scripts/governance/module-structure/lint-new-code-module-structure.mjs -- scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/module-structure-protocol-checks.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`pnpm lint:new-code:governance -- scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/module-structure-protocol-checks.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`pnpm check:governance-backlog-ratchet`
- 已通过：`ruby -e 'require "yaml"; YAML.load_file(".github/workflows/structure-governance.yml"); puts "yaml ok"'`
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/module-structure-protocol-checks.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
- 已通过：`pnpm --filter nextclaw tsc`
- 已通过：`pnpm dev start`
  - 观察点：不再报 `Cannot find module '/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/index.ts'`；前端成功监听 `http://127.0.0.1:5174/`，后端健康检查 `http://127.0.0.1:18792/api/health` 返回 `{"ok":true,"data":{"status":"ok",...}}`。
- 已通过：`node scripts/dev/dev-process-status.mjs --json`
  - 观察点：`mode=dev-start`、`status=running`，并正确识别 backend watch/runtime 入口为 `src/cli/app/index.ts`。
- 已通过：`pnpm --filter nextclaw test -- --run src/cli/commands/service-support/runtime/tests/service-managed-startup.test.ts src/cli/commands/service-support/marketplace/tests/service.marketplace-skill-args.test.ts src/cli/commands/service-support/autostart/tests/linux-systemd-autostart.service.test.ts src/cli/commands/service-support/autostart/tests/macos-launch-agent-autostart.service.test.ts`
- 已通过：`pnpm --filter nextclaw build`
- 已通过：`node ../../scripts/release/verify-package-release-artifacts.mjs`
- 已通过：`pnpm --filter nextclaw tsc`
- 已通过：`pnpm --filter nextclaw test -- --run src/cli/commands/config/services/config-commands.service.test.ts src/cli/shared/utils/config-path.utils.test.ts src/cli/commands/cron/utils/cron-job.utils.test.ts src/cli/commands/diagnostics/services/diagnostics-commands.service.test.ts src/cli/shared/services/ui-bridge-api.service.test.ts src/cli/commands/platform-auth/services/platform-auth-commands.service.test.ts`
- 已通过：`pnpm --filter nextclaw test -- --run src/cli/commands/cron/services/cron-dev-service.service.test.ts`
- 已通过：`node scripts/governance/lint-new-code-governance.mjs packages/nextclaw/src/cli/commands/config/index.ts packages/nextclaw/src/cli/commands/config/services/config-commands.service.ts packages/nextclaw/src/cli/commands/config/services/config-commands.service.test.ts packages/nextclaw/src/cli/commands/cron/index.ts packages/nextclaw/src/cli/commands/cron/services/cron-commands.service.ts packages/nextclaw/src/cli/commands/cron/services/cron-dev-service.service.test.ts packages/nextclaw/src/cli/commands/cron/services/cron-local.service.ts packages/nextclaw/src/cli/commands/cron/utils/cron-job.utils.ts packages/nextclaw/src/cli/commands/cron/utils/cron-job.utils.test.ts packages/nextclaw/src/cli/commands/diagnostics/index.ts packages/nextclaw/src/cli/commands/diagnostics/services/diagnostics-commands.service.ts packages/nextclaw/src/cli/commands/diagnostics/services/diagnostics-commands.service.test.ts packages/nextclaw/src/cli/commands/diagnostics/utils/diagnostics-render.utils.ts packages/nextclaw/src/cli/commands/platform-auth/index.ts packages/nextclaw/src/cli/commands/platform-auth/services/account-status.service.ts packages/nextclaw/src/cli/commands/platform-auth/services/platform-auth-commands.service.ts packages/nextclaw/src/cli/commands/platform-auth/services/platform-auth-commands.service.test.ts packages/nextclaw/src/cli/commands/platform-auth/utils/payload.utils.ts packages/nextclaw/src/cli/commands/remote-support/index.ts packages/nextclaw/src/cli/shared/services/ui-bridge-api.service.ts packages/nextclaw/src/cli/shared/services/ui-bridge-api.service.test.ts packages/nextclaw/src/cli/shared/utils/config-path.utils.test.ts packages/nextclaw/src/cli/commands/channel/index.ts`
- 当前未作为 blocking gate 接入的项：`pnpm check:topology`
  - 原因：仓库现状仍有历史 cross-layer violation backlog，本次按根因优先顺序先补“目录层级 contract + diff gate + PR workflow”，把 topology 继续保留为 PR 报告产物，而不是直接炸掉全仓准入。

## 发布/部署方式

- 无需产品发布或服务部署。
- 合入后即可生效：
  - 本地收尾时运行 `pnpm lint:new-code:governance`
  - PR 阶段自动触发 `.github/workflows/structure-governance.yml`

## 用户/产品视角的验收步骤

1. 在一个受 contract 约束的目录里尝试新增根级文件，例如向 `packages/nextclaw-ui/src/components/chat/` 新增 `chat-draft-toolbar.tsx`。
2. 运行 `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/chat/chat-draft-toolbar.tsx`，确认会直接失败，提示该文件是在旧 legacy root `components/` 下继续新增，已被 `frontend-l3` 协议阻断。
3. 在协议化 feature 结构里尝试从外部 deep import，例如新增 `import { ChatPanel } from "@/features/chat/components/chat-panel";`。
4. 运行对应治理检查，确认会直接失败，提示 feature 导入必须走 `@/features/chat` 的唯一出口。
5. 在 `shared/lib/` 下尝试新增根级文件，或从外部 deep import `@/shared/lib/date-format/date-format.utils`。
6. 运行对应治理检查，确认会直接失败，提示 `shared/lib` 只能“目录即包 + index 唯一出口”。
7. 在 PR 中提交上述违规改动，确认 `structure-governance` workflow 会自动运行并阻断。
8. 查看 workflow 上传的 `topology-governance-report` artifact，确认 review 阶段能同时看到全仓 topology 报告。
9. 在 `packages/nextclaw/src/cli/` 中触达历史根目录如 `gateway/` 或历史根文件如 `runtime.ts`，运行治理检查，确认它们会因为不在 `app/ + commands/ + shared/` 骨架内而直接报错，而不是只给 warning。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。本次目标不是业务重构，而是把“目录层级治理”补成最小可运行闭环；已优先复用既有 `lint:new-code:governance` 和 ratchet 主链，没有再造第二套平行入口。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有把 full topology backlog 粗暴接成 blocking gate，也没有扩成仓库级结构重写；新增内容集中在一个新的 `module-structure/` 子树与一条 workflow，复杂度增长限定在最小必要范围内。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：目录组织层面有改善。虽然总代码净增，但新增代码是为了提供此前缺失的结构治理能力；同时把新治理逻辑收进了 `scripts/governance/module-structure/` 子树，而不是继续把 `scripts/governance/` 根目录摊平。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。协议模板、模块配置发现、diff 检查器、workflow 与说明文档各自承担单一职责，没有再把“模块采用什么规则”硬编码在中心脚本里。
- 目录结构与文件组织是否满足当前项目治理要求：本次新增内容满足。新增治理能力已放入独立子树 `scripts/governance/module-structure/`，模块采纳关系也已下放到各模块根自己的 `module-structure.config.json`；保留债务是测试文件增长较快，以及协议模块本身已接近预算上限，后续若继续扩协议类型，应优先按“结构检查 / 导入检查 / 模板定义 / 配置发现”再拆一层。
- 同批次 CLI 续改后的结构状态：更接近目标。`packages/nextclaw` 的真实入口事实来源已统一为 `src/cli/app/index.ts` / `dist/cli/app/index.js`，不再让 dev / release / smoke / autostart 测试各自保留一套旧入口字符串；仍待继续清算的是 CLI 命令目录内剩余命名治理与历史平铺债务。
- 同批次 CLI 命令根层债务状态：已继续下降。`config/`、`cron/`、`diagnostics/`、`platform-auth/` 四个命令已完成“根层仅 index + 内部 role 目录化”的第一批收敛，并把共用 bridge / config-path 测试收回 `shared/`；仍待继续清算的是 `remote-support/`、`service-support/` 以及其它尚未彻底协议化的命令侧 support 子树。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。结论如下：
  - 长期目标对齐 / 可维护性推进：是，这次顺着“目录边界更明确、默认入口更统一、review 更可预测”的方向推进了一步。它增强的是 NextClaw 作为长期统一入口产品的内部演进能力，因为后续新能力更不容易继续掉进平铺失控目录。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：796 行
    - 删除：106 行
    - 净增：+690 行
  - 非测试代码增减报告：
    - 新增：633 行
    - 删除：78 行
    - 净增：+555 行
  - 可维护性总结：这次净增长主要来自一项新的治理能力升级，而不是非功能性补丁膨胀；同时已把“协议模板定义 / 主检查器 / 协议检查器 / 测试”分成更清晰的职责边界，并复用现有聚合命令与 ratchet 主链，避免继续堆第二套治理系统。剩余观察点是协议模块已接近文件预算，以及测试文件增长较快，后续扩展更多协议类型时应优先继续拆分。
- 不适用项：无。

## NPM 包发布记录

- 不涉及 NPM 包发布。
