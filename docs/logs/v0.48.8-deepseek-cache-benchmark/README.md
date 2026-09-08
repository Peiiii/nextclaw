# DeepSeek 缓存修复与同任务 Harness 对照

## 2026-09-08 统一五阶段累计实验完成

用户要求重新按统一规范测量五阶段，修正旧博客混合不同实验的问题。新增 private benchmark 的 staged-study.manager，复用既有 worker/fixture/observer/budget，不改产品行为。S0 原版、S1 轮次、S2 提示/技能去重顺序、S3 搜索声明、S4 压缩范围、S5 参数查询，每阶段三任务，另有 DSH 三任务；输出上限全部 2048。独立临时源码副本和每任务 HOME，manifest 冻结源码，任务间轮换阶段顺序，基线只保留 facade chatStream 绑定修复。

全部 21 样本通过，没有 length 截断，112 请求，实际用量估算 USD 0.094429860 / 上限 0.25。S0–S5 总费用依次 0.022663784、0.015053636、0.015040528、0.011757332、0.011645088、0.008613148；DSH 0.009656344。五阶段环比分别 −33.58%、−0.09%、−21.83%、−0.95%、−26.04%。最终相对原版 −62.0%，相对 DSH −10.8%。所有调用在同一 off-peak 价格窗口，usage 完整且逐项求和与 ledger 一致。

S0 前缀改写9→S1/S2各1→S3后0。S4没有摘要调用，不能将其0.95%变化归因压缩，调用17→16伴随执行路径变化；S5基本工具任务没有密集schema lookup覆盖，保持实验边界。首请求全冷敏感性为S5 0.010085404 / DSH 0.009656344，即高约4.4%，不是实际冷缓存复测。单次样本不声称统计显著性。所有原始证据在 `~/.nextclaw/diagnostics/prompt-cache/2026-09-08-staged-study/`，包含manifest、每请求usage、report.json/report.md、绘图脚本；没有公开下载功能。

中英文blog改为本次统一数据，完整阶段表、环比与原版差值、逐阶段分析、21样本详情及Matplotlib费用曲线；旧结果留本日志历史，不混新曲线。标题/博客列表/排错指南同步新结果。应用18工具review仍是TODO，不扩大产品改动、不重启、不提交发布。

## 2026-09-08 原始版本补测

已在 docs/TODO.md 记录应用管理 18 个工具及参数按需加载的后续 review，本批不改变产品策略。恢复 c0b131f19 的产品源码（仅保留公共 chatStream 接收者绑定修复），与当前版本交错运行三任务；独立源码副本和 HOME，不触碰主实例。共享预算 USD 0.10 / 48 请求，实际 29 请求、USD 0.051850816，停止追加付费测试。

原版/优化版分别：输入 193192/171259，缓存 128384/144000，输出 2815/2888，总 token 196007/174147，费用 USD 0.034028696/0.017822120，累计任务耗时 43.319/36.347 秒，API 31.304/25.154 秒，前缀改写 7/0。两边均只有 2/3 通过；原版 files 和优化版 config 出现 length 截断，后者 512 输出全为 reasoning。黄金成绩均无效；66.45%/84.08% 仅为诊断比例，不把 47.6% 总开销下降宣传为同等质量收益。repair 双方通过、费用低约 41.8%，只支持单样本结论。不通过挑选重跑隐藏失败。

中英文 blog 新增完整原始基线表、逐任务结果与失败分析，开头限定此前 DSH -13.2% 为单组结果；新旧组峰谷价格不同，禁止直接拼三方成本排行。原始报告、逐请求 usage、源码指纹、例外说明与重跑脚本归档于本机 `~/.nextclaw/diagnostics/prompt-cache/2026-09-07-investigation/original-versus-optimized/`，不新增公开下载功能。输出上限修复仍需独立对称实验，参数按需加载的普遍无损性尚未得到证明。

## 迭代完成说明

