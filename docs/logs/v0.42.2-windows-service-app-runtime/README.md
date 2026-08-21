# v0.42.2 Windows Service App Runtime

## 迭代完成说明

- 修复了 Service App 已归类错误跨 runtime/package 边界时仅靠 `instanceof` 识别、从而降级为通用 500 的问题；现在仅接受白名单错误码、`ServiceAppError` 名称与消息的结构化错误，未知异常仍保持安全的通用响应。
- 将 Windows Desktop 打包 smoke 扩展为真实 runtime API 链路：启用个人空间、创建 Panel bridge session、授权并执行收藏和日历的写入/读取。
- 同一 smoke 兼容 PowerShell 7 与 Windows PowerShell 5，并在便携版使用基础网页解析模式。

根因确认：此前 CI 将开发态 Electron Service App smoke 与打包 Desktop 启动 smoke 分开执行，未覆盖已安装/便携 Desktop 内的 HTTP action 调用；首次真实探针还暴露了测试自身遗漏 read-action 授权及 Windows PowerShell 5 的请求兼容问题。修复将判定与探针放在真实打包宿主上，而不是在 UI 增加重试或系统 Node fallback。

## 测试/验证/验收方式

- 本地：`@nextclaw/server` Service App controller 测试 11/11 通过；kernel、server 与 desktop TypeScript 检查通过；maintainability guard 无 findings。
- GitHub Actions `desktop-validate` run `32509316539` 全绿。
- Windows `win-unpacked`、安装器和 Portable archive 均启动实际 Desktop，并完成 Favorites 与 Calendar 的授权、写入和读取请求。

## 发布/部署方式

- 以 `.changeset/windows-service-app-runtime.md` 发布 `@nextclaw/kernel`、`@nextclaw/server` 与 `nextclaw` 的 patch 版本。
- 先完成 stable NPM/runtime，再发布匹配的 Desktop stable installer、update manifest 和 GitHub Release。

## 用户/产品视角的验收步骤

1. Windows Desktop 更新到本版本。
2. 打开个人空间的收藏或日历，创建一条数据后刷新列表。
3. 读写成功；若 runtime 真正不可用，界面收到稳定的结构化错误而非无信息的通用 500。

## 可维护性总结汇总

- 以现有 `smoke-windows-desktop.ps1` 为唯一真实 Desktop 验证入口，没有新增并行启动器或测试框架。
- 错误识别收敛到稳定且白名单化的错误合同；未知异常仍不向用户泄露内部细节。
- 自动 maintainability guard 对 TypeScript 改动报告 0 errors / 0 warnings；审查无未关闭 findings。

## NPM 包发布记录

- 已作为 `v0.42.2` stable batch 发布；`nextclaw@0.42.2` 为 npm `latest`，同批 8 个公开包均已完成 registry 校验。
- Stable runtime 已构建并发布 darwin arm64/x64、linux x64、win32 x64 update bundle，GitHub Release、gh-pages 和公开 manifest 验证通过。
- 已从发布的 `0.42.1` 执行 `check`、`download-only`、`apply` 和新进程版本验证，最终确认升级为 `0.42.2`。

## Desktop 发布记录

- 已发布 [NextClaw Desktop 0.0.262](https://github.com/Peiiii/nextclaw/releases/tag/v0.42.2-desktop.1)，桌面 runtime 为 `0.42.2`。
- `desktop-release` workflow `32512855395` 的 8 个 jobs 全部成功：macOS arm64/x64、Windows x64/arm64、Linux x64、release assets、stable 更新通道与 APT。
- 闭环已验证 Windows 安装器、Windows x64/arm64 portable、Windows bundle/manifest、公钥和 Linux `.deb`；`gh-pages`、公开 Pages stable manifest 和 APT 均指向正确版本。
