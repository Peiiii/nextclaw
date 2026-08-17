# Native App 多平台 Artifact

## 迭代完成说明

- schema v2 Mini App 版本现在可以声明 `universal`，或声明一个到多个精确 native targets；单平台与多平台使用同一合同。
- 新增 `nextclaw app pack --target --out`、`validate-publish --artifacts` 和 `publish --artifacts`，公开工作流只使用 `nextclaw app ...`，`.napp` 仅作为 artifact 文件格式。
- Marketplace 将公共版本事实与 target artifacts 分开存储，Registry 为 targeted 版本返回 artifact 列表，安装器选择当前宿主的精确 target，并在最新版不兼容时回退到最新兼容版本。
- Service App 支持互斥的 `command/args` 或 `launch.targets`；发布校验会证明 artifact target 与 Service 启动入口一致。
- 内置 Marketplace 与公开 Apps Web 均展示支持平台；旧的 universal bundle 读取合同继续兼容。
- 设计与执行计划分别记录在 `docs/designs/2026-08-18-native-app-platform-artifacts.design.md` 和 `docs/plans/2026-08-18-native-app-platform-artifacts.plan.md`。

## 测试/验证/验收方式

- `@nextclaw/app-runtime`、`@nextclaw/kernel`、`nextclaw`、Marketplace Worker、`@nextclaw/ui`、`@nextclaw/apps-web` 的 TypeScript 检查通过。
- artifact target、Service launch、targeted publish、latest-compatible install、CLI 参数透传、Marketplace payload/record/HTTP 合同定向测试通过。
- 新增的 release artifact 顺序测试证明：全部 target 校验和版本不可变断言完成前不会写入 R2。
- `@nextclaw/ui` 与 `@nextclaw/apps-web` production build 通过。
- 本地 D1 从 `0001` 到 `0014_app_platform_artifacts_20260818.sql` 全量迁移成功。
- `git diff --check`、文档命名治理和 diff-only maintainability review 通过。

## 发布/部署方式

- 本轮只完成本地源码、migration、文档与验证，没有 commit、push、远端 D1 migration、Worker deploy、NPM publish 或 Marketplace 正式发布。
- 后续发布时先应用 skills D1 migration `0014`，再部署 Marketplace Worker，最后按 changeset 统一发布受影响的 NextClaw packages。

## 用户/产品视角的验收步骤

1. 在 root `manifest.json` 中声明一个 target，使用 `nextclaw app pack` 生成同名 `.napp`，再运行 `validate-publish --artifacts`，确认校验通过。
2. 声明多个 targets 并生成全部 artifacts，确认一个逻辑版本只创建一次，Registry 返回多个 target artifacts。
3. 删除任一已声明 artifact，确认发布前被“声明集合与实际集合不一致”阻止。
4. 在不同宿主 target 安装同一 App ID，确认只下载精确匹配 artifact；不兼容的显式版本在下载前失败。
5. 在内置 Marketplace 与公开 Apps Web 查看卡片和详情，确认显示 macOS、Linux、Windows 或“全部平台”。

## 可维护性总结汇总

- 设计评审后保持单一 target owner、单一 Service launch owner、单一 release artifact owner，没有引入独立 `napp` 用户工作流或第二份平台声明。
- Artifact 查询与发布 artifact 准备分别下沉到 `apps/artifacts/` repository/service，Marketplace datasource 与 record repository 均回到文件预算内。
- 安装服务复用远端来源字段映射，target 持久化没有复制四套字段拼装。
- 自动维护性检查最终为 `0 errors`；容量 warning 经主观复核后无开放 finding。接近预算的既有文件保留清晰的后续拆分缝，不为压行牺牲协议和类型安全。
- 本轮没有触达 maintainability hotspots 脚本登记的红区文件。

## NPM 包发布记录

- 需要后续统一发布：`@nextclaw/app-runtime`（minor）、`nextclaw`（minor）、`@nextclaw/core`（patch）、`@nextclaw/kernel`（patch）、`@nextclaw/ui`（patch）。
- 当前状态：仅本地 changeset，未获得 NPM 发布授权，全部为`待统一发布`。
