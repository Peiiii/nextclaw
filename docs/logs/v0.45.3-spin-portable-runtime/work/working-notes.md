# Spin Portable Runtime 工作笔记

## 当前目标

完整交付 Spin-first Portable Capability Runtime：保持 `.napp`、Service Action、权限与数据 owner 不变；默认 App 自包含、开箱即用；外部 Factor/资源只作为谨慎、醒目标识且由 AI 自动操作的逃生口；Node/native Service App 长期并存。

## 当前事实

- v0.45.2 的直接 Wasmtime runner 已在 macOS、Linux、Windows 发布，Action、Resident、Provider、持久化与真实 Linux enable 已有基线证据。
- 当前 runner 手工实现 Component 装载、KV、HTTP、Provider registry 和 Resident 生命周期；继续扩张会重复 Spin 已有的 Factor/Trigger 基础设施。
- Spin 4.0.2 基于 Wasmtime，公开 Runtime Factors、custom Trigger 与 in-process 构建 API；本轮已形成可编译的 `apps/nextclaw-spin-runner` Spike，保持现有 WIT 和 NDJSON 合同。
- 外部 Redis、PostgreSQL 等不是默认产品路径；普通用户不应学习或手工运维这些依赖。

## 关键约束 / 不变量

- NextClaw 拥有 `.napp`、App 身份、安装、授权、数据、生命周期、Marketplace 与 readiness；Spin 只是内部执行底座。
- 不公开 `spin.toml`，不运行每 App 一个 `spin up`，不长期保留双 executor。
- 默认 runner 只包含精选 Factors；未安装的重 Factor 不产生包体之外的运行成本、连接池、timer 或常驻进程。
- 默认推荐 App 必须自包含、安装后直接运行。外部依赖 App 在 Marketplace、安装确认和详情中提前醒目标识并降低推荐优先级。
- 外部依赖的检测、安装、配置、Secret 采集、验证、修复与解绑必须可由 AI 通过结构化 owner 操作；用户只做不可代理的授权、登录或付费决定。
- `native-process` 保留给完整 Node/Python 生态、原生 SDK、OS API 和重依赖；不隐式 fallback。

## 证据 / 观察点

