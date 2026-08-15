# 思考能力与 Responses 协议收敛设计

## 背景

VPS 上的 NextClaw v0.37.0 暴露出两个相关但不同的问题：

1. 选择思考强度后，OpenAI Responses API 返回 `Unknown parameter: input[n].reasoning`；部分会话还会返回 assistant 历史消息使用 `input_text` 的错误。
2. 会话输入框中的“思考关闭”无法可靠保持，界面可能重新显示为 `High`。

这不是单个枚举值写错，而是控制面偏好、运行时有效值、历史内容和厂商 wire protocol 没有由同一条链路分别拥有。修复目标是通过结构保证各入口等价，而不是依赖不断增加黑盒补丁。

## 已确认事实与待补证据

### 已确认

- 产品统一思考等级已经包含 `off`，内核解析、会话元数据和 OpenAI effort 映射都能识别它；`off` 在协议上不是非法值。
- OpenAI Responses 请求的当前实现会把历史消息的 `reasoning_content` 写为 `input[n].reasoning`。该字段不属于 Responses message item，且 VPS 当前部署产物包含同一实现，能够直接解释实际 400。
- Responses 历史内容目前由与角色无关的 `normalizeResponsesContent` 生成，因此 assistant 历史内容也可能被编码为 `input_text`；实际 VPS 会话中已经出现对应 400。
- 思考强度的当前顶层映射会生成 `reasoning: { effort }`，位置正确；截图中的错误不是 `High` 映射本身造成的。
- 已有 Codex 会话连续性设计明确了跨 provider reasoning 应使用可移植的 `summary`，不能把 provider 私有推理内容原样回灌。原生 OpenAI provider 的平行序列化路径没有复用这一合同。
- 现有前端会先更新本地思考状态，再异步 PATCH 会话偏好；PATCH 错误被静默吞掉，也没有明确的缓存写回和冲突版本。这使失败、旧会话投影回写和用户选择无法被区分。

### 尚未完全确认

- “思考关闭”被改回 `High` 的具体触发时序还缺少稳定的点击级事件追踪。现有静态链路足以证明状态所有权和错误可见性存在缺陷，但不能把某一次复现武断归因于 PATCH 失败、旧查询覆盖或 draft 初始化中的任意一个分支。
- 因此实现阶段必须先加入可测试的状态归约器和定向交互测试，再用 VPS 独立会话复验；不得用猜测性的条件分支掩盖问题。

## 用户任务与成功标准

用户选择任意思考档位时：

- 界面立即、稳定地表达用户选择；“关闭”是明确选择，不等于清空偏好。
- 刷新、切换会话、切换模型和排队发送后，偏好遵循可解释的一致规则。
- 运行时只在一个位置计算有效思考等级。
- provider adapter 只发目标协议允许的字段和内容类型。
- UI、CLI、Agent 自管理入口最终调用同一个内核 owner，产生等价请求。
- 持久化失败必须可见，且不能悄悄恢复成另一个档位。

## 当前链路与职责断点

```text
UI 选择
  -> draft / session preference
  -> chat run metadata
  -> kernel 计算运行参数
  -> provider adapter
  -> Responses wire payload

历史消息 / reasoning 内容
  -> provider adapter 历史编码
  -> Responses input items
```

当前问题在于两条链路在 provider serializer 中发生了混合：控制面 `reasoning.effort` 是请求配置，历史 reasoning 是内容记录，二者不能共享字段形状。同时，UI 偏好存在本地状态、会话查询和服务端持久化三个潜在 owner，没有冲突裁决。

## 核心模型

### 1. 控制面：显式偏好

禁止再用 `null`、空字符串或 truthy/falsy 同时表达“关闭”“继承”“未加载”。推荐使用可辨识联合：

```ts
type ThinkingPreference =
  | { kind: "unavailable" }
  | { kind: "inherit" }
  | { kind: "explicit"; level: "off" | "minimal" | "low" | "medium" | "high" | "adaptive" | "xhigh" };
```

- `explicit/off`：用户明确关闭，必须跨刷新持久化。
- `inherit`：跟随模型或 provider 默认值，应在 UI 中作为独立选项表达，而不是借用“关闭”。
- `unavailable`：能力尚未加载或模型不支持，只用于展示状态，不得被写回业务偏好。

内核在一次 run 建立时计算唯一的 `EffectiveThinking` 快照。后续排队、重放和 provider 调用只消费该快照，不在各层重复回退。

### 2. 内容面：角色感知的 Responses 历史编码

Responses adapter 必须按角色生成合法 item：

| 内部语义 | Responses 输出 |
| --- | --- |
| user/system/developer 文本 | 对应角色的 message + `input_text` |
| assistant 文本 | assistant message + `output_text` 或 `refusal` |
| tool result | `function_call_output` |
| assistant tool call | `function_call` |
| 可移植 reasoning 摘要 | 合法 reasoning item，`summary` 承载摘要且 `content=[]`；目标协议不接受时省略 |
| provider 私有 reasoning 内容 | 不跨 provider 回灌 |

