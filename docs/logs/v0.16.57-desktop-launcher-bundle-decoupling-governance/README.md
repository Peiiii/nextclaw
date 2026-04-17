# v0.16.57-desktop-launcher-bundle-decoupling-governance

## 迭代完成说明

- 系统性修正桌面发布链路里“把当前 launcher 版本默认为 bundle 最低 launcher 版本”的残留实现，核心修复落在 [prepare-seed-bundle.service.mjs](../../../apps/desktop/scripts/update/services/prepare-seed-bundle.service.mjs)。
- 新增长期治理文档 [desktop-launcher-bundle-governance.md](../../../docs/internal/desktop-launcher-bundle-governance.md)，把 `launcher version != minimumLauncherVersion`、`channel floor 是唯一 source of truth`、`只有 launcher-side contract break 才允许抬高 floor` 固化为常态文档。
- 新增公共 service [local-update-channel-artifacts.service.mjs](../../../apps/desktop/scripts/update/services/local-update-channel-artifacts.service.mjs)，统一本地更新烟测和手动验收支持包的 stable / beta bundle 与 manifest 生成逻辑，避免再由多个脚本各自写一份 floor 判断。
- 更新 [prepare-manual-update-validation.mjs](../../../apps/desktop/scripts/prepare-manual-update-validation.mjs) 与 [smoke-product-update.mjs](../../../apps/desktop/scripts/smoke-product-update.mjs)：
  - 不再从 `apps/desktop/package.json` 当前 launcher 版本推导 `minimumLauncherVersion`
  - stable / beta manifest 改为分别读取 governed floor
  - beta 克隆 bundle 时同步写回 bundle 内部 `launcherCompatibility.minVersion`
- 更新本地打包入口与 CI / release workflow：
  - [apps/desktop/package.json](../../../apps/desktop/package.json)
  - [desktop-package-build.mjs](../../../scripts/desktop/desktop-package-build.mjs)
  - [desktop-package-verify.mjs](../../../scripts/desktop/desktop-package-verify.mjs)
  - [desktop-validate.yml](../../../.github/workflows/desktop-validate.yml)
  - [desktop-release.yml](../../../.github/workflows/desktop-release.yml)
  - 这些入口现在都显式传 `channel` 或动态读取 governed floor，避免再出现隐藏默认值把 launcher 与 bundle 重新耦合起来。
- 补充 [apps/desktop/README.md](../../../apps/desktop/README.md) 与 [desktop-install-unsigned.md](../../../docs/internal/desktop-install-unsigned.md) 的长期说明入口，方便后续查找。

## 测试/验证/验收方式

- 已通过：
  - `node --check apps/desktop/scripts/update/services/local-update-channel-artifacts.service.mjs`
  - `node --check apps/desktop/scripts/update/services/prepare-seed-bundle.service.mjs`
  - `node --check apps/desktop/scripts/prepare-manual-update-validation.mjs`
  - `node --check apps/desktop/scripts/smoke-product-update.mjs`
  - `node --check scripts/desktop/desktop-package-build.mjs`
  - `node --check scripts/desktop/desktop-package-verify.mjs`
  - `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/desktop-validate.yml"); YAML.load_file(".github/workflows/desktop-release.yml")'`
  - `pnpm -C apps/desktop lint`
  - `pnpm -C apps/desktop tsc`
  - `pnpm check:governance-backlog-ratchet`
  - `pnpm desktop:package:verify`
    - 已确认先前阻塞点消失：`bundle:seed` 现在按 stable channel governed floor `0.0.141` 正常构建，不再错误地回落到 launcher `0.0.143`
  - `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel stable`
  - `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel beta`
- 定向结果：
  - stable floor：`0.0.141`
  - beta floor：`0.0.143`
- 未通过但确认与本次桌面链路改动无关：
  - `pnpm lint:new-code:governance`
    - 仍被当前工作区其它并行改动挡住，失败文件集中在 `packages/ncp-packages/*`、`packages/nextclaw-core/*`、`packages/nextclaw-hermes-acp-bridge/*` 等非本次桌面发布链路文件。
  - `pnpm lint:maintainability:guard`
    - 仍被当前工作区其它并行改动挡住，包含 `packages/ncp-packages/nextclaw-ncp-react/src/hooks/use-hydrated-ncp-agent.ts`、`packages/nextclaw-core/src/agent` 等非本次桌面改动。
