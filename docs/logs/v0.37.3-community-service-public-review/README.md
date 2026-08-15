# v0.37.3 社区 Service App 公开审核机制修复

## 迭代完成说明

线上审核 `peiiii.daily-feed` 时出现 `community native-process apps cannot be listed publicly`。证据确认该 App 是 schema v2 Panel + Service 包，Service 通过 `command/args` 启动宿主进程并如实声明 `native-process`；问题不是应用声明错误，而是 Marketplace 把“社区高权限执行面”直接等同于“永远不能公开”，同时管理后台没有把公开与不公开两种审核动作做成显式合同。

根因是平台混淆了执行信任、人工审核和目录可见性三个独立状态。修复后，社区 Service App 仍必须如实声明 `native-process/full-user` 并进入人工高权限审核，但管理员可以根据源码、权限、网络目标、artifact digest 和发布者证据选择“通过并公开”或“通过但不公开”。schema v2 WASI Service 仍由本地校验与 Marketplace ingest 双端拒绝，不能只改标签伪造沙箱。schema v2 App 安装后默认停用，用户显式启用后才运行组件。

## 测试/验证/验收方式

- App runtime manifest 定向测试：6/6 通过。
- Marketplace Worker 全量测试：8 files、37/37 通过；公开资格、审核可见性和 payload 定向覆盖包含在内。
- App runtime、Marketplace Worker、Platform Admin 与 Provider Gateway 的 TypeScript、lint 和 build 检查通过。
- `nextclaw-app-publisher` Skill 压力测试通过：允许 Service 提交公开审核、保留真实风险声明、不承诺自动通过、不伪造 WASI。
- new-code governance 全量通过；diff-only maintainability 为 0 error、2 warnings、主观复核 no findings。生产冒烟在部署后补齐。

## 发布/部署方式

- Marketplace Worker：待部署到 `marketplace-api.nextclaw.io` / `apps-registry.nextclaw.io`。
- Provider Gateway：待部署到 `ai-gateway-api.nextclaw.io`。
- Platform Admin：待部署到 `nextclaw-platform-admin` Pages 项目并验证 `platform-admin.nextclaw.io`。
- 不修改 `peiiii.daily-feed` 的审核状态；部署后由管理员使用新的审核动作完成业务审核。

## 用户/产品视角的验收步骤

1. 打开管理后台的 App 审核页并选择一个社区 Panel + Service App。
2. 确认页面显示宿主进程、当前用户权限、组件、权限和“完成高权限人工审核后可以公开上架”。
3. 确认“通过并公开”和“通过但不公开”均可操作，且不再出现旧的社区 native-process 硬阻断。
4. 对伪造 `runtime.profile: wasi` 的 Service 包执行本地发布校验和服务端提交，确认两端都拒绝。
5. 安装审核通过的 schema v2 App，确认安装后默认停用，用户显式启用后才运行 Service。

## 可维护性总结汇总

公开资格由 Marketplace 后端单一 owner 判定，管理后台只消费结构化结论，不复制安全策略。运行时真实性由 App runtime 与 Marketplace ingest 双端守卫，审核只决定目录可见性，不改写 manifest。实现没有新增兼容 fallback 或第二套状态。

自动 guard 为 0 error、2 warnings：App manifest service 接近既有文件预算，但本次只增加一个与现有组件/runtime 一致性校验；审核主组件接近 feature 文件预算，因此已把运行证据、状态展示、feature API provider 和 feature 类型拆到独立 owner，主文件从 602 行降至 487 行。主观复核无可维护性 finding；目录与文件组织治理全量通过。

## NPM 包发布记录

- `nextclaw`：需要 patch，内建 Usage 与发布 Skill 行为改变；当前 `待统一发布`。
- `@nextclaw/app-runtime`：需要 patch，schema v2 WASI Service 非法声明校验改变；当前 `待统一发布`。
- `@nextclaw/core`：需要 patch，内建 App 创建/发布 Skill 合同改变；当前 `待统一发布`。
