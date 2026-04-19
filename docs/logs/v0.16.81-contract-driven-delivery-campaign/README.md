# 迭代完成说明

本次新增了一个 repo 内专用的长期编码交付 skill 第一版：[contract-driven-delivery-campaign](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/SKILL.md)。

这次迭代的目标，不是继续围绕“可维护性治理战役”做局部增强，而是向上抽出一个更通用的长期编码任务闭环：让 agent 在复杂编码任务中围绕“任务契约”而不是围绕临时局部最优持续推进，以降低目标漂移、范围漂移、完成漂移与验收漂移。

当前交付包含：

- skill 主协议文件：[SKILL.md](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/SKILL.md)
- skill UI 元信息：[openai.yaml](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/agents/openai.yaml)
- 任务契约模板：[task-contract.md](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/assets/templates/task-contract.md)
- 过程工作笔记模板：[working-notes.md](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/assets/templates/working-notes.md)
- 机器续跑状态模板：[state.json](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/assets/templates/state.json)

这版 skill 明确把“任务契约”提升为第一等公民，并要求长期编码任务默认围绕以下闭环运行：

- 先锁定用户真正想要的结果、非目标、交付物、完成条件与验收清单
- 再按阶段推进，而不是只按“手头方便做什么”推进
- 每轮执行后都做偏航检查
- 只有在契约中的完成条件全部满足时，才允许宣布完成

这次实现仍然保持不过度设计的原则：没有引入额外 adapter、profile、脚本系统或业务目录绑定，而是沿用现有 repo 内治理机制，把长期编码交付所需的最小协议直接收敛进一个 all-in-one skill 中。

随后继续做了一轮同批次收敛优化，重点不是继续加层，而是补齐两类最值钱的能力：

- 把“上下文压缩 / 长中断恢复”正式提升为一条显式恢复协议，而不是隐含假设
- 补充“最小维护原则”与“同步检查点”，避免协议本身变成新的负担

同时，模板层也补齐了更贴近真实交付的几个关键信息位：

- `task-contract.md` 增加“用户看到什么算成功”与“明确失败信号”
- `working-notes.md` 增加“恢复摘要”
- `state.json` 增加“恢复入口”

在收到 review finding 后，又继续做了同批次修补，补上了两条高风险但此前不够落地的协议：

- 明确“当前活跃迭代目录”的判定顺序、复用条件、提前留痕条件，以及运行时状态必须只落在对应迭代目录 `work/` 下的约束
- 把“压缩恢复协议”从单纯重读状态文件，升级为“状态文件 + 最新用户要求 + 当前 repo 状态”的三方核对

同时，为了让这两条协议能真的落地，模板也补了最小必要字段：

- `working-notes.md` 新增“外部变化核对”
- `state.json` 新增“当前迭代目录 / 最近一次用户变化核对 / 最近一次仓库变化核对”

# 测试 / 验证 / 验收方式

本次改动未触达产品运行时代码、构建链路或类型链路，`build / lint / tsc` 不适用，原因是仅新增 repo 内 skill 文档、元信息与模板文件。

已执行的最小验证：

- 手动审阅新增 skill 结构与内容，确认其聚焦长期编码交付而非泛化成过度抽象的平台
- 使用 `node` 解析模板文件 `state.json`，确认 JSON 语法有效
- 审阅 skill 是否已明确区分“任务契约 / 阶段推进 / 偏航检查 / 完成判定 / 停机条件”
- 审阅 skill 与现有仓库治理机制的接线方式，确认它直接复用 `commands/commands.md`、`iteration-work-notes` 与 maintainability 相关机制，而没有复制或发明平行体系
- 补充“压缩恢复协议 / 最小维护原则 / 同步检查点”后再次人工审阅，确认这版增强的是抗漂移能力而不是额外流程负担
- 针对 review finding 补充“当前活跃迭代目录判定”与“最新外部变化核对”后再次人工审阅，确认长期任务的状态归档位置与恢复协议都已具备可执行性而不是停留在概念层

当前未执行：

- 未执行运行时冒烟，因为本次尚未将该 skill 接入真实自动化任务
- 未执行构建、类型或 UI 相关验证，因为本次没有触达对应代码路径

# 发布 / 部署方式

本次无需独立部署。

生效方式为代码合入仓库后，skill 即作为本 repo 内可复用能力存在。后续若用户希望以 thread heartbeat 方式整夜推进复杂编码任务，可在实际任务中再配合 automation 使用；本次迭代先不把 automation 配置一并固化到仓库中。

# 用户 / 产品视角的验收步骤

1. 打开 [SKILL.md](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/SKILL.md)，确认它的重点已经不是单纯“执行长任务”，而是“围绕任务契约防漂移地完成编码交付”。
2. 打开 [task-contract.md 模板](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/assets/templates/task-contract.md)，确认它已经覆盖“用户真正想要的结果 / 非目标 / 交付物 / 完成条件 / 验收清单 / 提交发布要求”。
3. 打开 [working-notes.md 模板](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/assets/templates/working-notes.md) 与 [state.json 模板](/Users/peiwang/Projects/nextbot/.agents/skills/contract-driven-delivery-campaign/assets/templates/state.json)，确认它们已经能够承接阶段推进、偏航检查与续跑状态。
4. 检查 skill 是否明确写出了“不能把中间进展误判为最终完成”这一完成判定约束。

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。就这次“先交付一个通用长期编码任务 skill 的第一版 MVP”而言，已经优先做了删减与收敛，没有额外引入 adapter、profile、脚本系统或跨仓库抽象层。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有试图把它做成一个万能任务平台，而是只保留“任务契约、工作笔记、状态模板、阶段推进、偏航检查、完成判定”这些直接支撑目标的最小必要结构。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次存在最小必要的文件净增长，原因是新增一项 repo 内可复用能力。增长控制在 skill 主文件、元信息和三个模板加一个迭代 README 的范围内，未新增脚本、未拆多层 reference，属于为了形成新能力所需的最小必要增量。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。边界被明确收敛为一个 skill 加三份状态模板，没有为了“以后也许通用”而提前拆出额外平台层。

目录结构与文件组织是否满足当前项目治理要求：满足。新增内容集中在单一 skill 目录下，未侵入业务代码目录，也没有制造平行治理体系。

若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：本次不适用，原因是本次新增的是 repo 内 skill 文档与模板，不涉及产品运行时代码的可维护性评估；但本次仍进行了独立主观复核，重点确认没有把第一版做成过度设计的平台。

# NPM 包发布记录

不涉及 NPM 包发布。
