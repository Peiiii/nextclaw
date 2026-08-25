# NextClaw 发布命令语义与快速完成点设计

## 文档状态

- 日期：2026-08-14
- 状态：已按新版 development skill 体系本地落地并完成定向验证，尚未执行真实发布
- 范围：项目 AI 元命令、自然语言路由、NPM / runtime / desktop 发布边界、阶段完成反馈与恢复语义
- 已实施：中文命令、自然语言合同、专项 skill 边界、确定性脚本入口、NPM 优先顺序、release plan、支持包缓存和安全的构建复用
- 本轮未执行：不修改版本，不写 registry、runtime channel、GitHub Release、desktop channel、官网、文档站或 X

## 一、结论

用户不需要理解 Changesets、dist-tag、runtime channel、GitHub Release、desktop installer 或仓库脚本。项目提供五个中文元命令，用户只说发布目标，AI 自动选择最小且语义完整的流程：

```text
/发布NPM
/发布NPM测试版
/发布NextClaw正式版
/发布NextClaw桌面版
/发布NextClaw全平台版
```

其中：

- `/发布NPM` 只承诺 NPM stable 包尽快可安装，不被 runtime、release notes、官网、文档站、X 或 desktop 阻塞。
- `/发布NextClaw正式版` 是常规产品正式版，先达到 NPM 可用，再继续 stable runtime 与适用的发布材料；明确不包含 desktop。
- `/发布NextClaw桌面版` 只发布桌面安装包和桌面更新通道，默认消费已经存在的 NextClaw stable 版本，不重复发布 NPM。
- `/发布NextClaw全平台版` 才依次闭合常规正式版与 desktop。

中文命令是用户意图入口，不直接复制为 shell 命令。确定性执行仍由仓库脚本负责，发布合同仍由现有专项 skill owner 负责，不新增平行发布 skill。

## 二、用户任务与成功标准

### 2.1 用户任务

用户从项目会话输入一个名字直观的中文命令，不需要补充“是否包含桌面、是否包含 runtime、是否准备宣传材料”等说明，就能得到稳定、可预测的发布范围和分阶段结果。

### 2.2 成功标准

1. 同一个中文命令在不同 AI 和不同会话中具有相同发布对象、渠道与完成条件。
2. `/发布NPM` 的不可逆 publish 尽可能早发生；不影响 NPM artifact 正确性与可安装性的事项不得前置阻塞。
3. `/发布NextClaw正式版` 不会隐式发布 desktop。
4. 完整流程在 NPM 已可用时立即报告 `NPM_READY`，不等待所有下游表面完成后才第一次反馈。
5. 后续 runtime、文档、X 或 desktop 失败时，保留并报告已经成立的完成点，不重复发布 NPM。
6. 自然语言与中文命令等价，用户不需要记英文脚本或参数。

## 三、统一语义模型

发布意图由三个维度组成：

| 维度 | 可选值 | 说明 |
| --- | --- | --- |
| 发布对象 | NPM、NextClaw 常规产品、Desktop、全平台 | 决定发布哪些表面 |
| 渠道 | stable、beta | 决定 dist-tag 与更新通道；未说明时中文正式命令默认 stable |
| 完成点 | NPM_READY、NEXTCLAW_STABLE_READY、DESKTOP_READY、ALL_PLATFORMS_READY | 决定何时可以如实报告什么结果 |

解析优先级固定为：

```text
明确限制词（只、仅、不包含）
→ 明确中文命令
→ 发布对象
→ 渠道
→ 当前会话中的最近发布对象
→ 最小外部影响原则
```

AI 不根据“这是一次大更新”自行加入 desktop，也不根据代码触达了 desktop 相关依赖就扩大授权。desktop 只由明确的桌面命令，或包含“桌面版、安装包、DMG、EXE、AppImage、全平台”等清晰自然语言触发。

## 四、中文命令合同

### 4.1 `/发布NPM`

固定语义：

