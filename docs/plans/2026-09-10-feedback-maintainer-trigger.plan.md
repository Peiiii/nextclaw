# 反馈维护命令触发闭环执行计划

上位设计：[反馈维护命令触发闭环设计](../designs/2026-09-10-feedback-maintainer-trigger.design.md)

## 最终结果

- contract-id：`feedback-trigger-loop-20260910`
- parent-goal：维护者用一个短命令启动通用、低成本的反馈监听；审批触发任意配置命令，Codex Desktop 预设创建并稳定续接可见任务，处理器通过 NextClaw CLI 读取和回写，最终以可安装发布版本和生产真实链路交付。
- scope-revision / scope-confirmation：`1 / user-delegated-full-delivery`

## 整体验收契约

- 必须成立：公开生命周期入口、通用命令合同、高效幂等事件监听、审批与权限门、稳定反馈会话、Codex Desktop 推荐预设、CLI 自主读写回、安装发布和生产验收全部闭合。
- 必须不发生：空闲模型调用、核心识别 Agent 类型、未审批首次修复、维护者自回复循环、token 落盘到普通配置/日志、退出码冒充业务完成、旧 watcher 形成平行 owner。
- 架构不变量：平台拥有业务状态；feedback CLI 应用层拥有本地监听生命周期；通用触发协议只执行 argv，不感知 Agent、会话、项目或工作目录；配置命令拥有外部调度和会话映射；feedback ID、event ID、revision、runId 各司其职。
- 代表性场景：自定义命令；首次批准；用户补充；重新批准；重复扫描/崩溃重试；维护者评论；Codex thread 创建/恢复；发布安装后生产链路。
- 交付边界：当前任务已获 commit、push、发布、部署及生产验收授权；全部由 AI 完成。
- 真实边界：不构建 Agent 注册表、平台事件总线、无消费者 adapter 或跨系统通用会话协议；不增加 OS 登录自启。

## 阶段图

| 阶段                | 可验收结果                       | 进入下一阶段的门              | 状态   |
| ------------------- | -------------------------------- | ----------------------------- | ------ |
| 设计与方案 Review   | 主链路、状态、失败恢复、验收冻结 | design-review 无 finding      | 已完成 |
| 通用触发器          | 生命周期和任意命令端到端可运行   | FMT-01 ～ 05、07 定向证据成立 | 已完成 |
| Codex 与回写        | 桌面任务创建/续接、CLI 回写成立  | FMT-06、08 真实证据成立       | 已完成 |
| 文档、Review 与发布 | 可安装版本、生产链路及最终对账   | 全部 Required ID passed       | 已完成 |

## Active acceptance ledger

| ID     | Required | 合同                                                                                                        | Status | 当前证据                                                     | 失效原因 |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------ | -------- |
| FMT-01 | true     | configure/start/status/stop/restart 可产品化使用；start 简短、后台运行且无需保留终端                        | passed | 隔离安装态 CLI 完成 configure → start → status → stop        | —        |
| FMT-02 | true     | 核心只执行可信 argv/stdin/env/exit 合同，不识别 Agent、会话、项目或工作目录，也不要求 stdout 协议           | passed | 实际配置仅 argv；消费事件证明无 WORKSPACE/PROJECT 环境字段   | —        |
| FMT-03 | true     | 立即首扫、空闲零模型调用、journal 去重、心跳、崩溃恢复和退避成立                                            | passed | worker 定向测试及两次真实后台生命周期                        | —        |
| FMT-04 | true     | 首次处理只在管理员批准后触发；claim/repair/deliver 仍由平台原子权限合同约束                                 | passed | 审批选择测试、平台维护 API 与私有发行合同测试                | —        |
| FMT-05 | true     | feedback/event/revision/run 身份分离；用户补充续接、维护者评论不自触发、同反馈串行                          | passed | 稳定事件、留言过滤、再次审批及领取后恢复测试                 | —        |
| FMT-06 | true     | Codex Desktop 预设首次创建带项目目录索引的可见任务，同一反馈后续恢复同一 thread，映射可恢复且失败不静默降级 | passed | App Server 假服务；本机可见任务与同 thread 两轮真实 turn     | —        |
| FMT-07 | true     | 一个非 AI 自定义命令能收到准确事件合同并完成幂等重试                                                        | passed | 本机普通 Node 消费器收到 approval event/stdin/env            | —        |
| FMT-08 | true     | 下游通过随包 skill 和 `nextclaw feedback maintain` CLI 读写；原反馈承载回复/结果                            | passed | 本机 Codex 通过精确 CLI 前缀 claim/comment/result            | —        |
| FMT-09 | true     | 中英文反馈与命令文档、根/随包 USAGE、维护 skill 与 CLI 注册树同步                                           | passed | docs build、nextclaw build/prepack、源码回归均通过           | —        |
| FMT-10 | true     | 包内容、已发布 NPM 安装、生产平台和真实运行链路通过，版本/发布记录完整                                      | passed | `nextclaw@0.51.0`、产品运行时与真实 `nextclaw` 用户入口通过  | —        |
| FMT-11 | true     | 匿名/登录用户入口不回归；凭据、路径权限、命令注入和不可信反馈边界通过                                       | passed | 现有用户链路测试；0600/HTTPS 校验、argv 无 shell、正文不注入 | —        |
| FMT-12 | true     | 最终逐条重放原始需求，所有无需新增授权即可完成的缺口均已关闭                                                | passed | 原始需求对账、实现 Review、生产反馈与桌面任务全部闭合        | —        |

