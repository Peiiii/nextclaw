# v0.16.67-platform-skill-owner-management

## 迭代完成说明

- 本次交付为用户自上传 marketplace skill 的自主管理能力，新增设计文档：[2026-04-18-platform-skill-owner-management-design.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-platform-skill-owner-management-design.md)。
- `marketplace-api` 新增 skill owner 管理数据模型与链路：
  - skill 表新增 `owner_visibility` 与 `owner_deleted_at`
  - 公共 marketplace 列表仅暴露 `publish_status='published' + owner_visibility='public' + owner_deleted_at IS NULL`
  - 新增 owner 视角接口：列出自己的 skill、读取详情、执行 `hide/show/delete`
- `nextclaw-provider-gateway-api` 新增平台用户侧 marketplace skill 代理接口，并为 owner 管理动作写入 audit log。
- `platform-console` 新增 `My Skills / 我的 Skills` 页面，提供经典工作台内的 skill 管理入口，支持：
  - 查看自己发布的 skill 列表与详情
  - 查看管理员审核状态与自己的可见性状态
  - 隐藏 skill
  - 重新公开 skill
  - 删除 skill（从默认管理列表移除，同时从公共 marketplace 视图下线）
- 扩展 [platform-console-smoke.mjs](/Users/peiwang/Projects/nextbot/scripts/smoke/platform-console-smoke.mjs)，补上 owner skill 管理的浏览器级冒烟。

## 测试/验证/验收方式

- 已执行：
  - `pnpm -C workers/marketplace-api tsc`
  - `pnpm -C workers/marketplace-api lint`
  - `pnpm -C workers/marketplace-api build`
  - `pnpm -C workers/nextclaw-provider-gateway-api tsc`
  - `pnpm -C workers/nextclaw-provider-gateway-api build`
  - `pnpm -C apps/platform-console lint`
  - `pnpm -C apps/platform-console tsc`
  - `pnpm -C apps/platform-console build`
  - `pnpm smoke:platform:console`
  - `curl https://marketplace-api.nextclaw.io/health`
  - `curl https://ai-gateway-api.nextclaw.io/health`
  - `curl -I https://platform.nextclaw.io`
  - `PLATFORM_CONSOLE_BASE_URL=https://platform.nextclaw.io pnpm smoke:platform:console`
- 结果：
  - 本次交付范围内的 `tsc / lint / build / 本地 smoke / 线上 smoke` 均通过。
  - `lint:maintainability:guard` 未全量通过，但剩余 error 来自本次任务之外的既有工作树热点：
    - `packages/nextclaw-core/src/agent`
    - `packages/nextclaw-server/src/ui/config.ts`
    - `packages/nextclaw-server/src/ui/types.ts`
    - `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx`
    - `packages/nextclaw-ui/src/components/config/use-provider-form-state.ts`
  - 本次改动自己新增出来的 maintainability error 已在收尾阶段清理完毕。
- 未完成项：
  - 未做真实线上登录态下的 owner 权限验收，因为当前会话没有可用的平台账号凭证。

## 发布/部署方式

- 已执行：
  - `pnpm -C workers/marketplace-api run db:migrate:skills:remote`
  - `pnpm -C workers/marketplace-api run deploy`
  - `pnpm -C workers/nextclaw-provider-gateway-api run deploy`
  - `pnpm deploy:platform:console`
