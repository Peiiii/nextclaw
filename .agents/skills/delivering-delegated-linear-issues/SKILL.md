---
name: delivering-delegated-linear-issues
description: "当用户要求从 Linear 领取、处理、批量清空或定时扫描带 `Delegated to Agent` 标签的 issue，讨论默认交付方式、ready PR、本地 master、脏工作区/WIP 安全合入、Agent 状态标签或定时扫描会话归属时使用。"
---

# Linear 委派交付

## 核心合同

把 Linear 标签分成用户意图与 Agent 运行状态两类，禁止混用：

| 标签 | Owner | 含义 | Agent 权限 |
|---|---|---|---|
| `Delegated to Agent` | 用户 | 该 issue 允许由 Agent 自动开发 | 只读；Agent 永不自动添加或删除 |
| `Delivery: Local Master` | 用户 | 显式确认默认的本地 `master` 交付，兼容既有筛选与审计 | 只读；不是本地合入的必需条件，单独存在也不构成开发授权 |
| `Agent: Queued` | Agent | 等待领取或已显式要求重试 | 可替换为下一状态 |
| `Agent: Claimed` | Agent | 某个 Run 已领取并正在处理 | 可替换为下一状态 |
| `Agent: Blocked` | Agent | 本次处理停止，等待输入或环境恢复 | 保持到显式重试 |
| `Agent: Delivered` | Agent | 已完成本轮交付 | 持久保留 |

Linear 原生状态与 `Agent: *` 标签是有意冗余：原生状态服务团队流程，Agent 标签提供稳定、可过滤、可审计的自动化状态。一个 issue 最多只能有一个 `Agent: *` 标签；Agent 第一次写入后不得把状态清空，只能在一次完整标签更新中替换为下一状态，并保留全部其它标签。

下文把用户明确要求 ready PR、禁止本地合并或不得修改本地 `master` 统称为“PR 例外说明”。

- 有 `Delegated to Agent` 且没有相反交付说明：默认在满足全部硬门后 fast-forward 到本地 `master`；不 push、不建 PR。实际 `master` worktree 中存在无关 WIP 不构成开发或合入的当然阻塞，除非已经发现明确冲突、语义重叠、Git 拒绝合入、WIP 无法可靠取证或合入前后 WIP 指纹发生变化。
- 只有存在 PR 例外说明时，才改走 ready PR 路径；PR 不自动 merge。
- 更具体的用户交付说明始终覆盖默认值；若用户既禁止本地合入，也禁止或没有授权 push / PR，且指定方式无法形成受支持的独立交付，必须退回澄清，不得擅自扩权创建 PR。
- `Delivery: Local Master` 只显式强化默认交付意图，缺少该标签不得成为降级到 PR 或拒绝本地合入的理由。
- 所有交付模式都不授权 release、deploy、migration、远程配置/密钥/生产数据修改或其它不可逆外部动作。
- 用户直接点名 issue 并要求处理时，本轮指令可替代 `Delegated to Agent`；除非同时存在 PR 例外说明，否则仍默认交付本地 `master`。Agent 不得替用户补加或删除两个用户标签。
- Linear 保存任务意图、状态和交付记录；仓库与 PR/commit 保存实现结果。本 skill 只编排两者，不复制项目开发规范。
- 实现与验证必须使用 `nextclaw-delivery-workflow`；提交前的 release notes 与迭代记录判断继续遵守项目现有 owner。

## 状态合同

| Linear 状态 | Agent 状态标签 | 含义 | 自动扫描动作 |
|---|---|---|---|
| `Todo` | 无 `Agent: *` 或 `Agent: Queued` | 新委派或显式重试，等待领取 | 有 `Delegated` 时可进入预检 |
| `In Progress` | `Agent: Claimed` | 某个 Run 正在处理 | 跳过 |
| `Todo` | `Agent: Blocked` | 已退回，等待用户补充或显式重试 | 跳过 |
| `In Review` | `Agent: Delivered` | 已交付，等待人工审核 | 跳过 |
| 任意 | 任一非 `Queued` 的 `Agent: *` | 已有 Agent 状态 | 跳过并按恢复规则核对异常组合 |
| `Todo` | 任意，且无 `Delegated` | 未进入自动委派队列 | 跳过 |
| `Done` / `Canceled` / `Duplicate` | 任意 | 已终止 | 永不自动领取 |

