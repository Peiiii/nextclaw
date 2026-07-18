# v0.25.12 platform instance ID diagnostics

## 迭代完成说明

- 根因：remote instance 注册时已经由平台生成稳定 UUID，并通过实例列表 API 的 `id` 字段返回；platform console 只显示名称、版本、平台、状态和最近在线时间，没有把这个后台 ID 渲染出来，导致线上异常无法从用户表面快速关联到实例记录。
- 确认方式：沿 `registerRemoteInstanceHandler -> remote_devices.id -> toRemoteInstanceView -> fetchRemoteInstances -> RemoteInstancesTable` 检查完整链路，确认 ID 的生成、持久化和 API 合同均已存在，缺口只在列表展示层。
- 修复：活动实例与归档实例现在都会显示完整后台实例 ID；点击 ID 可复制，成功或失败均有可见反馈。复制逻辑复用同一剪贴板路径，没有新增后端字段、兼容分支或第二套实例身份。
- 结构收口：本次触达的 platform console 入口与 dashboard 页面同步迁入现有 `app-l2` 合同，形成 `app/`、`features/dashboard/` 与根级 `index.tsx`，不再继续增长冻结的根目录和旧 `pages/`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/platform-console tsc`：通过。
- `pnpm --filter @nextclaw/platform-console lint`：通过，0 warning。
- `pnpm --filter @nextclaw/platform-console build`：通过，Vite production build 成功。
- `pnpm smoke:platform:console`：通过；在隔离预览 `http://127.0.0.1:4173/` 验证活动实例 ID 可见并可复制、复制成功反馈可见、归档后 ID 仍可见，以及原有实例打开、归档、恢复、删除和中英文切换流程。
- `pnpm lint:new-code:governance -- <本次触达文件>`：通过，覆盖命名、目录、角色、module structure、import boundary、owner 与 effect 等增量规则。
- `pnpm check:governance-backlog-ratchet`：通过。
- maintainability guard：0 error；保留 dashboard page 接近 650 行预算、platform smoke 达到 500 行预算两项后续拆分预警。
- 线上产物校验：`https://2568198c.nextclaw-platform-console.pages.dev` 与 `https://platform.nextclaw.io` 均返回 `200` 和本次 `index-CnwciEki.js`；线上 bundle 包含实例 ID 中英文文案与复制成功反馈。

## 发布/部署方式

- 已通过 `pnpm deploy:platform:console` 部署到 Cloudflare Pages，部署地址为 `https://2568198c.nextclaw-platform-console.pages.dev`，生产域名 `https://platform.nextclaw.io` 已切换到同一产物。
- 不涉及数据库 migration、Worker backend 发布或 remote quota 配置变更。

## 用户/产品视角的验收步骤

1. 登录 platform console，进入“我的实例 / My Instances”。
2. 确认活动实例名称下显示完整后台实例 ID。
3. 点击实例 ID，确认页面提示已复制，并能在排查记录中粘贴出相同 ID。
4. 归档该实例，确认“已归档实例”列表仍显示并可复制同一个 ID。

## 可维护性总结汇总

- 代码增减报告：新增 57 行，删除 28 行，净增 29 行。
- 非测试代码增减报告：新增 52 行，删除 24 行，净增 28 行。
- 本次属于新增用户可见诊断能力，必要增长来自双语文案、复制反馈与 feature 公共出口；没有通过 fallback、alias 或重复 API 扩大行为面。
- 正向减债动作：复用并统一剪贴板反馈路径；删除 smoke 中已被等待条件覆盖的重复归档断言；把本次触达的 dashboard 链路迁入 `app-l2` 允许的 app/feature 结构。
- `post-edit-maintainability-review` 结论：通过；没有新增 owner、文件角色或目录边界阻塞项。后续若继续扩展 dashboard page 或 platform smoke，应优先沿现有预警缝拆分，而不是继续增长原文件。

## NPM 包发布记录

不涉及 NPM 包发布。`@nextclaw/platform-console` 是私有部署型应用，本次不添加 `.changeset`；需要通过 platform 前端部署让用户获得该能力。
