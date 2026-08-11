# v0.31.1 更新恢复一致性

## 迭代完成说明

本批闭合两条真实安装态更新链路。

第一条是 NPM runtime 设置页更新：根因是 Linux systemd unit 固定执行安装时解析出的版本目录；运行时指针虽然切到新版，服务重启仍会回到旧入口，因此用户看到内核版本变化而产品版本和实际内容没有变化。通过目标 VPS 的 unit、进程命令和运行时指针，以及隔离环境的双版本真实 apply 确认根因。修复让 systemd 固定执行稳定 launcher，并让设置页更新动作直接完成下载、应用和重连，不再暴露隐含的两阶段语义。

第二条是 Marketplace 技能更新：底层本地漂移保护会正确拒绝覆盖，但错误跨 CLI 子进程后被包装为通用 `MANAGE_FAILED`，Web UI 无法提供恢复动作。修复保留 lifecycle 的单一漂移判定 owner，将该确定性冲突恢复为 `409 / MARKETPLACE_SKILL_LOCAL_CHANGES`，并且只有用户明确确认后才对同一技能重试一次 `force` 更新；取消不会产生第二次请求。

目标 VPS 上的 `@nextclaw/proxy-local-ai-subscriptions` 已更新。调查同时发现公开 Marketplace 包缺少仓库已有的 `scripts/cliproxy-service.mjs`，现已重新发布完整 8 文件。发布闭环又暴露了国内镜像同步缺陷：同步器强制刷新技能详情和 blob，却从已有缓存读取 files 列表，导致新增文件永久缺席。修复后 files 列表也由同步任务强制刷新，国内镜像与官方源恢复一致。

## 测试/验证/验收方式

- runtime 更新定向测试 30 项通过，覆盖 systemd launcher、runtime apply、gateway 交接和宿主自启动。
- 设置页更新前端测试 8 项通过，覆盖一键 apply、重连与最终版本状态。
- 隔离真实更新从 `0.31.0-dev.0` 应用到 `0.31.0`，进程 PID 发生切换，最终 API 返回 up-to-date。
- Marketplace Service 组装边界测试 17 项通过，精确断言 CLI 冲突恢复、HTTP 409 错误合同和显式 `--force` 重试。
- Marketplace 前端测试 13 项通过，覆盖确认覆盖、取消保留以及冲突不显示通用错误 toast。
- Marketplace 镜像 Python 测试 8 项通过，新增回归证明同步器先刷新 files 列表，再按新列表预热文件 blob。
- `@nextclaw/service`、`@nextclaw/server`、`@nextclaw/ui` TypeScript 编译通过；触达文件定向 ESLint 和 `git diff --check` 通过。
- 官方 Marketplace 与国内镜像均返回 8 文件，`updatedAt=2026-08-11T07:24:32.593Z`，全部 SHA-256 与仓库一致。
- VPS 不指定源执行普通 Marketplace update，第一次返回 `updated: true`，第二次返回 `updated: false / up-to-date`；技能入口 `cliproxy.mjs --help` 成功。辅助文件 SHA-256 为 `d9d949a225d6becd768f156a8b46aaf377400b3deef5485213bde5f00697322b`，与仓库一致。

## 发布/部署方式

- 已在 `8.219.57.52` 精确更新并修复 `proxy-local-ai-subscriptions` 技能目录，没有重启 NextClaw 宿主。
- 已把 `@nextclaw/proxy-local-ai-subscriptions` 完整 8 文件发布到官方 Marketplace，并刷新国内镜像对应缓存。
- 已更新备案 ECS `8.154.43.167` 的镜像同步脚本并启动新一轮同步；只读 Marketplace API 未重启，旧快照到新缓存的切换期间服务保持可用。
- 运行时更新与技能冲突 UI 的源码修复仅进入本地提交，尚未发布 NPM、runtime update channel 或 Desktop 包，因此 VPS 当前还不包含新的覆盖确认界面。

## 用户/产品视角的验收步骤

1. 在设置页对可用 NPM runtime 更新点击一次更新，等待服务重连。
2. 确认页面版本、内核版本和实际运行版本同时切换到目标版本。
3. 修改一个 Marketplace 安装技能后点击更新，确认出现覆盖本地修改的明确提示。
4. 选择取消，确认本地文件不变；再次操作并确认覆盖，确认技能更新成功。
5. 在目标 VPS 上重新执行 `proxy-local-ai-subscriptions` 普通更新，第一次消费市场新版，随后返回 up-to-date，技能命令入口可用。

## 可维护性总结汇总

本批复用既有 launcher、runtime updater、本地漂移检测和 `force` 合同，没有新增平行更新器或第二套哈希判断。错误状态只在 CLI 边界恢复一次，HTTP 和 UI 消费稳定 code，owner 边界比通用字符串错误更清楚。国内镜像继续由同步任务统一拥有源站刷新；修复只消除 files 列表的缓存旁路，没有增加第二套定向同步机制。

自动可维护性检查无阻塞项；它提示两个触达文件接近文件预算，以及 runtime 目录存在未继续恶化的既有预算债务，因此执行了主观复核。结论为无可维护性发现：新增逻辑属于目标所需的最小清晰增长，没有用 wrapper、兼容层或无关删改隐藏复杂度。

Marketplace 发布跟进再次对镜像脚本和测试运行定向 guard，无阻塞项；脚本接近 500 行文件预算的警告触发主观复核。此次生产逻辑只净增一行，把 files 列表恢复到既有 `prewarm_path` owner，拆文件不会降低本次风险，因此保留最小修正，后续功能增长前再按同步、缓存与 HTTP 服务职责拆分。

## NPM 包发布记录

- `nextclaw`：需要 patch，状态为 `待统一发布`。
- `@nextclaw/service`：需要 patch，状态为 `待统一发布`。
- `@nextclaw/server`：需要 patch，状态为 `待统一发布`。
- `@nextclaw/ui`：需要 patch，状态为 `待统一发布`。
- 本批未执行 NPM publish、runtime update channel、GitHub Release 或 Desktop 发布。
