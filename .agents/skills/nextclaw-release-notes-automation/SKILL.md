---
name: nextclaw-release-notes-automation
description: 当用户要求提交、收尾、统一 NPM 发布、GitHub release、changelog、release notes、版本更新说明、产品更新笔记、X/社交媒体发布帖、变更汇总，或担心并行会话导致发布内容靠记忆整理时使用。适用于需要进入用户可见发布说明的 NextClaw workspace 包变更、Changesets 聚合、AI 撰写版本更新笔记、可拉取结构化 release notes JSON、minor 及以上版本宣发帖，以及 update manifest releaseNotesUrl 闭环。
---

# NextClaw Release Notes Automation

## 目标

只把用户需要感知的产品变更写进发布说明。发布时直接收集这些发布说明片段，不靠记忆回忆。

本 skill 维护两层发布说明合同：

- 需要进入最终 changelog 的用户可见变更：添加 `.changeset/*.md`
- 不需要进入最终 changelog 的内部变更：不添加任何发布说明片段
- 面向最终用户的版本更新说明：发布时由 AI 基于 `.changeset`、commit 区间和必要 `docs/logs` 证据手写产品更新笔记，不能只机械拼接 changeset
- 面向产品更新提示的结构化版本说明：发布时同步生成可拉取 JSON，供更新 UI 在用户更新前展示本版本内容
- 面向版本更新笔记的需求级视觉证据：在对应 changeset 中绑定本地化源截图，发布时自动发现和校验，不靠发布当天搜索文件

## 提交/收尾时

在 `/commit`、`/close-task`、用户说“提交吧/收尾/完成”时，先判断本次 staged 范围是否包含用户需要感知的产品变更。

脏工作区提交必须做双向范围审计：既检查 staged 中没有混入无关改动，也要把本轮需求及 follow-up、相关 changeset / 迭代记录与未暂存的语义 diff（必要时使用 `git diff -w`）对照，确认同批生产代码、测试、运行时 skill 资源和收尾记录没有遗漏。还要将本次触达文件与未暂存文件求交集；即使只剩格式差异，也必须明确提交、保留或在获得授权后恢复，不能把“无语义差异”表述成“无相关改动”。不能只因 staged diff 自洽就判定提交范围已经闭合。

需要添加 `.changeset/*.md` 的典型情况：

- 新增或改变用户可见功能
- 修复用户会遇到的 bug
- 改变安装态、运行态、CLI、UI、agent 行为或公共 API
- 改变发布包内用户会使用或依赖的内容

不需要添加 `.changeset/*.md` 的典型情况：

- 只改 `AGENTS.md`、`.agents/skills`、内部治理规则
- 只改 `docs/logs`、`docs/thoughts`、`docs/plans`、内部设计文档
- 只补测试、lint、工程治理，不改变产品行为
- 纯内部重构且用户可见行为不变

判断规则：

- 如果用户最终看 changelog 时会觉得“这和我使用产品有关”，就写 changeset。
- 如果用户看了也没有意义，就不写。
- 不要为“不需要进入 changelog”的变更创建额外记录。

### 需求级配图证据

如果本次用户可见变更已经产出适合作为版本更新说明证据的正式截图，必须把截图与同一需求的 changeset 绑定。每个语言版本使用一条不可见指令：

```md
<!-- release-note-image: zh-CN | images/screenshots/<asset-cn>.png | 中文替代文本 -->
<!-- release-note-image: en-US | images/screenshots/<asset-en>.png | English alt text -->
```

- 指令必须放在 changeset 正文中；不要另建平行清单，也不要依赖文件名猜测所属需求。
- 路径必须是仓库相对路径，源文件必须位于 `images/screenshots/`，支持 PNG、JPEG 和 WebP。
- 替代文本直接描述用户看到的产品结果，不写“宣传图”“截图如下”或内部方案话术。
- 没有合格截图时不写空指令；截图是候选证据，不是所有 changeset 的必填项。
- 提交或收尾前运行 `pnpm release:summary -- --json`，确保已声明素材存在、格式合法且可被未来发布流程发现。

## 发布时

在 `/release-beta`、`/release-beta-npm`、稳定 NPM 发布、GitHub release 或用户要求“生成本次 changelog/汇总更新内容”时：

