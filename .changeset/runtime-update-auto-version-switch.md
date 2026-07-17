---
"@nextclaw/service": patch
"@nextclaw/shared": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

修复运行时更新状态可能停滞、应用后仍启动旧版本，以及新版本已运行却被后续检查错误笼统显示为“更新失败”的问题：页面会区分检查、下载和应用失败，展示完整错误原因，并给出查看完整日志的命令。
