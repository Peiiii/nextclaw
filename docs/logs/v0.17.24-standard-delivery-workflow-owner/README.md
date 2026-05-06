# v0.17.24-standard-delivery-workflow-owner

## 迭代完成说明

- 为项目治理体系新增了一个标准交付流程 owner：`nextclaw-delivery-workflow`。
- 根因不是“缺一条新规则”这么简单，而是现有治理系统只有实现、验证、可维护性、留痕等分散专项 skill，却没有一个端到端总流程 owner 去强制串起这些环节。
- 这会导致代理即使分别知道多条规则，也仍可能遗漏跨环节义务，例如：
  - 没有主动披露总代码与非测试代码增减，
  - 没有把复盘后的机制改进落实到治理系统，
  - 没有统一判断一项工作是否真正可以收尾。
- 本次修正命中根因而不是补一句提醒：
  - 在 `AGENTS.md` 新增 `标准交付流程` 专门环节，直接固化最核心的固定 6 步，让每轮都能先看到主流程骨架。
  - 在 `标准交付流程` 的每一步中补上“默认联动 skill / 条件联动 skill”，让代理不仅知道顺序，还知道在什么条件下应该展开哪些专项规则。
  - 补充 `skill 默认用中文` 规则，避免项目内新增 skill 默认漂到英文，导致治理系统语言风格不一致。
  - 在 `commands/commands.md` 增加 `/close-task` 显式入口。
  - 新增 `.agents/skills/nextclaw-delivery-workflow/SKILL.md`，承接条件细节、专项 skill 编排、收尾强制检查与最终主动汇报，并同步补齐与 `AGENTS.md` 对应的 skill 路由说明。
- 这次改动遵守了“AGENTS 只放常驻内核”的边界：`AGENTS.md` 只放核心固定步骤，不把条件分支、例外和长 checklist 全塞回常驻 prompt。

## 测试/验证/验收方式

- 已执行：
  - `wc -c -m -w AGENTS.md`
  - `git diff -- AGENTS.md commands/commands.md .agents/skills/nextclaw-delivery-workflow/SKILL.md`
  - `find docs/logs -maxdepth 1 -type d -name 'v*' | sed 's#docs/logs/##' | sort -V | tail -n 5`
- 结果：
  - `AGENTS.md` 变更后仍保持常驻内核模式，只新增一个简短的 `标准交付流程` 专门环节；详细条件继续下沉到 skill。
  - diff 已确认固定骨架和步骤级 skill 路由在 `AGENTS.md`，条件细节在 skill，命令索引单独在 `commands/commands.md`。
  - 新增的 `nextclaw-delivery-workflow` 已改写为中文，`nextclaw-agent-instructions-governance` 也同步补上了“项目内 skill 默认中文”的治理规则。
  - 迭代目录版本号使用 `v0.17.24-*`，严格大于现有最大有效版本。
- 未执行：
  - `tsc` / build / eslint / 测试。
  - 原因：本次仅为治理文本与 skill 分层调整，不涉及 TypeScript、运行链路或可执行脚本实现。

## 发布/部署方式

- 本次不涉及产品运行时代码发布。
- 合入后新的治理入口会在后续任务中自动生效。

## 用户/产品视角的验收步骤

1. 查看 [AGENTS.md](/Users/peiwang/Projects/nextbot/AGENTS.md:46)，确认已有 `标准交付流程` 专门环节，且核心固定步骤和步骤级 skill 路由已直接写入常驻内核。
2. 查看 [commands/commands.md](/Users/peiwang/Projects/nextbot/commands/commands.md:43)，确认已有 `/close-task` 显式入口。
3. 查看 [SKILL.md](/Users/peiwang/Projects/nextbot/.agents/skills/nextclaw-delivery-workflow/SKILL.md:1)，确认它承接条件细节，并明确要求主动披露总代码与非测试代码增减、复盘机制改进、迭代留痕决策与最终主动汇报。
4. 后续任一代码任务收尾时，确认代理不需要用户追问，也会主动汇报这些关键项。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次只把最核心的固定步骤和必要的步骤级 skill 路由提到 `AGENTS.md`，条件性细节仍放在 skill。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：常驻内核增长被压到最小；新增复杂度集中在一个新 skill 与一个短流程段，而不是分散进多个已有规则文件。
- 抽象、模块边界、class / helper / service / store / controller 边界是否更合适、更清晰：更清晰。现在“标准交付流程”有了明确 owner，不再依赖多个专项 skill 的隐式拼接。
- 目录结构与文件组织是否满足当前项目治理要求：满足。本次新增 skill 位于 `.agents/skills/nextclaw-delivery-workflow/`，命令索引与 AGENTS 索引同步更新。
- 可维护性总结：
  - 这次的正向减债动作是职责收敛：把原本分散在多条规则里的“端到端交付闭环”收回到一个明确 owner，并把核心固定步骤与必要的 skill 路由提升为常驻骨架。
  - 这不是把流程写得更长，而是把“主流程永远可见、需要展开哪些 skill 也永远可见、条件细节再按需展开”做成稳定结构。

## NPM 包发布记录

- 不涉及 NPM 包发布。
