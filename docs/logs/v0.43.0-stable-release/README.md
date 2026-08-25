# NextClaw 0.43.0 全平台正式版发布

## 迭代完成说明

- 本批次发布运行触发证据、实时插话顺序、子会话连续性与递归边界、长会话排队提速和文件工具结果去重。
- `nextclaw` 选择 minor：消息“更多操作”新增统一的运行触发详情，是向后兼容的新用户能力；其余修复随同一产品闭包发布。
- 发布使用冻结的远程 `master`、exact-commit 预制 artifact 和单次 `target=product` workflow；NPM/Runtime 完成后再转交 Desktop owner，不并行触发两套发布。
- 发布后复盘确认一次主链路感知误判：`release.yml` 和真实成功 run 已证明 GitHub Actions 通过 `npm-production/NPM_TOKEN` 发布，但命令总表仍残留 OIDC 描述。根因是 workflow、skill 与 command consumer 缺少一致性门禁，而不是 GitHub 发布能力缺失。修复要求每次先输出 `EXISTING_RELEASE_PATH`，并用同一静态合同测试阻止三者再次漂移。
- 全平台发布仍有一处 owner 缺口：NPM/Runtime 和 Desktop 各自已经自动化，但两者的顺序曾由 AI 在本地串联，导致“一次发布”仍需要阶段介入。现由单一 `release.yml target=all` 串行拥有 NPM、Runtime、Desktop 和 `ALL_PLATFORMS_READY` 收口；Desktop 继续复用原有 Draft、子 workflow 和 closure 主链路，没有新建第二套构建实现。

## 测试/验证/验收方式

- 发布前运行 product stable dry-run，初次发现自动版本级别仍为 patch 且结构化 release notes 缺失，已在任何 registry/Release 写入前修正。
- Product workflow `32803630382` 最终成功：43/43 NPM package identity 可见，Runtime 四个平台构建成功，旧版本 `0.42.3` 经 check/download-only/apply/new-process 升级到 `0.43.0`。
- Desktop workflow `32804702855` 最终成功：五个平台构建与冒烟、30 个资产、五份公开更新清单和 APT `0.0.267` 均已核验。
- 本地主线已由协调器安全回流到 `768e9b712f551dda1962859ac52360d871763b99`；用户未跟踪设计文件未纳入发布或提交范围。
- Reuse-first 修复验证：`release-action-environment.test.mjs` 9/9 通过；最近成功 `release.yml` run 回读为 `32803630382`，`nextclaw@latest` 回读为 `0.43.0`；skill progressive-loading、new-code governance、backlog ratchet 和定向 ESLint 均通过。
- 单次 Actions 编排修复使用静态 workflow 合同、结构化双语 Notes 合同、Desktop closure/稳定发布合同和真实 CLI dry-run 联合验证；本批只验证自动化入口，没有再次发布 `0.43.0`。
- 时间边界复核读取了最近成功 Desktop run `32804702855`：实际 24 分 14 秒，而旧 CLI 等待上限仅 25 分钟。现已把 child 各阶段、CLI 观察和父 Desktop job 调整为分层硬上限，并在 CLI 超时后取消精确 child run；硬上限不替代每次 closure 输出的实际 wall/job/slowest-step 观测。

## 发布/部署方式

- 当前状态：正式发布完成。
- Product：GitHub Actions `release.yml target=product` 已达到 `NPM_READY` 和 `NEXTCLAW_STABLE_READY`；Runtime Release 为 `nextclaw@0.43.0`。
- Desktop：隐藏 Draft 完成五平台构建/冒烟和资产核验后原子公开为 `v0.43.0-desktop.1`。
- 主线：远程 release commit 和指标 commit 已安全 fast-forward 回本地 `master`。
- 后续完整正式版入口统一为手动 dispatch `release.yml target=all`；Actions 自行完成阶段依赖、exact-commit 传递和失败收口，操作者只观察同一个 run。

## 用户/产品视角的验收步骤

1. 打开任意用户、Agent 委派、定时或观察任务产生的消息，在“更多操作”中核对触发方、来源和实际运行模型。
2. 运行中插入下一步消息，确认它始终排在当前 AI 输出之后，刷新后顺序不变。
3. 从顶层会话创建子会话，确认继承模型且不重复展示父会话压缩记录；子会话不再递归创建孙会话。
4. 在长会话运行中继续发送消息，确认排队提示快速出现。
5. 展开文件工具结果，确认只显示一份结构化预览。

## 可维护性总结汇总

- 本批次功能实现沿既有 NCP/Kernel/UI owner 交付，没有为发布新增产品语义平行路径。
- 正式发布自动化只消费 changeset、结构化 Notes 与冻结 artifact；失败恢复沿同一版本 identity 续跑。
- 生产观测发现并修复两项自动化缺口：registry 最终一致性等待改为最长约 120 秒的有界退避，Desktop `gh-pages` 收尾改为直接读取单个 raw manifest，不再 fetch 仓库。
- 主链路感知继续复用现有 workflow owner，没有新增 capability registry 或平行 preflight service；自动检查 0 error/0 warning，规则入口仍在 8KB 渐进加载预算内。
- 全平台编排复用 `release.yml`、既有 NPM/Runtime job 和既有 Desktop CLI/子 workflow；新增结构化 Notes 生成器作为 GitHub Release body 的单一确定性 owner。维护性检查发现并消除了 `release-desktop.mjs` 的机械格式膨胀，保留后的文件仍在既有 500 行预算内。

## NPM 包发布记录

- 需要发布：是。原因是本批包含用户可见新能力、运行合同和 UI/Kernel 修复。
- 目标产品版本：`nextclaw@0.43.0`。
- 当前状态：43 个公开 package 已完成 registry version/integrity/latest 回读；`nextclaw@0.43.0` 真实安装与升级链路通过。
- 本次 reuse-first 规则与测试修复不改变 package 内容或版本，不触发再次 NPM 发布。
- 本次单次 Actions 编排仅改变发布控制面，不改变任何 NPM package 内容或公开版本；无需再次发布包。

发布过程观测见[工作记录](work/working-notes.md)。
