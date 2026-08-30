# v0.45.3 Spin Portable Runtime

## 迭代完成说明

### 0.47.0 Portable Capability Runtime 闭合批次

本批在 Spin 执行底座之上闭合了原总体计划中仍打开的产品能力：受控文件、标准网络、Secret、KV/SQLite、Resident 与事件、可取消 Job、进度与流、模型/Agent 插槽、版本化 Provider、Panel/Agent/CLI 同实例调用，以及当前版本有效的验收证据。产品仍只有一条 `.napp` / Service App 主链；权限、数据和生命周期语义归 Kernel，Spin 只拥有 Component 执行。

根因不是 Spin 缺少执行能力，而是此前把“框架可提供 Factor”误当成“NextClaw 已完成产品合同”：目录授权、Secret owner、AI 绑定、错误语义、开发工具、产品展示和发布证据都必须由 NextClaw 显式接线。该结论通过 22 项验收合同、真实 runner smoke 和三入口 HTTP smoke 确认；本批修的是缺失的产品主链与自动门，而不是给样例增加特判。

本批将正式 Portable Runtime 从自维护的直接 Wasmtime host 迁移为嵌入式 Spin 4.0.2 Runtime Factors，同时保持 `.napp`、WIT、NDJSON、权限、数据目录和发布 artifact 合同不变。旧 executor 已删除，没有形成长期双实现。

本批也完成了外部依赖 readiness 与 Provider binding 的产品纵向合同：默认 App 仍然自包含且直接可用；只有 manifest 显式声明 capability/resource 时，API、CLI 与 UI 才显示 `needs-capability` / `needs-configuration`，并在实际激活前稳定拒绝。独立 Provider `.napp` 可通过 `provides.capabilities` 声明版本化能力与 resource type，Kernel 从已启用且正在运行的 Provider 建立 catalog，并把 Consumer 的非敏感绑定存入实例 `config/dependencies.json`。

API、CLI 与 Agent tool 复用同一个 AppPackage dependency owner 完成 inspect/setup/bind/verify/unbind；唯一候选可自动绑定，多候选必须显式选择。运行中的 Consumer 不能更改绑定，已被启用 Consumer 使用的 Provider 不能停用或卸载。Secret、token、密码与连接串不进入 `.napp` 或 binding；重型外部服务仍由 Provider 自己的 Service Actions 与既有 Secret owner 管理，且默认不推荐外部依赖。

## 测试/验证/验收方式

- 0.47.0 候选：Rust `cargo test`、七个受影响 TypeScript package 的 `tsc`、App Runtime/Kernel/Server/UI/CLI 定向测试、治理检查和 diff-only maintainability 均通过。
- 正式 Spin runner smoke 通过，覆盖 32 个执行、权限、Job、流、AI、Provider、Resident、资源隔离与 SQLite 重启持久化检查；同一 runner PID 装载 16 个 Component 实例。
- 真实产品 HTTP smoke 通过，覆盖安装启用、Panel/Agent/CLI 同实例调用、入口事实等价、验收合同/记录/导出，以及 Resident 停用后重启。
- 文档站 build、结构化版本笔记与 release content 合同通过。三平台候选证据与公开发布证据由 `release.yml target=all` 的自动门生成并在发布后写回本记录。

