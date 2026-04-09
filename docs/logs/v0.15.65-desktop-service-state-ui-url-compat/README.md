# v0.15.65-desktop-service-state-ui-url-compat

## 迭代完成说明

- 修复桌面端已安装模式下的 managed runtime 地址解析不一致：
  - [runtime-service.ts](../../../../apps/desktop/src/runtime-service.ts)
  - [runtime-service.test.ts](../../../../apps/desktop/src/runtime-service.test.ts)
- 原问题：
  - 桌面端在 `managed-service` 启动链里，执行完 `nextclaw start` 后只信任 `~/.nextclaw/run/service.json` 里的 `uiHost/uiPort`。
  - CLI 侧对同一份状态文件的契约更宽：`uiUrl` 是稳定入口，`uiHost/uiPort` 只是补充字段；旧状态或过渡态只要 `uiUrl` 可用，CLI 仍能继续工作。
  - 这会导致桌面端在“runtime 已启动，但当前 `service.json` 只有 `uiUrl` 或暂未补齐 `uiHost/uiPort`”时误判失败，并弹出 `Managed runtime is running but UI host/port is unavailable`。
- 本次修正：
  - 把 managed runtime 的 UI 地址解析抽成纯函数 `resolveManagedUiBaseUrlFromState`。
  - 解析顺序收敛为：
    1. 先读取并校验 `uiUrl`
    2. 只有 `uiUrl` 缺失或非法时，才回退到 `uiHost/uiPort`
  - 保持 loopback / wildcard host 仍统一归一到 `127.0.0.1`，避免桌面端把 `0.0.0.0` 直接拿去加载。
  - 顺手把 `RuntimeServiceProcess` 被触碰到的实例方法全部改成箭头函数 class field，满足当前仓库治理要求。
  - 新增 2 条无额外依赖的 `node:test` 单测，覆盖：
    - 只有 `uiUrl` 的旧/过渡状态
    - `uiUrl` 非法时回退到 `uiHost/uiPort`
- 续改现场排查结论：
  - 用户二次复现时，真实现场并不是“`service.json` 只有 `uiHost/uiPort` 不全”，而是 `~/.nextclaw/run/service.json` 整个缺失，但 `55667` 上仍有一个健康的 NextClaw HTTP 服务在监听。
  - 该进程属于未被 state file 跟踪到的 orphan service；CLI `status --json` 现场明确显示：
    - `serviceStateExists: false`
    - `orphanSuspected: true`
    - `configuredApiUrl: http://127.0.0.1:55667/api`
    - `configured` 健康检查为 `ok`
  - 第一版 beta 修复解决的是“state 已存在，但只有 `uiUrl` / `uiHost/uiPort` 过渡态”的问题；这次用户命中的则是另一条更底层的失败链：
    1. 有一个健康 orphan service 占住 `55667`
    2. `nextclaw start` 检测到端口冲突后只打印错误并 `return`
    3. 该命令未设置非零退出码，桌面端误以为 `start` 已成功
    4. 桌面端继续读取缺失的 `service.json`，最终弹出误导性的 `Managed runtime is running but UI host/port is unavailable`