> 将当前待发布的公开 NPM 包发布到 stable / latest，验证 registry 可见和精确版本冷安装，并闭合必要的 Git 版本记录；不发布 runtime、desktop，也不准备官网、文档站或 X 材料。

允许阻塞 NPM publish 的事项只有：

- 发布范围和目标版本可确定。
- NPM 身份与目标 registry 正确。
- workspace 公共依赖闭包与发布顺序正确。
- 实际 tarball 构建成功，`workspace:*` 被正确转换。
- `nextclaw` 包内 launcher、app entry、embedded UI、公钥等关键产物存在。
- 与本次 artifact 直接相关的 build、类型、测试、lint 证据有效；不存在未验证的高风险触达。
- 隔离 worktree 或精确暂存能证明无关 WIP 未进入发布。

不得阻塞 NPM publish 的事项：

- 完整 release notes、文档站、官网和 X。
- stable runtime 四平台 workflow、公开 manifest 和旧版本升级验证。
- desktop installer / update channel。
- 最终传播材料与完整产品发布总结。

完成条件：

- 目标包与版本已在 registry 可见。
- `latest` 指向预期 `nextclaw` stable 版本。
- 从公开 registry 精确冷安装目标 `nextclaw@<version>` 成功，关键入口与资源存在。
- version / changelog / release commit / package tags 已形成可回流的 Git 事实；若因并行 WIP 暂不能回流，必须把“registry 已发布”和“分支尚未闭合”分开报告。

完成状态：`NPM_READY`。

### 4.2 `/发布NPM测试版`

固定语义：

> 将当前待发布 NPM 包发布到 beta dist-tag，验证 `nextclaw@beta` 可安装；不触发 beta runtime channel、desktop 或正式版发布材料。

完成状态仍为 `NPM_READY`，但反馈中必须同时显示 `channel: beta`，不能称为正式版。

### 4.3 `/发布NextClaw正式版`

固定语义：

> 发布 NextClaw 常规 stable 产品版本：先完成 NPM stable，再继续 stable runtime、GitHub Release、结构化 release notes、适用的文档/官网更新与发布传播；明确不包含 desktop。

主链路：

```text
NPM 最小安全门禁
→ NPM publish / registry verify / cold install
→ 立即报告 NPM_READY
→ 准备或补齐 runtime 所需结构化 release notes
→ stable runtime 四平台 workflow / public manifests
→ 旧 NPM 版本 check / download-only / apply / 新进程验证
→ 完成适用于本版本级别的文档、官网和 X 合同
→ 报告 NEXTCLAW_STABLE_READY
```

约束：

- release notes、docs、website、X 不再前置阻塞 `NPM_READY`。
- 结构化 release notes 仍可阻塞 runtime channel，因为 stable manifest 与 GitHub Release 需要真实 URL。
- minor / major 是否要求文档、官网和 X，由常规产品发布合同决定；它们影响 `NEXTCLAW_STABLE_READY`，不影响已经成立的 `NPM_READY`。
- 任一下游失败均从失败阶段恢复，不重新 publish 已存在的 NPM 版本。

完成状态：`NEXTCLAW_STABLE_READY`。

### 4.4 `/发布NextClaw桌面版`

固定语义：

> 基于已发布且明确选择的 NextClaw stable runtime，发布桌面安装包、portable 产物和桌面更新通道；不发布或重发 NPM。

约束：

- 默认使用当前最新且已经验证的 NextClaw stable 版本；如果工作区源码比该版本更新，不自动把未发布源码混入 desktop。
- 需要包含尚未发布的 runtime 变更时，先停止并说明应执行 `/发布NextClaw正式版` 或 `/发布NextClaw全平台版`。
- desktop 的平台矩阵、签名、installer、DMG、Windows/Linux 产物、manifest、APT 与真实冒烟继续由 desktop 专项 owner 负责。
- 桌面发布频率独立于 NPM/runtime；普通正式版完成后不自动询问或继续桌面发布。

完成状态：`DESKTOP_READY`。