`Delivery: Local Master` 不改变领取资格，也不再负责选择交付路径；它是对默认本地交付的可选显式确认。新委派可以暂时没有 Agent 状态；一旦被 Agent 处理，就必须持续保留一个 `Agent: *` 状态。

第一版只允许一个活跃队列执行者，所有 issue 串行处理。批量处理表示清空一次扫描得到的队列快照，不表示并行开发。

## 入口与队列选择

### 人工触发

- 指定 issue：只处理用户点名的 ID。用户要求实现或处理时，该指令构成本轮授权并默认交付本地 `master`；存在 PR 例外说明时改走 PR 路径。两种情况都不改用户标签。
- 用户要求只调查或只给方案时，不扩大到代码交付，也不进入 claim、不改状态或标签，除非用户另有明确要求。
- 批量触发：读取 `Todo + Delegated to Agent +（无 Agent 状态或 Agent: Queued）`；按优先级从高到低、同级从旧到新排序。
- 用户明确说“只处理 Urgent”时再增加 Urgent 过滤；Urgent 表示顺序，不表示授权。
- 用户明确要求重试 `Agent: Blocked` 或重新处理 `Agent: Delivered` issue 时，先核对上一 Run 已停止，再把 Agent 状态替换为 `Agent: Queued`，按新 Run 重新领取。

### 定时触发与会话归属

- 用户只说“定时扫描”“每隔 N 小时扫描”或等价话术时，默认创建绑定当前会话的 thread heartbeat automation，让后续唤醒继续进入当前会话并继承同一任务上下文；不得默认创建每次运行都产生独立会话的 standalone cron automation，也不为这个默认值额外追问。
- 只有用户明确要求“每次新会话”“独立任务运行”或等价语义时，才创建 standalone cron automation。
- 创建或更新自动化后，必须回读确认 automation kind、target thread、周期和启用状态；同一扫描目标已有自动化时优先更新，禁止 heartbeat 与 cron 重复并存。
- 默认团队为 `NextClaw`，只扫描 `Todo + Delegated to Agent +（无 Agent 状态或 Agent: Queued）`。
- 自动化 prompt 可以追加 priority、project、team 或单次最大数量，但不能放宽标签授权门。
- 自动化 prompt 必须保持本 skill 的默认交付合同：除非存在 PR 例外说明，成功后默认尝试 fast-forward 到本地 `master`；`master` 有无关 WIP 时仍继续隔离开发，并按本 skill 的 WIP 取证、重叠审计与合入后校验合同尽量完成本地合入。
- 一次唤醒先冻结 issue ID 快照；处理期间新加入的 issue 留给下一次唤醒。
- 不配置多个重叠定时任务。Linear 普通读写没有可靠的原子租约，第一版不声称支持多执行者竞争。

## 领取前预检

先只读调查，不因描述短就直接退回：

1. 读取 issue 的标题、描述、评论、附件/截图、关系、项目、标签、状态和已有 PR/分支线索。
2. 检查仓库指令、相关代码、历史实现和可复现环境；从证据中补全根因假设与可观察验收条件。
3. 检查 Git 工作区、目标文件是否有用户 WIP、远端/PR 权限以及必需工具是否可用；不得输出 secret。WIP 调查用于决定最终合入是否安全，不得仅因 worktree 不干净而阻止隔离开发。
4. 判断任务能否形成单一、内聚、可验证的交付。
5. 默认按本地 `master` 路径预检：定位实际持有 `master` 的 worktree，冻结当前本地 `master` SHA，并只读记录 staged、unstaged、untracked WIP 的路径与可复核内容指纹。只有存在 PR 例外说明时才跳过这项本地集成预检。不得自动 fetch、pull、stash、reset 或用远端覆盖本地分支。

