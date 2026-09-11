# systemd 计划重启续跑补充设计

## 最终结果

- contract-id：`systemd-planned-restart-recovery-v1`
- parent-goal：NextClaw 在受支持的 systemd 托管安装中执行普通 `nextclaw restart` 后，由 supervisor 拉起的新进程准确接续本次计划重启中断的会话，并能通过标准诊断入口报告真实运行中的 runtime 版本。
- scope-revision / scope-confirmation：`1 / approved-repair-feedback`
- 上游设计：[计划重启后的运行恢复设计](./2026-09-10-planned-restart-run-recovery.design.md)

## 问题与证据

0.53.0 的计划重启恢复只把 operation ID 放入 detached self-relaunch helper 的环境。systemd 托管进程执行普通 restart 时，旧进程会写入 kernel recovery manifest，但实际 replacement 由 systemd 创建，operation ID 不会进入新进程环境；新进程随后执行 `recover(undefined)`，因此不会领取 manifest。旧 restart sentinel 仍可能尝试按 session route 唤醒，但它不拥有 run continuation 语义，也不能替代 recovery manifest。

同一现场还暴露出版本事实的可见性问题：`nextclaw --version` 描述当前命令所执行的 CLI/runtime 版本；systemd 进程绕过或禁用 bundle launcher 时，它可能与正在提供 API/UI 的进程版本不同。运行中进程已经通过 `/api/app/meta` 产生自身 `productVersion`，但 `nextclaw status` 没有消费该事实，导致维护者容易把 pointer/CLI 版本误当成运行版本。

该缺口属于能力面缺失，不只是局部实现偏差：恢复从旧进程 prepare 跨越 supervisor replacement 和新进程 recover，版本事实也需要从运行中 API 回到 CLI 诊断 consumer。修复仍限定在既有 kernel recovery owner 与 service host 边界，不扩展为通用崩溃恢复或持久任务调度。

## Owner 与主链路

### Kernel recovery owner

`PlannedRestartRecoveryManager` 继续唯一拥有 recovery manifest、过期校验、原子 claim 和 continuation。新增一个语义明确的 supervisor 恢复入口：它只在调用方已确认 replacement 由受支持 supervisor 创建时，从同一 manifest 读取其 operation ID，再复用现有精确匹配的 claim/continue 路径。

不新增第二个 token 文件或 service store。manifest 已经同时证明“旧进程完成了计划重启 prepare”和“可恢复 run 的精确集合”；额外 handoff 文件会复制 operation ID 生命周期并引入清理竞态。

### Service process boundary

service 提供一个纯函数 owner 归一化 systemd supervisor 身份：显式 `NEXTCLAW_PROCESS_SUPERVISOR=systemd` 为主路径；仅在该字段缺失时接受 `INVOCATION_ID` 作为旧 unit 兼容信号。runtime update、普通 restart 和 successor startup 复用该判断。

普通 `background-service-or-exit` restart 在 systemd 下执行以下链路：

1. kernel prepare，暂停 admission、刷新 journal 并原子写 manifest；
2. 不启动 detached self-relaunch helper，由 systemd 独占 replacement；
3. 旧进程以专用非零 supervised restart exit code 退出，兼容 `Restart=always` 与旧 `Restart=on-failure` unit；
4. 新进程在 kernel、extension 和 channel ready 后调用 supervisor recovery 入口；
5. kernel 从 manifest 取得 operation ID，执行既有匹配、过期、原子 claim 与 `continueRun`；
6. restart sentinel 最后执行，继续只负责上线通知。

foreground 与 NextClaw 自管 background service 继续使用 detached helper 显式传递 operation ID，不改变其已验证链路。

### 运行版本事实

`/api/app/meta` 中由当前进程 distribution 产生的 `productVersion` 是运行中 runtime 版本事实源。`nextclaw status` 对实际命中的 managed endpoint 或 configured endpoint读取该接口，并输出结构化 runtime version probe；人类可读 status 同步展示版本。探测失败必须显示 unavailable/原因，不能回退到 pointer、launcher package 或当前 CLI 自身版本冒充运行版本。

`nextclaw --version` 保持当前 CLI/runtime 的版本查询，不改为网络请求，也不把 CLI 启动生命周期依赖于服务可用性。文档明确区分两者。

## 状态与失败矩阵

