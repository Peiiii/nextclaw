# Portable Runner 发布完整性设计

## 问题与证据

`nextclaw@0.45.0` 的 Linux runtime bundle 已发布并可安装，但归档及服务器安装目录都缺少 `runtime/resources/native/linux-x64/nextclaw-wasmtime-runner`，导致用户启用 Portable Service App 时失败。

现有 `portable-runtime-validate` 会单独构建并上传 runner artifact；正式 `npm-runtime-update-release` 只执行 `pnpm deploy`，没有生产或下载该 artifact。发布验证只证明 runtime 可以更新并打印版本，没有证明 Portable Service App 能运行。

## 必须成立的不变量

1. 每个公开 runtime manifest 对应的 ZIP 必须包含当前 `platform-arch` 的 runner。
2. Unix runner 安装后必须可执行；Windows runner 必须存在。
3. 缺少 runner 时必须在签名和上传之前失败。
4. 通过旧 updater 安装的新 runtime 仍必须可用；不能要求用户手工 `chmod`。
5. 发布成功验证必须覆盖真实归档、安装结果和一次 Portable Service App 调用。

## 单一主链

1. `npm-runtime-update-release` 在每个平台构建正式 runner 和通用 WASM components。
2. `build-npm-runtime-update-channel` 作为 runtime bundle producer，在 `pnpm deploy` 后校验 runner 存在且源文件权限正确，并把文件权限写入 ZIP。
3. `NpmRuntimeUpdateService` 解压时恢复 ZIP 中的普通权限位，服务未来更新。
4. 新 runtime 启动时显式执行一次 distribution 资源准备，只对自己已签名安装目录中的 runner 修复缺失的 Unix 可执行位，并记录日志，兼容 0.45.0 及更早 updater 的解压行为。
5. 发布验证检查公开 ZIP、真实更新后的 runner 路径/权限，并执行内置日常工作工具箱的代表性能力。

## 生命周期与失败边界

| 场景 | 行为 |
| --- | --- |
| 正常构建 | runner 进入平台 runtime ZIP，Unix mode 为可执行 |
| runner 未构建或漏复制 | bundle producer 在签名前失败，不生成 manifest |
| 旧 updater 丢失 Unix mode | 新 runtime 启动时修复自己固定资源路径的权限 |
| 新 updater 安装 | 解压阶段按 ZIP 权限恢复，无需后续修复 |
| runner 文件缺失或不是普通文件 | 不创建、不下载替代物，Service App 明确失败 |
| 发布取消/重试 | 使用标准 stable patch 发布 checkpoint；已成立阶段不重复发布 |

## 结构取舍

- 保留现有 runner builder、runtime channel builder、update service 和 distribution owner，不新增 manager、registry 或通用 native-resource 框架。
- 不从独立 CI artifact 拼正式包；正式 workflow 自己构建，避免验证产物与发布产物分叉。
- 权限兼容仅作用于固定的 distribution runner 路径；不对任意文件或用户路径做 chmod。该兼容由 NextClaw runtime distribution owner 维护；当 `minimumLauncherVersion` 提升到包含权限保留解压器的版本后删除。
- 本次不改变 WASM host contract、Service App manifest、权限模型或 UI。

## 验证标准

- 修前：0.45.0 公开 Linux ZIP 和服务器安装目录均缺 runner。
- 定向测试：构建计划、runtime ZIP 内容/权限、旧 ZIP 解压权限恢复、distribution 权限修复。
- CI：Linux x64、macOS arm64/x64、Windows x64 runtime bundle 全部构建并通过发布合同。
- 发布后：`nextclaw@latest`、stable runtime manifest、公开 Linux ZIP、真实服务器更新、runner `X_OK`、日常工作工具箱启用和代表性调用全部成功。

## 设计结论

- `design-document: required`
- `plan: required`：公开 `0.45.1` 暴露了 NPM launcher、runtime bundle、三平台发布验证和线上恢复之间的能力面缺口，需要按依赖顺序闭环，执行计划见 [Portable Runtime 自愈与发布闭环计划](../plans/2026-08-29-portable-runtime-self-heal.plan.md)。

## 0.45.1 线上证据触发的补充设计

### 可观察问题与缺失不变量

公开的 `nextclaw@0.45.1` NPM tarball 不包含任何平台的 `nextclaw-wasmtime-runner`。当 NPM launcher 为 `0.45.1`、已有完整 runtime bundle 仍为 `0.45.0` 时，现有选择器把版本更高但能力不完整的 packaged runtime 当成有效 `0.45.1`；更新状态也据此认为已经是最新版，因而不会下载包含 runner 的同版本 runtime ZIP。用户最终看到的不是一个可自愈的安装，而是“版本正确、能力缺失”的永久状态。

新的不变量是：**版本只有在对应平台的运行能力完整时，才可以参与 runtime 选择和已安装版本比较。** NPM 包是稳定 launcher 及受控应急 runtime；签名 runtime bundle 才是完整产品 runtime 的标准分发单位。版本号不能替代完整性证明。

