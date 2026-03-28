# v0.14.251-maintainability-skill-doc-structure

## 迭代完成说明

- 重构 `post-edit-maintainability-guard` skill 文档结构，按“定位、能力地图、适用范围、默认执行入口、检查模型、阻塞项、警告项、预算规则、Diff-only 原则、输出约定、扩展约定、资源”重新组织内容。
- 保持现有执行入口和默认阻塞逻辑不变，不在本次迭代中引入新的流程要求。
- 将代码统计正式纳入可维护性体系说明，明确区分“闸门型信号”和“趋势型信号”。
- 补充 `TypeScript`、`TSX`、`TS + TSX` 代码体积统计在可维护性报告中的定位与输出要求。
- 在资源区补充仓库现有的 `code-volume-metrics` 脚本索引，便于后续将代码体积指标继续系统化扩展。

相关文档：

- [post-edit-maintainability-guard skill](/Users/tongwenwen/Projects/Peiiii/nextclaw/.codex/skills/post-edit-maintainability-guard/SKILL.md)

## 测试/验证/验收方式

- 文档核对：确认 skill 文档结构已从单层流程说明重组为“系统定位 + 信号分类 + 输出契约 + 扩展约定”的结构。
- 逻辑核对：确认默认入口仍为 `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`，未修改执行命令和阻塞规则的主干行为。
- 内容核对：确认代码统计部分已明确写入 skill 文档，且被归类为趋势型信号而非默认阻塞项。
- 本次未执行 `build`、`lint`、`tsc`：不适用，原因是本次仅修改文档结构，未触达代码路径。

## 发布/部署方式

- 无独立发布动作。
- 随仓库文档变更一并提交即可。
- 若后续需要让代码统计进入自动化流程，应在后续迭代中单独修改脚本或 hook/CI 配置，而不是在本次文档整理里隐含变更。

## 用户/产品视角的验收步骤

1. 打开 `post-edit-maintainability-guard` skill 文档。
2. 确认文档开头先回答“这个 skill 是什么、解决什么问题、哪些信号会阻塞、哪些信号用于观察趋势”。
3. 确认文档中已出现代码统计相关说明，且明确包含 `TypeScript`、`TSX`、`TS + TSX` 统计口径。
4. 确认文档没有把代码统计直接写成新的默认阻塞规则，也没有改变现有执行入口。
5. 确认文档结尾提供了后续扩展约定和相关资源索引，方便后续继续系统化演进。