请求的思考强度只编码在顶层 provider 配置，例如 Responses 的 `reasoning.effort`。禁止生成 `message.reasoning`，也禁止由不感知角色的 content normalizer 决定 `input_text` / `output_text`。

## Provider 能力合同

provider adapter 对内声明能力，对外独占 wire 编码：

```ts
interface ThinkingCapability {
  supportedLevels: readonly ThinkingLevel[];
  defaultMode: "inherit" | ThinkingLevel;
  encodeRequest(level: EffectiveThinking): ProviderRequestFragment;
  encodeHistory(history: CanonicalHistory): ProviderHistoryItem[];
}
```

统一 UI 只依赖规范化能力，不直接知道各厂商字段名。厂商差异只能存在于 adapter 最后一跳。对于不支持的档位，能力协商必须在发送前得出确定结果；不得等 400 后再删字段重试，因为那会静默改变用户选择并掩盖协议漂移。

## 前端状态 owner 与并发规则

会话偏好由单一 manager/store 拥有，组件只提交意图和展示状态：

1. 用户选择生成递增的 mutation id，并立即进入 optimistic 状态。
2. draft 没有远端会话时，写入 draft owner；创建会话时由同一 owner 一次性迁移。
3. 已有会话时，成功响应原子更新会话查询缓存和本地 owner。
4. 失败时展示可操作错误并回滚到已确认值；禁止 `.catch(() => undefined)`。
5. 带旧 revision 的查询结果不得覆盖更新中的或已确认的新 mutation。
6. 模型切换只改变 capability；若当前显式等级不支持，UI 明确展示需要重新选择，不擅自改为 `High` 或默认值。

## 方案比较

### A. 收到 400 后删除字段重试

改动小，但会掩盖协议错误、改变用户意图，并把错误请求留在长期主链路。拒绝。

### B. 在各 UI/provider 分支分别维护映射

能局部修复当前厂商，却继续制造入口和协议漂移。拒绝。

### C. 规范化偏好 + 单一有效值 owner + provider 最后一跳编码

把产品语义和 wire protocol 分离，UI/CLI/Agent 共用内核决策，provider 只拥有厂商差异；同时删除平行序列化和静默失败。采用。

## 实施边界与删除点

实施应按以下顺序收敛，不保留两套长期路径：

1. 为思考偏好建立显式类型和唯一状态 owner，迁移现有 draft/session 输入。
2. 将有效思考值计算收口到 kernel run 边界。
3. 用角色感知 encoder 替换 Responses 的通用 content normalizer。
4. 删除 `output.reasoning = msg.reasoning_content`。
5. 删除偏好更新中的静默 `.catch(() => undefined)`，接入可见失败和缓存原子更新。
6. UI、CLI、Agent 入口只调用同一个内核能力，不复制 provider 映射。

兼容迁移规则：缺失偏好解释为 `inherit`；已有字符串 `"off"` 解释为 `explicit/off`；旧别名只允许在 ingress 读取，所有新写入只使用规范值。迁移观测确认旧数据退出后删除旧读路径。

## 验证合同

### 协议级

- 对 user、assistant、reasoning、tool call、tool result 的混合历史做 exact-payload 测试。
- 断言 assistant 文本只能生成 `output_text` / `refusal`。
- 断言任何 input item 都不存在 `reasoning` 属性。
- 对每个 provider 建立规范档位到 wire 字段的表驱动合同；`off` 与 `inherit` 分开验证。

### 状态级

- draft 和已有会话分别测试选择 `off`、刷新、切换模型、快速连续切换和发送排队。
- 模拟 PATCH 成功、失败、乱序响应和旧查询回写，断言最后一次用户意图拥有最高优先级。
- 持久化失败时必须出现用户可见反馈，并保持可预测的回滚。

### VPS 真实链路

使用独立测试会话，不修改用户已有失败会话：

1. 选择 `High`，完成一轮产生 reasoning 的响应，再发送第二轮；第二轮必须成功，且请求中不存在 `input[n].reasoning` 和 assistant `input_text`。
2. 切换为“思考关闭”，界面立即显示关闭；刷新后仍为关闭。
3. 再发送请求，确认 wire payload 不包含启用 reasoning 的配置，响应正常。
4. 覆盖一次运行中排队消息，确认 run 快照不被随后 UI 选择逆向修改。

只有协议 exact-payload、状态并发测试和 VPS 两轮真实会话三类证据同时通过，才能声明修复完成。

## 非目标

- 不统一不同模型实际投入的推理 token 或语义强度，只统一用户可理解的控制合同。
- 不展示或跨 provider 搬运私有 chain-of-thought。
- 不用自动重试隐藏协议 400。
- 本设计不处理 CLI 版本展示、升级机制或其他与思考能力无关的问题。

## 相关设计

- `docs/designs/2026-07-20-codex-session-model-continuity.design.md`
- `docs/logs/v0.26.4-codex-model-switch-session-continuity/README.md`
