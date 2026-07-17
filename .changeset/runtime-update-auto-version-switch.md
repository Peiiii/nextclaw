---
"@nextclaw/service": patch
"@nextclaw/shared": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

修复运行时更新应用后的后续检查可能把“新版本已运行但验证失败”笼统显示为更新失败的问题；页面会区分检查、下载和应用失败，展示完整错误原因，并给出查看完整日志的命令。
