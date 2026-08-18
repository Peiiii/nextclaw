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
- Worker 缺省 manifest 修复后，18 个测试文件、83 条测试、tsc、lint 与 Wrangler production dry-run 通过；新增组装测试覆盖缺省 `permissions` 的 targeted artifact 发布边界。

## 发布/部署方式

- 已随完整 stable NPM 批次发布 `nextclaw@0.39.0` 与 24 个 workspace 依赖包，并完成版本提交、package tags、`master` 回流和公网精确 payload 审计。
- 生产 D1 已应用 `0014_app_platform_artifacts_20260818.sql`；Marketplace Worker 已部署为 `99938c65-c584-46a9-9d8b-1e0c6e3e0aa4`，health、plugins、skills 与 Apps v2 均通过公网 smoke，新 `availability` 字段在线可见。
- Apps Web 已部署到 Cloudflare Pages `https://e8cc688f.nextclaw-apps.pages.dev`，自定义域 `https://apps.nextclaw.io/apps` 返回 200，生产 bundle 包含平台标签。
- Worker 首次部署暴露两层边缘兼容问题：root barrel 带入 Node-only 模块，以及 target service 构造时提前读取 `process`。前者通过公共 edge-safe subpath 收窄，后者改为宿主探测时延迟读取；修复后重新部署并通过线上 smoke。
- Rust Todo 试投进一步暴露 Worker manifest parser 会把未声明的 `permissions` 改写为 `{}`，而 artifact validator 会区分“字段缺失”和“空对象”，因此目录与包内 manifest 完全一致仍被误判。修复让 manifest 保留 optional 字段缺失语义，同时继续在发布层推导 native-process 的有效权限；组装测试用真实 targeted `.napp` 贯穿 Worker parser 与 artifact validator，证明修复针对归一化根因而非绕过校验。生产 Worker 已更新为 `8ecae45a-77b3-42fe-83e8-393bdb2570b2`，health 与 Apps v2 catalog 公网 smoke 通过。
- stable runtime channel 已为 darwin arm64/x64、linux x64、win32 x64 构建并发布，四份公网 manifest 均返回 `0.39.0`；从 `0.38.1` 完成 `check -> download-only -> apply -> 新进程 0.39.0` 的真实升级验证。
- 双语 release notes、结构化 release JSON、全球与国内 Docs、Apps Web 均已上线；X 公告使用冻结文案和产品截图单次写入时，被平台以当日发送额度已满（344）拒绝，未产生帖子，也未盲目重试。Desktop 明确排除。

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

- stable/latest：`nextclaw@0.39.0`、`@nextclaw/app-runtime@0.13.0`、`@nextclaw/core@0.17.4`、`@nextclaw/kernel@0.8.5`、`@nextclaw/ui@0.18.2`，连同完整批次共 25 个公开包。
- exact-commit prepare workflow `32052866134` 用时 4 分 17 秒并通过；prepare 不计入 NPM_READY 窗口。
- 首次正式发布尝试在上传、registry 验证和 Git/tag 闭合后，因隔离 worktree 缺少包级 `jszip` 链接而在 install 审计阶段失败，用时 84.87 秒，记为 `NPM_SLA_MISSED`；没有重复上传。
- 从 `install` checkpoint 恢复后用时 15.08 秒，最慢阶段为 package/registry 复核 8.85 秒；公网空缓存下载、解包与 payload 审计通过，最终状态为 `NPM_READY (stable/latest)`。
- runtime workflow 为 `https://github.com/Peiiii/nextclaw/actions/runs/32109874103`，四个平台构建与 update channel 发布全部成功；GitHub Release 为 `https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.39.0`。
- 全球与国内版本说明分别为 `https://docs.nextclaw.io/en/notes/2026-08-18-nextclaw-v0-39-0` 和 `https://docs.nextclaw.net/en/notes/2026-08-18-nextclaw-v0-39-0`，均返回 200。
