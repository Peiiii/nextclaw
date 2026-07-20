---
"@nextclaw/service": patch
"nextclaw": patch
---

Marketplace 技能安装现在会在镜像单文件下载超时时自动切换备用源，并在完整下载后原子替换目标目录，避免安装或更新失败留下半套技能。
