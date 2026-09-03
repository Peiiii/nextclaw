# NextClaw 0.48.2 稳定产品发布

## 迭代完成说明

本批次于 2026-09-03 完成 NextClaw `0.48.2` 稳定产品发布，覆盖 NPM 正式包、四平台 portable runtime、stable update channel、GitHub Release 与真实安装升级闭环；Desktop 安装包不在本次 `target=product` 授权范围内。

发布前 `npm-release-prepare` 在 `@nextclaw/client-sdk` lint 阶段失败。直接根因是 `packages/nextclaw-client-sdk/src/nextclaw-client.test.ts` 的 ESLint 有效行数达到 826，超过 800 行上限；GitHub Actions run `33716742570` 的 `max-lines` 与 `--max-warnings=0` 日志确认了违约点。修复把项目注册表与删除契约测试移动到独立的 `project-client.test.ts`，没有压缩断言或修改生产逻辑，因此针对的是文件职责和预算根因，而不是关闭 lint 规则。

阻塞修复提交为 `63396ce918c43b8f77ea2b32727efadb8be79a7a`；稳定版本提交为 `4bed28d6c8978d06e98e8845fd5f64888ff9b06e`，随后源码体积指标由自动化更新到 `55d77cb7df49903fbc537e08a6d901a067bce71e`。

## 测试/验证/验收方式

- 阻塞修复：`@nextclaw/client-sdk` 5 个测试文件、30 条测试通过，package lint、TypeScript、文件命名/角色/模块治理与 backlog ratchet 通过。
- 精确提交预构建：GitHub Actions run `33724309303` 成功，生成 NPM 产物与 darwin-arm64、darwin-x64、linux-x64、win32-x64 四个平台 runtime 产物。
- 正式发布：GitHub Actions run `33725584248` 返回 `NPM_READY` 与 `NEXTCLAW_STABLE_READY`。
- NPM 安装矩阵：Linux、macOS Intel/Apple Silicon、Windows 覆盖 Node 20.19.0、22.19.0、24、26，并验证不支持 Node 版本能清晰失败；全部 job 成功。
- stable update：从官方 `0.48.1` runtime 执行 check、download-only、apply，再由新进程报告 `0.48.2`；download-only 未提前切换 current pointer，Portable Service App runner 与真实 action 调用成功。
- 公开渠道：四个平台 Pages manifest 均返回 `latestVersion: 0.48.2`、`hostKind: npm-runtime-bundle` 和 GitHub Release notes URL。

## 发布/部署方式

- 唯一入口：`.github/workflows/release.yml`，参数 `target=product`。
- 正式发布工作流：<https://github.com/Peiiii/nextclaw/actions/runs/33725584248>
- Runtime 子工作流：<https://github.com/Peiiii/nextclaw/actions/runs/33726431432>
- GitHub Release：<https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.48.2>
- NPM stable：`nextclaw@0.48.2`，`latest` dist-tag 已指向 `0.48.2`，`beta` 保持 `0.48.0-beta.2`。
- 远程 `master` 已包含发布提交和后置指标提交；本地主工作区存在受保护 tracked WIP，由 `release:reconcile:mainline` 单例 retry worker 自动等待安全快进。

## 用户/产品视角的验收步骤

1. 从 NPM 全新安装 `nextclaw@latest`，确认安装包版本为 `0.48.2`，launcher、app entry、update public key 与内嵌 UI 均存在。
2. 在 stable channel 从 `0.48.1` 检查更新，确认可发现 `0.48.2`。
3. 执行 download-only，确认不会切换当前 runtime；再执行 apply，确认新进程版本为 `0.48.2`。
4. 在 macOS arm64/x64、Linux x64、Windows x64 读取公开 manifest，确认版本、平台、架构与对应 release asset 一致。
5. 打开 GitHub Release，确认四个平台 runtime ZIP 均存在并带 SHA-256 digest。

## 可维护性总结汇总

- 发布阻塞修复只移动既有测试，非测试代码净增长为 0，生产合同不变。
- `nextclaw-client.test.ts` 减少 66 行，项目领域测试形成独立文件 owner；没有通过 eslint-disable、压行或删除断言绕过预算。
- diff-only maintainability guard 为 0 error；唯一 warning 是原聚合测试文件仍接近维护预算，但本次已改善且没有新增复杂度。
- 新文件通过 planned-path preflight、kebab-case、文件角色、模块结构与治理检查。
- 流程改进信号：NPM publish 本身不依赖 runtime 产物，但完整产品发布在首个不可逆动作前要求全部产物 ready。安全合同正确，后续应优先提升预构建状态可见性并缩短 Windows 安装矩阵关键路径，避免用户误解为 NPM 被 runtime 技术依赖阻塞。

## NPM 包发布记录

本批次实际发布 23 个包，registry verification 通过：

- `nextclaw@0.48.2`
- `@nextclaw/app-runtime@0.16.2`
- `@nextclaw/client-sdk@0.11.2`
- `@nextclaw/companion@0.2.56`
- `@nextclaw/core@0.17.17`
- `@nextclaw/harness@0.2.13`
- `@nextclaw/kernel@0.15.2`
- `@nextclaw/mcp@0.3.44`
- `@nextclaw/ncp-mcp@0.2.44`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.44`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.44`
- `@nextclaw/remote@0.3.56`
- `@nextclaw/runtime@0.4.43`
- `@nextclaw/server@0.22.2`
- `@nextclaw/service@0.6.2`
- `@nextclaw/ui@0.24.2`
- `@nextclaw/channel-extension-dingtalk@0.2.43`
- `@nextclaw/channel-extension-discord@0.2.43`
- `@nextclaw/channel-extension-email@0.2.43`
- `@nextclaw/channel-extension-slack@0.2.43`
- `@nextclaw/channel-extension-telegram@0.2.43`
- `@nextclaw/channel-extension-wecom@0.2.43`
- `@nextclaw/channel-extension-whatsapp@0.2.43`

所有包均由同一正式工作流从精确提交预构建产物发布；没有使用本地 raw `npm publish`，没有待统一发布项或外部阻塞。
