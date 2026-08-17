# 原生 App 多平台 Artifact 实现计划

## 目标

依据 [原生 Service App 多平台 Artifact 与 Marketplace 可安装性设计](../designs/2026-08-18-native-app-platform-artifacts.design.md)，交付一条可验证主链：发布者在 schema v2 根 manifest 声明 `universal` 或 `targeted(1..n)`，CLI/Worker 校验声明集合与 artifact 集合一致，Registry 暴露 target artifacts，安装器只下载当前宿主匹配产物，两个 Marketplace 消费端展示真实平台范围。

本计划不执行 commit、push、部署或正式发布 Rust Todo。

## 影响面与 Owner

| 批次 | 最近 owner | 主要文件 | 可观察结果 |
| --- | --- | --- | --- |
| 1. Target 合同 | `@nextclaw/app-runtime` manifest + target service | `app-manifest.types.ts`、`app-manifest.service.ts`、新增 target service | 单 target、多 target、universal、Linux ABI 可解析并精确匹配 |
| 2. Service launch | kernel Service manifest parser | `service-app.types.ts`、`service-app-manifest.utils.ts` | 本地胖包按当前 target 解析成单一 command/args；runtime 不感知 target map |
| 3. Bundle / 发布 | app-runtime publish + NextClaw CLI | bundle/artifact/publish services、app CLI controllers/types | `--artifacts` 校验并提交一个逻辑版本下的 1..n target artifacts |
| 4. Marketplace canonical | Worker D1 App repository | migration、payload、file store、persistence、reader/mapper/routes | version → artifacts 一对多；Registry/下载按 target 输出；单 bundle 回填 universal |
| 5. 安装解析 | app-runtime Registry client + installer | remote registry types/client、installation/registry types | 当前宿主只选择精确 artifact；无匹配时下载前失败 |
| 6. 用户投影 | Worker read model + 内置 UI + Apps Web | Marketplace types/services/cards/detail/i18n | 卡片显示跨平台或 OS 摘要，详情显示 arch/ABI |
| 7. 命令与文档同步 | CLI 语义 owner | 两份 `USAGE.md`、`nextclaw-self-manage` skill、publisher skill | 用户和 Agent 不再使用单 artifact 旧说明猜测发布能力 |

## 批次 1：Target 与 Manifest

1. 在 app-runtime 公共类型中新增 `AppArtifactTarget`、`AppDistributionDeclaration`。
2. `AppManifestService` 解析并规范化 distribution：缺失视为 legacy universal；targeted 必须为去重非空集合；OS/arch/ABI 组合严格校验。
3. 新增 `AppPlatformTargetService`：
   - 读取 `process.platform/process.arch` 与 Linux libc；
   - 生成 canonical target key；
   - 精确匹配 universal/targeted artifacts；
   - 选择当前宿主最高兼容版本。
4. 增加 manifest 与 target resolver 定向测试。

迭代门：app-runtime 定向测试与 `tsc` 能证明类型/解析路径成立。

## 批次 2：Service 本地 Target Launch

1. Service manifest 支持现有 `command + args` 或新的 `launch.targets`，两者互斥。
2. `readServiceAppManifest` 默认通过共享 target service 解析当前宿主；测试可注入 target。
3. 对重复 target、无匹配、非法 ABI 和空 command 给出可操作错误。
4. `ServiceAppRecord` 和 `McpServiceAppRuntimeService` 继续只接收 resolved command/args。

迭代门：kernel Service manifest tests 覆盖 universal、单 target、多 target、无匹配；kernel `tsc` 通过。

## 批次 3：Artifact 与聚合发布

1. `.napp/bundle.json` 可携带 target attestation；legacy bundle 保持无 target。
2. artifact validator 校验 target attestation、根 distribution 声明和 expected target。
3. 只扩展公开的 `nextclaw app` 命令：`pack --target` 生成单 target artifact，`validate-publish/publish --artifacts <dir>` 扫描 canonical `<target-key>.napp`；不新增或扩展独立 `napp` 用户工作流。
4. targeted publish 要求 declared、uploaded、validated target sets 完全相等；universal 仍走现有单 bundle兼容路径。
5. publish payload 使用 discriminated union：legacy universal bundle 或 target artifacts 数组。

迭代门：CLI tests 证明一个 target、多个 targets、漏传、超传、重复和 hash 不一致。

## 批次 4：Marketplace Artifact Canonical

1. 新增 D1 `marketplace_app_artifacts` migration，并从现有 version bundle 回填 universal。
2. R2 key 变为 `(appId, version, target, sha256)` 内容寻址；保留 legacy 读取。
3. publish parser/validator 接受 union，并在任何 D1/R2 可见写入前校验完整 artifact 集合。
4. persistence 先写 version 公共事实，再写 artifacts；同版本同 target 不同 hash 拒绝。
5. Registry universal 输出旧 `dist.bundle`；targeted 输出 `dist.kind=targeted-bundle + artifacts[]`，不输出伪通用 bundle。
6. 新增 target bundle 路由；blocked/pending 不进入公开 Registry。
7. catalog/detail 从 active artifacts 投影 availability。

迭代门：Worker payload、repository、Registry 和 HTTP contract tests 通过；本地 migration 可应用。

## 批次 5：安装与更新

1. Registry client 解析 distribution union。
2. 未指定版本时选择当前 host target 的最高兼容 published version；显式版本只检查该版本。
3. `AppRemoteRegistryResolution` 与 installed version 记录 target key；下载名和诊断包含 target。
4. 无匹配、ABI 不符或 targeted metadata 缺失时在下载前失败。
5. update 复用同一 resolver，不因其它 target 新版本产生假更新。

迭代门：安装测试覆盖 universal、单 target、多 target、全局 latest 不兼容、显式不兼容和 checksum。

## 批次 6：Marketplace 展示

1. Worker summary 输出 `availability.mode + supportedPlatforms`；detail versions 输出 artifacts。
2. 内置 Marketplace card 显示“跨平台”或 OS 摘要；detail 展开 target。
3. Apps Web 使用相同字段，不根据 browser user agent 猜架构/ABI。
4. 本轮若现有 UI 尚无可靠 host arch API，只展示发布事实；安装器仍为硬门禁。后续再把 kernel installability 直接投影到按钮，不在 UI 复制 resolver。

迭代门：两个 UI 的解析/渲染测试与各自 `tsc` 通过。

## 批次 7：文档、验证与 Review

1. 同步两份 USAGE 和自管理/发布者 skill。
2. 运行受影响 packages 的 `tsc`、定向 tests、Worker migration/contract smoke。
3. 构造本地 universal、单 target 和双 target fixtures，跑 pack → publish payload → Registry resolve → install source 选择。
4. 运行一次 diff-only maintainability 自动检查。
5. 按 findings 做主观源码 Review；有 finding 时修复并重新验证。

## 完成条件

- schema v2 可以明确声明 universal、只支持一个 target 或支持多个 targets。
- targeted publish 无法在声明集合与 artifact 集合不一致时 finalize/提交。
- Marketplace Registry 保存并返回版本级 artifact 集合。
- installer 在下载前选择精确 host target，不下载其它平台文件。
- Marketplace 用户能看到 OS 级支持范围，详情能看到 arch/ABI。
- 旧 universal 包和旧 Registry metadata 仍可安装。
- 实际执行的 TypeScript、测试、migration/链路证据全部通过，Review 无未关闭 finding。

## 明确不做

- 创建或正式发布 Rust Todo；
- 部署 Worker、发布 NPM、提交 Git；
- 跨平台编译工具链安装；
- 签名、增量 artifact、最低 OS 版本求解和任意 fallback。
