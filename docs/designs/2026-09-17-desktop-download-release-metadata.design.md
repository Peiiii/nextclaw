# 官网桌面下载发行元数据设计

## 问题

官网当前把 `v0.39.0-desktop.1` 写成静态下载兜底，再由浏览器匿名请求 GitHub Releases API，从最近 20 条 Release 中寻找完整桌面发行版并替换链接。GitHub API 被限流、网络不可达或返回异常时，页面会静默保留旧兜底，使用户下载到过期桌面壳。2026-09-17 的现场请求返回 `403`，而稳定桌面更新通道已经发布 `v0.57.0-desktop.1`。

应保持的不变量是：稳定桌面发布完成后，官网默认下载入口必须能解析到该次稳定发行版；GitHub API 可用性不能决定用户是否获得当前桌面安装器。

## 设计

GitHub Desktop Release 继续作为发行身份和产物 URL 的唯一 owner。稳定桌面发布在完整资产公开后生成 `nextclaw.desktop-download/v1` JSON，并与现有更新清单一起写入 `gh-pages` 状态分支的 `desktop-downloads/stable.json`。beta 发布不改该文件，NPM Release 也不拥有这份状态。

官网增加同域 `/api/desktop-release` Pages Function，由 Cloudflare 服务端从 `raw.githubusercontent.com` 读取该静态 JSON、校验发行 tag 和桌面壳版本，再生成 Release 页面、四个平台安装包和 Windows portable 地址。浏览器只访问 `nextclaw.io`，不再依赖 GitHub API、GitHub Pages、GitHub Latest 的跨产品含义或跨域读取 GitHub Release 资产。`raw.githubusercontent.com` 只出现在 Cloudflare 服务端到 GitHub 的读取链路，不暴露给国内用户浏览器。

Pages Function 只接受 `nextclaw.desktop-download/v1`，符合 `v<runtime>-desktop.<iteration>` 的 tag 和正式桌面壳版本，再按既有命名合同重建下载地址。上游请求使用 Cloudflare 缓存，响应也允许边缘与浏览器短期缓存。页面仍内置一个已知稳定版本作为故障兜底；该兜底只承担同域接口或 GitHub 上游暂时不可用时的恢复能力。本次同步到已验证的 `v0.57.0-desktop.1 / 0.0.296`。

新文件在第一次新版 stable Desktop 发布前尚不存在。该阶段 Pages Function 兼容读取现有 `desktop-updates/stable/manifest-stable-win32-x64.json`，从 bundle URL 提取精确桌面 tag，再读取该 tag 自己的 `latest.yml` 取得桌面壳版本。它不查询 GitHub Releases API 或跨产品的 `releases/latest`；新静态 JSON 出现后自动成为唯一主路径。

稳定桌面 Draft 完成资产校验并公开后，发布流程才推进静态下载元数据。元数据与 stable update channel 使用同一串行状态分支和发布时机；如果元数据写入失败，桌面闭合不会被报告成功。NPM stable Release 与桌面 Release 可以独立发布，不会互相覆盖官网所读的桌面版本。

## 失败与恢复

- 同域接口成功：官网展示并下载静态元数据指向的稳定桌面发行版。
- 同域接口、上游请求或字段校验失败：接口返回失败，官网保留编译时静态兜底，不产生空链接。
- GitHub Releases API 被限流、GitHub Pages 在国内不可达或浏览器 CORS 受限：不再影响官网版本解析。
- NPM stable 已发布而配套桌面尚未闭合：静态桌面元数据继续指向上一版完整桌面 Release；桌面发布完成后切换到新版。

## 验收

1. 用户打开官网中文或英文下载页，浏览器只请求同域 `/api/desktop-release`，得到 `v0.57.0-desktop.1 / 0.0.296`，Windows 主按钮指向 `NextClaw.Desktop-Setup-0.0.296-x64.exe`。
2. GitHub Releases API 返回 `403` 或 GitHub Pages 不可达时，解析不受影响，因为链路不请求这两个端点。
3. 模拟同域接口不可用时，页面保留完整的 `v0.57.0-desktop.1 / 0.0.296` 兜底链接。
4. 后续稳定桌面发布生成新的 `desktop-downloads/stable.json`，同域接口在缓存窗口后自动返回新的 tag、桌面壳版本和下载地址；后续 NPM 或 beta Release 不改变该结果。
5. 新静态 JSON 尚未生成时，同域接口通过现有 stable manifest 与其精确 Release 元数据返回相同结果，不落到浏览器编译时兜底。

## 范围

本次不改变桌面应用自身的 bundle 更新协议、签名合同和最低 launcher 兼容策略，也不改安装器命名。Pages Function 只解析公开发行元数据，不代理 170 MB 左右的安装包；最终下载仍直接来自 GitHub Release 资产。
