# v0.44.13 产品活跃发行分类修复

## 迭代完成说明

生产管理后台的产品活跃默认筛选长期显示 0，并不是客户端没有上报。2026-08-30 对生产 D1 的只读查询确认，真实匿名回执已经持续写入，但全部被标记为 `external / development / development`；后台默认查询 `external / production / stable`，因此不会计入。

根因是 `ProductActivityReporter` 使用 `NODE_ENV` 推断产品发行环境，而正式 NPM 与桌面运行入口不保证设置 `NODE_ENV=production`。原有测试手工提供了该变量，掩盖了真实发行链路。修复将环境与发行渠道归入 `NextclawDistribution`，由 NPM launcher 和 Desktop host 提供发行事实，reporter 只消费 canonical distribution，不再自行猜测。后台筛选、HTTP schema、D1 schema 和匿名隐私白名单均未改变。

这次修复针对 producer 的分类根因，而不是把后台默认筛选扩大到 development。历史 development 数据同时包含真实发行与开发流量，无法可靠拆分，因此没有执行会制造虚假生产活跃的批量迁移。

设计依据见[产品活跃发行分类修复设计](../../designs/2026-08-30-product-activity-release-classification.design.md)。

## 测试/验证/验收方式

- 生产 D1 只读查询确认：2026-08-30 已有 external 回执，但位于 development/development；production/stable 为 0。
- 新增组装边界测试，从 NPM launcher child 建立 distribution，再由 reporter 发出匿名回执，断言三个周期请求全部为 production/stable。
- Service 相关 6 个测试文件共 35 条通过，NextClaw distribution 2 条测试通过；最终受影响 Service 测试 9 条再次通过。
- Desktop runtime 环境与 command bridge 8 条测试通过，覆盖 bundle、packaged runtime、environment override 与 command surface。
- `@nextclaw/service`、`nextclaw`、`@nextclaw/desktop` 匹配范围 TypeScript 检查通过。
- 触达文件定向 ESLint 零告警；新增文件治理与 `git diff --check` 通过。

## 发布/部署方式

当前仅在隔离 worktree `codex/product-activity-release-classification` 完成未提交实现。未经用户明确授权，未 commit、未 push、未发布 NPM/runtime/desktop、未部署，也未改写生产 D1。

因此生产网站当前仍可能显示 0。修复需要进入新版 NPM runtime 与 Desktop runtime；用户升级并完成一次 Agent 意图后，新的 production/stable 回执才会进入默认统计。部署后应以生产 D1 只读查询和正式管理后台默认筛选共同验收。

## 用户/产品视角的验收步骤

1. 安装包含本修复的正式 NPM 或 Desktop 版本，保持匿名活跃统计开启。
2. 完成一次直接或渠道 Agent 请求，并等待回执投递成功。
3. 管理员登录 `https://platform-admin.nextclaw.io`，保持 external / production / stable。
4. 确认当天 DAU 与对应周期 WAU、MAU 不再因发行环境错分而保持 0。
5. 本地源码与 Desktop environment override 产生的回执仍应只出现在 development 筛选。

## 可维护性总结汇总

删除了 reporter 内基于 `NODE_ENV` 的环境与渠道推断，把发行事实收敛到既有 `NextclawDistribution` owner；没有新增 service、resolver、兼容双写或 consumer fallback。Desktop 子进程环境仍由既有 `createDesktopRuntimeEnv` 统一生成。

diff-only maintainability 检查最终为 0 error。两个 warning 均未恶化：`apps/desktop/src/main.ts` 保持既有 400 行预算边界，`packages/nextclaw-service/src/services/runtime` 目录文件数未增加。因 owner 跨宿主调整触发主观复核，结论为无可维护性发现。文件组织治理通过。

## 红区触达与减债记录

### apps/desktop/src/main.ts

- 本次是否减债：是，至少不增加主入口职责与行数。
- 说明：初版实现让文件越过 400 行预算；返工后只向既有 desktop runtime env owner 传入 runtime source，分类逻辑不留在 main，最终保持原有预算。
- 下一步拆分缝：本任务不扩张 Desktop bootstrap 拆分；后续独立治理可评估把 runtime 启动编排移出 main。

## NPM 包发布记录

需要随下一次统一发布：

- `nextclaw`：待统一发布，包含 NPM launcher 与 runtime 装配修复。
- `@nextclaw/service`：待统一发布，包含 canonical distribution 与 reporter 分类合同。

Desktop 也需要包含同一源码的新版 runtime，但当前未执行 Desktop 发布。触发条件是用户明确授权对应提交与发布流程。
