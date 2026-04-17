# v0.16.52-desktop-launcher-compatibility-governance

## 迭代完成说明（改了什么）

- 新增桌面 launcher 兼容性 contract 文件 [`apps/desktop/desktop-launcher-compatibility.json`](/Users/peiwang/Projects/nextbot/apps/desktop/desktop-launcher-compatibility.json)，把 stable / beta 通道的 `minimumLauncherVersion` 收敛为唯一受控来源，不再允许从当前 launcher 包版本自动推导。
- 新增脚本：
  - [`launcher-compatibility.service.mjs`](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/update/services/launcher-compatibility.service.mjs)
  - [`print-minimum-launcher-version.service.mjs`](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/update/services/print-minimum-launcher-version.service.mjs)
  - 作用：统一解析 channel floor，并在有人试图用错误的 `minimumLauncherVersion` 覆盖 release contract 时直接阻断。
- 调整 [`build-product-bundle.service.mjs`](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/update/services/build-product-bundle.service.mjs) 与 [`build-update-manifest.service.mjs`](/Users/peiwang/Projects/nextbot/apps/desktop/scripts/update/services/build-update-manifest.service.mjs)，默认从兼容性 contract 读取 governed floor；只有显式开启 override 才允许偏离。
- 修正 [`desktop-release.yml`](/Users/peiwang/Projects/nextbot/.github/workflows/desktop-release.yml)，不再把 `apps/desktop/package.json` 当前 launcher 版本直接塞给 `--minimum-launcher-version`，改为按 release channel 读取 governed floor。
- 在 [`AGENTS.md`](/Users/peiwang/Projects/nextbot/AGENTS.md) 的 `Project Rulebook` 新增规则 `desktop-minimum-launcher-version-must-be-governed`，把“何时允许抬高 floor、何时默认禁止”写成项目硬规则。
- 更新桌面发布 skill [`desktop-release-contract-guard`](/Users/peiwang/Projects/nextbot/.agents/skills/desktop-release-contract-guard/SKILL.md)，把 `minimumLauncherVersion` 的治理、检查命令与禁止事项补齐。
- 新增本次方案文档 [`2026-04-17-desktop-minimum-launcher-version-governance-plan.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-17-desktop-minimum-launcher-version-governance-plan.md)，把“兼容性下限不是当前 launcher 版本镜像”的设计决策写明。

## 测试/验证/验收方式

- 已通过：`pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel stable`
  - 结果：输出 `0.0.141`
- 已通过：`pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel beta`
  - 结果：输出 `0.0.143`
- 已通过：`node apps/desktop/scripts/update/services/build-update-manifest.service.mjs --bundle <tmp bundle> --channel stable --platform linux --arch x64 --version 0.18.0 --bundle-url https://example.com/bundle.zip --output <tmp manifest> --private-key-file <tmp key>`
  - 结果：在未显式传 `--minimum-launcher-version` 的情况下，生成 manifest 的 `minimumLauncherVersion = 0.0.141`
- 已通过：`node apps/desktop/scripts/update/services/build-product-bundle.service.mjs --channel stable --minimum-launcher-version 0.0.999 --platform linux --arch x64 --version 0.18.0 --output-dir /tmp/nextclaw-bundle-test`
  - 结果：按预期失败，并明确提示 `0.0.999` 与 stable channel governed floor `0.0.141` 不一致
- 已通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths AGENTS.md .agents/skills/desktop-release-contract-guard/SKILL.md .github/workflows/desktop-release.yml apps/desktop/README.md apps/desktop/package.json apps/desktop/desktop-launcher-compatibility.json apps/desktop/scripts/update/services/build-product-bundle.service.mjs apps/desktop/scripts/update/services/build-update-manifest.service.mjs apps/desktop/scripts/update/services/launcher-compatibility.service.mjs apps/desktop/scripts/update/services/print-minimum-launcher-version.service.mjs docs/plans/2026-04-17-desktop-minimum-launcher-version-governance-plan.md`
  - 结果：`Errors: 0`、`Warnings: 0`
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：未完全通过。
  - 原因：当前工作树里存在与本任务无关的历史/并行 touched 文件，命中了 legacy 命名与热点文件治理，不是本次新增的 desktop compatibility 治理文件触发。
- 已通过：远端 GitHub Actions workflow `desktop-release`
  - run id：`24570137388`
  - run URL：[desktop-release #24570137388](https://github.com/Peiiii/nextclaw/actions/runs/24570137388)
  - 触发分支：`codex/desktop-launcher-compat-governance`
  - 结果：整体 `success`
  - 关键观察点：
    - `desktop-darwin-arm64`、`desktop-darwin-x64`、`desktop-linux-x64`、`desktop-win32-x64` 全部成功
    - Unix / Windows 的 `Build signed product bundle + manifest` 均成功，说明新的 channel floor 解析逻辑已在真实 workflow 中跑通
    - `publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 为分支验证场景下的 `skipped`，不属于本次兼容性治理失败

## 发布/部署方式

- 本次已修正桌面 release workflow 的 minimum launcher version 取值逻辑；后续正式桌面 release 会自动从 [`apps/desktop/desktop-launcher-compatibility.json`](/Users/peiwang/Projects/nextbot/apps/desktop/desktop-launcher-compatibility.json) 读取对应 channel floor。
- 本次已在分支 `codex/desktop-launcher-compat-governance` 上远端重跑 `desktop-release` workflow，并确认 workflow 逻辑修正可通过真实矩阵构建与 bundle/manifest 阶段。
- 本次未直接创建新的 GitHub Release，也未在本 README 写入正式发布 URL；本次 run 的目标是验证治理后的 workflow 逻辑，而不是执行正式 tag 发布，因此发布类聚合 job 保持 `skipped`。

## 用户/产品视角的验收步骤

1. 打开 [`apps/desktop/desktop-launcher-compatibility.json`](/Users/peiwang/Projects/nextbot/apps/desktop/desktop-launcher-compatibility.json)，确认 stable / beta 各自维护独立 `minimumLauncherVersion`，且不再依赖当前 launcher 包版本。
2. 打开 [`desktop-release.yml`](/Users/peiwang/Projects/nextbot/.github/workflows/desktop-release.yml)，确认 workflow 先调用 `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel <channel>`，再把解析结果传给 `bundle:build` 与 `bundle:manifest`。
3. 打开 [`AGENTS.md`](/Users/peiwang/Projects/nextbot/AGENTS.md)，确认 `Project Rulebook` 中已存在 `desktop-minimum-launcher-version-must-be-governed`。
4. 打开 [`desktop-release-contract-guard/SKILL.md`](/Users/peiwang/Projects/nextbot/.agents/skills/desktop-release-contract-guard/SKILL.md)，确认 skill 已明确写出：`minimumLauncherVersion` 是 compatibility floor，不得用当前 launcher 版本自动派生。
5. 在本地执行 `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel stable`，确认输出的是 governed floor，而不是当前 launcher 包版本。
6. 在本地用错误的 `--minimum-launcher-version` 调用 `build-product-bundle.service.mjs`，确认脚本会直接阻断，而不是默默生成错误 manifest。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。这次没有再加一层“解释型补丁”去兜报错，而是直接删掉发布链路里“当前 launcher 版本即最低要求”的错误默认语义，把兼容性下限收敛成单一 contract。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：未做到净删除。本次存在净增，主要来自新的 compatibility contract、解析脚本、项目规则、方案文档与发布 skill 说明；这些增长属于把隐式发布假设前移为显式治理的最小必要新增。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。最低 launcher 要求现在从“散落在 workflow / 手工命令 / 发布习惯中的隐式约定”收敛为“contract 文件 + 小脚本 + workflow 消费”的单一边界，没有把逻辑塞进 runtime 或 UI 文案特判。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次新增文件都落在既有 desktop 发布链路与文档治理范围内；未额外制造新的职责散点目录。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。
- 可维护性复核结论：通过。
- 本次顺手减债：是。顺手清掉了桌面 release workflow 中“把当前 launcher 版本当 minimum launcher version”的错误默认值，避免后续每次发版都机械性抬高兼容门槛。
- 长期目标对齐 / 可维护性推进：这次顺着“让桌面更新更可预测、更少 surprise failure、更接近安装一次 launcher 后主要靠 bundle 更新”的长期方向推进了一小步。它没有去给用户加更多解释性报错，而是直接把破坏体验的发布默认行为收敛到受控 contract 上。
- 可维护性总结：这次改动虽然净增了少量脚本和规则文本，但它删掉的是一条更危险的隐式错误默认值。剩余观察点是：未来若确实需要抬高某个 channel 的 floor，必须继续严格遵循“显式改 contract + 写明破兼容原因 + 更新 release skill”的治理闭环，避免再次退回到随发布版本漂移的做法。
