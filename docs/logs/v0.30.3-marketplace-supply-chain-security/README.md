# Marketplace Skill 供应链安全闭环

## 迭代完成说明

本迭代处置 Marketplace `bird` skill 被投毒事件，并把一次性下架升级为上传、存储、审核、发布、镜像和本地安装面的持续防护。

- 根因：2026-02-27 从外部 OpenClaw skill 源导入的 `SKILL.md` 已包含伪装安装说明、混淆 shell 执行和恶意网络指标；后续批量归属迁移又把历史条目统一标记为 `@nextclaw/*`、`published/admin`，形成了信任漂白。
- 确认证据：Git 历史中的恶意工件 SHA-256、生产 D1/R2 保存的同一内容、公开下载链路和本机隐藏 skill 副本互相吻合；精确 IOC 扫描在当时线上目录中只命中 `bird`。
- 根因修复：Marketplace 现在由单一安全服务在上传时扫描，并在管理员发布前对 R2 中的实际存储文件重新扫描；官方 scope 只对安全判定自动发布，高风险命令进入人工审核，已知恶意指标直接阻断。
- 原子性修复：upsert 先把条目置为 pending、完整替换文件，再按 `updated_at` 防并发条件切换为 published，避免上传失败时继续暴露旧工件。
- 历史数据修复：历史 seed 中的恶意内容改为禁用占位文件，生产迁移 `0010_revoke_bird_skill_20260811.sql` 强制拒绝现存条目并保留取证内容。
- 镜像修复：国内镜像 manifest 升级到 schema 2，记录 slug 与 package name，并对已从上游消失的 skill 淘汰详情、内容、文件列表和单文件 blob 缓存。
- 本机处置：`~/.nextclaw/workspace/.agents/skills/bird-su` 中与恶意工件哈希完全一致的副本已移出可加载根目录，保存在 `~/.nextclaw/quarantine/marketplace-bird-20260811/`，权限仅限当前用户，便于后续取证。

这组修改直接修复了信任归属、发布门禁、存储重扫和镜像失效四个根因，不依赖仅删除一个公开条目的表面处置。

## 测试/验证/验收方式

- Marketplace Worker：2 个 Vitest 文件、8 个测试通过。
- TypeScript：`workers/marketplace-api` 的 `tsc --noEmit` 通过。
- 定向 lint：Marketplace Worker lint 通过。
- D1：全新隔离数据库顺序执行 10 个迁移通过；`bird` 为 rejected，安全占位 SHA 正确，恶意 seed SHA 命中数为 0。
- 镜像：本地 Python 测试 7 个通过；ECS Python 3.6 隔离 staging 测试 7 个通过。
- 生产门禁：带已知 IOC 的 harmless dummy 上传被 400 拒绝且未落库；尝试重新发布生产 `bird` 被 400 拒绝。
- 生产可见性：国际站和国内镜像的 `bird` 详情、内容、文件列表、单文件下载入口均返回 404。
- 国内同步：远端脚本与本地 SHA-256 一致；schema 2 manifest 生成成功，32 个 skill 均有 package name，失败项为 0。
- 本机影响面：LaunchAgent/LaunchDaemon、crontab、活动恶意 IP 连接和可疑下载文件均为 0；隔离后所有活动 skill 根目录中的恶意 SHA 命中数为 0。
- 历史执行核查：只读解析 4,206 个 NextClaw/Codex JSONL 记录，匹配恶意执行形态的历史 shell 工具调用为 0；现有命中均为读取、调查或审计留痕。

## 发布/部署方式

- Cloudflare Worker 已通过 Wrangler 紧急路径部署，生产版本：`c54f510b-a584-4bb2-9696-d7aa45544094`。
- Worker 上一可回滚版本：`7f6cb266-3fd0-4e4e-8fe6-6f86b44849cf`。
- 生产 D1 仅应用迁移 `0010_revoke_bird_skill_20260811.sql`。
- 国内 ECS 已替换镜像同步脚本，旧脚本保存在 `/opt/nextclaw-marketplace-mirror/marketplace-mirror-server.py.backup-20260811`。
- 未重启 NextClaw 宿主、API 服务或桌面应用；镜像仅执行一次性同步。
- 本地源码尚未 commit、push 或创建 PR。

## 用户/产品视角的验收步骤

1. 在国际 Marketplace 和国内镜像分别访问 `bird` 的详情与安装入口，均应不可见并返回 404。
2. 用管理员接口尝试重新发布旧 `bird`，应得到安全策略阻断且状态继续保持 rejected。
3. 上传包含已知恶意指标的测试工件，应在进入存储和公开目录前返回 400。
4. 上传包含直接 `curl/wget | shell` 的未知工件，官方 scope 也只能进入 pending/manual-review，不能自动发布。
5. 上游删除任意已缓存 skill 后执行镜像同步，国内详情、内容、文件列表和单文件 blob 缓存应一并消失。

## 可维护性总结汇总

- 已尽最大努力改善可维护性：安全规则集中在纯扫描 utility，上传与发布门禁由一个 security service 统一拥有，repository 只编排持久化和状态转换。
- 采用单一路径和明确 owner，没有为兼容旧恶意数据增加永久 fallback；历史 seed 直接替换为安全占位。
- 国内镜像复用既有 cache path owner，只补充确定性的 package-name 识别和淘汰逻辑，没有另建平行缓存系统。
- 文件和目录通过 planned-path governance；设计文档、公开安全说明、迁移、服务和测试各自位于现有 owner 目录。
- 自动 maintainability 检查通过，仅提示 repository 388/400 行、镜像脚本 459/500 行接近阈值；本次文件范围的全套 governance 检查通过。全工作区组合命令另被既有未提交前端改动中的 React effect 规则拦截，本迭代未修改或混入该无关范围。已执行主观复核，未发现空壳拆分、重复 owner 或需要为行数而扩大的改动。

## 红区触达与减债记录

### `workers/marketplace-api/src/infrastructure/d1-marketplace-skill.repository.ts`

- 本次是否减债：是。
- 说明：把安全判断抽到真实 security service owner，并把 upsert 改为 pending staging + 条件发布，repository 保留持久化编排职责。
- 下一步拆分缝：若文件存储生命周期继续增长，可按现有 R2 file-store 边界抽出持久化组件；本次不为接近行数阈值制造空壳。

### `scripts/deploy/nextclaw-net-marketplace-mirror/marketplace-mirror-server.py`

- 本次是否减债：是。
- 说明：统一由 manifest 维护 slug/packageName 快照，并删除旧条目的全部缓存派生物，消除手工删缓存的隐式运维路径。
- 下一步拆分缝：达到阈值后优先按 snapshot sync 与 HTTP serving 两个真实运行职责拆分；当前保持单文件部署降低 ECS 应急发布复杂度。

## NPM 包发布记录

不涉及 NPM 包发布。
