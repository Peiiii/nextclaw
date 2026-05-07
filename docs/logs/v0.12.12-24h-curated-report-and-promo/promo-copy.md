# NextClaw 24h Promo Copy (ZH / EN)

## Version for Release Notes (Bilingual, Mid-Length)

### 中文版

过去 24 小时，NextClaw 重点完成了两件事：把「安装成功率」和「运维可预期性」都拉高了一档。

- Marketplace 的 git skill 安装现在支持无 git 兜底。即使是未安装 git 的 Windows 环境，也能自动走 GitHub HTTP 路径完成安装。
- 安装目录策略进一步收敛为 NextClaw 工作区 `skills/`，减少历史路径分歧带来的困惑。
- CLI 侧明确了版本查询与状态查询职责：查版本用 `nextclaw --version`，状态判断看 `status` 输出字段，自动化语义更清晰。

同时，`nextclaw@0.9.13` 已发布到 npm（latest），对应 GitHub Release 已同步更新为中英文说明。

一句话总结：这次不是“多一个功能”，而是把跨平台安装和日常运维的稳定性做成默认体验。

### English

In the last 24 hours, NextClaw focused on one core outcome: making reliability feel default.

- Marketplace git-sourced skill installation now includes a no-git fallback. On environments like Windows without `git`, installation can continue via GitHub HTTP.
- Install target behavior is now aligned around NextClaw workspace `skills/`, reducing historical path ambiguity.
- CLI intent is clearer: use `nextclaw --version` for version lookup, and use status output fields for runtime state interpretation.

`nextclaw@0.9.13` is now published to npm (`latest`), with matching bilingual GitHub release notes.

Bottom line: this cycle is less about adding one more feature and more about turning cross-platform install and operations stability into the default experience.

## Version for Social Media (Short)

### 中文短版（微博/X/朋友圈）

NextClaw 这 24 小时主要升级了稳定性：
1. Marketplace skill 安装支持无 git 自动兜底（Windows 友好）。
2. 安装路径统一到工作区 `skills/`。
3. CLI 版本查询语义更清晰（`nextclaw --version`）。

`nextclaw@0.9.13` 已发布（npm latest + GitHub Release）。

### English Short (X/LinkedIn)

NextClaw reliability update in the last 24h:
1. Marketplace git-skill install now works even without `git` (fallback via GitHub HTTP).
2. Install target is aligned to workspace `skills/`.
3. CLI version/status semantics are cleaner (`nextclaw --version` for version checks).

`nextclaw@0.9.13` is live on npm (latest) with updated GitHub release notes.

## Version for Technical Community (Developer-Focused)

### 中文技术版

这次迭代把 marketplace git skill 安装做成了双路径：
- 有 git：`clone --sparse` 快路径。
- 无 git：GitHub contents API 递归下载兜底路径。

并且补了回归测试与隔离冒烟验证，核心目标是把“环境依赖导致安装失败”的概率压下去。  
如果你在做桌面端/CLI 工具链，欢迎参考这种“快路径 + 兜底路径 + 明确目录约束”的设计方式。

### English Technical

This iteration introduces a dual-path installer for marketplace git skills:
- Git available: sparse clone fast path.
- Git unavailable: recursive GitHub contents API fallback.

With regression coverage and isolated smoke validation, the key goal is to reduce environment-dependent install failures.  
If you build CLI/desktop toolchains, this fast-path + fallback + explicit target-directory pattern is worth adopting.