- 稳定设计：`docs/designs/2026-08-28-wasi-service-app-runtime.design.md`。
- 执行计划：`docs/plans/2026-08-28-portable-capability-runtime-overall.plan.md`。
- Spike `cargo check` 与 debug 可执行构建已通过；Spin git 依赖固定到 `v4.0.2`，Rust/Wasmtime 依赖闭包可解析。
- 现有 State Component 已在 Spin runner 上完成 `list-actions -> counter_increment -> counter_read`，原 WIT、NDJSON 和宿主 KV 合同保持不变。
- 同一 Spin runner 已同时装载三个 Component：Provider 启动后，Composition 经 `host.component-call` 得到规范化联系人；Resident 启动、接收事件并在同一实例读回内存计数；stats 报告 3 个已加载 Component、1 个 Provider、1 个 Resident。
- macOS arm64 release 基线已完成同 workload 对照：Spin runner 31 MiB、直接 Wasmtime 25 MiB；空载 RSS 9.89/7.70 MiB，1 个 Component 40.28/34.84 MiB，5 个 48.92/42.94 MiB，10 个 56.36/49.16 MiB。Spin 固定增量约 6–7 MiB，但仍远低于 5 个独立 Node Service 的约 203 MiB。
- 同轮方向性延迟：Spin 首个 `list-actions` 70.09 ms、热 `counter_read` 中位数 0.11 ms；直接 Wasmtime 为 73.70 ms / 0.17 ms。当前证据未发现 Spin 造成有意义的调用延迟退化。
- Spin 实现已迁入正式 `apps/nextclaw-wasmtime-runner`，发布 artifact 名、WIT 与 NDJSON `0.1.0` 合同保持不变；旧直接 Wasmtime bindings/主实现已移除，未保留长期双 executor。
- 正式五 Guest smoke 已自动化并通过：Action discover/invoke、Host KV、storage/network denied、Provider、Composition、Resident、同 PID、stop 后角色释放。
- 迁移后的 Kernel 定向集成首次发现缓存隔离 Bug：相同 id/component path 但不同 storage grant 会复用旧 Factor config。缓存键现已纳入 data directory、storage、allowed domains 与 provider grants，并新增回归；6 条共享 runner/恢复测试通过。
- 真实产品 HTTP smoke 已通过：干净 home 启动、内置 App enable、5 个 Service Component、Provider/Resident running、`counter_read`；同轮 `--verify-rust-wasi-scaffold` 从 doctor/create/build/check/test/dev/call/pack/相对路径 install/enable 到安装后 action 全链通过。
- 外部依赖纵向合同已闭合：无显式声明的 App 始终 `ready`；独立 Provider `.napp` 以 `provides.capabilities` 进入运行中 catalog；Consumer 的 capability/resource 可由 API、CLI、Agent 共享 owner 完成 inspect/setup/bind/verify/unbind，并只把非敏感 Provider 引用原子写入实例配置。
- 两个真实独立 `.napp` 已完成 Consumer needs-capability → Provider install/enable → unique setup → Consumer enable → runner component-call → 运行期 mutation 拒绝 → disable/unbind 的全链。Provider 反向依赖保护与 binding 文件 0600 均有回归。
- Review 补齐了更新/回滚边界：未启用 App 仍可安装或切换到依赖未满足的版本；仅当当前 App 已启用、切换会立即激活候选 runtime 时阻止操作并保留原运行版本。真实 registry artifact 回归已覆盖启用中的 `0.1.0 -> 0.3.0` 拒绝与旧版本持续可用。
- Portable Runtime 最终证据：run `33276343562` 的 macOS arm64、Linux x64 成功；focused run `33277547811` 的 Windows x64 成功，包含 runner/Spin/Rust tests/runtime closure/真实 HTTP/Rust-WASI scaffold 全链。
- Desktop 最终证据：run `33278867556` 的 runtime、macOS DMG、Windows installer、Linux AppImage/deb 成功；focused run `33279269319` 的 Windows EXE 成功。

## 活跃假设

- Spin 的额外固定 RSS 和二进制体积不会抵消多 Component 共享运行时的收益。

## 已排除项

- 把所有 Redis/MQTT/数据库 Factor 默认编进 runner。
- 把外部依赖当作与自包含 App 平级的推荐方式。
- 要求用户照 README 手工安装、配置或排障。
- 用 `spin.toml`、Spin CLI、Spin App identity 替代 NextClaw 产品合同。
- 为了兼容而强迫所有 Node/native Service 改成 WASM。

## 关键决策

- 架构推荐已调整为 Spin-first，直接 Wasmtime只保留为判别性基线。
- 能力供给分为内置 Factor、可安装 Capability Provider、可移植 Component、Native Provider；外部资源绑定与 capability 实现分离。Spin 4 Factor 是静态 Rust 类型，生态扩展通过通用 Provider/Action 桥完成，不虚构任意动态 Factor ABI。
- App readiness 至少区分 `ready`、`needs-capability`、`needs-configuration`、`incompatible`，缺依赖时可以安装但禁止误启用。

## 省 Token 执行方案

- 根线程持有设计、owner、共享 WIP、最终验收与发布；不委派秘密、生产、迁移或高频协作。
- 先复用现有五个 Guest、HTTP enable smoke 和发布矩阵，不重新生成平行 fixture。
- 失败按 `cargo check -> 单 Component/单 Action -> 单角色 -> Kernel 定向测试 -> 真实 HTTP -> 三平台/完整发布矩阵` 漏斗定位；完整矩阵只在稳定后运行一次。
- 只有边界固定、只读或机械核对且净节省明确时才委派；子任务只返回结论、证据和阻塞，不复制长上下文。
- 不重复读取未变化的设计、日志或成功构建日志；长任务只读取结构化状态或末尾错误。

