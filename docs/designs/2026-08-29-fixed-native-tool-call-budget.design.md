# Native Agent 固定工具调用预算设计

## 背景与问题

`agents.defaults.maxToolIterations` 最初以 `20` 写入旧实例配置，随后产品默认值提高到 `1000`，但 native runtime 长期没有消费该字段。2026-08-26 的运行时成本治理把这一休眠配置接入每次 run 的硬预算后，旧实例在没有用户配置变更的情况下突然于第 21 个工具调用失败。

这不是配置迁移问题。工具调用预算属于 NextClaw native runtime 的产品安全不变量，不应由用户配置、Agent profile 或历史 JSON 值改变。

## 目标

- native agent run 统一使用固定的 `1000` 次工具调用预算。
- `agents.defaults.maxToolIterations` 与 `agents.list.*.maxToolIterations` 不再是配置合同，旧 JSON 字段不参与解析结果和运行行为。
- 从 CLI 配置目录、Agent API、设置 UI、详情 UI 和 run-spec metadata 中删除该字段，避免形成仍可配置的假入口。
- 保留达到固定预算后的明确失败，作为极端失控保护；正常任务不再受旧实例的 `20` 影响。

## 唯一主链路

```text
native agent run
  -> AgentRunExecutionManager
  -> RuntimeToolCallBudget(FIXED_NATIVE_TOOL_CALL_LIMIT = 1000)
  -> 每个真正开始的工具调用扣减一次
  -> 第 1001 个调用产生 terminal RunError
```

固定值由 native runtime 唯一拥有。kernel 不再从 resolved agent profile 读取预算，也不再把预算写入 `AgentRunSpec`；server、UI 和配置 schema 不再投影或编辑该值。

## 旧配置行为

旧配置中的两个字段按未知字段处理：

- `agents.defaults.maxToolIterations`
- `agents.list[].maxToolIterations`

不增加迁移器、deprecated alias、warning-only 兼容或 fallback。配置解析后的规范对象不包含这些字段，因此运行时永远不能再次读取它们；后续正常保存配置时，旧字段随规范化结果自然消失。

## 删除范围

- Core：schema、label、help、reload route、effective profile 投影。
- Kernel：resolved profile、run spec、run metadata 和 request 组装。
- Native runtime：删除外部 `maxToolIterations` 输入，改用内部固定工具调用预算；内部命名统一使用 `tool call`，不再称为 iteration。
- Server/UI：删除 Agent/API 类型、配置编辑控件、Agent 详情字段、i18n 文案和截图 mock。
- Docs：当前能力清单不再宣称该配置可运行时应用；历史设计与日志保留事实，但明确旧设计已被本设计取代。

## 场景矩阵

| 场景 | 预期行为 |
| --- | --- |
| 新安装 | 不生成、不展示工具调用上限配置；native runtime 固定使用 1000 |
| 旧配置含 defaults=20 | 字段被忽略，run 使用 1000 |
| 旧 Agent override=20 | 字段被忽略，run 使用 1000 |
| CLI/API/UI 读取配置 | 返回的规范配置与 Agent 视图中不包含该字段 |
| 并行工具调用 | 每个真正启动的调用计一次，共享同一 run 的 1000 预算 |
| 第 1001 个调用 | 不启动该工具，run 以明确错误终止 |
| 历史 run metadata | 继续可读；新 run 不再写 `maxToolIterations` |

## 验证标准

1. 用含旧 defaults/profile 字段的配置解析测试证明两处字段都被剔除。
2. runtime 单测证明固定值为 1000，预算仍按真实工具调用计数且不会多启动一个。
3. kernel run-spec 测试证明不再从 Agent profile 获取或写入该字段。
4. server/UI 类型检查和定向 UI 测试证明配置与详情入口已删除。
5. 对所有触达 TypeScript package 运行对应 `tsc`。

## 非目标

- 本批不设计动态成本策略、token/时长预算或循环检测。
- 不迁移或主动改写用户磁盘上的旧 JSON 文件。
- 不改变非 native 外部 agent runtime 自身的预算合同。

## Design Ready

本设计只保留一个 runtime 常量和一个内部预算 owner，删除所有用户配置与跨层传递路径；没有新增兼容层、配置开关或未来抽象。
