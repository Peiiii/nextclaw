# 计划重启恢复与 CLI 自更新验收

## 迭代完成说明

2026-09-11，在隔离工作区 `nextbot-planned-restart-recovery`、分支 `codex/planned-restart-recovery` 完成源码和本地工程验收。用户随后授权合入主干，集成包含功能、测试和文档；不包含版本发布，用户现有安装不因此升级。

对应设计：[计划重启后的运行恢复](../../designs/2026-09-10-planned-restart-run-recovery.design.md)，合同 `planned-restart-run-recovery-v1`。

- kernel 用一个原子交接单记录 operation id、有效期和精确 active run；admission gate 只负责关闭入口与等待已接收请求完成入队。
- service 只负责真实退出、helper 和 launcher；新内核启动并完成 channels 后领取交接单，经现有 continuation 主链路恢复匹配的 interrupted run。
- 不恢复工具 Promise/执行栈，不自动重放命令。新的隐藏输入明确告知重启已完成，要求先检查版本、健康和外部副作用。
- 删除 `gateway update.run`，保留配置动作；AI 和人使用同一 `nextclaw update` / `nextclaw restart` 路径。
- 当前范围是支持本地 API 的 managed/foreground host；不宣称 desktop、supervisor、崩溃、旧版本首次升级或任意排队输入也能恢复。

发现并修正的关键问题：

1. 受控 API 响应是 `{ok,data:{accepted}}`，不是顶层 accepted；用正式 route/controller 验证后修正解析。
2. 第二次重启必须清除 launcher child 标记，重新选择已激活 bundle；连续两轮真实替换进程覆盖此边界。
3. 正式 CLI 默认传 `open:false`。它不是用户修改重启配置，不能因此走旧 stop/start；同时验证 `{}` 和 `{open:false}`。
4. 模拟 AgentRuntime 也必须调用 SessionRun.applyEvents；否则“模型结束”不代表产品 owner 结束，后续请求会一直排队。验收 fixture 已遵循此合同。
5. journal 写入失败不能被 flush 吞掉后继续重启；新增失败保留与拒绝准备重启的定向测试。

### NC-177 systemd 补充修复

2026-09-11 的 support feedback 进一步确认：原实现只把 operation ID 交给 detached helper，systemd 实际创建的 successor 无法继承该环境值，因此 manifest 已写入但新进程执行 `recover(undefined)`，会话不会续跑。这是 supervisor replacement 边界的能力缺口，不是退出码 143 本身导致。

修复继续复用 kernel manifest 作为唯一 owner：systemd successor 在可信 supervisor 上下文中从同一 manifest 取得 operation ID，再进入既有原子 claim/continuation；旧进程不再同时启动 detached helper，而以 75 退出以兼容 `Restart=always` 和旧 `Restart=on-failure` unit。`nextclaw status` 同时从实际响应的 `/api/app/meta` 报告运行中 runtime 版本，避免用 CLI 或 bundle pointer 版本掩盖现场版本差异。对应补充设计为 [systemd 计划重启续跑](../../designs/2026-09-11-systemd-planned-restart-recovery.design.md)。

## 测试/验证/验收方式

已完成：

- kernel 全量：141 个测试文件，649 个测试通过。
- 恢复/admission/持久化定向：3 个测试文件，23 个测试通过（包含在全量中）。
- service 相关控制器、宿主、更新、工具合同与进程验收：8 个文件、26 个测试通过；随后补充 CLI 默认 false 的参数化用例，单独重跑对应控制器和进程验收。
- core、kernel、service 的 `tsc --noEmit`；kernel/service build；所有改动 TypeScript 文件与新增测试的 ESLint；diff-only maintainability 与 `git diff --check`。
- `docs/USAGE.md` 通过既有脚本同步到打包资源（前两行为生成声明）；自管理 skill 通过 copy-skills 同步到 core dist。测试 fixture 位于 `tests/`，不进入 service 生产构建。

进程验收入口（从本工作区根目录执行）：

```sh
pnpm --filter @nextclaw/service exec vitest run src/services/runtime/tests/planned-restart-update-acceptance.service.test.ts
```

该测试自动创建并清理临时 home、本地 HTTP 更新源、Ed25519 密钥和签名 bundle。真实 ExecTool 调用进程级 CLI fixture；fixture 消费正式 update/restart controller，接到真实 HTTP route、kernel、journal、helper 和 launcher。模拟边界为 AgentRuntime 的模型输出、CLI dispatch shell 和更新包内 native runner 占位；不连接线上模型、不下载线上版本、不改变用户服务。

可观察验收结果：版本 0.1.0 → 0.1.1；update 命令恰好一次；两次 restart；三个不同 PID 的 runtime generation；两轮中发起会话与并行会话分别续跑；每轮重复领取为空；已完成/普通失败会话不重跑；进度与成功回执进入模型消息；tool call/result 配对完整；最后普通新消息仍正常运行。定向测试还覆盖标记错误、过期、错配、无 token、恢复项失败隔离、写盘失败、admission drain/abort、启动失败和 HTTP 超时不二次重启。

广域回归例外：service 的 cron dev 集成测试仍存在 `forced job executed timeout after 8000ms`。在不包含本任务源码修改的主工作区独立复验，出现同一测试、同一超时。未修改或屏蔽该测试，不将 service 全量宣称为全部通过。kernel 首次广域测试缺少隔离工作区原生运行器；复用主工作区已有构建产物后，全量 649 通过。

