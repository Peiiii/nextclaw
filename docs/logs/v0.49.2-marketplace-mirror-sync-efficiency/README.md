# 国内 Marketplace 镜像增量同步

## 迭代完成说明

Cloudflare Workers 日请求量异常的根因是国内 Marketplace 镜像每 10 分钟无条件全量刷新全部技能详情、content、files 和 blob。Cloudflare Analytics 显示，过去 24 小时 `marketplace-api.nextclaw.io` 的 35,600 次请求中，35,064 次来自同一来源，User-Agent 为 `nextclaw-marketplace-mirror/1.0`；约 137 轮同步也与 10 分钟 systemd timer 的理论频率吻合。

修复直接收敛根因：镜像仍按 10 分钟刷新目录、场景和推荐，但使用目录现有的 `updatedAt` 作为技能版本 owner，只刷新新增、变化、上轮失败或缺少本地版本状态的技能。旧 manifest 首次升级时全量建立基线，删除与失败重试语义保留。

当前单页目录规模下，稳定态每轮仅需 4 次官方请求，理论请求量从约 3.5 万次/日降至约 576 次/日，约减少 98.4%。

## 测试/验证/验收方式

- `python3 -m py_compile scripts/deploy/nextclaw-net-marketplace-mirror/marketplace-mirror-server.py scripts/deploy/nextclaw-net-marketplace-mirror/marketplace-mirror-server-test.py`
- `python3 -m unittest scripts/deploy/nextclaw-net-marketplace-mirror/marketplace-mirror-server-test.py`：11 个测试通过。
- `git diff --check`：通过。
- 覆盖旧 manifest 首次全量、稳定态 4 次源请求、变化技能增量刷新、上轮失败重试、失败保留旧文件计数、删除缓存与 stale-if-error。

## 发布/部署方式

已于 2026-09-09 通过阿里云 Cloud Assistant 部署到备案 ECS 的 `/opt/nextclaw-marketplace-mirror/marketplace-mirror-server.py`。部署前保留了时间戳备份，远端文件 SHA-256 与提交 `ae8f2f566` 一致。

旧 schema v2 manifest 已通过一次全量同步升级为 v3；基线包含 32 个技能、156 个文件、完整 `sourceVersions/fileCounts` 且无失败项。随后稳定态同步实测耗时 5.741 秒。Cloudflare Analytics 在 `2026-09-09T01:57:45Z` 至 `01:58:05Z` 精确记录到 4 次 `nextclaw-marketplace-mirror/1.0` 请求：`/health`、技能目录、scenes 和 recommendations 各 1 次，全部返回 200。

`nextclaw-marketplace-mirror-api.service` 与 `nextclaw-marketplace-mirror-sync.timer` 均已恢复为 active，下一轮 timer 已正常排期。公网健康、目录、详情、content、files、blob 均返回 200，写入接口保持 405。

`AUTOMATION_INTERVENTIONS: 2`：首次部署命令同时遇到旧 systemd 对 oneshot `activating` 状态的返回码差异和 5 分钟云助手等待窗，需拆分为“启动同步”和“等待完成”两个远端任务；API 重启后的首次健康检查缺少就绪重试，需补跑带重试的最终冒烟。后续部署入口应原生使用 `ActiveState/SubState`、异步启动长同步并内置 API readiness retry。

## 用户/产品视角的验收步骤

1. `https://api.nextclaw.net/health` 继续返回完整技能与文件统计。
2. 国内源的技能搜索、详情和安装保持可用。
3. 连续两轮无 Marketplace 发布变更时，第二轮 manifest 保留相同 `sourceVersions/fileCounts`，且官方源只收到 health、场景、推荐和目录页请求。
4. 发布一个测试技能更新后，下一轮只刷新该技能及其文件。
5. 在 Cloudflare Analytics 中观察 `nextclaw-marketplace-mirror/1.0` 请求从约 1,500 次/小时降至约 24 次/小时。

## 可维护性总结汇总

实现复用现有 sync owner 和 manifest，没有新增 revision 服务、配置入口或并行状态源。自动 maintainability 检查无错误，提示主脚本接近 500 行且测试文件增长较多；主观复核认为拆分单文件 systemd 部署资产会新增远端复制、导入与回滚边界，当前没有第二消费者，因此保留单文件更清晰。非必需的 manifest 观测字段已删除，避免扩张协议。

## NPM 包发布记录

不涉及 NPM 包发布。