### 4.5 `/发布NextClaw全平台版`

固定语义：

> 从远程 `master` 单次 dispatch GitHub Actions `release.yml target=all`；父 workflow 依次完成常规 stable 与同一 identity 的 Desktop，不由 AI 或本地命令编排阶段。

阶段反馈：

```text
NPM_READY
→ NEXTCLAW_STABLE_READY
→ DESKTOP_READY
→ ALL_PLATFORMS_READY
```

如果 desktop 失败，常规正式版状态不回退；最终报告必须写成“NextClaw stable 已完成，desktop 未完成”，不能笼统宣称整个发布失败或重复前序阶段。

GitHub Actions 是全平台状态机 owner：Delivery 只触发并监控父 run；failed-job rerun 从未完成阶段恢复，完整重跑也必须复用已成立的 NPM/runtime identity。

## 五、自然语言等价表达

| 用户表达 | 等价命令 |
| --- | --- |
| “发 NPM”“发布一个 NPM 正式版本”“把这些包发到 latest” | `/发布NPM` |
| “发 NPM beta”“先发一个 NPM 测试版” | `/发布NPM测试版` |
| “发布 NextClaw 正式版”“发一个常规稳定版”“完整发布但不要桌面” | `/发布NextClaw正式版` |
| “发布桌面端”“发安装包”“更新 DMG / EXE / AppImage” | `/发布NextClaw桌面版` |
| “全平台发布”“NPM、runtime 和桌面全部发” | `/发布NextClaw全平台版` |

“发布一下”“发个版本”且当前上下文没有明确对象时，AI 只问一个短问题：

> 这次要发布 NPM、NextClaw 常规正式版，还是桌面版？

上下文足够时不重复确认，但执行前必须用一句话复述范围。例如：

> 我按 `/发布NextClaw正式版` 处理：包含 NPM 和 stable runtime，不包含桌面安装包；NPM 可安装后会先报告，再继续后续闭环。

## 六、反馈与可观察性合同

发布开始时先输出一份紧凑计划：

```text
命令：/发布NPM
对象：NPM stable
预计发布包：6
验证闭包：36 workspace packages
不包含：runtime、desktop、docs、website、X
当前阶段：准备 NPM artifact
```

每个阶段输出开始、完成、耗时与剩余阶段；不向会话倾倒完整 build / lint 日志。必须区分：

- 版本变化包数量。
- 实际 NPM 上传包数量。
- 为构建依赖闭包而验证的 workspace 包数量。

不能再用一个模糊的“24 packages”同时代表三种事实。

标准完成反馈：

```text
NPM_READY
nextclaw@0.34.0 已发布到 latest，registry 可见，精确版本冷安装通过。
不包含：stable runtime、desktop、docs、website、X。
```

完整产品发布在 `NPM_READY` 时立即产生阶段性反馈并继续工作；最终回复必须再次汇总所有完成点，用户不需要依赖被折叠的中间 commentary。

## 七、Owner 与入口边界

| Owner | 未来负责 | 不负责 |
| --- | --- | --- |
| `commands/commands.md` | 五个中文元命令的用户语义、输入和期望行为 | 复制完整发布流程 |
| `development-delivery` | 识别外部写入授权、路由到发布专项 owner、交付反馈 | NPM/runtime/desktop 具体合同 |
| NextClaw NPM release 专项 skill | NPM、runtime channel、registry、安装验证、恢复与分支闭合 | desktop 构建合同、营销内容写作 |
| NextClaw desktop release 专项 skill | desktop installer、签名、平台矩阵、desktop channel | NPM package publish |
| NextClaw release notes 专项 skill | 结构化 release notes、版本页面和传播材料 | 阻塞 NPM artifact publish |
| `scripts/release/*` | 确定性计划、验证缓存、publish、checkpoint、resume | 猜测用户意图 |