1. 运行 `pnpm release:summary -- --json`，读取未发布 changeset、受影响 packages、semver bump、用户可读摘要和需求级本地化截图；命令报错时先修复素材合同，不得继续版本化。
2. 以聚合结果作为写作和配图底稿；必要时再读取 commit 区间与对应 `docs/logs` 补充证据，不能用临时全仓搜索替代 changeset 关联。
3. 判断是否需要用户可见版本更新笔记：
   - 只要本批包含用户会感知的产品变化，并且发布结果会进入用户安装、自动更新、GitHub release、官网/docs 或 update manifest，就必须生成或更新版本更新笔记。
   - 稳定 NPM minor 发布是强制项：只要 `nextclaw` 的稳定版本从 `0.x.y` 升到下一个 minor（例如 `0.22.x -> 0.23.0`），发布前必须补齐文档站版本更新笔记，不能用 changeset、GitHub release 或 npm changelog 代替。
   - 如果本批只有内部治理、测试、纯发布元数据或无用户可见变化，可以不生成，但发布报告必须写明“不适用”的原因。
4. 需要版本更新笔记时，联动 `product-blog-storytelling`，由 AI 基于证据手写短文，不把写作讨论、分类依据、模板解释或内部治理内容写进正文。
5. 默认落点：
   - 中文：`apps/docs/zh/notes/YYYY-MM-DD-nextclaw-v<version>.md`
   - 英文：`apps/docs/en/notes/YYYY-MM-DD-nextclaw-v<version>.md`
   - 同步更新对应 `apps/docs/<locale>/notes/index.md`
   - 结构化 JSON：`apps/docs/public/release-notes/nextclaw-v<version>.json`
   - 如果本次只面向中文用户或发布窗口不足，可以先写中文，并在发布报告中明确英文缺口。
   - 通过配图门槛的需求级源截图复制为版本稳定资产：`apps/docs/public/release-notes/nextclaw-v<version>-<slug>.<ext>`；中英文笔记分别引用匹配 locale 的图片，不直接引用仓库根目录源图。
6. 对 runtime / desktop update channel，必须让 update manifest 的 `releaseNotesUrl` 指向本次用户可读版本更新笔记；更新 UI 可通过同源 `/release-notes/nextclaw-v<version>.json` 拉取结构化内容。不要为了 JSON URL 轻易新增签名 manifest 字段，除非已经审计旧客户端验签兼容性。
7. 用聚合结果生成 NPM changelog / GitHub release notes。
8. 若本次 release type 是 `minor` 或 `major`，发布完成且文档站 release note URL 已公开可访问后，必须补齐 X 发布帖闭环；`patch` 默认不发 X 帖，除非用户明确要求或发布报告说明本次 patch 有明确宣传价值。
9. 再进入 `npm-beta-release` / `npm-release-contract-guard` / `desktop-release-contract-guard` 的发布闭环。

## X 发布帖要求

X 帖是文档站版本更新笔记的下游产物，只服务 minor / major 版本宣发，不替代 release note、changelog、runtime manifest 或 docs 部署。

- 触发条件：只有 `releaseType` 为 `minor` 或 `major` 时默认执行；`patch`、纯 beta 修正、内部治理、测试、发布元数据和无用户可见变化的版本默认不发。
- 发布时间：必须在 npm / runtime / desktop / docs 等对应发布闭环完成之后，并确认公开 release note URL 返回 200，再发布或准备 X 帖。
- 内容形态：默认 1 条短帖，不默认开 thread；包含版本号、1 个最主要用户价值、1 到 2 个可感知亮点和 release note 链接。
- 配图规则：只有本次版本更新笔记已经通过配图门槛并有真实、可公开、能支撑主结论的图片时，才给 X 帖带图；不要为了社交媒体强行配弱图。
- 文案边界：联动 `user-facing-content-boundary`，只写用户能感知的产品结果，不写内部治理、发布流程、测试结果或“我们为什么这样分组”。
- 发布能力：如果当前环境有已授权的 X 发布工具，直接发布并把帖子 URL 写入发布报告 / `docs/logs`；如果没有发布工具或授权，必须生成可直接发布的帖文和图片路径，并在发布报告中明确“X 发布未完成”的阻塞原因，不能假装已经发布。
- 验证：发布后记录 X 帖 URL；若只生成草稿，记录草稿内容、目标图片和缺失的发布能力。

## 版本更新笔记要求

- 最终正文面向用户，不面向内部协作者。
- 允许按真实变化聚类，但不要在正文解释“为什么这样分组”或写模板说明。
- 必须能区分变更类型：`功能` / `增强` / `修复` / `默认行为与兼容性`，英文对应 `Features` / `Enhancements` / `Fixes` / `Defaults and Compatibility`。
- 每类默认保留 3 到 6 条。真实变化不足时不凑数；超过 6 条时先合并相近项，避免流水账。
- 内容优先覆盖：
  - 本版本用户会感受到什么；
  - 哪些体验、能力或稳定性变好了；
  - 是否有兼容性、升级或已知边界；
  - 需要时链接到完整 changelog、GitHub release 或相关指南。
