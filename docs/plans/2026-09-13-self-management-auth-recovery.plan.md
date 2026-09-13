# 自管理认证修复交付计划

- contract-id：self-management-auth-recovery-v1
- parent-goal：开启认证的 NextClaw 能通过标准 CLI 自更新、自重启并继续会话，修复合入主干且 VPS 更新验证完成。
- scope-revision：1；用户授权实现、充分验证、合入主干和 VPS 更新。
- 设计：[开启认证后的自管理与升级恢复](../designs/2026-09-13-self-management-auth-recovery.design.md)
- 工作区：`/Users/peiwang/Projects/nextbot-self-management-auth-recovery`；初始主工作区干净，HEAD `7c99f9ae094aeb51a48635d5d44b3f4cbdad974e`，无草稿迁移。

## 阶段与恢复入口

1. 复用上位设计，实现 bridge 传输、重启、诊断及正式入口验收；维护自管理文档与 changeset。
2. 定向测试、相关 tsc、真实进程替换与 Review。失败按证据返回原 owner。
3. 提交并合入远程 master，冻结提交；从冻结产物部署 VPS，备份后迁移 launcher 覆盖，验证真实模型续跑、健康及版本。
4. 更新原事故证据、主线回流和本 ledger。压缩恢复先读本文件，不能把阶段通过当整体通过。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| AUTH-1 | true | 开启认证的正式入口接受本机 CLI，匿名和错误凭据仍拒绝 | passed | 正式 router 进程验收，每代 anonymous=401、invalid=403 |
| AUTH-2 | true | restart/status 共用可信传输，失败不强杀、不泄漏凭据 | passed | bridge 10 项、restart 8 项及真实 runtime.version 读取 |
| AUTH-3 | true | 签名更新、两次进程替换、原会话恢复经过正式认证 router | passed | 2026-09-13 17:53 本地两轮进程验收，三个 PID、两个会话 |
| AUTH-4 | true | 类型检查、定向回归、Review 及用户文档完整 | passed | service/server tsc；定向 lint；auth/control 17 项；governance/ratchet/skill 检查；Review 0 errors |
| AUTH-5 | true | 修复合入 origin/master，主工作区无遗漏 | not-run | |
| AUTH-6 | true | VPS 已部署冻结主干产物，标准重启选择正确新版，健康和公开认证正确 | not-run | |
| AUTH-7 | true | VPS 真实模型经 CLI 自重启，原会话自动继续并核对版本 | not-run | |

当前阶段：本地完整产物升级验证与交付准备；设计/实现审查无未关闭 finding。未关闭：AUTH-5 至 AUTH-7。不加入无关 UI、美学或全平台人工验收噪声；当前用户指定部署为 Linux VPS，跨平台基础回归按实际可用环境证明。

打包恢复：隔离目录缺 native runner，确认主工作区 darwin-arm64 已有兼容产物后复制复用。NPM 官方源经本机代理持续 ECONNRESET，离线元数据不足；切换当前进程到 npm mirror 后部署依赖安装成功，不修改项目 registry 配置。VPS 当前剩余 1.3 GB，新版 bundle 约 235 MB，数据不复制到同一磁盘，保留旧运行产物与 unit 回滚。
