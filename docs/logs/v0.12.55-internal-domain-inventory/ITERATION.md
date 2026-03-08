# v0.12.55-internal-domain-inventory

## 迭代完成说明（改了什么）

- 新增内部文档 [`docs/internal/domain-inventory.md`](../../internal/domain-inventory.md)，集中记录当前 Nextclaw 全部线上域名（Pages + Workers）。
- 文档中包含：
  - 站点/服务与 Cloudflare 项目映射
  - 业务域名与默认域名（`*.pages.dev` / `*.workers.dev`）
  - 2026-03-08 的可用性校验结果
  - 待处理/历史域名清单（含 `api.nextclaw.io` 当前不可用状态）

## 测试/验证/验收方式

- Pages 项目与域名关系核对：
  - `pnpm dlx wrangler pages project list`
- 域名可用性校验（本次已执行）：
  - `https://platform.nextclaw.io` -> 200
  - `https://platform-admin.nextclaw.io` -> 200
  - `https://docs.nextclaw.io` -> 200
  - `https://nextclaw.io` -> 200
  - `https://bibo.bot` -> 200
  - `https://openclaw-pro-max.com` -> TLS 异常
- Worker 健康接口校验（本次已执行）：
  - `https://ai-gateway-api.nextclaw.io/health` -> 200
  - `https://ai-gateway-api.nextclaw.io/v1/models` -> 200
  - `https://marketplace-api.nextclaw.io/health` -> 200
  - `https://marketplace-api.nextclaw.io/api/v1/skills/items?page=1&pageSize=1` -> 200

## 发布/部署方式

- 本迭代仅文档更新，无代码部署动作。

## 用户/产品视角的验收步骤

1. 打开内部文档：[`docs/internal/domain-inventory.md`](../../internal/domain-inventory.md)。
2. 检查是否覆盖以下两类域名：
   - 平台前端：用户站、管理站、Docs、Landing
   - API：Provider Gateway、Marketplace
3. 依据文档中的 URL 在浏览器或 `curl` 复验可用性。
4. 若新增/替换域名，按“维护规则”更新同一文档，保持单一事实来源。