满足以下条件时直接推进：

- 通过 issue 与仓库调查能够形成单一、可验证的交付目标；
- 剩余不确定性只需要低风险、可逆且符合现有规范的判断；
- 不需要标签授权之外的外部副作用；
- 用户 WIP 可以通过隔离 worktree 完整避开；
- 实际 `master` worktree 即使不干净，也能可靠读取当前分支、HEAD 和 WIP 快照；此时继续隔离开发，把是否可合入留到交付阶段判断。

issue 提到越界动作时，不要因此放弃可独立交付的代码部分。用户明确选择 PR 时可跳过本地 merge、release、deploy 并继续交付 ready PR；默认本地路径只能执行本 skill 明确授权的本地 fast-forward，仍跳过远程合并、push、release、deploy 和 migration。

出现以下情况时退回，不猜测实现：

- 存在两个会实质改变产品结果的方向，证据无法裁决；
- 任务依赖用户未提交且语义重叠的 WIP；
- 缺少仓库、权限、账号、密钥、真实环境或可验证成功的路径；
- 当前交付本身无法形成独立价值，成功只能由未授权动作证明；
- 多个独立目标无法作为一次交付统一验收；
- 默认交付所需的本地 `master` worktree 无法定位，或连当前分支、HEAD、WIP 路径与内容指纹都无法可靠读取；不得擅自降级成 PR 来绕过阻塞。单纯 dirty 不是退回理由。

预检阻塞也要通过领取竞争确定唯一 winner，再由 winner 把 `Agent: Claimed` 替换为 `Agent: Blocked` 并写退回评论，避免每次定时扫描重复报告。

## 领取与幂等

真正开始前生成稳定 Run ID，并重新读取 issue：

1. 确认仍满足 `Todo + Delegated to Agent +（无 Agent 状态或 Agent: Queued）`，或仍属于用户本轮明确点名的 issue。
2. 搜索该 issue ID 对应的活动 claim、分支、commit 和 PR；已有交付时复用或归一化状态，禁止重复创建。活动 claim 是只有领取评论、尚无同 Run ID 的交付/退回评论。
3. 写一条带 Run ID 的领取评论，短暂等待 5 秒后重新读取评论。
4. 若竞争窗口出现多个活动 claim，以 Linear 服务端 `createdAt` 最早者为 winner；时间相同时以 comment ID 字典序最小者为 winner。
5. loser 只追加一条同 Run ID 的领取取消说明并立即退出，不改状态、标签或仓库；无法判定唯一 winner 时所有执行者都停止。
6. winner 把 Agent 状态替换为 `Agent: Claimed`，把 Linear 状态改为 `In Progress`，再回读完整状态、标签集与 claim；无法确认时立即停止，不开始修改仓库。

领取时按“显式例外优先”冻结交付模式：issue 正文、评论或本轮指令存在 PR 例外说明时选择 PR；否则选择本地 `master`。更具体的其它交付说明优先，无法落入受支持路径时退回。`Delivery: Local Master` 的有无不改变这个判断，清晰的当前文字说明优先于该标签；若多个用户说明互相冲突且无法确认当前意图，必须退回而不是猜测。运行中标签变化不得自动改变本 Run 的交付模式；新的用户明确说明必须重新读取并按其权限收窄或重新确认。

领取评论只写可审查事实：

```markdown
### Agent 已领取

- Run：<稳定 ID>
- 目标：<一句话>
- 验收：<可观察条件>
- 交付：<ready PR；不自动合并 | 本地 master fast-forward；不 push、不建 PR>
- 未授权：release / deploy / migration / 生产操作
```

领取取消评论只写：`Run <ID> 领取取消；此任务已由 Run <winner ID> 领取。` 不删除或改写其它执行者的评论。

领取时禁止擅自：

