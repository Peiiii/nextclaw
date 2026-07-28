# v0.26.33 主动可视化展示决策

## 迭代完成说明

- 根因不是缺少 `visualize-output` 能力，而是常驻 `ReplyFormatContextProvider` 只用“结果明显更适合视觉表达”这一抽象原则提示模型，同时把严格首调用门禁限定在用户明确提出可视化、图表或时间线等话术时；模型能够在被点名后使用能力，却缺少从信息形态主动发现能力价值的高信号判断依据。
- 本次继续由现有 `ReplyFormatContextProvider` 作为唯一输出提示 owner，没有新增 provider、planner、registry 或平行展示链路。
- 常驻提示新增展示决策门：每轮回答前先识别信息形态，再选择能实质降低用户理解成本的最小媒介；重复字段比较、分支影响、依赖/层级/空间关系、多步状态变化、数值趋势与可调场景成为主动候选。
- 同一规则明确保留反向克制：单一事实、一两个简单步骤、短解释和简单编辑继续使用自然文字，避免把“主动使用能力”异化为“强制提高可视化数量”。
- 第一轮真实模型前向验收已证明隐式触发成功，但也暴露三行比较被过度升级成 HTML、并补造未给权重的综合评分；常驻提示因此继续明确表格和 Mermaid 本身就是可视化，HTML 只用于确有空间布局或交互收益的场景，并禁止为了丰富画面新增评分、权重、排名、阈值或定性标签。
- 第二轮前向验收中模型仍把同一组小型命名比较升级成气泡图 HTML，证明“HTML 只在更清楚时使用”仍然过于主观；媒介路由因此进一步明确：少量命名对象的重复字段比较默认使用紧凑表格，只有用户点名媒介或图形编码能揭示表格会隐藏的重要模式时，才升级为图表或 HTML。
- 第三轮比较验收已收敛到“读取可视化 skill + 紧凑表格”，但独立的五环节关系请求仍读取了无关 skill 并用 ASCII 流程代替 Mermaid；关系型路由因此继续明确，多节点流程、时间线、层级与状态关系在短文字不能更清楚时默认使用 Mermaid，不以 ASCII 绕开既有可视化能力。
- 后续关系型验收已把实际媒介从 ASCII 稳定纠正为 Mermaid；但即使规则写成 `MUST call read_file`，当前模型仍可能直接输出 Mermaid 而不读取 skill。这证明常驻提示适合提升“是否可视化、选什么媒介”的判断质量，却不能单独提供确定性的工具调用保证；若产品要求每个隐式强候选都严格加载 skill，后续应由运行时能力路由或条件化 context 注入提供机制保障，而不是继续堆叠提示词。
- 显式可视化请求仍要求首个工具调用读取 `visualize-output`；调查过程中才识别出的隐式候选，则在组织或创建视觉结果前读取 skill，不要求用户再次点名媒介。
- 本次没有修改 `visualize-output` skill。原因是本轮缺口属于每轮都要执行的媒介选择，而不是技能被选中后的具体制作合同；将判断放进常驻输出 provider，能让 skill 继续保持按需加载。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel exec vitest run src/contributions/context-provider/providers/reply-format-context.provider.test.ts src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`：通过，2 个测试文件、2 个用例。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/kernel build`：通过；存在项目当前 Node.js 22.16.0 即将不受 `tsdown` 支持的非阻塞警告。
- `pnpm lint:new-code:governance`：通过；provider 目录继续命中已有目录预算例外，没有新增目录文件。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm clean:generated && pnpm check:generated-clean`：通过；真实源码构建产生的 `ui-dist` 漂移已清理。
- `git diff --check -- packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.ts packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.test.ts docs/logs/v0.26.33-proactive-visual-presentation/README.md`：通过。
- 第一轮隔离真实模型前向验收：当前源码构建实例运行在独立 `NEXTCLAW_HOME=/Users/peiwang/.nextclaw-source-runtime/proactive-visual-presentation` 与端口 `18907`，`deepseek/deepseek-chat` 在用户未写“可视化、图表、画图”等关键词时主动读取 `visualize-output`，但把小型比较过度升级为 HTML 并新增了无依据综合评分；该轮作为失败基线，已驱动第二次提示收紧。
- 第二轮隔离真实模型前向验收：隐式触发继续成功，但模型仍将同一组小型命名比较升级为气泡图 HTML；该轮作为第二条失败基线，驱动默认表格路由从原则升级为明确合同。
- 第三轮隔离比较验收：会话 `smoke-native-ms4st479-xmxrec49` 主动读取 `visualize-output` 后使用 Markdown 表格，没有创建 HTML 或综合评分；核心媒介选择通过。
- 反向克制验收：两句话解释闭包的会话 `smoke-native-ms4stq0a-ek4d7isd` 为零工具调用和纯文字回答，没有误触发可视化。
- 第一轮关系型验收：五环节职责请求未点名媒介，模型读取了无关 skill 并使用 ASCII 流程；该轮作为失败基线，驱动 Mermaid 默认路由收紧。
- 关系型媒介验收：会话 `smoke-native-ms4t1918-1ammdmir` 与 `smoke-native-ms4t2nq5-2fl2dx44` 均主动使用聚焦 Mermaid，不再退回 ASCII；但两轮均为零工具调用，确认“媒介选择通过、隐式 skill 调用未获得确定性保证”。
- 最终反向克制验收：会话 `smoke-native-ms4t399m-nqk4e1hz` 仍为零工具调用和两句话纯文字回答，没有因关系型规则收紧而扩大误触发。

## 发布/部署方式

- 本次仅执行本地 git commit；未执行 push、NPM publish、runtime update、GitHub Release、线上部署或主实例重启。真实模型验收使用的独立源码实例已停止。
- 不涉及数据库 migration、后端部署、Desktop installer 或 update manifest。

## 用户/产品视角的验收步骤

1. 发起不包含“可视化、图表、画图”等关键词、但包含多对象重复字段比较的请求，确认 Agent 主动考虑紧凑表格或其他最小合适媒介。
2. 发起不点名媒介的依赖、层级、状态迁移或时间演进解释请求，确认 Agent 会在 Mermaid 明显降低理解成本时使用聚焦图示；同时观测是否读取 `visualize-output`，但不把提示词层尚未获得的确定性调用保证误报为已完成。
3. 发起单一事实、短解释、一两个简单步骤或文案编辑请求，确认 Agent 保持自然文字，不为了展示能力强行生成视觉表面。
4. 发起明确要求可视化的请求，确认首个工具调用仍先读取 `visualize-output`，既有数据保真、资产路径和内联 HTML 合同不回归。

## 可维护性总结汇总

- 改动复用现有输出提示 owner 和现有定向测试，只重写常驻决策合同，没有新增文件角色、运行时状态、抽象或分支 owner。
- 正向收敛是把“模型自行领会何时更清楚”的隐式期望提升为可执行的信息形态判断，同时把完整制作细节继续留在按需 skill，避免把两层职责混在一起。
- `post-edit-maintainability-guard`：通过，总代码改动 `+33/-1`、非测试代码 `+3/-1`、净增 `+2`；本次属于用户可见能力增强，不适用非功能改动净增不得大于零的门槛。
- 守卫仅报告 provider 目录已有文件数预算例外，数量仍为 14、增量为 0；本次未新增 provider 文件，未扩大结构债务。
- `post-edit-maintainability-review`：通过。展示决策、媒介路由和制作细节分别由现有 provider 与按需 skill 承担，没有新增平行 owner；已明确记录提示词的概率性边界，避免把未实现的确定性能力调用包装成已完成。

## NPM 包发布记录

- `@nextclaw/kernel@0.6.17`：已添加 `.changeset/proactive-visual-presentation.md`，标记 patch，待统一发布。
- `nextclaw` 及其 runtime update channel：本次没有直接包改动或独立 changeset；统一发布时随 kernel 依赖关系评估 runtime update，本轮未发布。
