# 发布自动化失败语义与不可变运行身份设计

## 背景

NextClaw 的稳定发布已经能够由 GitHub Actions 编排 NPM、runtime channel 和 Desktop，但现有链路把四类不同状态混成了失败：

1. 发布准备仍在运行或被后续 `master` push 取消；
2. workflow 已按冻结 SHA 执行，但调用方仍按可变分支的 `headSha` 定位运行；
3. GitHub Pages、raw GitHub 或 NPM registry 暂时不可读、仍返回旧内容；
4. 真实发布合同不满足，例如不可变 SHA、版本、签名公钥或完整资产集合不一致。

前 3 类是等待、恢复或外部可用性状态，只有第 4 类才是已证明的发布失败。当前实现会让一份合法发布因为自动化的时序假设而失败，也可能让 runtime workflow 从更新后的 `master` 构建并关联到错误运行。

本文拥有发布编排中的运行身份、准备制品生命周期、传播等待和最终失败边界。它不放宽版本、签名、tag target、资产集合或 release metadata 合同。

## 可观察目标

用户在 GitHub Actions 手动触发一次稳定发布后：

- 发布冻结在触发时的不可变 commit；后续 `master` 推进不改变本次 NPM、runtime 或 Desktop 输入；
- 调用方只等待自己触发的 workflow，不会找到同分支上的其它运行；
- 可恢复的准备缺失由编排自动补建并等待，不要求用户判断准备 workflow 的时间窗口；
- Pages、raw GitHub、NPM registry 的短暂 404、网络失败或旧投影进入有界等待；
- 等待耗尽时报告“外部状态未在期限内确认”，不伪装成“包不存在”或“内容错误”；
- 只有取得确定证据后，才报告版本、tag、资产、密钥或 manifest 合同失败。

## 当前链路与缺口

| Producer / owner | Consumer | 当前缺口 |
| --- | --- | --- |
| `npm-release-prepare.yml` | `release-stable` | prepare 以分支为 concurrency key 且 `cancel-in-progress: true`；冻结 SHA 的制品可被后续 push 取消，publish 又只查一次 success |
| `desktop-release-preflight.yml` | `desktop-release-preflight.mjs` | workflow checkout `target_sha`，调用方却用分支 `headSha === target` 定位；分支推进后永远找不到运行 |
| `npm-runtime-update-release.yml` | `release-beta-runtime.mjs` | workflow 从可变分支 checkout，调用方按分支和时间找运行；无法证明运行与冻结发布属于同一身份 |
| gh-pages / Pages / registry | closure scripts | 部分读取在 404、旧内容或暂时不可用时立即抛错；重试循环实际没有机会继续 |

这是“能力面缺失”，不是单点实现偏差：同一不可变发布身份横跨 NPM prepare、runtime、Desktop preflight 和公开投影验证。只修一个超时点会在相邻 consumer 继续复发；但无需重做整个 release 系统，因为现有版本、tag、资产和签名合同仍然正确。

## 主合同

### 1. 发布身份

一次子 workflow 调用由两个不同字段组成：

- `release_target` / `target_sha`：内容身份，必须是完整 commit SHA，所有 checkout 和产物校验都绑定它；
- `dispatch_id`：调用身份，由父流程或脚本生成，仅用于 run-name 和调用方定位，不参与内容语义。

分支只负责告诉 GitHub 从哪个 ref 加载 workflow 文件，不能再作为构建内容身份或运行关联身份。

### 2. 准备制品生命周期

准备制品的唯一事实源仍是 `npm-release-prepared-<source_sha>`。状态为：

```text
missing/cancelled/failed -> dispatch exact SHA recovery -> queued/in_progress -> success artifact
                                              | timeout/persistent failure
                                              v
                                      preparation unavailable
```

- push 触发的预热可以继续存在，但不同 SHA 不互相取消；避免为了节约几分钟破坏已冻结发布的可恢复性；
- stable publish 在下载前执行“确保 exact-SHA prepare”动作：复用成功运行，等待正在执行的同 SHA 运行；没有可用运行时显式 dispatch 一次 exact SHA recovery；
- recovery 是显式发布动作的一部分，不是 read-shaped 查询的隐藏副作用；
- prepare workflow 成功但没有预期 artifact 属于确定合同失败。

### 3. 外部投影等待

传播读取统一遵守：

- 请求失败、404、暂时无法解析、内容仍是旧版本：记为 pending，并在有界期限内重试；
- 内容已经出现预期版本后，再校验最低 launcher、release notes URL 等不可变字段；字段不一致立即作为确定合同失败；
- 到期仍不可确认：报告最后一次观察和明确的 `timed out waiting for ...`，不报告“missing identity”或“version mismatch”；
- 已经由 gh-pages 分支证明正确、仅公共 Pages 构建状态未完成时，可以保持现有“源正确、公开投影暂时滞后”的成功语义；Pages 状态已 `built` 但公共内容在完整等待窗后仍错误，才失败。

