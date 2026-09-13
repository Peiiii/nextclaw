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
| AUTH-5 | true | 修复合入 origin/master，主工作区无遗漏 | passed | 22d22669a 已推送；reconcile 返回 LOCAL_MAINLINE_SYNCED，主工作区干净 |
| AUTH-6 | true | VPS 已部署冻结主干产物，标准重启选择正确新版，健康和公开认证正确 | passed | 18:02 普通 restart：0.53.0 → 0.54.2；PID 20118 → 55242；1,000 文件哈希一致；公网健康正常、匿名控制401、41资产200 |
| AUTH-7 | true | VPS 真实模型经 CLI 自重启，原会话自动继续并核对版本 | passed | ncp-auth-restart-20260913：native/codex-sub/gpt-5.6-sol；PID 55242 → 55400；1 resumed/0 failed，恢复后输出 AUTH_RESTART_20260913_OK；后续普通消息 AUTH_AFTER_RESTART_OK、run.finished |

当前阶段：交付收尾；全部 Required 已 passed。当前用户指定部署为 Linux VPS，未声明其它平台人工验收。线上验收会话：[查看](http://8.219.57.52/chat/sid_bmNwLWF1dGgtcmVzdGFydC0yMDI2MDkxMw)。

打包恢复：隔离目录缺 native runner，确认主工作区 darwin-arm64 已有兼容产物后复制复用。NPM 官方源经本机代理持续 ECONNRESET，离线元数据不足；切换当前进程到 npm mirror 后部署依赖安装成功，不修改项目 registry 配置。VPS 当前剩余 1.3 GB，新版 bundle 约 235 MB，数据不复制到同一磁盘，保留旧运行产物与 unit 回滚。

完整本地升级：`dev:verify-update --no-open --rebuild` 成功验证自动发现、签名下载、apply、0.54.2-dev.0 → 0.54.2、PID 19569 → 28517、current pointer 与20个内置技能，验证宿主已清理。缓存构建期间 Linux runner 传输使输入变化，改用 rebuild 并冻结源；终止慢传输后删除不完整 native 文件，未将它部署到 VPS。

VPS 部署目录：`/home/admin/.nextclaw/hotfix-deployments/20260913-auth-22d22669a`。新构建的33个workspace包与现有Linux包外部依赖合同完全一致；通过8,077,045字节增量归档更新1,000文件，保留原生和外部依赖，现场复验所有SHA-256。删除生效中的历史30-runtime-053.conf覆盖，但备份保留；首轮迁移也通过标准受控restart完成，未强杀。保留旧0.54.2 bundle、unit/config备份及独立 rollback.sh（语法和输入存在性已核对，未在健康线上执行回滚演练）。部署10:02:24Z开始、10:02:36Z完成，12秒；该路径由本机SSH发起，不称CI自动发布。AUTOMATION_INTERVENTIONS: 0。原SSE连接因真实重启断开，恢复证据来自持久journal与独立后续SSE请求，不把前一个smoke连接错误当恢复失败。