这是“能力面缺失”而不是单点打包偏差：同一缺口同时影响全新 NPM 安装、旧 bundle 上升级 launcher、同版本修复、服务重启和发布验证。

### 主链与 owner

`NpmRuntimeLauncher` 继续拥有启动时的唯一 runtime 选择，`NpmRuntimeBundleService` 继续拥有已安装 bundle 的验证和 pointer 生命周期，`RuntimeUpdateManager` 继续拥有签名 manifest 的检查、下载和激活。只补齐三者之间缺少的完整性事实，不新增第二套 updater、runner 下载器或版本状态。

启动链路固定为：

1. launcher 检查当前 pointer 指向的 bundle 是否通过现有 manifest、平台、架构、兼容性和入口校验。
2. launcher 检查 packaged runtime 是否具备当前平台 runner；Unix 还必须可执行。只有通过时，packaged version 才能参与“更高版本优先”的比较。
3. 若没有可启动的完整目标版本，launcher 通过现有签名 runtime update owner 下载并激活 stable/beta 当前 channel 的 bundle，然后从新 pointer 启动。
4. 若 bootstrap 因网络或 channel 不可用而失败：已有完整 bundle 时继续运行该 bundle；没有 bundle时才运行 packaged 应急 runtime，并输出明确的能力不完整诊断。不得扫描其它目录、复制 runner 或把失败伪装成已完成。
5. 同版本完整 bundle 始终优先于 packaged runtime，避免重启后重新落回缺 runner 的 NPM 资源。

`RuntimeUpdateManager.state.currentVersion` 只记录完整 bundle pointer，或已证明完整的 packaged runtime。`UpdateSnapshot.currentVersion` 仍只表示当前运行版本；应用更新后的 CLI 使用已激活目标版本输出结果，不再把仍在运行的旧版本误报为“已应用版本”。

### 生命周期矩阵

| 状态 | 启动行为 | 恢复结果 |
| --- | --- | --- |
| 全新 NPM 安装，packaged runner 缺失，无 pointer | 启动前获取并激活当前 channel 的签名 bundle | 首次进入产品即使用完整 runtime；离线时进入有明确诊断的应急 runtime |
| 新 launcher + 旧完整 bundle | 不以缺能力 launcher 版本遮盖旧 pointer；获取并激活新 bundle | 成功后重启到新 bundle；下载失败时继续使用旧完整 bundle |
| launcher 与完整 bundle 同版本 | 直接使用 bundle | 不重复下载，不落回 packaged runtime |
| packaged runtime 自身完整且比 bundle 新 | 可直接使用 packaged runtime | 保持既有发布/开发兼容路径 |
| bundle 损坏或平台不匹配 | 现有 bundle verifier 拒绝 | 尝试标准签名 bootstrap；失败时明确诊断 |
| 已下载、未激活或进程中断 | 复用现有 state/pointer 恢复 | 不重复下载；激活后由 supervisor/下一进程切换 |

### 发布验证合同

发布验证不再以“runner 文件存在 + 直接调用一个 state action”代表产品可用。适用平台必须并行执行同一闭环：

```text
正式产物/升级 fixture
  -> launcher 选择或自愈完整 runtime
  -> 启动真实 HTTP service
  -> POST /api/app-packages/nextclaw.portable-runtime-lab/enable
  -> JSON 2xx + enabled
  -> 通过真实 HTTP action 入口调用 counter_read
  -> 验证 provider/resident 已启动
```

矩阵至少覆盖 Linux x64、Windows x64、macOS arm64。Linux runner 使用 musl 静态链接并校验没有动态解释器或 `NEEDED` 依赖，同时验证 `X_OK` 和受限内存下主进程不退出；这些门用于发现 ABI/OOM 风险，不用增加平行的 direct-call smoke。

### 结构取舍与非目标

- 保留：现有 launcher、bundle verifier、签名 update manager、current/previous pointer 和发布 runtime ZIP。
- 删除：把“不完整 packaged runtime 的较高版本号”等同于完整已安装 runtime 的推导；同版本时 packaged runtime 覆盖完整 bundle 的选择。
- 延后：按平台拆 optional NPM runner 包。当前没有必要引入新的包拓扑和发布身份。
- 禁止：把四个平台 runner 永久塞进单一 NPM tgz、在 App enable 读路径里暗中安装、扫描任意目录找 runner、远程机器手工复制作为产品修复。
- 本次不改变 WASM host API、App manifest、权限模型、Panel UI 或 Service Component 语义。

命中的设计原则是 `single-complete-owner`、`equivalence-by-construction`、`fail-fast` 和 `abstractions-pay-rent`。新增的只有“packaged runtime 完整性”这一项已有事实及 launcher bootstrap 编排；它保护版本与能力一致的不变量，没有新增通用 registry、capability DSL 或第二条更新链路。
