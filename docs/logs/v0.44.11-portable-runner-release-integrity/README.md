# v0.44.11 Portable Runner 发布完整性修复

## 迭代完成说明

- 根因：v0.45.0 的正式 `npm-runtime-update-release` 只部署 JavaScript Runtime，没有构建 `nextclaw-wasmtime-runner`；ZIP 生成与旧更新器也没有形成 Unix 执行权限合同。独立验证 workflow 虽然构建 runner，但其 artifact 从未进入正式发布包。
- 确认方式：公开 Linux x64 Runtime ZIP 与用户服务器的 `0.45.0` 安装目录均不存在 runner，复现了启用「日常小工具箱」时的同一错误。
- 根因修复：正式 workflow 为四个发布目标构建 runner；bundle producer 在签名之前检查 runner；ZIP 写入权限且更新器恢复权限；新 Runtime 对旧更新器丢失的执行位做固定路径自修复；公开发布验证增加真实 Service App 调用。
- v0.45.1 发布后实机复验又确认了两个更深层缺口：公开 NPM 包本身不携带原生 runner，launcher 却会把不完整的 packaged runtime 当成完整新版本，阻止同版本 Runtime ZIP 自愈；Linux runner 由 glibc 2.35 构建环境产出，实机 glibc 2.32 无法加载，随后未处理的 stdin `EPIPE` 带崩主服务并形成 Nginx 502。
- 本轮根因修复把 NPM 明确收敛为 launcher/应急 runtime：完整性不足时自动下载并激活签名 Runtime，同版本不完整 bundle 可以原子替换且失败回滚；Linux x64 runner 改为 musl 静态链接；runner 启动失败只拒绝当前请求，不再退出 NextClaw 主进程。

## 测试/验证/验收方式

- Node 定向测试 19 个、Service Runtime 定向测试 12 个、distribution 定向测试 2 个通过。
- `@nextclaw/service` 与 `nextclaw` 的 TypeScript 检查通过；两个 package lint 无 error。
- 本机真实构建 runner 与 Runtime ZIP，确认 runner 为 `0755`，并从解压后的正式 bundle 成功调用 WASM 状态组件 `counter_read`。
- `pnpm dev:verify-update -- --rebuild` 完成隔离更新回放：自动发现、下载、应用、进程替换、`current.json` 切换与清理均通过。
- 新代码治理、backlog ratchet、diff check 与维护性 Review 通过；Review 无未关闭 finding。
- 新增真实 HTTP 发布门：启动发布后的服务，经 `/api/app-packages/.../enable` 启用内置应用，验证 5 个 Component、Provider、Resident 与 `counter_read`，而不是只做 runner 文件检查或 direct-call。
- 本轮本地证据：40 个 runtime/launcher/runner 定向测试、四个受影响 package 的 TypeScript 检查、真实 HTTP 五组件闭环和 YAML 解析通过；`better-sqlite3@12.11.1` 在 Node 22 工作区安装和 Node 26.7.0 全新 NPM 安装中分别完成内存数据库读写；维护性检查 0 error。Linux 静态产物与三平台闭环由分支 CI 和正式发布产物继续验收。

## 发布/部署方式

- v0.45.1 已使用统一 `release.yml target=all` 从冻结的 `master` 单次完成全平台正式发布，但实机 ABI 验收失败，因此不能作为本次问题的最终交付。
- 修复通过分支三平台验证后，使用同一统一入口单次发布 v0.45.2；禁止分别重发 NPM、Runtime 或 Desktop。
- GitHub Actions 依次闭合 NPM、Stable Runtime、Desktop，并由公开 manifest、真实安装验证和主线回流作为完成门；不在本地重复发布已完成阶段。

## 用户/产品视角的验收步骤

1. 在 Linux x64 服务器把 NextClaw 更新到 v0.45.1。
2. 确认 stable Runtime 指针切换到 `0.45.1`，对应 runner 文件存在且可执行。
3. 在应用列表启用「日常小工具箱」，执行代表性 Action，并确认返回持久状态数据而非 runner 缺失错误。
4. 核对 NPM latest、四个平台 Runtime manifest、Desktop stable manifest、GitHub Release assets 与 APT。