- 本轮补充修正：
  - 调整 [service.ts](../../../../packages/nextclaw/src/cli/commands/service.ts) 中 `startService` 的失败语义：
    - UI 端口已被健康实例占用
    - spawn 失败
    - 后台服务在 ready 前退出
    - 为强制公共 UI 绑定而 stop 旧服务失败
    - 以上场景都会设置 `process.exitCode = 1`，不再“打印错误但返回成功”
  - 调整 [runtime-service.ts](../../../../apps/desktop/src/runtime-service.ts) 的 managed-service 启动报错：
    - `service.json` 缺失时，报 `Managed runtime did not write service state`
    - `service.json` 存在但字段非法时，报 `Managed runtime wrote invalid UI discovery state`
  - 桌面端现在会把 CLI 最近输出的关键错误行拼回弹窗 detail，避免只看到抽象的 `exited with code=1`
  - 新增 1 条桌面端单测，覆盖 CLI 失败信息透传
  - 本地打包验收链继续暴露了第二层问题：
    - [smoke-macos-dmg.sh](../../../../apps/desktop/scripts/smoke-macos-dmg.sh) 的 runtime fallback 端口区间写成了 `55667 -> 18840`，起始值大于结束值，导致脚本永远报“no available port”
    - 修正该脚本后，才继续暴露真正的包内问题：已安装 app 中 `@nextclaw/remote/package.json` 被 asar 归档错位，`nextclaw init` 在 fallback 路径上会报 `ERR_INVALID_PACKAGE_CONFIG`
  - 为避免桌面包继续依赖这份会被归档错位的 workspace 裸包目录，新增 [tsdown.config.ts](../../../../packages/nextclaw/tsdown.config.ts)，将 `@nextclaw/remote` 强制 bundle 进 `packages/nextclaw/dist/cli/index.js`
- 最终结果：
  - 桌面包不再依赖已安装 app 内那份损坏的 `@nextclaw/remote/package.json`
  - 本地 DMG 安装冒烟恢复通过
- 本轮 beta 发布链路补充修正：
  - 调整 [desktop-release.yml](../../../../.github/workflows/desktop-release.yml) 中 Windows 归档步骤，修复 preview/release 产物文件名未带版本号的问题。
  - 根因不是 `electron-builder` 不产版本号，而是 workflow 在 `Archive desktop artifacts (Windows)` 步骤里把 `win-unpacked` 目录手工压成了固定文件名 `NextClaw Desktop-win32-x64-unpacked.zip`。
  - 现已改为从 [package.json](../../../../apps/desktop/package.json) 读取桌面版本号，生成 `NextClaw.Desktop-<version>-win32-x64-unpacked.zip`；若版本缺失会直接失败，不再静默产出不符合约定的包名。
  - 同时把 Windows artifact 上传路径改成版本感知 glob，避免后续再次因为固定文件名导致上传规则与真实产物脱节。

## 测试/验证/验收方式

- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop build:main`
  - `PATH=/opt/homebrew/bin:$PATH node --test apps/desktop/dist/runtime-service.test.js`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop exec electron-builder --mac dmg --arm64 --publish never`
  - `PATH=/opt/homebrew/bin:$PATH bash apps/desktop/scripts/smoke-macos-dmg.sh "apps/desktop/release/NextClaw Desktop-0.0.133-arm64.dmg" 120`
  - `PATH=/opt/homebrew/bin:$PATH node scripts/desktop-package-verify.mjs`
- 续改补充验证：
  - `env -u ELECTRON_RUN_AS_NODE -u NEXTCLAW_DESKTOP_RUNTIME_SCRIPT -u NEXTCLAW_HOME '/Applications/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop'`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec tsx src/cli/index.ts start`
  - `git diff -- .github/workflows/desktop-release.yml`
  - `git diff --numstat -- .github/workflows/desktop-release.yml`
  - `PATH=/opt/homebrew/bin:$PATH node -e 'const { version } = require("./apps/desktop/package.json"); if (!version) throw new Error("missing version"); console.log(\`NextClaw.Desktop-${version}-win32-x64-unpacked.zip\`)'`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
- 结果：
  - `lint` 通过
  - `tsc` 通过
  - `packages/nextclaw build` 通过，且 `dist/cli/index.js` 不再保留 `@nextclaw/remote` 的外部 import
  - 3 条桌面端单测通过
  - 本地 macOS arm64 DMG 打包与安装冒烟通过，健康检查返回 `http://127.0.0.1:55667/api/health`
  - `node scripts/desktop-package-verify.mjs` 通过
  - Windows 归档命名改动 diff 仅触碰 1 个 workflow 文件：
    - 新增：8 行
    - 删除：3 行
    - 净增：+5 行
  - 使用与 workflow 同一版本源校验后，当前预期 Windows 包名为：
    - `NextClaw.Desktop-0.0.133-win32-x64-unpacked.zip`
  - `pnpm lint:maintainability:guard` 通过；仅报告与本次改动无关的既有目录/文件预算 warning，未发现本次 workflow 续改新增治理违规
