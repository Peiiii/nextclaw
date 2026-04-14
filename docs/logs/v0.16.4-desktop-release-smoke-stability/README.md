# v0.16.4-desktop-release-smoke-stability

## 迭代完成说明

- 修复 `apps/desktop/scripts/smoke-macos-dmg.sh` 的 macOS DMG 冒烟前置初始化方式，不再依赖打包后 `nextclaw init` 预热配置，而是直接写入最小 `config.json`，避免 `darwin-x64` 产物在 arm64 macOS runner 上卡死在预初始化阶段。
- 为 `.github/workflows/desktop-release.yml` 的 `build-desktop` 矩阵 job 增加 `timeout-minutes: 45`，避免未来类似卡死把整个桌面端预发布链路无限挂住。
- 本次续改又修复了一个更严重的桌面端数据目录回归：之前为了手动验证更新通道，错误地把 `runtimeHomeOverride` / `desktopDataDirOverride` 烘进了打包 metadata，导致验证安装包启动后不会回到用户自己的 `~/.nextclaw`。
- 现在已删除这条错误链路：
  - `apps/desktop/src/utils/desktop-paths.utils.ts` 不再从 packaged `update-release-metadata.json` 读取 `runtimeHomeOverride` / `desktopDataDirOverride`
  - `apps/desktop/scripts/update/services/write-release-metadata.service.mjs` 不再写入这两个字段
  - `apps/desktop/scripts/prepare-manual-update-validation.mjs` 只再写 `manifestBaseUrl`，不再给验证安装包烘入独立 runtime/data 目录
- 当前标准安装包内的 `Contents/Resources/update/update-release-metadata.json` 已收敛为：
  - `channel: "stable"`
  - `releaseTag: null`
  - 不再包含任何 `runtimeHomeOverride` / `desktopDataDirOverride`
- 本次继续收尾又定位出另一条会直接让用户误判“桌面包很老”的发布链路问题：
  - 仓库根的一键校验脚本 `pnpm desktop:package:verify` 之前只会跑 `electron-builder`，不会先重新生成 `apps/desktop/build/update/seed-product-bundle.zip`
  - 这意味着它可能把旧的 seed bundle 或缺失 seed 的状态直接带进新的 DMG，最终出现“安装包文件看起来是新的，但打开后桌面端 bundle 版本还是旧的”
  - 本次已经修正 [desktop-package-verify.mjs](/Users/peiwang/Projects/nextbot/scripts/desktop/desktop-package-verify.mjs)：现在会先执行 `pnpm -C apps/desktop bundle:seed`，并且在 DMG 产出后直接校验打包进去的 `seed-product-bundle.zip` 的 `bundleVersion` 必须等于当前 `packages/nextclaw/package.json` 版本
- 当前重新生成的标准 DMG 已确认内置 seed bundle 版本为 `0.17.10`，不再是错误的 `0.17.7`
- 本次又继续定位出导致“安装后直接打不开、`Runtime command failed: init exited with code=1`”的真正根因：
  - runtime bundle 构建阶段的 `pruneRuntimeNodeModules()` 之前会按目录 basename 粗暴删除 `doc` / `docs` / `example` / `test`
  - 这会把某些真实运行时依赖的内部目录也误删掉，例如 `yaml/dist/doc`
  - 最终打进桌面 seed bundle 的 runtime 虽然版本号正确，但一到 `nextclaw init` 阶段就会因为 `Cannot find module '../doc/directives.js'` 之类错误直接炸掉
- 现在已修正这条裁剪规则：
  - 只再删除包根层级的 `docs/`, `examples/`, `tests/` 等典型辅助目录
  - 不再误删像 `yaml/dist/doc` 这种包内部真实运行时目录