在隔离 worktree 中修复并真实验证，未提交、发布或重启现有实例。根因是 native runtime 将多次模型调用写入同一个 UI assistant message，而 OpenAI 转换器将这些轮次合并，后续工具结果使历史 assistant 内容不断改写。真实请求证明 system/tools 稳定、assistant 历史却变化；修复在消息 metadata 保存模型轮次边界，转换时逐轮恢复。该修复保留 UI 消息身份和并行工具组，直接消除错误的历史改写。已有无边界历史不能可靠重建，保留既有读取行为。

固定五文件核对及同会话追问，均使用官方 deepseek-v4-flash、每次最多 512 输出 token、7 次模型调用，答案为 TOTAL=65;FILES=5 和 15。2026-09-07 UTC 同价格窗口的真实结果：

| 组合 | 整任务输入 token | 缓存输入 token | 输出 token | 整任务命中率 | 用量估算 USD |
|---|---:|---:|---:|---:|---:|
| NextClaw 修前 | 141119 | 96896 | 708 | 68.66% | 0.010874612 |
| NextClaw 修后 | 141535 | 119424 | 681 | 84.38% | 0.006149848 |
| 官方 DSH 0.1.2-rc.1，sdk profile | 103378 | 85632 | 621 | 82.83% | 0.004913404 |

完成收尾重构后的追加复验：NextClaw 输入 141612、缓存 119680、输出 709，命中率 84.51%，费用 USD 0.006130740，仍为 7 调用、任务通过且历史改写为 0；对应持久报告 `nextclaw-verified.json`。与 DSH 相比费用约高 24.8%。前后数值均保留，不只挑选最好的一次。

DSH 按原生 read 工具替换任务提示中的 read_file；其余任务语义和合成文件完全一致，两边保留原生系统提示与工具目录。两边均串行读取五个指定文件且没有修改文件。NextClaw 配置请求 off，但实际 API 请求未发送 thinking 字段，官方默认 enabled/high；DSH 明确发送 enabled/high。因此本次实际思考模式一致，不能把配置 off 当作关闭思考已经生效。该配置到 API 的映射问题另待修复，本次没有改变它，以保留缓存 A/B 单变量。

NextClaw 费用下降约 43.4%，但仍比 DSH 高约 25.2%。DSH 首次输入 10640 token，NextClaw 为 15957；较大稳定上下文可以提高命中比例，同时增加总成本。因此 95% 不是这项包含首次输入、新工具结果的短任务的通用正常线。84.38% 中首次未命中 14805 token，占累计输入约 10.46 个百分点；后续未命中合计 7306 token，包含新增工具结果、消息与缓存块边界，不能全部视为缓存故障。

## 测试/验证/验收方式

- converter 定向测试 8 项、runtime-next 25 项、kernel 公共流式调用 2 项、指标与预算测试 6 项通过；context builder 相邻测试先前通过。
- 两个 NCP package 的 tsc 通过；kernel 公共 facade 按现有 development paths 的 scoped tsc 通过。标准独立 kernel tsc 在源码工作区遇到已有 @core alias 解析问题，不能宣称完整 kernel 编译通过。
- 同一 suite 多次真实复跑稳定约 84.4%；5 次历史前缀改写降为 0。原始 API usage 单独保存，不从 UI 最后一条用量倒推整任务。
- DSH 首次仪器试运行因 SDK 提前结束 SSE 消费未触发 flush，费用预留没有释放而停止；该不完整样本保留，不计入成功对照。修正观察器在 usage 到达时结算后，完整 7 调用真实任务通过。
- 维护性检查无错误；历史超长 runtime 文件从 647 行降至 637 行，保留历史预算警告。主观复核确认边界归 runtime、转换归 converter，费用统计归独立指标模块，没有新增产品内调度 owner。

## 发布/部署方式

尚未 commit/push/release/deploy，也未修改运行中的 NextClaw。用户可见修复已准备 changeset；发布授权未提供。

## 用户/产品视角的验收步骤

在本分支运行：

