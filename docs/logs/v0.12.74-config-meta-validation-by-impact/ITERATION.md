# v0.12.74-config-meta-validation-by-impact

## 迭代完成说明（改了什么）

- 修正 `AGENTS.md` 中 `/validate` 指令描述与 `post-dev-stage-validation` 规则，统一为“按改动影响范围执行最小充分验证”。
- 同步更新 `commands/commands.md` 中 `/validate` 描述，消除命令索引与 Rulebook 口径偏差。
- 明确了三条边界：
  - 仅当改动触达构建/类型/运行链路时，才执行 `build/lint/tsc` 的相关项。
  - 纯文档/文案/注释改动可跳过 `build/lint/tsc`。
  - 跳过验证时必须记录“不适用 + 判定依据”，避免口头化省略。

## 测试/验证/验收方式

- 本次为规则文档改动，不触达代码路径，`pnpm build`、`pnpm lint`、`pnpm tsc` 判定为不适用。
- 已执行文本一致性检查：
  - `rg -n "post-dev-stage-validation|/validate|最小充分验证|不适用" AGENTS.md commands/commands.md`
- 验收点：
  - `/validate` 描述与 Rulebook 条目口径一致。
  - Rulebook 中明确给出“文档改动可跳过三件套，但需记录理由”。

## 发布/部署方式

- 本次仅为仓库协作规则文档更新，无构建产物、无部署动作。

## 用户/产品视角的验收步骤

1. 发起一次纯文档改动任务。
2. 交付说明中写明：`build/lint/tsc` 不适用及具体理由（未触达代码路径）。
3. 发起一次代码改动任务。
4. 交付说明中应包含受影响范围的 `build/lint/tsc` 相关验证与结果，并在需要时附冒烟测试。
