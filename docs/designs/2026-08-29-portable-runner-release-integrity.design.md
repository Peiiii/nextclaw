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
- `plan: not-required`：这是一个聚焦的单批合同修复，可在同一实现、验证和 patch 发布链路闭环。