### 4. 失败分类

| 状态 | 行为 | 是否发布失败 |
| --- | --- | --- |
| queued / in progress / propagation pending | 继续有界等待 | 否 |
| exact-SHA prepare 缺失但可 dispatch | 自动恢复并等待 | 否 |
| registry / Pages / API 短暂不可用 | 重试并保留最后观察 | 否 |
| 等待到期仍无法取得证据 | 终止，明确为外部/准备不可确认 | 自动化未完成，不声称内容错误 |
| target、version、tag、key、asset、manifest 固定字段不一致 | 立即 fail-fast | 是 |
| 子 workflow 确定有 failed job | 立即 fail-fast，并保留 run URL | 是 |

## 方案选择

### NPM prepare

选择“预热 + exact-SHA 按需恢复”，不选择以下方案：

- **publish job 自己重新 build**：会恢复旧的双构建路径，publish 不再消费提前验证的不可变制品；放弃。
- **只等待 push prepare**：若运行已被取消、artifact 过期或 workflow 没触发，发布永久无恢复入口；放弃。
- **完全移除 push 预热**：一次发布必然增加完整准备耗时，失去免费提前计算价值；延后，不是本次必要范围。

### workflow 关联

选择显式 `dispatch_id` 写入 `run-name` 并按它定位。时间戳只保留为排除陈旧运行的辅助条件，不再用分支或 `headSha` 猜测调用归属。

### 传播重试

选择在具体 closure owner 内提供窄的有界轮询函数；不建立通用网络 DSL，也不按错误字符串伪造成功。HTTP 404 在“等待公开投影”的调用点是 pending，但在普通确定性读取中仍保持 fail-fast。

## 生命周期与不变量

| 场景 | 预期行为 |
| --- | --- |
| 正常 | exact SHA 准备成功；三个发布面使用同一 SHA；最终合同全通过 |
| prepare 正在运行 | 发布等待该 SHA，不重复 dispatch |
| prepare 被取消/缺失 | dispatch exact SHA recovery，等待并消费其 artifact |
| `master` 在发布中推进 | 当前发布的 checkout、tag 和产物不变化；定位仍命中自己的 dispatch ID |
| Pages 暂时 404/旧版本 | 继续等待；不误报 manifest 错误 |
| NPM registry 暂时不可用 | 继续等待；不误报包不存在 |
| 等待超时 | 保留最后观察并以“未确认/超时”终止，不改变发布事实 |
| 重试同一发布 | 已有成功制品和幂等发布面被复用；不会切换到新 `master` |

必须始终成立：

1. 一个发布版本只对应一个冻结 commit；
2. 一个调用只消费带自己 `dispatch_id` 的子 workflow；
3. pending 不能被命名为 mismatch，mismatch 必须有已读取的确定值；
4. 重试只改变观察次数，不放宽最终内容合同；
5. 任何超时都不能被当成发布成功。

## 实现边界

保留：

- 现有 `release.yml` 作为唯一稳定发布入口；
- prepared artifact、Desktop asset set、tag target、manifest 和 signing key 硬校验；
- GitHub Actions 原生 workflow 与现有脚本 owner。

删除或替换：

- 用可变分支 `headSha` 定位 Desktop preflight；
- 用分支 + 时间窗口定位 runtime workflow；
- prepare 单次 success 查询后立即失败；
- closure 轮询内部对传播期 404 的立即抛出；
- registry 查询异常被折叠为 `<missing>`。

延后：

- 通用 workflow orchestration framework；
- 自动修改用户工作站本地 `master`（云端 Actions 无法直接写本地文件系统）；
- 为所有外部命令建立统一错误分类 DSL；
- 实际触发一次新的正式发布，本轮没有发布授权。

## 验证标准

1. 单元测试证明分支推进后，Desktop preflight/runtime 仍按 dispatch ID 命中正确运行并传递冻结 SHA。
2. workflow 合同测试证明 prepare 支持 exact SHA dispatch、artifact 按 source SHA 命名，且不同 SHA 不互相取消。
3. 故障注入测试证明 404、网络失败、旧版本先出现时会重试，随后正确内容可通过；到期错误为 timeout/pending 语义。
4. 测试证明已经读取到预期版本但其它不可变字段错误会立即失败，重试不会吞掉真实合同错误。
5. 测试证明 registry 暂时失败后恢复可通过，持续不可用与确定版本不匹配拥有不同错误。
6. workflow YAML 可解析，改动脚本通过 Node 语法检查和相关测试；若触达 TypeScript 则追加匹配 `tsc`，本设计预计不触达 TypeScript。
7. diff-only 可维护性检查无阻断 finding。

## 非目标

- 不降低任何完整发布的资产、签名、tag、版本或 release notes 验收标准；
- 不把永久网络故障伪装成成功；
- 不自动发布、commit 或 push；
- 不承诺 GitHub Actions 能同步用户电脑上的本地仓库。
