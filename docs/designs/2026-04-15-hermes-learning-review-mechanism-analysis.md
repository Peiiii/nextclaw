# Hermes 自动复盘与学习机制实现梳理

日期：2026-04-15

相关链接：

1. [Hermes 仓库 `run_agent.py`](https://github.com/NousResearch/hermes-agent/blob/main/run_agent.py)
2. [Hermes `tools/session_search_tool.py`](https://github.com/NousResearch/hermes-agent/blob/main/tools/session_search_tool.py)
3. [Hermes `tools/skill_manager_tool.py`](https://github.com/NousResearch/hermes-agent/blob/main/tools/skill_manager_tool.py)
4. [Hermes `tools/checkpoint_manager.py`](https://github.com/NousResearch/hermes-agent/blob/main/tools/checkpoint_manager.py)
5. [Hermes `agent/prompt_builder.py`](https://github.com/NousResearch/hermes-agent/blob/main/agent/prompt_builder.py)
6. [Hermes 官方 sessions 文档](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/)
7. [Hermes 官方 skills 文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)
8. [Hermes 官方 memory 文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/)
9. [Hermes Learning Loop 页面](https://hermes-agent.ai/features/learning-loop)
10. [Hermes 自我改进博客文章](https://hermes-agent.ai/blog/self-improving-ai-guide)

## 1. 这份文档要回答什么

这份文档只回答一件事：

**Hermes 代码里与“自动复盘 / 自动学习 / 自动沉淀 skill”直接相关的完整机制到底有哪些。**

重点不是官方怎么宣传，而是：

1. 它在代码里到底有没有真正的自动复盘。
2. 复盘是同步做、异步做，还是后台 agent 做。
3. 触发条件到底是什么。
4. 复盘之后写回什么。
5. `session_search`、`skills`、`memory`、`checkpoint` 这些能力在这套闭环里分别扮演什么角色。

本文尽量把“代码事实”和“我的判断”分开写。

## 2. 结论先写在前面

基于当前公开主分支代码，可以明确下结论：

1. Hermes **确实有自动复盘机制**。
2. 这个机制不是一句 prompt 建议，而是 `run_agent.py` 里的真实代码路径。
3. Hermes 的自动复盘不是主 agent 同步顺手做，而是：
   - 主回复先完成并返回给用户
   - 然后后台异步 fork 一个新的 review agent
   - review agent 再去判断是否要写 memory / skill
4. Hermes 的自动学习不是单点，而是一整套闭环：
   - 计数型 trigger / nudge
   - 后台 review agent
   - `memory` / `skill_manage` 写回
   - 下次通过 `skills` 与 `session_search` 复用
5. Hermes 的 `session_search` 不等于 memory，也不直接等于复盘本身；它更像复盘后的跨 session recall 支撑层。
6. Hermes 的 `checkpoint_manager.py` 不是学习复盘，它是文件改动安全快照机制。

一句话概括：

**Hermes 真正的“自动复盘”实现，不是一个模糊的学习 loop 概念，而是“计数触发 + post-response background review + 直接写回 memory/skills”的完整机制。**

## 3. 我实际核对了哪些代码

### 3.1 `run_agent.py`

这是最核心的实现文件，里面有：

1. review trigger 的计数器与默认阈值
2. `_spawn_background_review()` 的后台 review 实现
3. review 何时触发
4. review agent 如何构造
5. review 完成后如何回传摘要

### 3.2 `tools/session_search_tool.py`

这个文件说明 Hermes 的 recall/search 层到底怎么做：

1. 是不是 FTS5
2. 是不是会总结命中 session
3. 是否默认排除当前 session
4. 是否会把 child session 折叠回 parent/root session

### 3.3 `tools/skill_manager_tool.py`

这个文件说明 Hermes 的 skill 写回是不是“真写回”：

1. skill 是否是 agent 可写对象
2. 支持 create / patch / edit 还是只有 create
3. skill 存到哪里
4. 写回后有没有安全扫描

### 3.4 `agent/prompt_builder.py`

这个文件不是复盘执行器，但它决定 Hermes 的前台 prompt 如何鼓励 skill 沉淀与 skill 修补。

### 3.5 `tools/checkpoint_manager.py`

这个文件用来区分另一个容易混淆的概念：

1. “学习复盘 checkpoint”
2. “文件系统安全 snapshot checkpoint”

两者名字类似，但职责完全不同。

## 4. Hermes 自动复盘闭环的完整机制图

从代码看，Hermes 的自动复盘闭环可以拆成 6 个部件：

1. `memory review` 触发器
2. `skill review` 触发器
3. 后台 review agent
4. 写回工具：`memory` / `skill_manage`
5. recall 支撑层：`session_search`
6. 前台 prompt 里的 skill 沉淀与 skill 修补行为约束

它们不是平行散落的，而是串起来的：

```text
主任务运行
  -> 计数器累积
  -> 到阈值
  -> 主回复先完成
  -> 后台 fork review agent
  -> review agent 判断并调用 memory / skill_manage
  -> 写回共享存储
  -> 下次任务通过 skills / session_search / memory 复用
```

## 5. 触发机制：Hermes 到底什么时候开始复盘

### 5.1 memory review：按对话 turn 计数

在 `run_agent.py` 中，Hermes 会维护：

1. `_turns_since_memory`
2. `_memory_nudge_interval`

当前公开主分支里，默认值是：

1. `self._memory_nudge_interval = 10`

代码语义是：

1. 每次进入新的 `run_conversation()`，如果 memory 功能与 memory store 可用，就把 `_turns_since_memory += 1`
2. 当它达到 `_memory_nudge_interval`，就把 `_should_review_memory = True`
3. 然后计数器清零

这说明 memory review 不是“每轮都复盘”，而是 **turn-based periodic nudge**。

### 5.2 skill review：按 tool-calling iterations 计数

Hermes 同时维护：

1. `_iters_since_skill`
2. `_skill_nudge_interval`

当前公开主分支里，默认值是：

1. `self._skill_nudge_interval = 10`

代码语义是：

1. 只要 `skill_manage` 在可用工具集中，每发生一次 tool-calling iteration，就把 `_iters_since_skill += 1`
2. 但 skill review 的真正判断不在 loop 开头，而在本轮任务完成之后
3. 如果本轮结束时 `_iters_since_skill >= _skill_nudge_interval`，且 `skill_manage` 可用，就触发 `_should_review_skills = True`
4. 然后计数器清零

这意味着 Hermes 的 skill 沉淀是 **tool-iteration-based nudge**，不是：

1. 成功一次就存 skill
2. 每个 session 结束都存 skill
3. 每个复杂任务都立即同步存 skill

### 5.3 实际使用 memory / skill_manage 时会清零计数器

代码里还有一个容易忽略但很重要的细节：

1. 当本轮真的调用了 memory 工具时，`_turns_since_memory` 会被清零
2. 当本轮真的调用了 `skill_manage` 时，`_iters_since_skill` 会被清零

这说明 Hermes 的计数器不是单纯的“时间流逝计数器”，而是“距离上次成功写回过了多久”的计数器。

我的判断：

**这比“固定每 N 次就无脑 review”更合理，因为它避免了刚保存完 skill 又立即再 review 一次。**

## 6. 后台 review agent：复盘到底是怎么执行的

### 6.1 复盘不是同步 prompt，而是后台线程

最关键的实现是 `run_agent.py` 的 `_spawn_background_review()`。

它的注释非常直接：

1. `Spawn a background thread to review the conversation for memory/skill saves.`

所以 Hermes 的复盘不是概念上的“思考一下”，而是：

1. 真起一个后台线程
2. 在线程里再建一个 review agent

### 6.2 review agent 是完整 fork 的 `AIAgent`

Hermes 在后台线程里会创建：

1. `review_agent = AIAgent(...)`

构造参数包括：

1. `model=self.model`
2. `provider=self.provider`
3. `platform=self.platform`
4. `max_iterations=8`
5. `quiet_mode=True`

所以这不是一个临时 helper，也不是只跑一个函数，而是一个真正的 agent fork。

### 6.3 review agent 复用主对话快照

它会把当前主对话 `messages_snapshot` 作为 forked conversation，并把 review prompt 追加成下一条 user turn。

也就是说 review agent 的输入不是一段模糊摘要，而是：

1. 真实历史消息快照
2. 明确的 review instruction

### 6.4 review agent 直接写共享 memory / skill store

源码注释也写得很明确：

1. `Writes directly to the shared memory/skill stores.`

这意味着 Hermes 的后台复盘不是“产出建议给主 agent”，而是：

1. review agent 自己调用工具
2. 工具自己落地 memory / skill
3. 主 agent 不再做第二次解释或转换

### 6.5 Hermes 明确避免 review 套娃

review agent 创建后，Hermes 会把：

1. `review_agent._memory_nudge_interval = 0`
2. `review_agent._skill_nudge_interval = 0`

这意味着 review agent 自己不会再触发下一轮自动 review。

我的判断：

**这是 Hermes 这套实现里非常关键的一笔。没有这一步，后台 review 很容易递归失控。**

### 6.6 review 是 best-effort，不阻塞主任务

Hermes 是在主回复完成之后，才去调用 `_spawn_background_review()`。

而且外层是宽松 try/catch，失败只会：

1. debug log
2. 静默吞掉

不会影响主回复，也不会回滚主任务。

所以 Hermes 的设计哲学是：

**复盘重要，但永远不能抢主任务的确定性。**

## 7. review prompt：后台复盘 agent 到底被要求做什么

Hermes 在 `run_agent.py` 里内置了 3 套 prompt：

### 7.1 `_MEMORY_REVIEW_PROMPT`

主要关注：

1. 用户 persona
2. 用户偏好
3. 用户工作方式
4. 用户对 agent 的期望

如果有价值，就存 memory；否则就输出 `Nothing to save.` 并停止。

### 7.2 `_SKILL_REVIEW_PROMPT`

主要关注：

1. 是否用了 non-trivial approach
2. 是否经历了 trial and error
3. 是否因为经验性发现而中途改了方法
4. 用户是否其实期望另一种方法或结果

如果已有相关 skill，就 update；否则 create new skill；没价值就停。

### 7.3 `_COMBINED_REVIEW_PROMPT`

当 memory 与 skill 两个触发同时满足时，会跑 combined review。

这说明 Hermes 的自动复盘不是单一维度，而是：

1. 用户事实沉淀
2. 程序性经验沉淀

二者可以共用同一个后台 review agent。

## 8. 写回能力：Hermes 的 skill 写回到底有多“真”

### 8.1 `skill_manage` 是真实可写工具

`tools/skill_manager_tool.py` 里写得非常明确：

1. `create`
2. `patch`
3. `edit`
4. `delete`
5. `write_file`
6. `remove_file`

所以 Hermes 不是只会“新建 skill”，它还会：

1. 修 skill
2. 补 supporting file
3. 删除不合适的 skill 文件

### 8.2 skill 是程序性记忆，不是一般记忆

这个文件开头就明确写了：

1. `Skills are the agent's procedural memory`

也就是说 Hermes 把：

1. `memory` 定位为广义事实 / persona / preference
2. `skills` 定位为 narrow & actionable 的 procedural knowledge

这和官方文档口径是一致的，也和代码实现保持一致。

### 8.3 skill 写回有安全扫描

Hermes 对 agent-created skills 会跑 `skills_guard`。

这说明在 Hermes 体系里，skill 不是“随便写点笔记”，而是被当成潜在可执行资产看待。

我的判断：

**这意味着 Hermes 的 skill 自动沉淀设计，从第一天开始就假设“skill 是生产对象”，而不是装饰性记忆。**

### 8.4 prompt 层也在强化“任务后沉淀 skill”

`agent/prompt_builder.py` 里能看到这些明确指令：

1. `If a skill has issues, fix it with skill_manage(action='patch').`
2. `After difficult/iterative tasks, offer to save as a skill.`
3. 如果某个 skill 明显相关，必须先 `skill_view(name)` 再按 skill 执行

说明 Hermes 的 skill 学习不是只靠后台 review；前台主 prompt 也在持续强化：

1. 用 skill
2. 修 skill
3. 事后沉淀 skill

## 9. `session_search` 在自动复盘闭环里的角色

`tools/session_search_tool.py` 告诉我们 Hermes 的 recall 层到底怎么做。

### 9.1 它不是 memory

Hermes 明确把 `session_search` 当成 past conversations recall。

### 9.2 它的实现是 FTS5 + focused summarization

代码与注释都很清楚：

1. SQLite FTS5 搜索匹配消息
2. 按 session 聚合
3. 取 top N unique sessions
4. 加载整段 conversation
5. 在命中位置附近截断上下文
6. 交给 Gemini Flash 做 focused summary

### 9.3 空 query 会进入“recent sessions mode”

如果 query 为空，它不会调用 LLM，而只是返回：

1. titles
2. previews
3. timestamps

也就是说 Hermes 的 recall 分成：

1. recent browsing
2. keyword recall with summary

### 9.4 当前 session 默认排除

代码明确写了：

1. `The current session is excluded from results since the agent already has that context.`

### 9.5 child/delegation session 会折叠到 parent/root session

它会沿着 `parent_session_id` 往上 resolve，把 child session 视作同一主会话的内部碎片。

我的判断：

**这一步很重要，因为 Hermes 明确不希望 recall 层被内部 delegation 噪音淹没。**

### 9.6 `session_search` 不是复盘触发器，但它是复盘后的跨 session 复用底座

Hermes 的后台 review 主要看的是当前对话快照，不靠 `session_search` 来复盘当前任务。

`session_search` 真正的作用更像：

1. 下次做类似任务时
2. 从旧 session 里 recall 相关经历
3. 再结合 skills / memory 一起复用

## 10. 另一个“checkpoint”：它不是学习复盘

`tools/checkpoint_manager.py` 很容易让人误会。

它做的是：

1. 在 `write_file` / `patch` / 某些 terminal 操作前
2. 自动给工作目录做 snapshot/checkpoint

它的目标是：

1. 防止文件改坏
2. 便于回滚

而不是：

1. 沉淀 skill
2. 生成 memory
3. 回顾任务方法论

所以 Hermes 至少有两套“checkpoint”语义：

1. 学习语义上的 nudge / review checkpoint
2. 文件安全语义上的 workspace snapshot checkpoint

讨论时一定要分开。

## 11. Hermes 自动复盘的完整实现链路

如果把 Hermes 的机制按执行顺序串起来，最接近真实实现的描述是：

1. 主 agent 正常完成任务。
2. 每轮对话更新 memory turn counter。
3. 每次 tool-calling iteration 更新 skill iteration counter。
4. 如果本轮已经实际调用过 memory / `skill_manage`，对应计数器会被清零。
5. 主回复形成并返回给用户。
6. 如果 `_should_review_memory` 或 `_should_review_skills` 为真：
   - Hermes 在后台线程里 fork 一个 `AIAgent`
   - 给它注入 review prompt
   - 传入当前对话快照
7. review agent 在共享工具和共享存储上执行：
   - 存 memory
   - create / patch / edit skill
8. review 完成后，主侧把成功动作压成简短摘要，通过 callback 或 CLI 提示出来。
9. 下一次任务中，主 agent 再通过：
   - `skills_list / skill_view / skill_manage`
   - `session_search`
   - `memory`
   来复用这些沉淀结果。

## 12. 这套机制里最值得借鉴的部分

### 12.1 最值得抄的，不是“后台线程”四个字，而是这 6 个原则

1. **trigger 计数化**
   不是每次都复盘，而是周期性 checkpoint。

2. **复盘后置**
   主回复先完成，再异步 review，不和主任务抢注意力。

3. **review 执行者独立**
   用 forked agent，而不是一直把主 prompt 塞得越来越胖。

4. **可直接写回**
   review 不是生成建议，而是可直接调用写回工具。

5. **递归熔断**
   review agent 自己禁掉再 review。

6. **recall / memory / skills 分层**
   不把所有东西塞进一个“大记忆系统”。

### 12.2 Hermes 当前代码最核心的两个“产品判断”

1. “学习”是系统默认行为，而不是用户点名才发生。
2. “学习”是 best-effort 的后台增益，而不是阻塞主任务的主链路。

## 13. 对我们借鉴 Hermes 的直接启发

### 13.1 我们已经对齐的部分

目前我们已经有一部分方向和 Hermes 很接近：

1. 我们已经把 `session_search` 单独做成了 recall 层
2. 我们已经在 P0 做了 skill learning loop prompt
3. 我们也明确不想把 search / memory / skills 混成一个东西

### 13.2 我们还缺的关键点

要真正借鉴 Hermes，我们还缺：

1. **review trigger**
   需要有 turn-based / tool-iteration-based nudge，而不是只靠 prompt 自觉。

2. **后台 review 执行器**
   需要一个受控 background agent / child session worker。

3. **review 专用 prompt contract**
   至少要区分：
   - memory review
   - skill review
   - combined review

4. **直接写回路径**
   review agent 需要能 create / patch skill，而不是只产出建议卡片。

5. **递归熔断**
   后台 review 自己不能再触发后台 review。

### 13.3 我们不需要机械照抄的部分

Hermes 代码里有些东西值得参考，但不需要一比一照抄：

1. 默认阈值 `10`
   这是一个实现参数，不是神圣产品真理。

2. 后台 review 一定用 thread
   我们完全可以用现有多 agent / child session 能力承载，而不是必须做 Python thread 风格实现。

3. `session_search` 一定要 LLM summarize
   Hermes 选择了 summary-first；我们现在的 P1 先做 structured hits 是合理的，后面可再决定是否加 summarize。

## 14. 最后的判断

如果只用一句话概括 Hermes 代码里的自动复盘机制，我会写成：

**Hermes 的自动复盘，是一个由计数型 nudge 触发、在主回复后异步启动的 background review agent；它基于当前对话快照，直接调用 memory / skill 写回工具，把经验沉淀成可复用资产，并由 `session_search + skills + memory` 共同构成后续复用闭环。**

这也是我们最值得借鉴的实现思想。

## 15. 下一步讨论建议

基于这份梳理，下一轮讨论建议只回答 4 个问题：

1. 我们要不要先抄 Hermes 的 **trigger + background review**，而不是继续加 prompt 提示。
2. 我们的 background review 承载体，是用现有多 agent / child session，还是单独做后台 worker。
3. 我们第一版只做 `skill review`，还是同时做 `memory review`。
4. 我们是否在现有 `session_search` 之上补一层 summarize，还是先让后台 review 直接基于当前 session 快照工作。

建议顺序：

1. 先做 trigger 设计
2. 再做 background review agent 设计
3. 再决定写回协议和安全边界
4. 最后才讨论是否要扩 recall summarize