NC-177 补充验证：kernel 定向 12 项、service 定向 29 项通过；其中 supervisor 等价验收完成两轮 prepare/recover，观察到四个不同 PID、每轮两个 active session 各续跑一次且重复领取为空。kernel/service `tsc --noEmit`、触达文件 ESLint、diff-only governance、文档中英文镜像检查与 `git diff --check` 通过。当前环境为 macOS，未执行真实 Linux systemd unit；进程所有权、环境识别、退出码和 successor claim 分别由组合测试及跨进程验收覆盖。

## 发布/部署方式

主干集成复验：合并 `af2e90aba` 后无冲突，kernel 全量 142 个文件 / 660 项通过；service 相关 8 个文件 / 27 项通过（含两轮真实重启验收）；kernel/service tsc、kernel build、VitePress 完整构建和集成 diff 检查通过。初始实现提交为 `ff217d4c8`。

初次验收未执行外部写入；用户随后明确授权“合入主干”，按任务提交、合并最新 master、复验、普通推送和本地主干同步的顺序集成，最终提交记录以 Git 为准。不创建 PR、不发布或部署。本次只验收本地测试源，不修改在线更新源，也不自动更新用户正在使用的安装。

NC-177 补充修复当前保留在隔离分支 `codex/nc-177-systemd-restart-recovery`，未获 commit、push、发布或部署授权；support feedback 仅回写待确认的本地修复与证据。

## 用户/产品视角的验收步骤

当前可直接复验的是上述本地自动验收，不把模拟模型称作真实在线模型行为保证。集成本次代码、运行支持恢复的新宿主后，正常产品路径为：

1. 同时启动两个未完成会话，在其中一个明确要求“通过命令行更新你自己，需要时重启，然后继续当前工作”。
2. 确认只有更新结果要求重启时才执行无配置覆盖的 `nextclaw restart`。
3. 连接短暂断开后，两会话恢复原有任务；用 `nextclaw --version` 和 `nextclaw status --json` 核对版本与健康。
4. 再发送普通消息，应正常继续；不应仅因旧工具结果中断而再次更新/重启。

systemd 宿主应额外确认 `nextclaw status --json` 的 `runtime.version` 与实际提供 API 的进程一致；`nextclaw --version` 只表示本次命令选中的 CLI/runtime，二者在旧 unit 或更新切换期间可能不同。

未做真实在线模型、完整桌面界面、Windows/Linux 或 supervisor 的人工/产品验收；提示与协议正确不等于任意模型都必然服从。若请求超时，先确认状态而非重复执行破坏性命令。

## 可维护性总结汇总

- 采用一个恢复 manager 和一个有真实排空状态的 admission service；未新增跨进程 tool/RPC、第二套 session 状态机、通用任务调度器或后台轮询。
- 删除 agent 专用更新分支及多余配置 controller 依赖；组装留在现有 kernel factory，移除 execution claim 的冗余转发函数。
- diff-only guard：0 errors，6 warnings（近文件预算与已有目录预算）。kernel app 400 → 396 行；未新增治理豁免。结构复杂度检查后复核了资格、幂等、CLI 默认值、启动顺序、写盘失败与模型输入合同。
- 文件 planned-path preflight 已通过；测试及 fixture 聚合在 runtime/tests，避免混入生产构建。
- 本批经验落在原测试与设计 owner，本记录汇总；不新增常驻规则或窄治理脚本。

NC-177 首次 diff-only guard 发现两个测试 describe 超出函数预算；拆分行为测试与跨进程验收、拆分 systemd suite 后复检为 0 errors。运行版本 HTTP 合同从临界体积的诊断编排类抽到独立 service，systemd 识别归一到既有 runtime utils 子目录；剩余提示为验收测试文件增长、诊断类接近历史预算和未被本次扩大的既有 runtime 目录预算。主观复核确认没有第二套 operation-ID store、helper/supervisor 双 owner 或版本 fallback。

### 自我管理文档与发布叙事补充

用户明确要求为该特点能力增加文档与宣传篇幅。按产品博客叙事 skill 组织为“自我管理”专题，归属自感知与自治，并解释其对长期协作连续性的价值，不称作自主改写或模型自我进化。

- 文档站新增中英文 `guide/self-management`，接入功能导航、产品介绍、运行托管与命令说明。未发布的恢复能力明确标注即将提供。
- 宣传稿为 [NextClaw：重启之后，接着做事](../../blog-drafts/2026-09-11-self-management-restart-continuity.blog-draft.md)，保持 draft，绑定本功能 changeset 随后续稳定版发布；未写入正式博客列表、未上线或发送社交平台。
- 正文以用户任务、操作方式、恢复后可观察结果和支持边界为主；只把模拟模型测试作为工程证据。无需用合成界面或泛 AI 配图代替真实产品证据。
- 文档补充验证：VitePress 完整构建通过，中英文产出页的正文与导航已检查；导航配置单独 tsc 通过，diff 无空白错误。构建仍有大 chunk 提示，不阻断本次文档生成。

## NPM 包发布记录

需要后续统一发布，当前未发布：`nextclaw`、`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/service`。四包 changeset 已准备；触发条件为用户另行授权集成与发布。目录版本只是迭代编号，不表示已发布该产品版本。

NC-177 的四包 patch changeset 为 `.changeset/systemd-planned-restart-recovery.md`，仍为待统一发布状态。
