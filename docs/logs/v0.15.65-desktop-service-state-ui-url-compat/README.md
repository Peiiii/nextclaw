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

## 测试/验证/验收方式

- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop build:main`
  - `PATH=/opt/homebrew/bin:$PATH node --test apps/desktop/dist/runtime-service.test.js`
  - `PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
- 结果：
  - `lint` 通过
  - `tsc` 通过
  - 2 条桌面端解析单测通过
  - 本地 macOS arm64 DMG 打包与安装冒烟通过，健康检查返回 `http://127.0.0.1:55667/api/health`
- 额外现场核对：
  - 用户报错时的弹窗文案来自 [runtime-service.ts](../../../../apps/desktop/src/runtime-service.ts)
  - 当前机器的 `~/.nextclaw/run/service.json` 现场状态已能看到 `uiUrl/uiHost/uiPort`
  - `~/.nextclaw/logs/service.log` 显示 managed runtime 可正常启动并写出 `UI frontend`
- 可维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：本次桌面改动相关治理项已通过，但整条命令最终仍被工作区内一个与本次修复无关的既有改动阻断：
    - `packages/nextclaw-ui/src/components/chat/hooks/use-chat-session-update.ts`
    - 阻断原因：`context destructuring` 治理告警
  - 判定：该失败不来自本次桌面修复文件，因此本次记录保留该背景，不在本迭代里顺手混改无关 UI 链路。

## 发布/部署方式

- 本次尚未执行正式发布，也未更新落地页。
- 原因：
  - 当前阶段仍属于桌面 beta 验收后的修复回合。
  - 仓库规则禁止在用户未明确要求时自行提交/推送代码。
- 下一步推荐闭环：
  1. 将本次修复提交到远端主分支
  2. 基于远端代码创建新的 desktop beta pre-release
  3. 触发 `desktop-release` workflow 上传三平台资产
  4. 等用户再次验证通过后，再提升正式版并更新落地页

## 用户/产品视角的验收步骤

1. 使用本次修复后的桌面包重新安装或覆盖安装。
2. 保留本机已有 `~/.nextclaw` 数据目录，直接启动桌面端。
3. 确认桌面端不再弹出 `Managed runtime is running but UI host/port is unavailable`。
4. 若后台服务已在运行，桌面端应直接接入现有本地 UI，而不是误判失败。
5. 在主界面可见后，继续验证最小闭环：
   - 能打开主界面
   - 能进入已有会话或设置页
   - 不要求用户手工删除 `~/.nextclaw/run/service.json`

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次是在收紧“桌面端如何读取 managed service 状态”这一条契约，而不是再加一条事故型兜底。
  - 方向上是朝“单一真相、读取语义更稳定、环境状态更少制造 surprise failure”推进了一小步。
  - 这次顺手减债点有两个：
    - 删除了桌面端对 `uiHost/uiPort` 的单一路径依赖，改为与 CLI 已存在契约对齐
    - 顺手把被触碰 class 的实例方法统一为箭头字段，避免留下半套 class 风格
- 本次是否已尽最大努力优化可维护性：
  - 是。
  - 这次没有去加“读不到就 sleep 重试 / 猜默认端口 / 写回 service.json”的隐式补丁，而是直接把读取契约修正到与 CLI 一致。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。
  - 虽然代码净增，但主要来自把原来隐藏在类私有方法里的解析逻辑抽成纯函数，并补最小必要测试；没有新增环境嗅探、事故分支或状态写回副作用。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 否，本次出现了最小必要净增长。
  - 代码增减报告：
    - 新增：94 行
    - 删除：38 行
    - 净增：+56 行
  - 非测试代码增减报告：
    - 新增：71 行
    - 删除：38 行
    - 净增：+33 行
  - 最小必要性说明：
    - 这次是非新增能力修复，净增主要来自一个纯函数解析器和 1 个测试文件。
    - 在接受增长前，已删除原类内旧的 `resolveManagedUiBaseUrl` / `resolveManagedUiHost` 实现，避免保留双套解析逻辑。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。
  - 现在 `RuntimeServiceProcess` 只负责启动流程；managed service 地址解释被收敛为可独立测试的纯函数，没有把兼容处理偷偷塞进启动副作用里。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 基本满足。
  - 仅新增 1 个桌面端测试文件，没有引入新的目录平铺问题。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 是。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：94 行
    - 删除：38 行
    - 净增：+56 行
  - 非测试代码增减报告：
    - 新增：71 行
    - 删除：38 行
    - 净增：+33 行
  - no maintainability findings
  - 可维护性总结：
    - 这次修复没有引入事故型 runtime 补丁，而是把桌面端读取逻辑收敛到已有状态契约，因此结构更清楚。
    - 净增已压到纯函数解析与最小测试这一级别；剩余债务主要是工作区里与本次无关的既有治理告警，不在本迭代混改。