- 同时桌面端启动链路也补上了“同版本坏 bundle 自愈”：
  - 如果当前桌面数据目录里已经存在一个损坏的 `0.17.10`
  - 桌面端首次 `init` 失败后，会自动删除该损坏版本并重新用安装包内的 packaged seed bundle `0.17.10` 重铺，然后立即重试启动
- 本次继续收尾又定位出“明明安装包里的 seed 已经修好了，但桌面里仍然一直停在 `0.17.7`”的真正根因：
  - 用户机器上的 `launcher/state.json` 里会把启动失败过的 `0.17.10` 记进 `badVersions`
  - 之前这条隔离逻辑只按“版本号”拦截，不区分安装包里 bundled seed 的实际内容有没有变化
  - 结果就是：哪怕后来重新打出了一个已修复的 `0.17.10` DMG，只要版本号没变，启动器也会继续把它当成旧坏包处理，永远回滚到 `0.17.7`
- 现在已修正这条启动器判定：
  - `DesktopLauncherState` 新增 `lastAttemptedPackagedSeedVersion` / `lastAttemptedPackagedSeedSha256`
  - 启动器现在会记录“上一次尝试过的 packaged seed 指纹”
  - 如果同版本 packaged seed 的归档指纹已经变化，就允许重新尝试这份修复后的 seed
  - 如果同版本 packaged seed 指纹根本没变，则继续跳过，避免对同一份坏包无限重试

## 测试/验证/验收方式

- 已通过：`bash apps/desktop/scripts/smoke-macos-dmg.sh "$(find apps/desktop/release -maxdepth 1 -type f -name '*.dmg' | head -n 1)" 240`
  - 结果：`darwin-x64` 本地复现不再卡死，桌面 app 早退后 `runtime fallback` 成功，健康检查通过 `http://127.0.0.1:55668/api/health`。
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
  - 结果：`darwin-arm64` 本地桌面包验证通过，输出 `macOS package verified: .../apps/desktop/release/NextClaw Desktop-0.0.138-arm64.dmg`。
- 已通过：`bash -n apps/desktop/scripts/smoke-macos-dmg.sh`
- 已通过：`pnpm lint:new-code:governance`
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：当前本地工作区存在未纳入本次提交的既有改动 `apps/desktop/scripts/update/services/build-product-bundle.service.mjs`，其函数预算命中守卫；本次修复涉及的两个文件未命中增量治理规则。
- 已通过：标准 `0.0.138` DMG 安装级真实验证
  - 验证方式：
    - 用临时 `HOME` 创建一份隔离的 `HOME/.nextclaw`
    - 先执行 `NEXTCLAW_HOME="$TMP_HOME/.nextclaw" node packages/nextclaw/dist/cli/index.js init`
    - 再写入带明显标记的用户配置：`agents.defaults.model = "validation/sentinel-model"`，并新增 `providers.validation-provider`
    - 挂载 `apps/desktop/release/NextClaw Desktop-0.0.138-arm64.dmg`，把其中的 `.app` 复制到临时安装目录后启动
    - 同时故意注入错误环境：`NEXTCLAW_HOME="$BAD_HOME"`、`NEXTCLAW_DESKTOP_DATA_DIR="$BAD_DATA"`，确认 packaged 桌面端不会被这两个脏值带偏
  - 真实观察结果：
    - 应用 stdout 明确记录 `ambientNextclawHome=$BAD_HOME`
    - 同一份启动日志同时明确记录 `runtimeHome=$TMP_HOME/.nextclaw`
    - 启动日志继续记录 `resolvedRuntimeHome=$TMP_HOME/.nextclaw`
    - 运行中的桌面 runtime 实际返回 `/api/config`，其中 `agents.defaults.model` 为 `validation/sentinel-model`
    - 同一份 `/api/config` 里可见 `providers.validation-provider`
  - 结论：通过。标准 DMG 安装包已经真实回到用户自己的 `~/.nextclaw`，没有再被验证版 override 污染。