## 可维护性总结汇总

- 复用现有 workflow、runner builder、runtime bundle producer、update service 与 distribution owner，没有新增 manager、registry 或平行发布器。
- 同一 runner 存在性与权限合同由 producer、installer 和发布后验证分别在自己的边界负责；兼容修复仅作用于签名 Runtime 的固定 runner 路径。
- 自动检查最初发现发布 workflow 测试函数新增预算违规，已提取单一职责 helper 并重新验证；最终 0 error。runtime service 目录仅保留一个未恶化的历史文件数警告。
- 新文件与目录通过现有命名、角色、模块边界和 package import 治理。

## NPM 包发布记录

- 需要发布：修复已公开 v0.45.0 的稳定 Runtime 缺陷，用户必须获得新的不可变 package/runtime identity。
- 直接 changeset：`nextclaw` patch、`@nextclaw/service` patch；最终依赖闭包由 stable release prepare 计算。
- v0.45.1 已发布，但 Linux glibc 2.32 实机启用失败，证明旧发布门不充分。
- 当时的完成门：以 v0.45.2 的 NPM latest、四平台 Runtime manifest、GitHub Release、Desktop manifest、APT 和真实 Linux HTTP 启用结果为准；最终实测结果见下节。

## v0.45.2 最终实测与发布闭环

- `nextclaw@0.45.2` 已作为 NPM `latest` 发布；Stable Runtime 的四个平台 bundle（macOS arm64/x64、Linux x64、Windows x64）和公开 Linux runner 均已完成产物验收。
- 在用户的 Linux x64 实机（glibc 2.32）上，从旧 launcher/runtime 状态执行稳定更新后，Runtime 切换至 `0.45.2`；runner 位于签名 Runtime 的固定路径、存在且具备执行权限，并被确认是静态 PIE ELF，因此不再依赖宿主机较新的 glibc。
- 实机重启后的真实服务链路已通过：`app enable nextclaw.portable-runtime-lab --json` 返回 `enabled: true`，5 类 Service Component（state、capabilities、resident、provider、composition）均完成启用；状态组件 `counter_read` 返回持久化计数。启用前后 NextClaw 主进程 PID 未变化，服务保持 active，近期 journal 未出现 `EPIPE`、runner 缺失或主进程退出，入口不再产生 502。
- v0.45.2 的中英文更新说明和结构化 release notes 已部署并可公开访问。Desktop 稳定构建使用冻结 target `bba91f3fcd05224c55b2ed77ac34f780d3922615`，其 `.desktop.1` 仅为稳定 Desktop 构建序号，不表示 beta 或 prerelease。
- Desktop stable run `33253296049` 于 2026-08-29 12:45:12Z 至 13:11:29Z 完成（约 26 分钟）；五个平台构建、资产发布、GitHub Release、stable update channels 和 Linux APT repo 均成功。公开 Release 精确包含 30 个已上传且非空的预期资产；五份 stable manifest 均指向 Runtime `0.45.2`，APT `Packages` 已包含 `nextclaw-desktop` `0.0.273`。

## 无人值守发布流程修复

- 旧流程把 NPM 包发布放在发布内容可验证之前，且发布后安装验证使用 registry 解析版本号，可能遇到 registry 缓存传播窗口；本次失败并非产品 artifact 重建失败，而是验证进程被大量下载进度输出撑满默认 `spawnSync` buffer，造成父发布被误判失败。
- 正式 `target=all` / 产品发布现在会在任何不可逆 NPM 发布前检查结构化发布内容；NPM-only 仍保留其独立语义，不会被不适用的产品内容门误阻断。
- 发布后稳定安装验证改为安装不可变 NPM tarball，并显式扩大验证进程输出缓冲区；这消除了版本缓存和进度输出导致的假失败，同时仍保留真实安装、升级、HTTP 启用和五组件调用作为验收链路。
- 对上述发布合同新增定向回归测试；验证通过后才合入主线。今后的故障先沿失败步骤或受影响平台做最小复现和定向验证，已成功的平台产物与证据复用，不重跑整条发布链路。