不新增中文命令专属 skill，不让 commands 直接并行触发多个专项 skill。`development-delivery` 只按当前阶段路由一个 owner：常规正式版先进入 NPM owner，到 desktop 阶段再进入 desktop owner。

## 八、脚本入口建议

中文元命令与底层脚本建议形成以下映射：

| 中文命令 | 建议确定性入口 |
| --- | --- |
| `/发布NPM` | `pnpm release:npm:stable` |
| `/发布NPM测试版` | `pnpm release:npm:beta` |
| `/发布NextClaw正式版` | `pnpm release:product:stable` |
| `/发布NextClaw桌面版` | 既有 desktop stable owner 入口 |
| `/发布NextClaw全平台版` | 产品 stable 完成后再调用 desktop stable owner |

兼容原则：

- 现有英文元命令和 `release:stable` 等脚本暂时保留，但文档明确其范围；不做静默语义翻转。
- 新入口优先组合、复用现有内部阶段函数，不复制 publish 实现。
- 待调用方和文档完成迁移后，再单独评估是否删除容易误解的旧入口。

## 九、NPM 优先的执行调整

未来实现 `/发布NPM` 时应同时解决当前重复耗时：

1. 增加 release plan，直接展示版本变化、实际上传、验证闭包、缓存命中、缺失门禁和阶段预计成本。
2. 将发布支持依赖的 build fingerprint 缓存与“会被 tag/publish 的 package checkpoint”分离，避免第二轮重复构建 30 个支持包。
3. 严格检查通过后复用产物；`prepack` 对可复用 artifact 做完整性验证，不机械重建相同输入。
4. 将 release notes / surface review 门禁从 packages 阶段移动到 runtime / product closure 阶段。
5. 在常规正式版中，runtime workflow 与不依赖 runtime 的新 NPM 精确安装验证可以并行；旧版本升级验证仍等待 runtime channel 生效。
6. 所有不可逆阶段写 checkpoint；恢复命令从最近未完成阶段继续，禁止重复 publish。

这些优化不能通过减少 artifact 正确性检查来换速度。首先消除不相关前置门禁、重复工作和无反馈等待。

## 十、状态、失败与恢复

| 已成立状态 | 后续失败 | 对用户的真实结论 | 恢复入口 |
| --- | --- | --- | --- |
| 尚无 | NPM 前置门禁失败 | 未发布任何包 | 修复后重跑当前命令 |
| NPM_READY | runtime / notes / docs / X 失败 | NPM 已发布；常规正式版未闭合 | 从对应 product 阶段继续 |
| NEXTCLAW_STABLE_READY | desktop 失败 | 常规正式版已完成；桌面版未完成 | 只恢复 desktop |
| DESKTOP_READY | 无对应 NPM 变化 | 桌面版已完成；没有发布 NPM | 不补做 NPM |

不存在自动回滚 NPM 版本，也不存在用同版本覆盖错误 tarball。NPM publish 后发现问题时，只能修复并发布新版本；因此 artifact 直接相关门禁必须在 publish 前保留。

## 十一、权限与授权边界

五个中文命令都是明确的外部写入授权，但授权只覆盖命令定义的发布表面：

- `/发布NPM` 不授权 runtime、desktop、官网、文档或 X 写入。
- `/发布NextClaw正式版` 不授权 desktop。
- `/发布NextClaw桌面版` 不授权 NPM publish。
- `/发布NextClaw全平台版` 授权常规正式版与 desktop 的合同内写入。

命令不扩大到与发布无关的代码修复。发布门禁发现需要修改源码时，先报告问题并回到开发生命周期；不能为了“完成发布”静默改功能。

## 十二、实施结果