- 额外现场核对：
  - 用户报错时的弹窗文案来自 [runtime-service.ts](../../../../apps/desktop/src/runtime-service.ts)
  - 现场复查确认，用户机器在报错时存在 `serviceStateExists: false` 但 `configuredApiUrl` 健康检查为 `ok` 的 orphan service 场景
  - 手工停掉 orphan 进程后，用干净环境直接拉起桌面 app，能够重新生成 `~/.nextclaw/run/service.json`
  - 干净启动时实际拉起的是 app 包内 helper：
    - `/Applications/NextClaw Desktop.app/Contents/Frameworks/NextClaw Desktop Helper.app/... nextclaw/dist/cli/index.js serve --ui-port 55667`
    - 不是全局 `/opt/homebrew/bin/nextclaw`
  - 续改后再次执行源码版 `nextclaw start` 复现“端口被健康实例占用”场景，命令已正确以 `exit code 1` 失败
  - 继续检查本地 DMG 产物时确认：
    - `app.asar` 中仍会带入 `node_modules/nextclaw/node_modules/@nextclaw/remote/` 目录
    - 但因 `packages/nextclaw/dist/cli/index.js` 已把 `@nextclaw/remote` bundle 进 CLI，桌面 runtime 不再在 `init`/`serve` 启动时读取这份损坏的包内 `package.json`