- 已额外执行本次改动的定向 maintainability guard：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：`Errors: 0`，仅剩 `apps/desktop/scripts` 目录预算历史 warning 与 `smoke-product-update.mjs` 接近预算 warning。

## 发布/部署方式

- 本次不需要改动桌面 release 的外部发布入口，继续沿用 [desktop-release.yml](../../../.github/workflows/desktop-release.yml)。
- 重新发布桌面版时，release workflow 会：
  - 显式把 `DESKTOP_UPDATE_CHANNEL` 传给 `bundle:seed`
  - 动态读取对应 channel 的 governed floor 构建 product bundle 与 update manifest
  - 继续保留 Windows `Setup.exe` 与 `win-unpacked.zip` 双轨资产
- 本次本地已经把 release contract 修正到可重新发布状态；是否真正对外发布，以本次提交后的 tag / release workflow 为准。

## 用户/产品视角的验收步骤

1. 打开 [apps/desktop/desktop-launcher-compatibility.json](../../../apps/desktop/desktop-launcher-compatibility.json)，确认 stable / beta floor 分别维护，不等于当前 launcher 包版本。
2. 运行 `pnpm desktop:package:verify`，确认不再出现“stable channel floor 0.0.141 与 launcher 0.0.143 不匹配”的失败。
3. 检查 [desktop-launcher-bundle-governance.md](../../../docs/internal/desktop-launcher-bundle-governance.md)，确认长期规则可直接查到。
4. 后续重新发布桌面版后，在应用里点击“检查更新”：
   - stable 用户不需要因为普通 bundle 更新而重下整个 launcher
   - beta 只有在确实发生 launcher-side contract break 时才会要求更高 launcher floor
5. Windows 用户继续可以同时拿到 `Setup.exe` 安装器和 `win-unpacked.zip` 便携包，两条路径并存。

## 可维护性总结汇总

- 可维护性复核结论：通过
- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是
  - 本次没有继续在多个脚本里分别补一套 `minimumLauncherVersion` 分支，而是抽出公共 service 统一 stable / beta 本地更新制品生成逻辑。
  - 同时没有引入新的隐藏 fallback，而是把所有入口收敛到同一个 governed source of truth。
- 长期目标对齐 / 可维护性推进：
  - 这次顺着“统一入口 + 能力编排 + 开箱即用”的长期方向推进了一小步：桌面 launcher 与 bundle 的关系更清晰，后续普通能力升级更接近“只更新 bundle，不重装 launcher”的产品目标。
  - 同时也减少了“因为发布脚本隐式默认值而反复犯同一类错误”的概率，让桌面发布行为更可预测。
- 代码增减报告：
  - 新增：711 行
  - 删除：305 行
  - 净增：+406 行
- 非测试代码增减报告：
  - 新增：711 行
  - 删除：305 行
  - 净增：+406 行
- 若总代码或非测试代码净增长，是否已做到最佳删减、已经删掉或收敛了什么、以及剩余增长为何仍属最小必要：
  - 已做到当前边界下的最佳删减。
  - 新增代码主要是一个公共 service 与一份长期治理文档；它们替代了继续在多个脚本里各自复制兼容 floor 逻辑的做法，属于防止重复犯错的最小必要增长。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 代码量小幅净增长，但 `prepare-manual-update-validation.mjs` 与 `smoke-product-update.mjs` 已明显收敛，逻辑不再重复。
  - `smoke-product-update.mjs` 文件长度从 488 行下降到 413 行。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。桌面更新测试制品生成逻辑被收进独立 service；seed bundle、workflow、README、内部文档分别承担自己的职责，没有再把规则散落在多个入口里。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 满足当前改动范围的治理要求。
  - 仍存在 `apps/desktop/scripts` 目录预算历史 warning，本次没有继续恶化，只顺手把新增逻辑放到 `apps/desktop/scripts/update/services/` 下，避免把根目录再铺平。
- 独立于实现阶段的主观复核：
  - no maintainability findings

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 原因：本次只改桌面发布脚本、workflow、验证脚本与文档，没有修改需要单独发版的 npm package 对外契约。