- 创建子 issue、修改父子关系或合并 issue；
- 标记 `Duplicate` / `Canceled`；
- 修改 priority、assignee、issue 正文或用户标签；
- 批量把尚未真正开始的 issue 改成 `In Progress`。

更新标签前先读取并保留完整标签集。Agent 只在 `Agent: Queued / Claimed / Blocked / Delivered` 之间做互斥替换，不得覆盖 `Delegated to Agent`、`Delivery: Local Master`、`Bug`、`Feature` 等用户标签。发现多个 `Agent: *` 标签时先停止并按异常状态处理，不擅自猜测真实状态。

## 隔离开发与验证

1. 保留原工作区全部用户改动，不 stash、reset、checkout、格式化或 stage 无关文件；实际 `master` 是否干净不影响创建隔离 worktree。
2. 每个 issue 使用独立 worktree/分支，分支名包含 Linear issue ID；不复制用户 WIP。
3. PR 路径使用仓库约定基线；本地路径必须从预检冻结的本地 `master` SHA 建分支，不能擅自改用 `origin/master`。
4. 使用 `nextclaw-delivery-workflow` 完成调查、方案门、实现、验证、可维护性复核、changeset 与迭代记录适用性判断。
5. 只提交当前 issue 的文件；提交信息使用英文。委派授权 commit；只有 PR 路径授权推送交付分支和创建 PR。
6. 完成项目规则要求的最小充分验证和用户可见行为验收。仅有 tsc/lint/单测时，不得把功能写成“已验证”。
7. 发现邻近问题时只记录，不顺手扩 scope。若它阻塞当前交付，按阻塞流程退回；否则在最终评论列为后续项。

## PR 交付路径（显式例外）

1. 只有存在 PR 例外说明并且验证闭环后，才创建 ready PR；不把本地合入阻塞擅自降级为 PR，也不为无法验收的半成品自动创建 draft PR。
2. 创建 PR 前再次确认 issue 仍为 `In Progress + Agent: Claimed`，本轮委派授权仍有效，且不存在同 issue 的现有 PR。
3. 创建 ready PR 后按“成功收尾”回写 Linear。禁止自动 merge、release 或 deploy。

## 本地 master 交付路径

本地合入是委派实现成功后的默认受控交付路径，不依赖 `Delivery: Local Master` 标签，但绝不是绕过验证的“随手 merge”。原则是“默认尝试合入，只有明确问题才阻塞”：dirty 本身不是问题，能举证的冲突、语义重叠、Git 拒绝、无法形成可靠 WIP 指纹或 WIP 指纹变化才是问题。必须按以下顺序执行：

1. 交付分支已精确提交，完整必跑验证和功能验收通过。
2. 合并前重读 Linear，确认 issue 仍为 `In Progress + Delegated to Agent + Agent: Claimed`，且没有 PR 例外说明；人工直接授权的等价条件必须仍有效。
3. 比较当前本地 `master` SHA 与冻结 SHA：
   - 未变化：继续；
   - 已前进且交付分支可无冲突更新：在隔离 worktree 将未推送的交付分支更新到最新本地 `master`，并重新运行全部必跑验证；
   - 出现冲突、回退、分叉或来源不明：停止，不猜测解决。
4. 基于最新本地 `master` 重新计算交付 commit 的改动路径，并与实际 `master` worktree 的 staged、unstaged、untracked 路径做双向重叠审计；同时检查是否有证据表明不同路径修改了同一配置、生成物、状态 owner 或运行语义。只有发现实际路径重叠或有具体证据的语义重叠时才阻塞；不能因为“可能有风险”或 worktree dirty 就提前放弃合入。
5. 紧邻合入前记录可复核的 WIP 指纹：
   - staged WIP 记录路径、文件模式与 index blob；
   - unstaged 和 untracked WIP 记录路径、文件类型/模式与内容哈希；
   - 对目录、删除、重命名、子模块、符号链接或无法稳定哈希的条目使用等价的内容身份快照；
   - 指纹必须描述用户内容本身，不能只保存依赖当前 HEAD 的 diff 文本。
