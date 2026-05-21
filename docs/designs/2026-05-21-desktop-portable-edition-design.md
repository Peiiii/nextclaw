# Windows Portable Edition Design

## 目标

交付 Windows Portable Edition：用户下载 zip，解压到 U 盘或任意目录，双击 `NextClaw Desktop.exe` 即可使用；运行数据默认写入同目录下的 `data/`，并且可以和普通安装版同时运行、同时保留各自数据。

本次是 Windows portable 完整交付，不是把安装器改成 portable，也不是只给一个未验证的备用 zip。

## 范围

- 支持 Windows x64 portable zip。
- 支持 Windows arm64 portable zip；CI 验证包结构，x64 runner 上不执行 arm64 二进制启动。
- 普通 Windows 安装版继续保留，并继续做 installer smoke。
- Portable Edition 暂不支持应用内更新。升级方式是下载新版 portable zip，保留旧包的 `data/` 目录或把 `data/` 迁移到新版目录。
- macOS / Linux portable 不在本次范围。

## 交付形态

Release assets 必须包含：

- `NextClaw-Portable-<desktop-version>-win-x64.zip`
- `NextClaw-Portable-<desktop-version>-win-arm64.zip`

Zip 内的根目录固定为 `NextClaw-Portable/`，其中包含：

- `NextClaw Desktop.exe`
- Electron unpacked app 文件
- `nextclaw-portable.json`

`data/` 不预置在 zip 中，由首次启动创建。

## Owner 设计

`DesktopInstallationProfile` 是安装形态事实源，不是一个泛化的 portable manager。它只回答：

- 当前是 `installed` 还是 `portable`
- portable root 在哪里
- desktop data / userData / logs / runtime home 应该落到哪里
- 当前实例隔离 id 是什么
- 当前安装形态是否支持应用内更新
- 需要注入给 runtime 的环境变量补丁是什么

它不负责：

- 启动窗口
- 启动 runtime
- 下载或应用更新
- 管理 release asset
- 持有业务状态

下游链路：

1. `main.ts` 在创建 logger / update shell / runtime 前解析 profile。
2. `applyDesktopInstallationProfile` 只应用 Electron `userData`、`logs` 和 runtime env patch。
3. runtime path 继续通过既有 `desktop-paths` 读取 override，不新增平行路径系统。
4. update coordinator 只消费 `updateCapability`，portable 时进入明确 blocked 状态。
5. smoke 脚本验证 portable 数据真正落在 portable root 的 `data/` 下。

## 抽象力度约束

只保留一个安装形态 owner。不要提前拆成 resolver / marker reader / path applier / capability service 等多层对象，除非后续出现真实变化轴，例如 macOS portable、加密数据目录或 portable updater。

允许的小抽象：

- 纯常量文件，用于避免测试加载 Electron。
- package / verify 脚本，用于把 release asset 合同自动化。

不允许的小聪明：

- 用安装版路径 + 环境变量临时伪装 portable。
- 用 fallback 静默吞掉坏 marker 后退回 installed。
- 在消费者包里新增 deep import 或 tsconfig alias 来绕过边界。
- 让普通安装版和 portable 共用同一个 userData / runtime home。

## 验收标准

- Windows x64 portable zip 可解压启动。
- 首次启动后出现 `data/desktop`、`data/runtime-home`、`data/logs`。
- main log 记录 `installationKind=portable`，并记录 portable data / runtime home。
- portable 应用内更新入口进入 unsupported blocked 状态，不触发下载。
- 普通安装版 smoke 仍通过，且与 portable 使用不同数据路径。
- GitHub beta preview release 上能下载 Windows portable zip。