- 不要写入：
  - 纯测试、lint、治理脚本、`.agents/skills`、`docs/logs`；
  - 内部讨论、复盘、取舍过程；
  - 包级 changeset 的机械重复列表。
- 发布前必须确认：
  - 笔记覆盖本批用户可见 changeset；
  - 人类页面和结构化 JSON 的分类、条目和主结论一致；
  - 笔记没有包含不应公开的内部治理内容；
  - docs index 已更新；
  - 稳定 NPM minor 发布已补齐中英文文档站笔记和结构化 JSON；若任一项缺失，发布不得继续，除非用户明确接受延期并把缺口写入发布报告；
  - `apps/docs/public/_headers` 允许 `/release-notes/*.json` 被产品跨域拉取；
  - update manifest / GitHub release 的 release notes URL 能指向它或等价页面。

## 版本更新笔记配图门槛

配图不是装饰项。只有图片能同时满足“确实有可见展示效果”和“发出去后能帮助用户理解、判断或传播本次更新”时，才给版本更新笔记配图。

- 稳定 minor、官网/docs 主推版本或发布叙事型更新，必须先做配图适用性判断；决定不配图时，在发布报告里写明“不适用”的原因。
- 主打用户可见 UI、真实工作流、结果形态、预览能力、图表/媒体/文件体验、更新提示或新入口的版本，且截图能直接证明变化价值时，优先配真实产品截图或标注截图。
- patch 版本只有在某个可视变化有明确展示价值、能显著降低理解成本或有传播价值时，才建议配图；不要为了“每版都有图”而配弱图。
- 纯 CLI、协议、兼容性、稳定性、内部链路、发布元数据或无明确视觉变化的更新，默认不配图。
- 如果只能拿到空态、mock、加载态、被裁断结果、概念图，或图片不能支撑正文主结论，也默认不配图；需要配图时先补真实素材或调整正文。
- 需要配图时，联动 `product-blog-storytelling` 选择图片形式和核心亮点，联动 `refresh-product-visual-assets` 生成或检查真实素材，并继续遵守 `user-facing-content-boundary` 的截图真实性、隐私和文案对齐要求。
- `release:summary` 返回的需求级图片是默认候选。只要图片通过上述门槛并支撑本版主结论，就默认进入对应语言的版本更新笔记；不得因为发布当天忘记、文件难找或需要手工复制而漏用。
- 候选图片未采用时，发布报告必须逐项说明原因，例如与主结论无关、内容已经过时、隐私风险或构图不合格；“没有注意到”不是有效理由。
- 同一版本有多张合格候选时，优先选择最能解释主变化的一至两张，避免把版本更新笔记写成截图画廊。

## 结构化 JSON 要求

结构化 JSON 面向产品读取，不是内部聚合底稿。字段保持稳定、克制：

- `schemaVersion`: 当前为 `1`
- `product`, `version`, `channel`, `releaseType`, `publishedAt`
- `title` / `summary`: 至少包含 `zh-CN` 和 `en-US`
- `links.html`: 指向中英文人类页面
- `sections[]`: 每个 section 包含 `kind`、本地化 `title`、`items[]`
- `kind` 只使用 `feature`、`enhancement`、`fix`、`compatibility`
- `items[]` 只写用户可见标题和简短说明，不写内部讨论、测试、治理或分类依据
- schema v1 暂不承载文档配图；需求级图片用于中英文人类页面和下游宣发，若未来更新 UI 需要媒体能力，必须另行设计兼容的 schema 演进。

## 自动化边界

当前仓库已有 Changesets、`pnpm release:auto:changeset` 与需求证据聚合命令：

```bash
pnpm release:summary -- --json
```

`release:version` 在执行 `changeset version` 前自动运行 `release:summary`，因此无效路径、缺失文件或格式错误会阻断版本化。AI 仍须显式读取 JSON 输出，完成配图判断和用户文案写作。

`release:summary` 只能生成证据底稿和缺口清单；最终用户可见版本更新笔记仍由 AI 审阅并手写，不能把脚本输出直接当正文。

## 禁止做法

- 不要发布当天只让 AI 扫 git diff 生成 changelog。
- 不要把自动聚合输出直接当成用户版本说明；聚合是底稿，最终说明必须经过 AI 归纳和人工/AI 审阅。
- 不要把内部治理、测试或纯工程文档写进用户 changelog。
- 不要为无用户可见变化的改动创建额外发布记录。
- 不要用一个 full public batch changeset 代替具体用户可读变更说明。
- 不要发布带 update manifest 的版本却让 `releaseNotesUrl` 为空，除非本批确实无用户可见变化且最终报告说明原因。
