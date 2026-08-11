---
"nextclaw": patch
"@nextclaw/service": patch
"@nextclaw/ui": patch
---

修复设置页更新后仍由 systemd 拉起旧运行时的问题。更新现在保持一键完成，并在切换运行时后由稳定 launcher 重新拉起新版本，页面版本、内核版本和实际进程保持一致。
