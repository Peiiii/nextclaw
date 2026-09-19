# D1 写入紧急止血

## 迭代完成说明

生产账号的 D1 每日写入额度快速接近上限。只读查询确认，分发采用量同步对
`distribution_download_assets` 执行无变更条件的 upsert：即使上游累计值不变，每两小时仍重写资产记录。

本批次把 `nextclaw-provider-gateway-api` 的 Wrangler Cron Trigger 显式设为空列表，暂停自动同步并让部署删除生产环境已有调度，从写入源头止血；未删除 D1 数据、未改 schema、未改变 HTTP/API 行为。恢复条件记录在
[`../../designs/2026-09-19-d1-write-containment.design.md`](../../designs/2026-09-19-d1-write-containment.design.md)。

## 测试/验证/验收方式

- Worker build、lint、TypeScript 检查和分发采用量定向测试通过。
- Wrangler dry-run 能生成生产 Worker 包，且配置中不再声明 Cron Trigger。
- 部署后检查生产健康端点，并确认线上调度配置不再包含原定时任务。

## 发布/部署方式

从隔离 worktree 精确提交本批次文件，推送并确认远程 `master` SHA 后，通过 Wrangler 部署
`nextclaw-provider-gateway-api`。不执行 D1 migration。

## 用户/产品视角的验收步骤

1. 打开 `https://ai-gateway-api.nextclaw.io/health`，确认网关仍可用。
2. 在 Cloudflare Worker 调度配置中确认原两小时 Cron 已消失。
3. 观察后续 D1 指标，确认不再出现同来源的周期性批量写入。

## 可维护性总结汇总

采用删除调度入口的最小单路径止血，没有新增抽象、兼容路径或第二状态 owner。配置恢复条件显式记录，避免控制台与仓库漂移。自动维护性检查结果随交付证据记录。

## NPM 包发布记录

不涉及 NPM 包发布。
