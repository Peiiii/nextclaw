# DevWeave 大型交付模式升级

## 关联入口与过程记录

- 状态：本地升级完成；来源：本任务用户要求将新增体系同步进 nextbot。
- 上游：DevWeave / ai-development-system；通用规则通过既有安装器 upgrade 管理，项目专项日志规则在本仓库适配。
- 2026-09-25：接入前安装器 check 匹配上游；新增 reference 与本日志的 planned-path preflight 通过。保护本次开始前的五份 Bibo/探索 thought 草稿，不混入体系升级。
- 当前批次的完整合同和恢复记录由同一会话的上游工作区 `docs/work/2026-09-25-major-delivery-integration/` 维护；本记录仅拥有 NextClaw 接入结果，不复制整体账本。
- 2026-09-25：安装器实际升级 12 项（含锁文件），check 与上游 43 个受管文件匹配；项目日志专项、路由和命名规则完成适配。
- 过程纠偏：渐进加载首次发现日志专项 8915 bytes 超出 8000 bytes 预算；压缩重复说明后为 7974 bytes，重验通过，未放宽预算。
- 用户追加“不能只有开局设计、中途一直实现”后，补齐滚动设计门：每块工作前核对设计覆盖，原先留白即使没有 plan 或新分叉也先补方案并做适用 Review；审查通过范围不能外推。上游 Design/Implementation/Review 与大型交付参考经升级器追加 5 项写入（含锁文件），摘要、渐进加载与定向治理重验通过。
- 用户确认中断恢复、当前状态命名和分次设计后，本批完善：大型交付新入口为 current-state.md，明确身份、执行现场、进度、未闭合事项与下一步；无路径时按任务身份寻找，不按最新日期选任务；旧 working-notes 兼容，整体/专题设计互链。上游本任务恢复文件已改名并修复入链，NextClaw 的项目路由与日志合同同步，无其它任务迁移。
- 本批协议 Review 覆盖已知/未知入口、多候选、旧记录、暂停任务、未验证成果与未知外部动作，无剩余 findings。上游 43 文件校验和 6 项分发测试通过；目标渐进加载、定向治理与 ratchet 通过。该结果不代表独立新会话恢复效果已实测。

## 迭代完成说明

大型交付路由、共识保真、持续日志和上下文恢复已进入实际规则；默认单阶段，沿用三条任务 flow。新建日志优先日期前缀，兼容版本号。通用规则在 DevWeave 上游维护，通过原升级器同步。

- [大型交付流程](../../../.agents/skills/development-lifecycle/references/major-delivery.md)：整体责任、持续推进、恢复和权限边界。
- [记录结构与模板](../../../.agents/wiki/skills/process/iteration-work-notes/references/major-delivery-records.md)：有效合同、整体设计、当前工作记录和启动即写的日志；附件与长详情按需。

## 测试/验证/验收方式

- 升级器 check：受管文件与上游匹配；上游 `npm run check` 通过，安装/升级/实际分发归档测试 6 项全部通过。
- 本项目 `pnpm check:skill-progressive-loading`、定向 `pnpm lint:new-code:governance -- --paths .agents docs/logs/2026-09-25-major-delivery`、`pnpm check:governance-backlog-ratchet` 通过；`git diff --check` 通过。
- 对未提交规则差异进行场景 Review：纯设计/普通任务边界、单阶段默认、真实依赖拆分、共识来源、恢复对账、整体完成门均无剩余阻塞问题。此为协议审查，实际大型产品交付效果尚待试用。
- 原有 5 份 Bibo/探索 thought 草稿与 AGENTS 的 SHA-256 均未变化。证据绑定本次实际工作区内容，不能用未包含这些修改的 HEAD 代替。

## 发布/部署方式

规则升级，不涉及产品部署或官网发布。用户后续明确授权合入主干并同步远程：首批规则已在 `18a354bda`，本批滚动设计增量在 `codex/major-delivery-sync` 精确提交，交付目标为本地与远程 `master`；由既有主线对账入口核验同步结果。

受管锁文件绑定上游 DevWeave 提交 `5b94d68`，而非仅保留未提交源摘要。迁移前保存任务 patch 与源状态，逐文件校验隔离副本后只撤销源区本任务增量；五份无关产品草稿保持原状。纯内部规则/文档不需要 changeset。

恢复协议补强批次沿用用户主干同步授权：共享源为 `a185a06`，本项目锁文件已更新绑定；任务分支 `codex/major-delivery-recovery`。远程新增的 `a95835055` 仅更新 metrics，已无冲突快进集成；本批不改产品源码或 metrics。

提交前隔离检查：渐进加载通过；治理检查首次因跳过 bootstrap 缺少 parser 依赖中止，随后按项目 Node wrapper 执行离线 frozen-lockfile/ignore-scripts 安装，治理与 ratchet 重验通过。未共享其它工作区 node_modules，也未执行无关产品构建。

## 用户/产品视角的验收步骤

升级后可在此项目委托完整大型需求，或明确说“按大型交付模式推进”；核对是否建立有效合同与恢复入口、启动时记录日志、关键结果及时保存，持续完成授权范围内工作。此入口不保证宿主停止后自动唤醒。

## 可维护性总结汇总

通用方法回上游，项目保留日志命名/章节等专属约定；不增加顶层 Skill、代理层或新调度器。顶层 Skill 仍 16 个，发现描述 2895 chars、description 1489 chars 不变；入口总字节最初 78430，上批 80048，本批 80337；AGENTS 保持 11989 bytes。规则检查和 Review 已完成。纯内部规则与文档不影响产品功能，不适用产品 tsc/build/运行冒烟、用户文档或 changeset；无 command/script/baseline 修改。

## NPM 包发布记录

不涉及 NPM 包发布。
