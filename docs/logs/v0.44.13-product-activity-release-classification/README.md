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

已于 2026-08-30 通过统一 `release.yml target=all` 入口完成 `nextclaw 0.45.5`、Runtime 四平台资产和 `v0.45.5-desktop.1` 五平台 Desktop 发布。最终父流程 `33273710311` 与 Desktop 子流程 `33273964827` 均为 success，输出 `ALL_PLATFORMS_READY`；Linux APT `0.0.276` 已进入公开仓库。

生产 D1 没有改写历史数据。管理后台 external / production / stable 仍可能暂时显示 0，直到升级到 0.45.5 的真实外部客户端完成活动并投递新回执；此前错分到 development/development 的历史数据不会伪装成生产活跃。

发布恢复曾暴露五类自动化缺口：prepared artifact 跨平台导入、并发主线前进、Runtime 成功后的进程清理误判、恢复协议与冻结发布身份混用、APT 包超过 GitHub Pages 单文件上限。最终将公开入口收敛为仅接收业务参数 `target`，由 workflow 自动识别已发布版本及未闭合 checkpoint；Desktop owner 自动复用既有公开 release 并只恢复 APT，用户或 Agent 不再补传版本、SHA、阶段或恢复参数。

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

已随统一发布完成：

- `nextclaw 0.45.5`：包含 NPM launcher 与 runtime 装配修复。
- `@nextclaw/service 0.4.5`：包含 canonical distribution 与 reporter 分类合同。
- `v0.45.5-desktop.1`：包含同一正式 runtime 分类合同及 Linux APT 0.0.276。
