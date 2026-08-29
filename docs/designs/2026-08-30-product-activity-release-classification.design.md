# 产品活跃发行分类修复设计

## 背景与证据

管理后台默认查询 `external / production / stable`，但 2026-08-30 对生产 D1 的只读查询确认：新版客户端已经持续提交匿名活跃回执，真实回执全部落在 `external / development / development`，因此默认视图的 DAU、WAU、MAU 仍为 0。

此前的[默认匿名产品活跃统计设计](2026-08-25-default-anonymous-product-activity-analytics.design.md)解决了默认关闭和稳定安装标识问题，但没有把“开发源码运行”和“NPM/桌面发行产物运行”的分类事实建模成明确合同。当前 `ProductActivityReporter` 通过 `NODE_ENV` 猜测环境；发行入口并不保证设置 `NODE_ENV=production`，测试却手工提供了该变量，导致测试与真实发行链路不等价。

这是能力面缺失，而不是后台展示错误：同一分类缺口同时影响 NPM launcher、桌面内置 runtime、桌面 command surface 和直接源码运行。只改后台默认筛选会把开发流量伪装成正式用户，不能恢复统计合同。

## 不变量

- 正式 NPM runtime 和正式桌面 runtime 的回执必须进入 `production`。
- 本地源码、watch、环境覆盖 runtime 的回执必须进入 `development`。
- stable、beta、nightly、development 的发行渠道必须来自发行事实或显式测试/诊断覆盖，不能由后台猜测。
- `ProductActivityReporter` 只负责生成、持久化和投递匿名周期回执，不自行推断宿主属于开发还是发行环境。
- 管理后台继续默认展示 `external / production / stable`，不通过扩大筛选范围掩盖 producer 错分。
- 历史错分数据不自动改写。现有 `development` 中混有真实发行与开发流量，无法可靠拆分；强行迁移会制造虚假的正式活跃人数。

## Owner 与主链路

发行分类归 `NextclawDistribution`：它已经拥有版本、launcher 来源、运行包入口等发行事实，是最接近的 information expert。

主链路为：

1. NPM app 入口根据 launcher child 事实建立 distribution 分类；直接源码入口分类为 development。
2. Desktop host 在启动 runtime 时，根据 runtime command 来源注入明确的发行分类：bundle 与 packaged runtime 为 production，environment override 为 development；桌面 command surface 使用同一发行分类。
3. `NextclawDistribution` 同时给出 environment 与 release channel；显式 analytics 环境变量只作为测试、诊断或受控部署覆盖。
4. 所有 `ProductActivityReporter` 构造点直接接收 distribution 的分类，不再读取 `NODE_ENV` 推断产品发行环境。
5. Worker 保持现有严格协议和 D1 聚合；Platform Admin 保持现有默认筛选。

## 发行渠道规则

- 显式 `NEXTCLAW_PRODUCT_ANALYTICS_RELEASE_CHANNEL` 优先，用于受控诊断。
- 其次使用宿主已有的 Desktop/NPM update channel。
- 再从产品版本预发布标识推断 beta/nightly；无预发布标识的正式发行默认 stable。
- development 环境在没有显式渠道时固定为 development。

环境规则不再使用“未设置 `NODE_ENV` 即 development”的 fallback。测试环境仍可显式传入 test，避免测试投递被分类为 production。

## 失败与恢复边界

- 分类缺失时不在 consumer 侧回退聚合其它环境；构造 distribution 时必须得到确定分类。
- 网络失败、幂等、周期回执与本地重试合同保持不变。
- 修复只影响新生成回执。用户安装含修复的新版并完成一次 Agent 意图后，production/stable 指标开始恢复。
- 旧版客户端继续错分，直到升级；后台可以暂时切换 development 查看已有回执，但不得把该视图解释为准确生产活跃。

## 放弃的方案

### 后台默认聚合 development

能够立刻显示非零，但会把开发机、测试机与真实用户混在一起，破坏“核心活跃用户”的可信度，放弃。

### 把 reporter 的默认值直接改成 production

能够修复发行包，却会让未显式设置环境的源码运行污染 production。事实 owner 仍然错误，放弃。

### 按版本批量迁移历史 D1 数据

历史 development 数据无法区分发布包与源码构建，同一版本号也会出现在本地开发中。迁移不可验证，放弃。

## 实现范围

- 扩充 `NextclawDistribution` 的产品环境与发行渠道合同。
- 在 NPM 与 Desktop 入口生成分类事实。
- 让全部 reporter 构造点消费同一 distribution 分类。
- 补充 NPM launcher、Desktop packaged/environment-override 与 reporter payload 的回归测试。
- 不改变 HTTP schema、D1 schema、后台 UI 或统计口径，不新增兼容双写。

## 最小验证标准

- 无 `NODE_ENV` 的 NPM launcher child 仍生成 `production/stable`。
- 本地源码入口生成 `development/development`。
- Desktop bundle/packaged runtime 生成 production，environment override 生成 development。
- beta 版本或显式 update channel 生成 beta；显式测试覆盖仍生效。
- Reporter 请求体完全使用 distribution 分类，且隐私字段白名单不变。
- Service、NextClaw、Desktop 匹配范围测试与 TypeScript 检查通过。
- 修复前复现用例在实现后变绿；生产只读查询仍作为部署后的最终观测标准，但本任务未经授权不发布、不部署、不改写 D1。

## 抽象审计

保留一个既有 `NextclawDistribution` owner，只增加它必须提供的两个发行事实；不新增 resolver/service/registry。删除 reporter 内基于 `NODE_ENV` 的平行推断。延后任何历史数据迁移与后台诊断提示，除非后续有可验证的分类依据或独立用户需求。

## 执行判断

`design-document: required`，本文即稳定设计落点。实现可在单个隔离 worktree 内一次闭环，`plan: not-required`。