1. `commands/commands.md` 已增加五个中文命令，并把自然语言等价、包含项、排除项和完成点写入统一入口。
2. `development-delivery`、`nextclaw-npm-release` 与 `nextclaw-desktop-release` 已按新版 development lifecycle 对齐；没有新增平行发布 skill。
3. 根脚本已增加 `release:npm:stable`、`release:npm:beta`、`release:product:stable`；旧英文入口继续兼容。
4. Stable package 阶段只检查 NPM artifact 门禁；结构化 release notes 和 surface review 已移到 runtime/product 阶段。
5. Stable dry-run 已分别显示版本变化包、实际上传包、验证闭包和支持包；当前真实计划输出为 `24 / 6 / 36 / 30`。
6. Validation support package build 已存入独立 checkpoint section，可以复用 fingerprint 成功结果，但不会进入 package tag/publish 集合。
7. `release:publish:validated` 只在 checkpoint 证明 build 通过、且所有被忽略 lifecycle hook 符合已审计合同时复用构建；自定义 hook fail closed。
8. Stable product 在 runtime/materials 前完成精确 registry 冷安装并输出 `NPM_READY`；runtime 后只执行旧版本升级验证。Beta NPM-only 也增加真实 `nextclaw@beta` 安装。
9. Desktop stable/beta 在入口验证对应 NPM dist-tag 已存在，计划明确 `npmPublish=excluded`，完成后输出 desktop 状态。
10. 出于发布安全，本次没有把 runtime workflow 与冷安装改为并行：冷安装是 `NPM_READY` 的门禁，先完成它再进入 product runtime，状态和恢复边界更清晰。后续如需继续压缩完整产品总耗时，可在不改变完成点的前提下单独设计并行执行。

## 十三、验证标准

### 13.1 命令与路由

- 五个中文命令都能唯一映射到一个发布对象和完成点。
- `/发布NextClaw正式版` 的计划明确显示 `desktop: excluded`。
- `/发布NextClaw桌面版` 的计划明确显示 `npm publish: excluded`。
- 自然语言等价表达与命令产生同一 release plan。

### 13.2 NPM 优先

- product stable dry-run 中，release notes / website / X 缺失不会阻止 packages 阶段达到可执行状态，但会在对应后续阶段显示为未满足。
- NPM artifact 的身份、依赖、tarball 和冷安装门禁仍会阻止 publish。
- `NPM_READY` 产生后，后续失败不会重新执行 package publish。

### 13.3 范围隔离

- 脏主工作区通过隔离 worktree 发布，不包含无关 staged / unstaged / untracked 文件。
- 中文命令不会跨越自身授权边界调用 runtime、desktop 或传播写入。
- 现有英文 recovery 命令仍能恢复历史 checkpoint。

### 13.4 治理

- `commands/commands.md`、AGENTS 命令路由、专项 skill、references、scripts 和 tests 只有一个事实 owner。
- `pnpm check:skill-progressive-loading` 与适用治理检查通过。
- 无新增循环 skill 路由或把完整流程复制到常驻 AGENTS。

## 十四、明确非目标

- 本次实现不执行 `0.34.0` 或任何真实发布。
- 本设计不决定下一次 desktop 的具体版本或时间。
- 本设计不删除现有英文命令。
- 本设计不降低 NPM artifact 的不可逆发布门禁。
- 本设计不要求每次常规正式版都发布 desktop。
- 实现基于已经合入的新版 development skill 体系；没有覆盖同时存在的产品源码和 `ui-dist` 工作区改动。

## 十五、方案自审

- [x] 用户可以用一个名称直观的中文命令表达清晰发布意图。
- [x] NPM 包发布与完整产品发布已经拆成不同完成点。
- [x] 不影响 NPM artifact 的材料不再前置阻塞 NPM。
- [x] 常规 NextClaw 正式版明确排除低频 desktop 发布。
- [x] 全平台版显式组合常规正式版和 desktop，不隐式扩大授权。
- [x] 下游失败保留已经成立的状态，并从失败阶段恢复。
- [x] 命令、skill 与脚本职责分离，不新增第二套发布实现。
- [x] 已明确等待并行 skill 体系改造完成后再实施和重新核对路径。
- [x] 新旧入口、dry-run、缓存、lifecycle 安全门和治理检查已形成本地证据；真实外部发布仍需用户单独发出发布命令。
