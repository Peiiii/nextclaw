# 擎天开发体系升级

## 目标与依据

用户于 2026-10-08 要求「安装一下最新的 AI 驱动开发体系，更新一下」。本项目已有受管安装，采用升级路径；体系治理授权包含精确提交并推送 master。本次按 standard 执行，规则路由影响为 L3，单批交付，无独立 plan。

2026-10-08 23:35（Asia/Shanghai）核对：npm 最新 `@nextclaw/qingtian` 为 `0.1.1`，本机 CLI 同版本；上游远程 main 为 `853ea3a43575ef0482e7fa70dfd16154b062a42a`。当前锁文件 sourceCommit 为 `024c19baafd429f60ff1c10381d26bd40eed3d10`，旧 sourceDigest 为 `b16eaffae308365d41dfc1cf96e33284123637223512f5cfac6162c72df0a55b`。升级前 check 确认受管文件完整，dry-run 预览 16 项写入。

公开安装合同：[Integrate Qingtian](https://ai-dev.nextclaw.io/SKILL.md)。安装包预期 SHA-256 为 `b1632e99264b460996001ace78d40ff44ae1efac0530fde2363bfdead7fcb03e`，提取前核验。

## 路径与边界

复用官方升级器：检查安装 → 校验公开安装包 → 预览 → upgrade → check。受管文件继续由上游 payload 与锁文件拥有，项目专项规则仍归本项目，不手工改受管副本。原安装 `agents.mode=skip`，根 AGENTS 已有 lifecycle 路由，继续保留 skip；在原 Skill 路由章节增加新大盘的条件入口，避免已安装 Skill 没有项目入口。

新增初始化、技术选型与长期事项参考位于原 owner 的 references；大盘 Skill 位于非发现 Wiki，顶层入口不扩张。无新脚本、运行依赖、CI、产品功能、NPM/runtime/desktop 或文档站发布。此任务是项目规则安装维护，无需启动产品或大盘，按需启动合同另行触发。

工作区已有 Bibo 等产品 thought/design 草稿，已在首次编辑前记录；提交只包含升级器写入、根入口及本文。发生受管冲突时停在冲突边界，不强制覆盖。回退可用本次提交之前的受管文件和锁文件；不重置活跃工作区。

### 项目预算适配（实施检查后的有效补充）

公开包完整性检查通过，但旧的单 Skill 8000 bytes 上限拒绝三个上游入口：design 8029、lifecycle 8744、iterative-quality-convergence 8111 bytes。AGENTS 新入口使其达到 12237 bytes，超过 12000。此为已测量的接入兼容问题，不修改上游受管副本，不普遍放宽预算：现有预算 owner 为这三个 Skill 按名称设置等于本版本实际字节数的上限，其余仍为 8000；总量 90000、顶层数 16、discovery 3500、AGENTS 12000 均保留。修改已有目录采集器消费可选的每名称预算，定向测试证明其不影响其它 Skill、且超限仍拒绝。根 AGENTS 合并重复加载措辞，保持语义。上游收缩后可撤回这三个容量例外，不新增检查脚本。

补充 design-review: passed；保留完整上游和逐项有限预算的方案比全局调至 9000 或本地改写上游更少治理漂移，验收目标不变。

## 活跃验收契约

- contract-id：nextbot-qingtian-upgrade-2026-10-08
- parent-goal：当前项目使用最新公开开发体系并完成适用 Git 交付。
- scope-revision：1；来源为用户当前请求与项目体系治理既有授权。
- 单阶段；无待决范围变更。只记录会改变升级完成判断的结果，不引入产品构建或审美标准。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| QT-01 | true | 当前受管 payload 与最新公开安装包一致 | passed | 安装包 SHA-256 匹配；upgrade 16 项；qingtian check：installed payload matches source。新 sourceDigest：bdccd7d221f8afc5c12874b30a3ec2225b8f91ff67bb237de64c1d74cc8871d2；公开包无 Git 元数据，sourceCommit 为 null |
| QT-02 | true | 项目规则和无关草稿保留，新 Wiki 入口可按需到达 | passed | AGENTS 条件入口指向已安装大盘 Skill；受管 owner 不分叉；diff 精确审计未触达原 Bibo 草稿 |
| QT-03 | true | 渐进加载、链接、拓扑及适用治理检查通过，Review 无遗留 findings | passed | 渐进加载、governance、ratchet PASS；13/13 定向测试；3 个治理 mjs 的 ESLint/node --check 通过；maintainability 0 errors/0 warnings；内容与场景 Review 无 findings |
| QT-04 | true | 本任务精确提交到远程 master，并核对本地主线状态 | passed | a98ca8f7b168f5355924b11ef05513de8a469795 已 push origin/master；2026-10-08 23:45:36 reconciliation 返回 LOCAL_MAINLINE_SYNCED，localOnly/remoteOnly 均为 0，原产品草稿保留 |

黄金验收链路：用户在本项目请求开发任务 → 根 AGENTS 路由 lifecycle → 当前阶段按需读取更新后的方法；请求打开擎天大盘 → 根条件入口定位新 Wiki Skill。AI 用文件、链接、条件反例和安装器证明接入，不把规则安装说成已完成实际产品开发或后台执行。

## 方案 Review

对原始升级目标、官方安装合同、skip 反例、工作区保护、上游与项目 owner、验收完整性检查：路径明确，复用官方安装器，没有平行安装实现或新增顶层 Skill。检查安装结果和主线交付均纳入完成门。design-review: passed；适用以上范围。

## 验证与实现 Review

更新前 → 更新后：顶层 Skill 16 → 16，Wiki 27 → 28，discovery 2908 → 2923 字符，description 1502 → 1517 字符，SKILL.md 合计 85023 → 87162 bytes，AGENTS 11993 → 11984 bytes。新增方法只在对应场景读取；大盘不占顶层发现。

按实际规则审查：仅体系升级不命中 initialization，普通既有产品小改不重选技术栈，保存周期事项不启动调度，讨论大盘不启动服务；根路由、阶段与引用均指向实际文件。三个预算例外精确到当前上游体积，定向测试覆盖例外相等通过、额外增长拒绝、其它入口仍受默认限制。拓扑和链接审计通过，project command/baseline 无需改动；复用已有治理脚本，没有新增脚本。

实现 Review：no findings。自动 maintainability 检查范围为三个治理 mjs；纯 Markdown 做内容与场景 Review。未改 TypeScript、类型或产品运行链路，产品 tsc/build/运行冒烟不适用；未启动大盘、不将静态接入验证宣称为真实产品任务或大盘运行验证。内部开发规则不需要 changeset、用户文档站、NPM/runtime/desktop 发布或宣传稿。

## 复盘

可复用事实是本版本的三个入口体积与项目预算不一致：已在原预算 owner 设置有限例外、保留退场条件，并以定向测试证明未扩大其它入口预算；AGENTS 在同一原路由收敛重复文字。除此之外 retrospective_decision: no-increment，官方安装链路已足够，不再增加长期规则或平行安装器。交付闭合后由 lifecycle 核对全部 Required IDs。

## 交付闭合

提交前拉取远程，确认本地主线落后 14 个提交且与任务路径/既有草稿不重叠，安全快进后提交本任务 21 个文件并推送。同步带入其它已交付的 X Skill 变更，因此最终项目审计为：顶层 16、Wiki 29、discovery 2916、description 1510 字符、SKILL.md 87036 bytes、AGENTS 11984 bytes，结果 PASS；本次升级自身新增的 Wiki 仅大盘 1 个。

公开归档安装器升级复验：`upgrade --dry-run` 为 0 file changes；`qingtian check` 仍为 installed payload matches source。三个预算例外、引用和项目规则均已验证；全部 Required IDs 当前 passed，retrospective_state=completed，无剩余授权内缺口。此记录补充随任务精确提交推送；工作区遗留仅任务开始时已有的产品草稿。