- Spin release runner 构建与五 Guest smoke 通过，覆盖 Action、Host KV、权限拒绝、Provider、Composition、Resident、同 PID 与 stop 后资源释放。
- Kernel 真实 portable runtime 集成 6 项通过；首次运行抓到的 Factor 配置缓存串用问题已经修复并增加隔离回归。
- 真实产品 HTTP smoke 通过：干净 home、内置 App enable、5 个 Service Component、Provider/Resident running、`counter_read`；Rust Guest 的 doctor/create/build/check/test/dev/call/pack/install/enable/action 全链通过。
- Readiness 与真实 registry artifact 生命周期 14 项、UI 10 项通过；Kernel/UI `tsc` 通过；触达文件 ESLint 0 error。
- 两个独立真实 `.napp` 的 Provider→Consumer 链路通过：Consumer 初始 `needs-capability`、Provider 安装启用、唯一候选 setup、Consumer enable、runner 受控跨 App `component-call`、运行时变更拒绝、停用后 unbind 回到 `needs-configuration`。
- Portable Runtime 最终矩阵首次复验发现两个发布自动化缺口：Linux 的 Spin telemetry OpenSSL 已改为 vendored 构建；Windows smoke 的 file URL 路径已改用 `fileURLToPath`，避免生成 `D:\\D:\\...`。
- 第二次矩阵进一步暴露 Windows 不允许用 `rename` 覆盖已存在空目录：`app check` 的临时实例现在使用 `mkdtemp` 下尚不存在的子目录作为原子迁移目标，并新增跨平台回归测试；这修复的是实际开发者校验链路，不是 CI 特判。
- 验证器同时观察异步安装 operation 与应用列表：operation 失败会立即报告稳定状态和错误，不再空等列表超时；workflow dispatch 支持 `darwin-arm64`、`linux-x64`、`win32-x64` 单目标恢复，完整三平台矩阵仍是最终合入门。
- Desktop bundle 现在把 App Runtime 的 WIT 与锁文件复制到重定位后的 `runtime/dist/resources` 并纳入 bundle 必需文件合同，避免 AppImage/Windows installer 因 Rust/WASI scaffold 资源缺失而启动失败；macOS N-API adapter 在 Electron headers 未预热时使用 ABI 稳定的当前 Node `node_api.h`，Windows Electron smoke 清理增加有界文件锁重试。
- Desktop workflow dispatch 支持按 runtime、macOS DMG、Windows EXE、Windows installer 或 Linux package 单链恢复；Windows Electron Service App smoke 在业务与 lifecycle 断言已通过后，短暂文件锁导致的临时目录清理失败只记录 warning，不再制造假失败。
- 最终原生证据已闭合：Portable Runtime run `33276343562` 的 macOS arm64/Linux x64 成功，focused Windows x64 run `33277547811` 成功；Desktop run `33278867556` 的 runtime、macOS DMG、Windows installer、Linux AppImage/deb 成功，focused Windows EXE run `33279269319` 成功。所有 focused run 都复用同一主干 SHA 的实现，仅跳过已由前序 run 证明且未受后续修复影响的平台。
- 文档站构建与中英文同步检查通过；`git diff --check` 通过。
- `0.46.0` 首次 `target=product` run `33293465778` 在任何 NPM 写入前复现发布自动化漂移：workflow 把完整内容门错误地同时施加给 `product` 与 `all`，而现有设计明确允许核心发布以 `CONTENT_PENDING` 和确定性 GitHub Release fallback 继续。修复后 39 个发布合同测试、产品 dry-run、Skill 渐进加载与治理 ratchet 均通过；dry-run 明确显示 NPM/Runtime 不再被内容缺失阻塞，Desktop 所属的 `all` 仍保留完整双语内容门。

## 发布/部署方式

0.47.0 使用唯一正式入口 `.github/workflows/release.yml target=all`。一次 dispatch 依次闭合 NPM、四平台 Runtime、真实升级、Desktop installer/manifest/APT、双语文档与 `PRT-REL-001` 公开复验；Agent 不参与状态迁移，不手工拆发或重复发布成功阶段。

本批按用户授权提交并合入 `master`；Portable Runtime 与 Desktop 的适用原生矩阵已用完整门 + focused recovery 组合闭合。`0.46.0` 产品正式发布只使用统一 `release.yml target=product`，先形成 `NPM_READY`，再由同一个无人值守 workflow 闭合 Runtime 与旧版本升级；Desktop 不在本次授权范围。首次 run 在 preflight 失败且没有发布任何包，修复沿同一 `0.46.0` identity 重新生成 exact-SHA prepared artifact 后恢复，不手工拆发、不发布 beta、不重复已有不可变产物。

## 用户/产品视角的验收步骤

0.47.0 可直接在应用列表启用「日常小工具箱」与 Portable Runtime 参考应用：在 Panel 中写入持久数据，再由 Agent 或 `nextclaw app invoke` 读取；查看文件、网络、Secret 与 AI 插槽的授权状态；运行 Resident/Job 场景后关闭 Panel，确认后台工作继续且可取消；最后在验收状态页或 CLI 查看 22 项当前证据。

1. 安装并启用不声明外部依赖的 Portable App，确认无需额外设置即可使用 Action、数据持久化、Resident 与 Provider。
2. 查看显式声明 capability/resource 的 App，确认产品在启用前展示友好的额外要求，而不是暴露 Redis 端口、命令或 Secret。
3. 尝试启用未满足要求的 App，确认返回结构化 `APP_PACKAGE_NOT_READY` / HTTP 409；CLI 与 UI 消费同一 readiness 事实。
4. 对正在运行的 App 更新到未满足依赖的候选版本，确认候选不会被激活，原版本和数据继续可用。
5. 安装并启用独立 Provider App，执行 `nextclaw app dependencies setup <consumer-id>`，确认 Consumer 变为 ready 并能跨 App 调用；停用 Consumer 后 unbind，确认再次回到 needs-configuration。

## 可维护性总结汇总

