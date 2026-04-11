# 迭代完成说明

- 新增 skill：`.agents/skills/collapsible-feature-root-architecture/SKILL.md`
- 将“可折叠 feature-root 架构”沉淀为可复用的仓库内 skill，核心约束包括：
  - `feature` 是语义单元，不是强制目录名
  - 单 feature 场景下，当前 scope 直接作为 feature root，不额外引入 `features/`
  - 多 feature 场景下，才引入 `features/` 作为聚合层
  - feature 内只有在出现多个稳定子业务域时，才继续展开子 `features/`
  - `shared/` 只允许承载真实跨 sibling 复用的稳定内容，禁止退化为垃圾桶
- skill 同时补齐了复杂度分级、目录扩张规则、命名约束、平台拆分规则、package 拆分规则和反模式清单。
- 根据同批次修正，已将 skill 正文与触发描述统一改为中文，避免仓库内 skill 出现中英混搭的表达割裂。
- 根据本轮 review，进一步补齐了前后端通用性与目录白名单约束：
  - `app/` 被明确收敛为应用根 / package 根装配目录，不再泛化到普通 feature root
  - 新增“白名单内按需可选、白名单外默认禁止”的总规则
  - 明确区分应用根、前端 feature root、后端 feature root 三套可选目录白名单
  - 将平台层约束单独显式化，避免与普通 feature 结构混淆
  - 将命名规则区分为通用后缀、前端特有命名、后端常见命名
- 根据本轮继续收敛：
  - 将 `L3` 与 `L4` 拆开：`L3` 仅表示 monorepo，`L4` 单独留给前端多平台
  - 从支持范围中删除 `integrations/`、`workers/`、`consumers/`
  - 同步删除对应的白名单条目、禁用目录示例与命名后缀
- 根据本轮再次细化：
  - 将 `L4` 进一步收敛为“前端多平台”，平台只保留 `desktop/`、`mobile/`、`web/`
  - 删除 `http/`、`cron/` 等示例，避免把 `L4` 误解成泛化宿主层
  - 明确写出每个平台目录内部本身仍然是一套 feature 架构，而不是散落式平台目录
- 根据本轮继续补齐：
  - 明确 `CLI` 不属于 `L4`，而是一种独立 app / package 形态
  - 明确 `package` 不是额外结构模型，内部继续复用 `L0-L2/L4`
  - 从后端白名单和命名规则中删除 `jobs`
- 根据本轮最终收口：
  - 删除 `commands/` 白名单，CLI 入口统一回收至 `app/`
  - 不再为 CLI 额外引入专门入口目录，避免白名单继续膨胀
- 根据收尾治理接入：
  - 已将该 skill 以高优先级项目规则接入 `AGENTS.md`
  - 未继续堆出多条平行规则，而是将现有“新建前先规划结构”“目录预算治理”两条规则的执行方式直接接到该 skill
  - 目标是让目录架构约束进入统一治理链路，而不是再形成一块孤立说明

# 测试/验证/验收方式

- 验证 skill 文件已创建：
  - `test -f .agents/skills/collapsible-feature-root-architecture/SKILL.md`
- 人工检查 skill 内容是否覆盖本次讨论达成的一致原则：
  - 单 feature 根折叠
  - 多 feature 才展开
  - 子 feature 按稳定业务域生长
  - shared 严格受限
  - 白名单内目录按需可选
  - 白名单外目录默认禁止
  - 前后端目录范围明确分开
  - `L4` 才表示多平台 / 多宿主
  - `integrations/`、`workers/`、`consumers/` 不在允许范围内
  - `L4` 当前仅表示前端多平台
  - `desktop/`、`mobile/`、`web/` 各自内部仍然是 feature 架构
  - `CLI` 不属于 `L4`
  - `jobs` 不在后端允许范围内
  - CLI 入口统一归 `app/`
  - `AGENTS.md` 已新增高优先级项目规则 `collapsible-feature-root-architecture-required`
  - `plan-structure-before-creating-files` 与 `directory-file-budget-must-stay-explicit` 已联动该 skill
- `build/lint/tsc` 不适用：
  - 本次仅新增/修改 skill 文档、`AGENTS.md` 规则与迭代留痕，未触达构建、类型或运行链路代码

# 发布/部署方式

- 无需发布或部署。
- skill 文件落库后即可被仓库的 skill 发现机制使用。

# 用户/产品视角的验收步骤

1. 打开 [.agents/skills/collapsible-feature-root-architecture/SKILL.md](/Users/peiwang/Projects/nextbot/.agents/skills/collapsible-feature-root-architecture/SKILL.md)。
2. 确认 skill 明确写出“单 feature 项目不需要 `features/` 目录，当前 root 直接就是 feature root”。
3. 确认 skill 明确区分 `L0` 到 `L4` 五档复杂度，其中 `L4` 仅表示前端多平台。
4. 确认 skill 明确约束何时引入 `features/`、何时引入子 feature、何时允许 `shared/`、何时拆平台和 package，并明确 CLI 入口统一归 `app/`。
5. 打开 [AGENTS.md](/Users/peiwang/Projects/nextbot/AGENTS.md)，确认已新增高优先级项目规则 `collapsible-feature-root-architecture-required`，且相关现有规则已联动该 skill。

# 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次目标不是继续新增一篇分散文档，而是把讨论结果收敛为一个可触发、可复用、可执行的 skill，降低未来重复解释和重复拍脑袋决策的成本。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。最终仅新增一个 skill 文件和一个迭代 README，没有再铺开额外参考文档、模板文档或重复说明文件。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次仓库文件数有最小必要净增长，原因是必须新增一个独立 skill 才能让该能力被系统发现和复用；同时避免了新增多份平行设计文档，控制了增长规模。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。新增 skill 将“feature 是语义单元，不是强制目录名”固定为上位规则，优先约束边界与演化条件，而不是堆更多模板式目录。
- 目录结构与文件组织是否满足当前项目治理要求：满足。新增内容放在 `.agents/skills/<skill-name>/SKILL.md`，命名与现有 skill 目录保持一致；同时通过 `AGENTS.md` 将该 skill 接入现有规则链路，而不是平行增加多条重复规则，避免治理结构继续膨胀。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次未修改源码、脚本、测试或运行链路配置，未触发代码层面的独立可维护性复核场景。
- 若本次迭代不涉及代码可维护性评估，必须明确写“不适用”并说明理由：不适用，原因同上；本次为 skill 文档沉淀与流程能力补充，不是代码实现或代码重构。