## 当前阶段门

- 结果：全部 Required ID 已通过，正式用户入口与生产监听保持可用，进入用户验收。
- 交付入口：`nextclaw feedback maintain`；生产监听绑定 `https://roadmap.nextclaw.io`，Codex 消费端工作目录为 `/Users/peiwang/Projects/nextbot`。
- 真实样本：反馈 `17bb616e-f82a-4579-aea1-81104db577ff` 经批准、领取和结果回写后为 `ready`；Codex task `01a08968-f878-7c93-ae42-0c77420a8da0` 已完成。
- 发布身份：`nextclaw@0.51.0`；NPM、稳定 Runtime、上一稳定版升级、文档站和公开 release notes 均通过。
- 待关闭缺口：无。

## 执行部分

1. **通用生命周期与事件 worker**：owner 为 `packages/nextclaw` feedback CLI 应用层；复用上位设计；实现配置、私有状态、后台进程、事件派生与进程执行，删除私有 app 平行 watcher。完成定向单测、tsc 和 FMT-01 ～ 05、07 证据。
2. **Codex Desktop 消费预设**：owner 为独立 feedback Codex consumer service；复用上位设计，按官方 App Server 合同生成/恢复 thread 和 turn。完成协议假服务测试与本机真实桌面任务验证，关闭 FMT-06。
3. **应用层回写与文档索引**：更新随包 skill、USAGE、CLI 中英文全集和反馈指南；用隔离反馈证明下游自行读写，关闭 FMT-08 ～ 09、11。
4. **统一验证、Review、发布和生产验收**：重新验证受影响合同，运行 implementation Review；添加 changeset，发布/部署并从已发布安装执行真实链路，逐项完成 FMT-10、12。

每部分在实现变化引入新状态 owner、协议或用户流程时返回 Design 更新本文上位设计；否则不另建平行设计。

## 中断恢复

恢复时先读取本文 ledger、上位设计和 `git status`，再检查本地 maintainer status、生产测试反馈和最近 release。已修改实现会让相关 passed 证据转 stale；不得从版本号或局部测试猜测整体完成。主工作区活跃 WIP 不得覆盖，所有源码工作留在当前隔离 worktree。

## 新发现与契约变更

- 2026-09-10：确认现有私有 watcher 写死 Codex Exec 且无产品生命周期；归入 FMT-01、02、05、06，不缩减范围。
- 2026-09-10：确认平台的新用户消息会撤销审批；设计保留该安全语义，同时把已激活反馈的消息作为沟通事件，新的修复仍须再次审批。
- 2026-09-10：方案 Review 核对本机 Codex 0.153.4 的生成 schema，确认 `thread/start`、`thread/resume`、`thread/name/set`、`turn/start` 与完成通知存在。
- 2026-09-10：官方协议与实机均确认 App Server 没有 Desktop project ID 输入；采用真实 workspace + `反馈：[项目目录]` 标题索引，拒绝写私有数据库，原生项目分组继续由通用消费者合同承载。
- 2026-09-10：实机中 Codex 领取反馈后超时暴露 working 状态无法由列表重新生成审批事件；worker 改为优先续接 journal 中未完成的已领取事件。
- 2026-09-10：用户纠正通用协议不应感知工作目录。设计删除通用配置/环境/执行合同中的 workspace 与 preset；`--preset codex-desktop --workspace` 仅是配置期语法糖，写入普通 Codex 命令 argv。
- 2026-09-10：按“底层是带审批的 issue 论坛”重新做方案 Review；三层 owner 清楚，无开放 finding。实现 Review 首轮发现命令注册文件越过 400 行预算，拆出同目录生命周期注册 owner 后自动检查与主观复核均无 finding。
- 2026-09-10：实现期真实握手发现桌面安装没有 control socket，且 daemon 命令要求额外 standalone 安装，原 proxy 假设失效。返回 Design 后改为直接 stdio App Server、等待 turn 完成并增加通用 timeout；重新核对用户入口、恢复与过度设计边界，`design-review: passed`，无开放 finding。
- 2026-09-10：首次 NPM 快速发布完成 `0.51.0`，但正式 launcher 仍运行 `0.49.0`，不能作为用户验收入口。补齐同版本双语更新说明与 surface review 后，产品恢复发布 `34435394827` 复用 NPM 身份并发布稳定 Runtime；本机通过标准升级路径切换到 `0.51.0`，真实 `nextclaw feedback maintain` 命令树、生产配置、启动和状态均通过。
- 2026-09-10：生产反馈 `17bb616e-f82a-4579-aea1-81104db577ff` 触发 Codex task `01a08968-f878-7c93-ae42-0c77420a8da0`；处理器按随包 skill 使用 CLI 完成 get、claim、result，服务端最终为 `ready/revision=6/runId=c8068b79-893f-4750-84e9-76deead23e44`。生产监听留在后台运行，空闲扫描没有模型调用。
- 2026-09-10：发布自动化共发生三次人工恢复：国内文档 CDN 从 GitHub runner 连接超时后重跑 verify；NPM-only 范围遗漏 Runtime 后改走 product recovery；一次 recovery dispatch 使用短 SHA 被 immutable-head 门拒绝后改用完整 SHA。均未绕过门禁或重复发布 NPM。

## 尚未关闭

- open-required：无。
- 外部阻塞：无。
