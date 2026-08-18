---
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
---

修复 Marketplace Panel App 固定到右侧边栏后无法再次打开的问题。固定入口现在使用稳定的 Panel App ID，并在升级、重装或重新启用后自动解析当前安装版本，不再依赖历史安装路径。