0.47.0 收口时把 Registry parser、readiness、capability resolver、Job/activation/AI manager、runner protocol 和 HTTP smoke helpers 从临界大文件中拆到明确 owner；删除平行能力 provider owner，保持单一事实链。治理和 maintainability 检查均为 0 error；子 Agent 使用规则改为默认单 Agent、显式授权且有累计上限，避免再次以并行名义放大 Token 与共享 WIP 风险。

- 以 Spin Runtime Factors 替换自维护 bindings，删除旧 `bindings.rs` 和直接 executor，保持一个执行 owner。
- Factor app cache key 纳入数据目录、storage、网络和 provider grants，避免跨权限复用实例。
- Readiness 和 host target 从接近预算的 manager 中抽为单一 service；UI readiness 投影抽为共享 helper。
- Provider catalog、binding persistence、readiness 与 active source projection 由一个 dependency coordinator 编排；删除早期只读 readiness 平行 owner。
- Binding 只存非敏感引用并以 0600 原子写入；运行中 mutation 与反向 Provider 依赖均有显式冲突保护。
- diff-only maintainability 最终 0 error；三个既有/临界大文件保留 warning，但本批已减少 manager 与 card 的行数。后续缝为继续拆分 manager 的版本生命周期测试 fixture 与 card 的详情区块。
- 文件命名、目录治理和 backlog ratchet 已通过。

## NPM 包发布记录

- 0.47.0 changeset：`.changeset/complete-portable-capability-runtime.md`；`nextclaw` 为 minor，受影响的 App Runtime、Kernel、Client SDK、Server、Service 与 UI 随同发布。
- 当前状态：候选验证完成，待统一 `target=all` stable 发布；发布完成后在此写回精确版本、run、耗时、干预数与公开产物证据。

- Changeset：`.changeset/adopt-spin-portable-runtime.md`；涉及 `nextclaw`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` 与 Runtime artifact。
- `0.46.0` 已由 `release.yml target=product` 完成正式发布：NPM registry 的 exact version 与 `latest` 均为 `0.46.0`；tag `nextclaw@0.46.0` 指向发布提交 `0eabae1e4519f4b927b52d46ff33b35626954268`；GitHub Release 含 darwin-arm64、darwin-x64、linux-x64、win32-x64 四个 Runtime zip。Desktop 未触发，内容状态如实为 `CONTENT_PENDING`。
- 最终产品恢复 run `33297141799` 于 2026-08-30 06:32:48Z–06:47:02Z 成功：NPM recovery 没有重复发布，unsupported-Node guard、四个此前失败的 Windows Node 20/22/24/26 真正 registry clean-install + SQLite contract、Runtime 四平台与旧稳定版升级验证全部通过。
- 自动化闭环同时修正六个独立根因：内容门误拦截 product、NPM publisher 等待整个 Runtime prewarm parent、Windows `npm.cmd` spawn、NPM/tag 已存在但 GitHub Release 未完成的 recovery checkpoint、Windows fixture cleanup 锁、以及 recovery 误重跑已成功 matrix cell。发布者现在只等待 exact NPM prepare job/artifact 并做有界下载重试；恢复会以不可变 tag/source ancestry 聚合历史成功证据，失败单元才重跑，全部成功时只执行 lightweight reuse job。
- 观察到的初次发布窗口为 2026-08-30 05:07:38Z–06:47:02Z（99 分 24 秒）；最终 recovery wall time 为 14 分 14 秒，NPM recovery checkpoint 为 1 分 51 秒，最慢有效阶段为 Runtime publish + verify 5 分 06 秒。此前最慢的非业务等待是完整 prepare parent 阻塞 NPM 约 21 分钟，已移除。模块级 cleanup 与 recovery-matrix tests 使相应诊断在本地毫秒级完成；是否先跑模块测试改为按定位置信度、平台隔离价值和运行成本自适应选择，完整矩阵只保留为首次/最终门。
- 后续 recovery `33297868807` 成功，正确跳过 NPM 写入与 Runtime 重发，并把兼容性范围缩至唯一尚无成功证据的 Windows Node 20 单元。最终 recovery `33298307609`（2026-08-30 07:03:22Z–07:09:02Z）成功把其成功证据与此前 15 个单元一起复用为 `verify NPM reused Node reused`，没有重跑兼容性矩阵；它仍独立执行 unsupported-Node guard、Runtime asset reuse 与旧版升级合同，Desktop 保持跳过。

## 关联产物

- [稳定设计](../../designs/2026-08-28-wasi-service-app-runtime.design.md)
- [总体阶段计划](../../plans/2026-08-28-portable-capability-runtime-overall.plan.md)
- [工作笔记](work/working-notes.md)
