---
"@nextclaw/kernel": patch
"@nextclaw/client-sdk": patch
"@nextclaw/server": patch
"@nextclaw/service": patch
"@nextclaw/shared": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

让桌面端与 NPM 安装态在持续运行期间固定每两小时自动检查更新，不再提供关闭自动检查或启用自动下载的配置；发现新版本后只提示用户，由用户明确点击后才下载和应用。更新通道切换会等待旧检查收口后检查新通道，避免复用过期结果。同步增强本地更新验证，使开发者无需等待真实发版或重启即可验证自动发现、手动下载、应用和版本切换。
