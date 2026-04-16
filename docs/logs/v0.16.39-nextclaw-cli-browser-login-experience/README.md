# v0.16.39-nextclaw-cli-browser-login-experience

## 迭代完成说明

- 将 `nextclaw login` 的默认交互从“终端里输邮箱/密码”升级为“浏览器授权优先”：
  - 默认尝试打开系统浏览器
  - 始终在终端打印可复制链接
  - CLI 轮询浏览器授权结果，授权完成后自动落 token 并结束命令
- 新增 `--no-open` 兜底，适配服务器、远程终端、AI 代操作等场景；此时不自动打开浏览器，但仍打印链接并等待授权完成。
- 保留 `--email/--password` 直登旧路径作为显式回退，避免脚本或特殊场景被硬切断。
- 更新平台浏览器授权完成页文案，让用户明确知道“页面可以关闭，CLI 会自动完成登录”。
- 更新 CLI 帮助文案与 `docs/USAGE.md` / `packages/nextclaw/resources/USAGE.md` 的使用说明。
- 新增 `packages/nextclaw/src/cli/commands/platform-auth.test.ts`，覆盖默认浏览器流、`--no-open` 兜底和显式密码流回退。

## 测试/验证/验收方式

- 已通过：
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/platform-auth.test.ts src/cli/commands/remote-support/remote-access-host.test.ts`
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C workers/nextclaw-provider-gateway-api tsc`
  - `pnpm -C packages/nextclaw exec eslint src/cli/commands/platform-auth.ts src/cli/commands/platform-auth.test.ts src/cli/index.ts src/cli/types.ts src/cli/utils.ts --max-warnings=0`
  - `pnpm -C workers/nextclaw-provider-gateway-api exec eslint src/controllers/auth-browser-controller.ts --max-warnings=0`
  - `pnpm -C packages/nextclaw build`
- CLI 冒烟已通过：
  - 使用临时 `NEXTCLAW_HOME` 与本地 stub 平台服务完整执行 `node packages/nextclaw/dist/cli/index.js login --api-base http://127.0.0.1:<port>/v1 --no-open`
  - 观察到终端输出登录链接、等待授权、授权完成后自动写入 `providers.nextclaw.apiKey`
- 未完全通过但已判定为与本次改动无直接功能回归关系：
  - `pnpm -C packages/nextclaw lint`
    失败原因：仓库中已有的历史 warning-as-error 与一个无关测试错误（`session-request-delivery.service.test.ts`）
  - `pnpm -C workers/nextclaw-provider-gateway-api lint`
    失败原因：仓库内其它既有 warning
  - `pnpm lint:maintainability:guard`
    失败原因：其它并行/历史改动引入的大文件与目录预算问题，不在本次登录链路范围
  - `pnpm lint:new-code:governance`
    失败原因：当前 dirty worktree 中包含大量他处 touched 文件；同时本次触达的历史命名文件 `platform-auth.ts` / `auth-browser-controller.ts` 也会触发既有命名治理
  - `pnpm check:governance-backlog-ratchet`
    失败原因：当前工作区文档命名 backlog 已高于基线

## 发布/部署方式

- CLI 发布：
  - 运行 `pnpm -C packages/nextclaw build`
  - 按既有 npm / release 流程发布 `nextclaw`
- 平台后端发布：
  - 本次无数据库结构变更
  - 需要按既有 worker 发布流程部署 `workers/nextclaw-provider-gateway-api`
- 文档资源：
  - `packages/nextclaw/resources/USAGE.md` 由 `packages/nextclaw` 构建时自动从 `docs/USAGE.md` 同步

## 用户/产品视角的验收步骤

1. 在本地桌面环境执行 `nextclaw login --api-base <platform-v1-url>`。
2. 观察默认浏览器被自动打开；即使浏览器未打开，终端也能看到完整授权链接。
3. 在浏览器完成登录/授权后，回到终端，确认命令自动完成并显示账号与 token 已保存。
4. 在无头/远程环境执行 `nextclaw login --api-base <platform-v1-url> --no-open`。
5. 从另一台设备打开终端打印的链接并完成授权，确认远程 CLI 仍会自动完成登录。
6. 执行依赖平台登录的后续命令（例如 `nextclaw remote enable` 或相关平台能力），确认不需要再手动填 token。
7. 如需旧路径兜底，执行 `nextclaw login --api-base <platform-v1-url> --email <email> --password <password>`，确认仍可直登。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是

### 长期目标对齐 / 可维护性推进

- 本次改动顺着“统一入口、意图优先、把工具复杂度从用户手里收回”的方向推进了一小步：用户不再被默认要求在 CLI 里直接输入邮箱密码，而是获得统一的浏览器授权入口，同时兼容远程终端与 AI 代操作。
- 本次已尽最大努力把实现收敛在现有 owner 上：浏览器登录编排继续留在 `PlatformAuthCommands` 这个已有 class owner 内，复用现有 `startBrowserAuth` / `pollBrowserAuth` 平台能力，没有再平铺新的 helper 簇，也没有新加设备码协议、额外后端状态机或新依赖。
- 仍保留的下一条明确 seam：
  - `packages/nextclaw/src/cli/commands/platform-auth.ts` 已增长到接近文件预算；如果后续继续扩展注册/切换账号/JSON 机器接口，优先拆出独立的 browser-login runner / presenter，而不是继续把交互输出、轮询与命令入口都堆在同一个文件里。

### 代码增减报告

- 新增：361 行
- 删除：45 行
- 净增：+316 行

### 非测试代码增减报告

- 口径：排除 `*.test.*`，同时不把文档同步文件计入源码增减
- 新增：167 行
- 删除：43 行
- 净增：+124 行

### 可维护性总结

- 是否已尽最大努力优化可维护性：是。在本次 scope 内，已经优先复用既有浏览器授权底座、保留 class owner、避免引入新的协议层和额外抽象。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有新增设备码协议、没有新增专门服务端回调通道、没有把体验优化拆成更多命令；而是把已有能力收敛成默认路径，只增加最小必要的终端引导与轮询编排。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：未做到净减少。非测试源码净增 `+124` 行，主要来自浏览器登录默认路径、`--no-open` 兜底与用户提示；这部分增长属于新增用户可见能力的最小必要成本。同步偿还的小额维护性债务包括：
  - 让 `openBrowser` 返回显式成功/失败结果，避免 CLI 盲目假设浏览器一定能打开
  - 顺手清理 `auth-browser-controller.ts` 和 `utils.ts` 中触达位置的结构噪音
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。业务编排仍集中在 `PlatformAuthCommands`，没有把等待轮询、打印提示、打开浏览器这些职责散到 runtime、index 或零碎 util；worker 侧只做展示文案与轻量结构整理，没有额外引入一层补丁式 abstraction。
- 目录结构与文件组织是否满足当前项目治理要求：部分未满足。`platform-auth.ts` 与 `auth-browser-controller.ts` 属于仓库里既有的历史命名债务，本次因触达而继续暴露在治理检查里；但考虑当前工作区存在大量并行改动与同类命名问题，本次未扩大 scope 去做整批 rename。下一步整理入口：
  - 以 `packages/nextclaw/src/cli/commands/platform-auth.ts`
  - `workers/nextclaw-provider-gateway-api/src/controllers/auth-browser-controller.ts`
  为起点，配合更大一批 CLI / controller 命名治理一起处理，避免只为单点需求制造大面积 import churn。
- 本次代码可维护性评估是否基于独立于实现阶段的复核：是。以上结论基于一次独立于实现阶段的 `post-edit-maintainability-review` 式复核，而不是仅复述 guard 输出。