- 发布结果：
  - `nextclaw-marketplace-api` 已部署，Version ID：`d3d10100-e811-413e-bd36-5e554970a378`
  - `nextclaw-provider-gateway-api` 已部署，Version ID：`7052d9c4-ba90-42e4-85f4-d753c7dc3865`
  - `platform-console` 已发布到 Pages，自定义域名为 [platform.nextclaw.io](https://platform.nextclaw.io/)
  - 本次 Pages 预览部署地址：<https://ef31cccb.nextclaw-platform-console.pages.dev>

## 用户/产品视角的验收步骤

1. 打开 [platform.nextclaw.io](https://platform.nextclaw.io/) 并登录平台账号。
2. 进入左侧导航 `My Skills / 我的 Skills`。
3. 确认页面能列出当前用户自己发布的 skill，并同时展示：
   - 管理员审核状态
   - 当前 owner 可见性状态
   - 更新时间、摘要、审核备注
4. 选择一个已公开 skill，点击 `Hide / 隐藏`：
   - 详情区状态切为 `Hidden / 已隐藏`
   - 管理动作切为 `Make visible / 重新公开`
   - 该 skill 不再出现在公共 marketplace 列表中
5. 再点击 `Make visible / 重新公开`：
   - 状态恢复为 `Visible / 公开中`
   - 该 skill 重新满足公共 marketplace 可见条件
6. 点击 `Delete / 删除`：
   - skill 从默认 owner 管理列表中移除
   - 公共 marketplace 中也不再显示该条目
   - 管理员审核结论字段本身不被 owner 动作覆盖

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有把 owner 管理硬塞进管理员审核状态，而是拆成独立 owner 状态模型，并额外把前端 owner API、marketplace user routes、owner support 逻辑分别独立收口，避免继续把复杂度堆进已有热点文件。
- 代码增减报告（仅统计本次交付范围文件，排除无关工作树改动；不含设计文档）：
  - 新增：1179 行
  - 删除：64 行
  - 净增：1115 行
- 非测试代码增减报告（本次范围内无测试文件变更，smoke 脚本视为运行验证脚本而非测试快照）：
  - 新增：1179 行
  - 删除：64 行
  - 净增：1115 行
- 净增原因为新增一条完整产品能力链路：数据库字段、数据源、owner 路由、平台网关代理、控制台页面、文案和冒烟验证都必须补齐，无法只靠删改旧代码完成。
- 为了把增长控制在最小必要范围内，本次已同步偿还的维护性债务包括：
  - 将 `platform-console` owner marketplace API 从 [client.ts](/Users/peiwang/Projects/nextbot/apps/platform-console/src/api/client.ts) 拆出到 [marketplace-owner-client.ts](/Users/peiwang/Projects/nextbot/apps/platform-console/src/api/marketplace-owner-client.ts)
  - 将 `marketplace-api` owner skill 用户路由从 [main.ts](/Users/peiwang/Projects/nextbot/workers/marketplace-api/src/main.ts) 拆出到 [user-skill-routes.ts](/Users/peiwang/Projects/nextbot/workers/marketplace-api/src/presentation/http/user-skill-routes.ts)
  - 将 `UserSkillsPage` 和 `platform-console-smoke` 收口为多个更清晰的局部块，清除本次新增的 maintainability error
- 抽象与边界判断：
  - 管理员审核状态与发布者 owner 状态已分离，边界比直接复用审核状态清晰
  - `marketplace-api` 中 owner 管理逻辑独立下沉到 [d1-marketplace-skill-owner-support.ts](/Users/peiwang/Projects/nextbot/workers/marketplace-api/src/infrastructure/skills/d1-marketplace-skill-owner-support.ts)，没有继续污染 admin support
  - 平台网关与前端均采用新增 owner 专属入口，而不是在既有 admin 页面上打补丁
- 目录结构与文件组织是否满足当前治理要求：
  - 本次新增文件都落在现有职责目录下，且未新增本次范围内的治理 error
  - 全仓 `lint:maintainability:guard` 仍被其它已有热点阻断，具体见“测试/验证/验收方式”
- 下一步整理入口：
  - 若后续 owner skill 管理继续扩展为编辑 metadata、恢复已删除 skill、批量操作，应优先继续沿 `owner support / user routes / owner client / My Skills page` 这条边界演进，不要回流到 admin 审核链路。

## NPM 包发布记录

- 不涉及 NPM 包发布。