6. 没有上述明确问题时，即使 worktree dirty，也在实际 `master` worktree 尝试且只尝试 `git merge --ff-only <delivery-branch>`。Git 因本地改动、未跟踪文件或其它安全检查拒绝时，立即停止合入并保留分支/commit；禁止自动 stash、reset、checkout、强制更新分支、merge commit、squash、rebase `master`、push 或修改远程 `master`。
7. 合入成功后立即确认：本地 `master` 精确指向交付 commit；合入前已有的 staged、unstaged、untracked WIP 路径、内容身份和 staged/unstaged 属性完全未变；没有新增来源不明的工作区变化。校验不能只看 `git status` 是否仍为 dirty。
8. 在该交付 commit 新建或复用一个干净的隔离 worktree，运行最贴近真实行为的合并后 smoke；不得在带用户 WIP 的实际 `master` worktree 中用 smoke 结果证明交付正确。

若路径/语义重叠、Git 拒绝 fast-forward 或合入前无法取得可靠 WIP 指纹，只阻塞“合入”：已完成验证的交付分支和 commit 必须保留并写入退回评论，不能把已经完成的开发抹掉，也不得擅自降级成 PR。此类 issue 特定阻塞按退回流程处理后继续队列快照中的下一个。

若合入后发现 WIP 指纹变化，或合并后 smoke 失败，属于已经修改本地 `master` 后的高风险异常：禁止 reset、stash、强推或隐瞒状态。先停止整个批次并记录合入前后指纹、当前 `master` commit 与人工恢复要求；只有能够证明不触碰用户 WIP 的向前修复才可继续，否则把 Agent 状态替换为 `Agent: Blocked` 并保留 `In Progress`。

## 成功收尾

成功必须同时满足：

- PR 路径：ready PR 已创建且只包含当前 issue；
- 本地路径：本地 `master` 已 fast-forward 到交付 commit，合入前既有 WIP 的内容与 staged/unstaged 属性未变，合并后 smoke 通过，未 push、未建 PR；
- 必跑验证通过，功能证据与剩余风险已经明确；
- Linear 最终评论、状态和标签都已回读确认。

按以下顺序收尾：

1. 写交付评论；
2. 将状态改为 `In Review`；
3. 把 `Agent: Claimed` 替换为 `Agent: Delivered`，保留 `Delegated to Agent`、`Delivery: Local Master` 及其它全部用户标签；
4. 重新读取 issue，确认三项都成功。任一失败时不得宣称完整交付。

```markdown
### Agent 交付完成

- Run：<稳定 ID>
- 结果：<用户可观察结果>
- 交付：<PR URL | 本地 master>
- Commit：<SHA>
- 修改：<主要范围>
- 验证：<命令与结果>
- 功能验收：<真实场景与结果>
- 剩余风险：<无或明确列表>
- 未执行：<merge / push / PR / release / deploy / migration 中的适用项>
```

永不自动标记 `Done`。`Done` 表示人工审核、远程合并或团队约定的后续闭环已经完成。

## 阻塞与失败

任务特定阻塞不终止整个批次；先安全退回当前 issue，再继续下一个。Linear/GitHub 授权失效、仓库不可用、本地 `master` 合入后异常或同类系统性故障应停止整个批次，避免重复污染。

合入本地 `master` 之前退回时，包括开发已完成但合入被明确问题阻塞的情况：

1. 不创建 ready PR，不修改本地 `master`；若已有验证通过的分支/commit则保留并写入评论；
2. 写清已确认事实、阻塞原因和最小所需输入；
3. 将状态恢复为 `Todo`；
4. 把 `Agent: Claimed` 替换为 `Agent: Blocked`，且不修改任何用户标签；
5. 回读确认。用户补充后可把 Agent 状态改为 `Agent: Queued`，或直接指令新 Run 重试。