- 已通过：`codesign --verify --deep --strict --verbose=2 '/tmp/.../install/NextClaw Desktop.app'`
  - 结果：从标准 DMG 解出的安装版 `.app` bundle 签名校验通过。
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
  - 结果：
    - 新生成的 `seed-product-bundle.zip` 已明确产出 `bundleVersion = 0.17.10`
    - `desktop:package:verify` 新增硬断言并输出 `seed bundle version verified: 0.17.10`
    - `desktop:package:verify` 新增“直接解包 seed runtime 并执行 `init`”的硬验证，当前日志已输出 `seed runtime init verified`
    - 新标准安装包重新产出为 `apps/desktop/release/NextClaw Desktop-0.0.138-arm64.dmg`
    - DMG 冒烟继续通过：`runtime fallback health check passed: http://127.0.0.1:55667/api/health`
- 已通过：`node --test apps/desktop/dist/src/services/desktop-bundle-bootstrap.service.test.js apps/desktop/dist/src/launcher/__tests__/launcher-foundation.test.js`
  - 结果：
    - 新增两条启动器测试已通过：
      - `retries a quarantined packaged seed when the packaged archive fingerprint is new`
      - `does not retry the same quarantined packaged seed fingerprint again`
    - 相关 launcher foundation 回归测试也一起通过，共 `23` 条测试全部通过
- 已通过：模拟“用户本机桌面 bundle 仍停在 `0.17.7`”的真实升级验证
  - 验证方式：
    - 直接复制当前用户机器的真实桌面状态快照，其中包含：
      - `current.json = 0.17.7`
      - `launcher/state.json.currentVersion = 0.17.7`
      - `launcher/state.json.badVersions = ["0.17.10"]`
    - 再把这份快照绑定到本次编译后的 `DesktopBundleBootstrapService`
    - 使用最新重新打出的 packaged seed zip：`apps/desktop/release/mac-arm64/NextClaw Desktop.app/Contents/Resources/update/seed-product-bundle.zip`
    - 按真实启动顺序执行：
      - `ensureInitialBundleAvailability()`
      - `recoverPendingCandidate()`
      - 解析升级后的 runtime script
      - 真实执行升级后 runtime 的 `node .../runtime/dist/cli/index.js init`
  - 真实观察结果：
    - 启动器真实输出：`Packaged seed bundle 0.17.10 was previously quarantined, but the packaged archive fingerprint changed. Desktop will retry it before boot.`
    - 随后同一份快照目录里的 `current.json` 已更新为 `0.17.10`
    - `launcher/state.json.currentVersion` 已更新为 `0.17.10`
    - `launcher/state.json.lastKnownGoodVersion` 已更新为 `0.17.10`
    - `launcher/state.json.badVersions` 已在健康确认后清空
    - 升级后的 `0.17.10` runtime 又真实执行了一次 `init`，完整输出 `nextclaw is ready! (init)`
  - 结论：通过。即使用户机器上已经把旧的 `0.17.10` 标成坏版本，只要安装的是这次修复后的同版本新包，也会因为 packaged seed 指纹变化而重新放行升级，不会再永久卡死在 `0.17.7`。
- 已通过：模拟“用户机器当前已经是同版本 `0.17.10`，但 runtime 依赖损坏”的真实自愈验证
  - 验证方式：
    - 从真实用户桌面数据目录复制一份 `versions/0.17.10`
    - 人为删除 `runtime/node_modules/yaml/dist/parse/cst.js`，制造与用户现场同类的 `MODULE_NOT_FOUND` 故障
    - 再从最新 DMG 里拷出临时安装版 `.app`，通过 `NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE` 指向这份损坏状态目录后直接启动
  - 真实观察结果：
    - 第一次启动日志先真实命中 `Cannot find module '../doc/directives.js'`
    - 随后主进程继续记录：`Desktop bootstrap failed while running bundle 0.17.10. Reinstalling packaged seed bundle 0.17.10.`
    - 接着记录：`Reinstalled packaged seed bundle 0.17.10 after bootstrap failure.`
    - 再继续记录：`Retrying desktop bootstrap after packaged seed bundle repair for 0.17.10.`
    - 第二次 `init` 成功，随后 `Loading desktop window URL: http://127.0.0.1:...`
    - 修复后同一目录里 `versions/0.17.10/runtime/node_modules/yaml/dist/doc/directives.js` 与 `dist/parse/cst.js` 都重新存在
  - 结论：通过。即使用户机器已经缓存了一个损坏的同版本 `0.17.10` runtime，新安装包也会自动重铺并恢复启动。

