# v0.42.10 Continuous Attention Skill

## 迭代完成说明

为 Agent 增加内置、always-on 的 `continuous-attention` Skill，补齐 Observation 从“工具可调用”到“模型知道何时使用”的行为指导。

- 明确一次性查询、`bind_context`、`subscribe_events` 与两者组合的选择规则。
- 要求 Agent 在建立关系前发现 capability、读取 `configSchema`、检查已有关系并控制高频事件噪声。
- 覆盖当前会话范围、全局 Extension 管理与会话 Observation 的边界。
- 覆盖外部事件的不可信数据处理、暂停、恢复、移除和能力缺失时的诚实反馈。

## 测试/验证/验收方式

- 新增 SkillsLoader 测试，验证 Skill 可加载、包含核心工具语义，并被识别为 always-on。
- `@nextclaw/core` 全量测试：46 个测试文件、237 个测试通过。
- `@nextclaw/core` TypeScript 检查通过。
- `git diff --check` 通过。
- Skill 官方 `quick_validate.py` 已尝试运行，但当前环境缺少 Python `PyYAML` 依赖；项目已有双语 Skill 合同和加载测试已完成等价格式/行为验证。

## 发布/部署方式

本次通过 `pnpm release:npm:beta` 发布 NPM beta，仅包含 NPM registry、beta dist-tag、真实安装和必要 Git 版本闭合；不发布 runtime channel、桌面端、文档站或官网。

## 用户/产品视角的验收步骤

1. 使用 beta 包启动 NextClaw Native Agent。
2. 向 Agent 提出“持续关注”“变化时提醒”“以后每次带上最新状态”等请求。
3. 确认 Agent 能先发现可用 Extension，再根据意图选择 Context、Events 或两者，而不是默认创建订阅。
4. 对已有关注关系提出暂停、恢复、删除和查看请求，确认 Agent 使用正确的生命周期操作。
5. 发送包含伪指令文本的外部事件，确认 Agent 将其视为不可信数据，不因事件 payload 自动执行高影响操作。

## 可维护性总结汇总

- 本次没有新增运行时 wrapper、manager 或第二套 Observation 逻辑，只增加一个聚焦行为决策的内置 Skill和一条加载测试。
- Skill 目录沿用 `packages/nextclaw-core/src/features/agent/shared/skills/<name>/SKILL.md`，未扩大目录层级。
- 测试验证了 Skill 的发现和 always-on 选择，owner 仍归 SkillsLoader；Observation 工具和关系状态的 owner 没有改变。
- 自动维护性 guard 未对本次新增内容产生新的代码预算问题；本次不触达既有运行时红区。

## NPM 包发布记录

- 需要发布：Skill 随 `@nextclaw/core` 一起打包，属于用户可见的 Agent 行为增强。
- `@nextclaw/core`：patch，随当前未发布 changeset 批次进入 beta。
- 其他 workspace 包：按仓库现有未发布 changeset 的依赖闭包统一处理，不在本次 Skill 中额外扩大范围。
- 发布渠道：NPM `beta` dist-tag；runtime channel、desktop 和正式 `latest` 不涉及。
- 初始记录状态：待 `pnpm release:npm:beta` 闭环后补充实际版本、包数、tag、安装验证与 release commit。