```markdown
### Agent 已退回

- Run：<稳定 ID>
- 已确认：<事实与证据>
- 阻塞：<无法安全继续的原因>
- 需要：<一个最小决策、信息或权限>
- 已保留：<分支/commit 或无>
- 重试：改为 `Agent: Queued`，或直接要求 Agent 重试
- 未执行：<代码、PR、本地合入、发布等>
```

不要只写“信息不足”。先主动调查并说明证据；只有调查后仍存在实质分歧才退回。

若用户在运行中移除 `Delegated to Agent`，视为撤销自动执行授权：停止新增仓库副作用，写取消事实，将 Linear 状态恢复为 `Todo`，并把 `Agent: Claimed` 替换为 `Agent: Blocked`；不得重新添加用户标签，也不得留下空白 Agent 状态。

## 恢复与异常状态

- 正常扫描只领取无 Agent 状态或 `Agent: Queued` 的 issue；`Blocked / Delivered / Claimed` 都必须跳过。
- `In Progress + Agent: Claimed` 表示可能仍有 Run 活跃；不根据时间自行宣布 lease 过期，也不让第二个 Agent 抢占。
- 发现遗留项时，先检查同 Run ID 的评论、分支、commit、PR 和本地 `master`：已有完整交付则归一化为 `In Review + Agent: Delivered`；明确已退回则归一化为 `Todo + Agent: Blocked`；状态不明则只报告，不重跑或重置。
- 若提交、push、PR、合入或评论只完成一部分，先从 Git/PR/Linear 的真实状态恢复，不重复创建任何交付物。
- Agent 状态只由 winner 迁移；loser 和普通扫描不得删除、替换或叠加状态标签。

## 红旗

- “`Delegated to Agent` 是队列锁，完成或失败后应该删掉。”——错误，它是用户标签，Agent 永不自动修改。
- “claim 结束后直接清掉 Agent 标签最干净。”——错误，Agent 状态必须持久化为 `Blocked` 或 `Delivered`，不能回到无状态。
- “没有 `Delivery: Local Master` 就只能建 PR。”——错误；有效委派默认交付本地 `master`，该标签只是可选的显式确认。
- “默认本地合入意味着可以忽略用户要求 PR。”——错误；ready PR、禁止合并或不得修改本地 `master` 等明确说明优先，冲突不明时必须退回。
- “用户只说不要合并，所以一定可以 push 并建 PR。”——错误；更具体的禁止项和交付范围优先，未授权的外部副作用不得自行补全。
- “本地合入等同于授权 push 或远程 merge。”——错误，本地路径默认不触碰远程。
- “master dirty，所以不能领取、开发或尝试合入。”——错误；必须先隔离开发，再审计实际重叠并记录 WIP 指纹；没有明确问题时仍应尝试 `--ff-only` 合入。
- “为了尽量合入，可以自动 stash、reset、checkout 或强制更新 master。”——错误；尽量合入不能以改变用户现场为代价，Git 拒绝或指纹异常时必须停止。
- “测试通过就可以 Done。”——错误，交付状态是 `In Review`。
- “批量最快的方式是并行多个 Agent。”——错误，第一版固定串行。
- “描述只有一句，直接退回最安全。”——错误，必须先调查和尝试形成验收条件。
- “更新标签时直接写目标标签数组。”——错误，必须保留完整标签集，且只互斥替换 Agent 状态标签。
- “用户说每小时扫描，所以默认建独立 cron。”——错误；除非用户明确要求每次新会话，否则必须绑定当前会话。

## 第一版非目标

- 多执行者租约、并发 worktree 或自动抢占恢复；
- 自动拆分/合并 issue、修改优先级、负责人或用户标签；
- 自动 push/merge 远程 `master`、release、deploy、migration 或生产操作；
- 在存在明确路径/语义重叠、冲突、分叉、Git 拒绝、WIP 无法可靠取证或合入后 WIP 指纹变化的本地 `master` 上强制集成；
- 用 Linear 替代仓库已有开发、验证、提交和发布 owner。