## 下一步

1. 按 `docs/plans/2026-08-31-wasi-document-access-authorization.plan.md` 交付 NC-163 Phase A：命名 document scope 的 inspect/grant/replace/mode/revoke 产品闭环。
2. 复用现有 WASI preopen 和已构建 runner，不修改或重编 Rust；先完成 TypeScript 垂直链和真实产品 smoke。
3. 在当前普通实例的常用端口完成用户验收交付；不创建隔离 worktree/实例，不提交、不推送、不发布。

## NC-163 当前事实与决策

- registry grant → Kernel capability snapshot → `/documents/<scope-id>` preopen 的底层链路已经存在，缺口是正式产品授权入口、状态 owner、错误恢复和撤权证据。
- Kernel `AppPackageManager` 是 document access 唯一产品 owner；App registry 是唯一持久事实源。
- Apps UI 复用 shared `ServerPathPickerDialog`，不复制目录浏览组件；Phase A 选择的是 Portable App 实际运行主机上的目录。
- `DocumentRef` 是已冻结设计中的 Phase B；当前不存在稳定 action input、ephemeral snapshot 和 job-bound cleanup 消费合同，不纳入 NC-163 Phase A。
- 当前 CLI 路径会触发昂贵 portable runtime CI，但 Phase A 不需要 Rust 源码变更。本地验收只复用既有 runner artifact，完整 native matrix 留给冻结候选/发布门。

## NC-163 本地交付证据（2026-08-31）

- App Runtime、Kernel、Server、Client SDK、CLI 与 Apps UI 已接入同一 document access owner；持久 grant 仍只存 registry，runtime resolver 只消费有效记录。
- 普通开发实例 `127.0.0.1:18792` / `127.0.0.1:5174` 已完成真实产品链：未授权拒绝、只读读取、只读写入拒绝、读写成功、替换、撤销、资源失效和 `..` 越界拒绝。
- watcher 冷重载后 `documents-read` grant 仍存在，真实 WASI 再次读取 `.local/nc163-acceptance/read/source.txt` 成功；`documents-write` 已恢复未授权状态，留给用户验收 picker 与写入授权。
- registry 回归覆盖旧字符串 grant 迁移、mode 收窄、scope 删除和 uninstall 清理；6 个受影响包 tsc、73 个定向测试、targeted ESLint、new-code governance 与 diff-only maintainability 均通过。
- 本轮没有修改 Rust/Cargo/Guest 源，也没有执行 Rust 编译；本地 normal instance 仅复用已经存在的 protocol 0.2.0 runner artifact。

## 剩余缺口 / 交接提醒

- Windows x64 的 file URL、临时实例原子 rename 和异步安装节流均已在 focused 原生 run 通过。
- 发布验证快速漏斗已补单平台 dispatch；异步安装 smoke 同时读取 operation 状态，失败时立即暴露真实错误，避免重复完整矩阵只得到模糊列表超时。
- Desktop 验证揭示 bundled app-runtime 的 `import.meta` 相对路径已迁到 `runtime/dist`，因此 WIT/Cargo.lock 必须由 Desktop bundle owner 同步重定位；已把两项资源加入强制 bundle contract，并修复 macOS N-API header 自动选择及 Windows smoke 清理重试。
- Desktop runtime、macOS DMG、Windows installer、Linux AppImage/deb 与 Windows EXE 均已通过；短暂文件锁只在业务 smoke 已成功后作为 cleanup warning。
- Spin 4 Runtime Factors 是静态 Rust 类型；生态扩展通过 Component/Native Provider，而不是未经验证的进程内动态插件。
- 当前 v1 binding 的执行身份是稳定 Provider Service id；动态 capability alias 到任意 Provider id 的路由尚未公开，替换实现必须维持同一 Service id。