## 发布/部署方式

- 提交本次修复后推送到远程默认分支。
- 创建新的桌面端 preview beta GitHub pre-release tag，触发 `.github/workflows/desktop-release.yml`。
- 等待 `desktop-release` workflow 完成后，确认 GitHub release 已挂载桌面端安装包、bundle、manifest 与更新通道文件。

## 用户/产品视角的验收步骤

- 打开新的桌面端 preview beta GitHub release 页面。
- 确认 release 为 pre-release，且包含 macOS、Windows、Linux 对应安装产物与 bundle/manifest 资产。
- 下载对应平台安装包。
- macOS 上打开 DMG 后完成安装，若桌面 app 首次启动早退，也应能自动切换到 runtime fallback 并返回健康状态。
- 若本机已有历史桌面端仍在后台运行，先从托盘或菜单完全退出，再启动这次的新安装包，避免单实例进程把旧窗口直接带回前台。
- 使用桌面端进入配置或聊天主流程，确认本地 UI 可正常打开并访问运行时接口。
- 进入“设置 > 桌面端更新”或查看桌面端当前版本时，确认不再停留在旧的 `0.17.7`，而是已经切到这次包内自带的 `0.17.10`
- 重点检查 provider、默认模型、会话列表是否继续读取用户已有的 `~/.nextclaw` 数据，而不是变成空白初始化状态。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次没有继续给“坏版本隔离”叠加例外判断，而是把 packaged seed 的判定条件收敛为“版本号 + 归档指纹”这一个明确规则，既解决了同版本修复包无法放行的问题，也避免了同一份坏包在每次启动时无限重试。
- 是否优先遵循删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好：是。本次没有再扩一层新的恢复通道或额外配置，而是只在现有 `DesktopBundleBootstrapService` 和 `DesktopLauncherState` 上补最小必要信息，让原有启动链路自己恢复正确行为。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到最小必要增长。本次为了解决“同版本修复包被旧 bad 标记挡住”这个真实线上问题，新增了 1 个小测试文件与 2 个状态字段；增长集中在桌面启动器本身，没有继续把复杂度外溢到新的脚本或目录。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。启动器状态继续由 `DesktopLauncherStateStore` 统一承载，packaged seed 的重试判定收敛在 `DesktopBundleBootstrapService`，没有把这类生命周期决策散落到 UI、脚本或更新源服务。
- 目录结构与文件组织是否满足当前项目治理要求：满足。本次仅收敛既有桌面端路径解析与构建脚本，没有引入新的目录或角色层。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已做独立复核，结论为“通过”。本次没有把逻辑继续补丁式塞进 `recoverPendingCandidate()` 或 UI 层，而是把判定约束留在 packaged seed bootstrap 边界内；新增状态字段和 layout 注入都服务于可测试性，没有引入新的职责漂移。
- 长期目标对齐 / 可维护性推进：这次顺着“更少 surprise、更可预测”的长期方向推进了一步。桌面启动器现在不再仅靠模糊的版本号记忆坏包，而是能识别“同版本但安装包内容已经变了”的修复场景。剩余可以继续优化的点，是把当前较重的桌面发包验证进一步拆成更快的增量层和更慢的发布层，但这属于独立批次，不在这次收尾里继续扩 scope。