- 不适用 / 已知背景：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc` 仍被工作区内与本次无关的既有问题阻断：
    - `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/user-content.ts:147`
    - 错误：`Type 'string | null' is not assignable to type 'string'`
  - 判定：该错误不由本次桌面启动修复引入，因此未在本迭代里顺手混改无关链路
- 可维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：命令通过
  - 判定：
    - 本次 workflow 续改没有新增治理违规
    - 守卫输出里的 warning 均为与本次改动无关的既有目录/文件预算提醒，已在本次记录中如实保留

## 发布/部署方式

- 本次尚未执行正式发布，也未更新落地页。
- 原因：
  - 当前阶段仍属于桌面 beta 验收后的修复回合。
  - 这次续改虽然已经在本地完成，但尚未重新打包并发布新的 desktop beta。
  - 因此当前 GitHub 已发布的 Windows 资产若仍是旧包，文件名还不会自动变化；需要在下一次 preview beta 重新跑 `desktop-release` 后，新的 zip 才会按版本号命名。
  - 仓库规则禁止在用户未明确要求时自行提交/推送代码。
- 下一步推荐闭环：
  1. 将本次修复提交到远端主分支
  2. 基于远端代码创建新的 desktop beta pre-release
  3. 触发 `desktop-release` workflow 上传三平台资产
  4. 确认 Windows 资产名为 `NextClaw.Desktop-<version>-win32-x64-unpacked.zip`
  5. 等用户再次验证通过后，再提升正式版并更新落地页

## 用户/产品视角的验收步骤

1. 使用本次修复后的桌面包重新安装或覆盖安装。
2. 保留本机已有 `~/.nextclaw` 数据目录，直接启动桌面端。
3. 若本机 `55667` 已有健康 orphan service 但 `service.json` 缺失，确认桌面端不再弹出误导性的 `UI host/port is unavailable`；应直接给出准确的 CLI 启动失败信息。
4. 若后台服务已在运行且 state 正常，桌面端应直接接入现有本地 UI，而不是误判失败。
5. 在主界面可见后，继续验证最小闭环：
   - 能打开主界面
   - 能进入已有会话或设置页
   - 不要求用户手工删除 `~/.nextclaw/run/service.json`
6. 发布新的 preview beta 后，到 release 资产列表里确认 Windows 包名带版本号，例如 `NextClaw.Desktop-0.0.133-win32-x64-unpacked.zip`，并与 macOS/Linux 版本展示方式一致。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次是在收紧“桌面端如何读取 managed service 状态”这一条契约，而不是再加一条事故型兜底。
  - 方向上是朝“单一真相、读取语义更稳定、环境状态更少制造 surprise failure”推进了一小步。
  - 这次顺手减债点有六个：
    - 删除了桌面端对 `uiHost/uiPort` 的单一路径依赖，改为与 CLI 已存在契约对齐
    - 把“CLI 启动失败却返回成功”这条误导链路切断，让失败语义重新可预测
    - 让桌面弹窗直接暴露 CLI 关键失败原因，而不是再经过一次二次误翻译
    - 修正本地 DMG 冒烟脚本自身的错误端口区间，让验证链不再制造假失败
    - 用 `tsdown` bundling 收敛桌面 runtime 对 `@nextclaw/remote` 裸包目录的依赖，避免继续命中 asar 归档错位
    - 把 Windows 发布资产命名收回到“版本号来自桌面 package 元数据”这一条主合同，去掉 workflow 里隐藏的固定文件名分叉
- 本次是否已尽最大努力优化可维护性：
  - 是。
  - 这次没有去加“读不到就 sleep 重试 / 猜默认端口 / 偷偷补写 service.json / 自动接管未知 orphan 进程 / 识别特定错误文案后静默绕过”的隐式补丁，也没有在 runtime 内部写 Windows 特判，而是直接修正启动失败语义、验证链 bug、构建依赖形态与发布命名合同。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。
  - 虽然续改有净增，但主要来自把 CLI 失败信息透传为明确错误消息、修正本地冒烟脚本、新增一份极小的 `tsdown.config.ts`，以及把 Windows 归档文件名改成版本感知；没有新增环境嗅探、事故分支或状态写回副作用。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 否，本次续改出现了最小必要净增长。
  - 代码增减报告：
    - 新增：111 行
    - 删除：32 行
    - 净增：+79 行
  - 非测试代码增减报告：
    - 新增：91 行
    - 删除：31 行
    - 净增：+60 行
  - 最小必要性说明：
    - 这次是非新增能力修复，净增主要来自：
      - 让 CLI 失败返回非零退出码
      - 让桌面端把 CLI 失败关键信息透传给用户
      - 修正本地 macOS DMG 冒烟脚本的端口区间 bug
      - 新增 1 个极小的 `tsdown.config.ts`，把 `@nextclaw/remote` bundle 进 CLI
      - 修正 Windows release 归档命名，让版本号直接来自桌面包版本
      - 1 条补充测试
    - 没有引入自动接管 orphan service 的隐藏兜底路径，也没有给桌面 runtime 增加事故特判分支。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。
  - 现在 `RuntimeServiceProcess` 只负责启动流程；managed service 地址解释与 CLI 失败信息拼装都被收敛为可独立测试的纯函数，没有把兼容处理偷偷塞进启动副作用里。
  - 打包层面没有给桌面 app 额外再加一个 Electron 特判，而是把 `@nextclaw/remote` bundling 收回 `packages/nextclaw` 自身构建，职责边界更集中。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 基本满足。
  - 仅新增 1 个 `packages/nextclaw/tsdown.config.ts`，用于声明现有构建策略；没有继续扩张目录平铺。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 是。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：111 行
    - 删除：32 行
    - 净增：+79 行
  - 非测试代码增减报告：
    - 新增：91 行
    - 删除：31 行
    - 净增：+60 行
  - no maintainability findings
  - 可维护性总结：
    - 这次续改没有引入事故型 runtime 补丁，而是把“启动失败语义”“本地验证脚本正确性”“CLI 对 remote 裸包的依赖形态”和“Windows 发布资产命名合同”一起收敛回更可预测的主链，因此结构更清楚。
    - 净增已压到失败透传、验证脚本修正、构建收敛、发布工作流命名修正与最小测试这一级别；剩余债务主要是文档里引用的根脚本入口与当前仓库状态不一致，以及与本次无关的既有 TypeScript 问题，不在本迭代混改。