| 场景 | 恢复行为 | 版本行为 |
| --- | --- | --- |
| 显式 systemd supervisor + 已 prepare manifest | supervisor successor 原子领取一次并续跑 | status 读取实际 API 进程版本 |
| 旧 systemd unit，仅有 `INVOCATION_ID` + manifest | 按兼容 supervisor 路径领取；旧进程使用非零退出码 | 同上 |
| systemd 普通启动、崩溃或手工启动，无 manifest | 返回 none，不续跑 | API 可达则报告版本，否则 unavailable |
| 非 systemd + 无 operation ID | 保持现状，不读取/领取 manifest | 同上 |
| foreground/managed helper replacement | 保持显式 operation ID 恢复 | 同上 |
| manifest 损坏、过期或 claim 竞争失败 | 复用既有 invalid/expired/none 结果，不重复 continuation | 不受影响 |

## 架构不变量

- kernel 仍是恢复资格、持久 manifest 和 continuation 的唯一 owner；service 只声明可信进程生命周期上下文。
- supervisor 无 token 恢复只允许在已归一化的 systemd replacement 上发生；普通启动没有 manifest 时绝不产生 continuation。
- 每个 manifest 至多 claim 一次，不恢复工具执行栈，不重放 update/restart。
- systemd replacement 与 detached helper 不并行争夺进程所有权。
- 运行版本只来自实际响应请求的 API 进程；CLI/package/pointer 版本不得作为它的 fallback。

## 排除的方案

- **继续拒绝 systemd 的可恢复 restart**：虽然改动最小，但同一 `nextclaw restart` 在受官方支持的常驻安装中静默丢失连续性，违反统一入口与长期连续性目标。
- **新增 service operation-ID handoff 文件**：与 kernel manifest 重复状态，产生写入、过期、claim、清理的第二套 owner。
- **让所有启动都无 token 领取最新 manifest**：会扩大误恢复面，破坏普通启动和计划重启的边界。
- **让 `nextclaw --version` 查询运行中 API**：会改变命令的离线可用性和既有 CLI 版本语义；运行版本应进入 status 诊断模型。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- | --- |
| SRR-1 | true | 显式 systemd 的普通受控 restart 写 manifest、仅由 supervisor replacement 领取并各续跑一次 | passed | service 组合测试 + 两轮四 PID 跨进程等价验收 | 真实 Linux systemd unit 未在 macOS 环境执行 |
| SRR-2 | true | systemd 无 manifest、非 systemd 无 operation ID、重复启动都不误恢复 | passed | kernel 与 startup 负向/幂等测试 | - |
| SRR-3 | true | 旧 `INVOCATION_ID` systemd unit 使用 supervisor 路径和非零 restart exit code | passed | legacy invocation 与 exit 75 定向测试 | - |
| SRR-4 | true | foreground/managed helper 的显式 operation-ID 恢复保持不变 | passed | helper operation-ID 与 foreground 回归测试 | - |
| SRR-5 | true | `nextclaw status` 从实际 API endpoint 报告权威运行版本，失败时不伪造 fallback | passed | app metadata 成功/无效响应诊断测试 | - |
| SRR-6 | true | 用户文档、CLI 能力全集与 self-manage 资源明确区分 CLI 版本和运行版本 | passed | usage resource 同步、docs i18n 与文档 diff 检查 | - |
| SRR-7 | true | 受影响 package 类型检查、定向测试、真实双进程/supervisor 等价验收与实现 Review 通过 | passed | kernel 12 + service 29；两包 tsc；ESLint；governance；maintainability 0 errors | 真实 systemd 验收边界同 SRR-1 |

## 交付边界

- 本地完成源码、测试、用户文档、自管理资源、changeset 和必要高影响修复留痕。
- 当前 feedback authority 为 repair；不 commit、push、发布、部署，也不修改用户的真实 systemd unit 或线上环境。
- 真实 Linux systemd 进程验收若当前 macOS 环境无法提供，将用两个独立进程与 supervisor 环境合同完成等价验证，并明确披露未执行真实 systemd 的边界。
- desktop、非 systemd supervisor、普通 crash/OS reboot 和任意排队任务恢复不进入本契约。

## 计划与当前阶段门

- design-document：required（跨 kernel 持久恢复、service supervisor 生命周期和 CLI 诊断边界）。
- plan：not-required（一个聚焦批次可按 recovery 协议、service 接线、诊断与文档顺序闭环）。
- 当前门：实现、验证与 Review 已完成；进入未授权外部写入下的用户验收交付。
- 被删除的噪声标准：不把全仓 lint、任意真实模型遵循 continuation prompt、其它 supervisor 支持写入本契约，因为它们不改变这次 systemd 修复的完成判断。