```sh
pnpm smoke:prompt-cache --transport task-suite --model deepseek/deepseek-v4-flash --runs 3 --prompt-target-chars 6000 --budget-usd 0.10 --output /tmp/cache-report.json
pnpm smoke:prompt-cache --compare /path/to/old.json /tmp/cache-report.json
```

默认 stdout 只显示固定任务整体命中率、PASS/FAIL、报告路径。详细 JSON 保留各调用输入/缓存/输出/思考 token、费用、时间、代码与配置指纹。单轮比率不作为黄金指标；任务失败时不能作为有效黄金样本。回归阈值 5 个百分点是本项目初始监控策略，不是供应商 SLA。

本机持久证据位于 `~/.nextclaw/diagnostics/prompt-cache/2026-09-07-investigation/`。DSH 安装与复跑脚本位于其 `dsh-experiment/`，运行 `node <该目录>/run.mjs`；仅合成文件，预算 USD 0.10，最多 12 请求，120 秒超时。源码工作区路径写在实验脚本中；换机器需重新安装固定 npm 版本并调整指标模块路径。凭据每次从本机配置读入子进程环境，没有写入报告或实验配置。

公开参考：[SWE-bench](https://www.swebench.com/) 提供真实 GitHub 修复任务；[Terminal-Bench](https://www.tbench.ai/) 展示模型、agent、解题率、成本与 token。没有查到可直接套用到本任务的公开 DSH 缓存黄金值。后续可固定少量公开任务作为较长任务样本，但未经实际运行不能将本次合成诊断任务称为公开榜单成绩。

## 可维护性总结汇总

复用现有 MessageSent upsert、kernel 模型 facade 和 smoke 入口。runtime 去重 abort/错误事件创建，RunStarted 事件归已有 execution manager；不建立第二套产品会话链路。指标报告与预算计算可离线测试，真实调用观察器只用于隔离 CLI 进程。新增文件 planned-path preflight 通过，中英文排障文档同步。

保留限制：旧 provider-direct smoke 仍依赖已移除的 ProviderManager；本次新 task-suite 通过 lazy import 独立运行，不声称修复旧传输。未覆盖长期压缩、原始 DSH 修复账单或全部模型。未创建付费定时任务。

## NPM 包发布记录

`@nextclaw/ncp-agent-runtime`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/kernel` 均待统一发布，原因是缓存历史与公共流式调用修复。当前只有隔离分支源码和本地真实验证，未发布任何包。

## 2026-09-08 标准基准扩展

用户追加低成本多任务、详细指标、长期代码管理及文档站报告要求。正式入口改为 `pnpm benchmark:cache`，实现归 `packages/nextclaw-agent-benchmark` 私有包；旧 smoke 仅保留兼容入口。产品运行时不依赖基准，DSH 为外部可选 SDK。上述 `dsh-experiment` 脚本仅为归档实验，后续维护与重跑统一使用新 package。

固定任务集为 files v1、config v1、repair v2。双方各 3/3 完成，整体缓存命中率 NextClaw 82.6307%、DSH 80.2853%；输入 306714 / 205507，输出 2165 / 2396，思考 678 / 918（已包含于输出），总 token 308879 / 207903。模型调用 17 / 16，累计 API 时间 24.866 / 23.649 秒，费用 USD 0.014923260 / 0.011649604。NextClaw 命中率略高，但同任务仍贵约 28%，固定上下文是后续调查方向。

黄金指标口径升级为三任务加权值，不能与旧五文件 84.4% 直接判断回归。早期 repair v1 的 DSH 达到 512 输出上限而未编辑文件，验收失败，样本保留；双方统一升级 1024 上限和提示后重跑 repair v2。追加实测合计 USD 0.022928752，低于 USD 0.05；后续整理未追加付费请求。

证据：持久目录中的 `three-task-study/report.{json,md}` 与 `repair-v2-standard/`。旧样本总耗时起点不同，三任务仅统一比较 API 累计时间，总墙钟时间标 null。标准 runner 对未来运行统一采集启动、执行与总耗时。报告保存全部请求用量和失败样本；版本不一致拒绝回归比较。定时付费运行尚未创建。

本地验证：私有包 11 项测试、ESLint、dry-run；极小预算实际进入隔离 NextClaw worker，在 dispatch 前阻断，ledger 为 0 次请求、0 费用，核心指标正确标为不可判定。维护性检查无错误，只有既有 runtime 文件与 smoke 目录预算警告。公开中英文博客及脱敏 JSON 归文档站，标明开发实测未发布，不将成本估算表述为账单实扣。

## 隔离与代表性纠正

旧 runner 继承系统 HOME，SkillsContextProvider 显式 includeGlobal=true，SkillsLoader 从 homedir()/.agents/skills 读取；早期真实 request-11.json 含本机 lark-base、backtest-expert 等。旧 28% 不是干净安装对照。runner 已隔离系统 HOME/CWD/XDG，worker 请求前断言真实路径及空全局技能目录；clean-home-v1 进入 settings，旧报告不可直接回归比较。

干净五文件任务双方 7 次调用、正确、0 历史改写。NextClaw / DSH 输入 123474 / 86612，首轮 13384 / 8158，费用 USD 0.005543100 / 0.004285712，差 29.34%。但首轮费用分别占 51.30% / 43.79%，约 76.93% 的费用差额发生于首轮。后六轮费用 USD 0.002699252 / 0.002409112，差 12.04%；后续输入命中率 93.247% / 90.876%。不能删掉首轮冒充新的整体成绩。

生成路径：默认 context providers 无条件收集产品提示，SkillsContextProvider 全量输出技能目录，ReplyFormatContextProvider 常驻展示细则，每轮序列化发送。首轮额外 5226 token × 7 = 36582，约解释累计输入差 36862 的 99.24%（算术归因，非独立消融）。工具 schema 字符 29898 / 28639，消息字符 24714 / 5475，差距主要在消息上下文。本样本未发现更多模型调用、输出暴涨或新的历史改写。

免费组装真实请求并在网络前阻断得到 system 分项字符：Skills 5640、输出与可视化 4886、消息交付 1707、Tooling 1670、会话编排 1574、自管理 1209。字符不是供应商 token。展示细则与 visualize-output skill、消息交付与 cross-channel-messaging skill 有语义重叠，可研究按需加载；不能据此删除全部工具或安全约束。优化效果尚未实测。

用户进一步纠正代表性：七调用的短冷启动诊断不足以代表持续修复，当前 repair 4–5 次调用也偏短。后续主任务应覆盖跨文件定位、修改、运行测试、根据失败继续修复，固定输入及外部验收，允许自然调用数；不强制空转、重复读文件或扩大前缀来抬高缓存率。完整任务成本与命中率仍是主结果；首轮/后续拆分只解释原因。压缩、重试、工具结果增长和恢复链路仍待长任务证明，不能声称整体机制已正常或成本已与 DSH 相同。

本轮费用 USD 0.013042400。配置任务被保守预算预留阻断，整个部分组无有效核心分数，证据在 clean-home-v1-verified。未追加 API；用户最新要求先研究机制，暂不修改产品提示策略。隔离修复与上下文分项采集已完成，代表性主任务和产品优化尚待后续验证。

逐轮机制检查：两边都是五次 read 工具调用和两次 stop，HTTP 全部 200，没有观测到额外 API 重试或输出截断。每次读文件后 NextClaw 输入增量约 1460，DSH 约 1463，未见工具结果膨胀。以上一轮输入 token 减本轮缓存 token 的非负值作粗略诊断，NextClaw 合计 154、DSH 10；此代理值不含上轮新输出、供应商分块等因素，不能称为精确可缓存命中率，但不支持大量旧输入反复失效的解释。会话编排的 wait/notify/start 细则同时存在 native-static-context 和 session-spawn 工具 schema，属于已定位的重复提示。长任务的压缩、恢复、工具选择和失败重试尚不能由这七轮排除。

## 用户授权后的首批上下文优化

完成会话参数说明去重、消息路由等义压缩、inline 示例/参数/布局细则渐进加载。常驻保留能力发现、读取要求、关键禁止事项、事实准确性、资产目录及基础文件链接合同。缺失的 inline 参数说明先迁入已有 visualize-output skill，非直接删除。未改变工具目录或模型配置，也未改变会话历史压缩算法。

相同干净环境免费组装请求，system 文本由约 24150 字符降至约 21154，约减少 12.4%；临时路径长度及随后补充的 skill 描述会造成少量差异，不能等同于费用减少 12.4%。

真实 DeepSeek 首动作路由探针：明确可视化先读 visualize-output、已有应用 inline 展示先读同一 skill、已有会话 wait/notify 参数、显式收件箱交付、纯文本无工具回答均观察到通过。已有 app 在 512 输出上限首次只产生思考而截断，保留失败；1024 上限复验通过。探针费用合计 USD 0.002789104，使用选定工具 schema 且未执行外部工具，仅验证模型首动作，不是完整任务成本 A/B，也未证明所有展示行为或压缩恢复无损。11 项定向测试及匹配源码/测试 scoped tsc 通过。

渐进加载检查后，把只供 inline 的 JSON/布局细则进一步放入 visualize-output/references/inline-display.md；skill 明确限定读取条件，普通文本、表格和 Mermaid 不读取该 reference。planned-path 与 skill-progressive-loading 检查通过。完整规则覆盖测试跨系统提示、skill 和 reference 核对原合同，没有仅删除旧断言放宽标准。另一次模拟 skill 工具返回后追读 reference 的真实请求没有取得 usage/有效结果，不能作为通过证据；保留 USD 0.0093302 的未结算预算预留，不将它称为实际扣费，也不继续付费重试。已知探针费用仍为 USD 0.002789104；本批证据归持久目录 prompt-optimization。规则追读的模型行为、真实渲染、长任务总成本及压缩恢复不在已验证范围。

维护性检查 0 错误，仅原有 context-provider 目录预算警告；文档站构建通过。AGENTS 未变、skill 数未变，新增一个仅 inline 触发的 reference；无 commands 或治理 baseline 变化。core 的 skill 资源与 kernel 的提示改动需同批发布，已更新 changeset，当前未提交、发布或重启宿主。

## 正式参数渐进加载与成本验收闭环

后续用户将隔离费用验收明确为最多比 DSH 高 5%。不能用旧命中率改善或字符减量代替这一门槛。完整过程和每轮指标见文档站中英文技术报告，以下记录最终代码与证据 owner。

1. 提示 A/B 两边各 3/3，但费用 0.013134800 → 0.015904624 USD，原因包含 session_search 从 49 工具增至 50 导致前缀变化。修为从启动声明，starting 时返回 SESSION_SEARCH_NOT_READY，失败返回 SESSION_SEARCH_UNAVAILABLE，不返回假空搜索结果。
2. 固定规则前置、always-on skill 目录去重后，stable-prefix-matrix 双方 3/3、0 改写，费用 0.012685172 / 0.010015264 USD，仍高 26.7%。差额算术分解：额外未缓存输入约 89%，缓存输入约 19%，较少输出抵消 8%。
3. 真正展示已有 Panel App 并手动压缩，发现保留一个 NCP ID 会恢复已摘要化的整段多轮历史。converter 输出 part 分组，checkpoint 保存 retainedMessagePartStarts，投影保留尾部并重定位轮次边界；原 journal 不删。修后 progressive-real-fixed 请求 16320 → 14162 token，旧工具调用消失、inline reference 重读、合法输出且 app 不变。不是同路径费用 A/B。
4. 非流式摘要原绕开观察器；benchmark 根入口安装 OpenAI SDK web shim 统一计量，重写请求后移除旧 content-length。原 progressive-real 样本由 checkpoint usage 补计总成本 0.013260372 USD；progressive-real-resume 捕获摘要及继续执行合计 0.004837172 USD。后者重启旧 journal 出现 unknown 工具历史，只用作 SDK 计量覆盖证据，不作干净压缩成功样本。保守预算中止、网络未知 usage 的样本保持原记录和预留，预留不作为实际扣费；不靠无限追加付费补齐每次试验。
5. tool_schema 参数渐进加载原型 3/3、0.008571780 USD。正式归 kernel ToolProviderManager 快照与 buildProviderTools，观察器中的实验改写和实验 contribution 已移除。原始 schema 和执行验证未改，查询返回克隆且限定当前工具集合。基础工具、小 schema、结构化结果参数保持直接可用。

最终正式 formal-schema-matrix（供应商原始 usage × 同一 off-peak 价格）：

| 指标 | NextClaw | DSH |
|---|---:|---:|
| 任务完成 | 3/3 | 3/3 |
| 黄金命中率 | 83.9509659% | 79.9529123% |
| 输入 / 缓存输入 | 170004 / 142720 | 166498 / 133120 |
| 输出 / 其中思考 | 2495 / 770 | 2562 / 872 |
| 总 token / 调用 | 172499 / 16 | 169060 / 16 |
| 总耗时 / API 秒 | 30.699 / 18.073 | 35.194 / 22.339 |
| 前缀改写 | 0 | 0 |
| 费用 USD | 0.008648220 | 0.009965920 |

NextClaw 本轮便宜 13.22%，三项分别便宜 9.9%、17.6%、13.9%，满足固定任务集 105% 门槛。两边合计 0.018614140 USD，未超过该批 0.05 USD 预算。formal-schema-positive 额外 4 调用、0.001996312 USD，真实查询 projects_create、创建空项目、列表确认，工具 hash 全程一致。最初路径字面校验因 /var 与 /private/var 软链接不等误判，离线 realpath 核验通过，未为此重跑模型。

基准已将 executionPassed 与 costParity 分开，超过 5% 即失败；观察器统一 streaming/non-streaming 计量并保留原 usage。新增产品参数 owner 进入源码指纹。包维持 private，默认三任务，CLI show/compare/dry-run 不收费，无定时付费任务。文档站改为逐步技术报告，删除公开 JSON/下载入口；此前“公开脱敏 JSON”的记录属于已撤销方案。

验证：参数查询 3 项与 context/facade 共 9 项定向测试、私有包 13 项测试通过；匹配 development paths 的源码 tsc 通过。维护性检查 0 错误、6 个存量/规模警告，无新错误。完整独立 core/kernel 构建受已有包/alias 解析约束，不以 scoped tsc 冒称全仓编译。无新增 CLI 产品命令，无自管理语义变化；changeset 覆盖 core/kernel/NCP 运行时修复。尚未提交、发布或部署；真实测量仅运行隔离实例。

最后核账发现正式 NextClaw 首请求各缓存 2304 token，DSH 各为 0。本地隔离不保证供应商缓存全冷；把首请求共 6912 token 改按未命中计价得到 NextClaw 0.010120476 USD，约高 1.55%，仍小于 5%，但这只是敏感性估算。报告新增该离线诊断，原实测不修改；文档明确实测领先不能全归于冷启动优势。最终新增测试覆盖未知价格不可估算、仅重算首请求及失败无效。工具管理器相邻测试更新为显式 builtin schema 合同并补快照/保留名称测试；测试消息使用完整 NCP 类型、执行测试使用真实 JSON 字符串参数。

最终收尾：private package 14 项离线测试及 lint、kernel 参数/工具管理器 9 项及压缩/搜索/展示相邻 27 项、core 压缩/搜索 13 项通过；匹配源码与新增测试的 scoped tsc 通过。维护性最终 0 错误、6 个已有/规模警告，diff whitespace 检查通过。中英文文档站完整构建通过，只有既有大 chunk 提示。默认 SDK 安装位置本机未安装，使用既有归档 SDK 的显式 --dsh-sdk-dir 完成真实矩阵与 dry-run；文档保留首次安装步骤，不偷偷增加本机全局依赖。最终真实 report.json 保留原始用量不改，report.md 仅离线重生成以显示新增首请求敏感性表。
