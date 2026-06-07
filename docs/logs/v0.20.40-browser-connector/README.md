# v0.20.40 Browser Connector

## 迭代完成说明

本次新增 `@nextclaw/browser-connector` 独立 CLI 包，并新增 `browser-control` marketplace skill 源。

完成内容：

- 新增 `browser-connector` CLI，支持 `setup chrome`、`install chrome`、`uninstall chrome`、`doctor`、`status`、`tabs list/selected/get/open/claim/finalize`、`page snapshot`、`page screenshot`、`page goto/reload/back/forward`、`page click/type/press/scroll/wait`。
- Codex 对标审计后补齐 P0/P1 主链路能力：extension protocol/capabilities 广播、setup/doctor capability mismatch 检测、`status/pendingUrl` tab 元信息、snapshot 节点 `role/visible/disabled/unique` 字段、`page screenshot --output` 和更细错误码。
- `tabs open` 默认后台打开，用于临时评估/读取页面时不切走用户当前 active tab，对齐 Codex 风格的后台打开体验；`--foreground` 用于用户明确要求切到新页面的场景。
- 增强 snapshot selector 生成，优先使用 id、data-*、name、aria-label、placeholder、href，必要时生成唯一 CSS path，减少复杂页面上大量 `button` 非唯一 selector。
- 新增本地源码便利用法：`pnpm browser-connector:setup` 与 `pnpm browser-connector:setup:open`。
- 新增 Chrome Native Messaging Host launcher、Native Messaging frame 协议、local IPC server、tab lease manager、URL 脱敏、审计日志和稳定 JSON error shape。
- Native Host manifest 指向 setup 生成的 wrapper，wrapper 内写入绝对 Node runtime 路径，避免 Chrome 非 shell 环境找不到 nvm Node 后报 `Native host has exited`。
- 新增 Browser Connector Chrome Extension 静态资产，使用 Manifest V3、固定 unpacked extension id key、`nativeMessaging`、`tabs`、`scripting`、`activeTab`，并避免读取 cookies、localStorage、sessionStorage、密码、history 和 extension private storage。
- Browser Connector Chrome Extension 在 Native Host 断开后自动重连，降低修复或重新注册后仍需手动 reload 的概率。
- `setup chrome --json` 和 `doctor --json` 会报告 `chrome-extension-capabilities`；当 CLI 已更新但 Chrome 仍运行旧 unpacked extension background 时，会返回明确 reload 指引。
- 新增 `skills/browser-control/SKILL.md` 与 `skills/browser-control/marketplace.json`，按 marketplace skill 而不是 `.agents/skills` 落地。
- 新增对标审计计划文档：`docs/plans/2026-06-07-browser-connector-codex-parity-review-plan.md`，并与总设计和真实评估集互相引用。
- 根级 `build`、`lint`、`tsc` 脚本纳入 `packages/browser-connector`。
- 新增包内发布记录：`packages/browser-connector/CHANGELOG.md`。
- 新增 NPM README：`packages/browser-connector/README.md`，说明新用户安装、setup、默认后台打开、安全边界和卸载流程。

## 测试/验证/验收方式

已执行：

- `pnpm -C packages/browser-connector tsc`
- `pnpm -C packages/browser-connector lint`
- `pnpm -C packages/browser-connector test`
- `pnpm -C packages/browser-connector build`
- `pnpm --filter @nextclaw/browser-connector tsc`
- `pnpm --filter @nextclaw/browser-connector lint`
- `pnpm --filter @nextclaw/browser-connector test`
- `pnpm --filter @nextclaw/browser-connector build`
- `node --check packages/browser-connector/resources/extension/background.controller.js`
- `node --check packages/browser-connector/resources/extension/page-snapshot.utils.js`
- `node packages/browser-connector/dist/app/main.js setup chrome --json`
- `node packages/browser-connector/dist/app/main.js tabs selected --json`
- `node packages/browser-connector/dist/app/main.js tabs open "https://example.com/" --reason "verify default background opening does not interrupt the active Chrome tab" --json`
- `python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/browser-control`
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm publish --access public --tag latest --publish-branch codex/release-browser-connector-20260607181529`
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm view @nextclaw/browser-connector version dist-tags bin files --json`
- 非仓库目录 `npm install --prefix <tmp> @nextclaw/browser-connector@latest`，再执行 `<tmp>/node_modules/.bin/browser-connector --version`
- `node packages/nextclaw/dist/cli/app/index.js skills publish skills/browser-control --meta skills/browser-control/marketplace.json --api-base https://marketplace-api.nextclaw.io`
- `curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/browser-control`
- 非仓库目录 `node packages/nextclaw/dist/cli/app/index.js skills install browser-control --api-base https://marketplace-api.nextclaw.io --workdir <tmp>`
- dist CLI smoke：临时 home + 临时 Native Host manifest 目录，验证 `setup chrome`、`install chrome`、`doctor` host warning、fake IPC 下 `status`、`tabs list`、`tabs claim`、`page snapshot`、`page click`、`tabs finalize`
- Native Host 协议级单测：模拟 Chrome Extension Native Messaging ready/response，验证 IPC request 经 Native Host 转发并返回
- Native Host wrapper smoke：使用 Chrome 近似的瘦 `PATH=/usr/bin:/bin:/usr/sbin:/sbin` 启动 manifest 指向的 wrapper，模拟 `extension.ready` native frame，确认 host 不因找不到 Node 秒退
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm tsc`

真实 Chrome 验证：

- 用户 reload unpacked extension 后，`setup chrome --json` 返回 `ready=true` 与 `chrome-extension-capabilities=true`。
- E00/E01/E02/E03/E04/E05/E06/E07/E09/E10/E11/E12 核心用例已通过并回写真实评估集。
- `tabs open` 默认后台打开已验证不会切走用户当前 active tab：打开 example.com 返回 `active=false`，随后 `tabs selected` 仍为原 NextClaw 对话页。
- example.com snapshot/screenshot/wait 通过。
- 本地 demo 页 type/click/scroll/reload/wait 通过。
- Suno 真实页面 snapshot/screenshot 通过，并验证关键输入框和按钮可返回唯一 selector。

## 发布/部署方式

本次已执行 NPM 首发与 marketplace skill 发布；未执行 desktop 发布或 runtime update。

发布结果：

- NPM：`@nextclaw/browser-connector@0.1.0` 已发布到 `latest`。
- Marketplace：`@nextclaw/browser-control` 已发布，alias 为 `browser-control`。
- NPM 安装冒烟：非仓库目录安装 `@nextclaw/browser-connector@latest` 后，`browser-connector --version` 输出 `0.1.0`，`setup chrome --json` 返回 ready。
- Marketplace 安装冒烟：非仓库目录安装 `browser-control` 成功，包含 `SKILL.md`、`marketplace.json` 与 `.nextclaw-install.json`。
- 如进入桌面分发，仍需再接入桌面安装/更新/卸载时的 Native Host manifest 注册闭环。

## 用户/产品视角的验收步骤

用户可通过以下路径验收：

1. 安装 `@nextclaw/browser-connector`。
2. 本地源码测试执行 `pnpm browser-connector:setup:open`；发布包测试执行 `browser-connector setup chrome --open --json`。
3. 若 `ready=false`，在 Chrome 中按 `nextSteps` 加载返回的 `nativeHost.extensionDir`；`--open` 会尽量打开 Chrome extensions 页面和扩展目录。
4. 重新执行 `browser-connector setup chrome --json`，确认 ready。
5. 执行 `browser-connector tabs list --json`，看到当前 Chrome tabs。
6. 执行 `browser-connector tabs selected --json` 或 `browser-connector tabs get <tabRef> --json`，确认目标 tab 元信息。
7. 临时读取或评估页面直接用 `tabs open`，默认后台打开；只有用户明确要求切过去看时才加 `--foreground`。
8. 执行 `tabs claim` 后读取 `page snapshot` 或 `page screenshot --output /tmp/browser-connector-page.png`。
9. 对普通页面执行 goto/reload/back/forward、click/type/scroll/wait，并在提交类动作前要求用户确认。
10. 完成后执行 `tabs finalize`。
11. 在 NextClaw 中安装 `browser-control` marketplace skill 后，让 AI 按 skill 调用 CLI。

## 可维护性总结汇总

本次是新增用户能力，非测试代码净增是必要增长。实现保持两个 owner：

- `packages/browser-connector` 负责真实执行、Native Host、Extension、IPC、tab lease、CLI JSON contract；
- `skills/browser-control` 负责 marketplace 用户旅程、就绪检查、使用纪律和排障。

可维护性结果：

- 最新 `post-edit-maintainability-guard` 无错误、1 个预算接近警告：`packages/browser-connector/src/app/register-browser-connector-commands.ts` 接近 400 行预算；
- `lint:new-code:governance` 全部通过；
- `check:governance-backlog-ratchet` 通过；
- module structure 未新增治理 protocol，复用 `app-l1`，extension 静态资产放在 `resources/extension`，避免污染 `src` 角色结构；
- 未把 browser connector 接入 NextClaw kernel/runtime/UI，保持与产品主体解耦。

保留债务与拆分缝：

- `resources/extension/background.controller.js` 已拆出 `page-snapshot.utils.js`，避免 extension background 超过文件预算。下一步若继续扩展，应继续拆出 tab operations、page script operations、serialization/error mapping。
- `register-browser-connector-commands.ts` 目前仍集中注册所有 CLI 命令。下一步若继续扩展，应拆成 install/status/tabs/page command registration。

代码增减：

- 总计：新增 3831 行，删除 0 行，净增 3831 行。
- 非测试：新增 3209 行，删除 0 行，净增 3209 行。

## NPM 包发布记录

涉及 NPM 包，首发状态：

- `@nextclaw/browser-connector`：新增包，首发版本 `0.1.0` 已发布到 NPM `latest`。
- registry 验证：`npm view @nextclaw/browser-connector version dist-tags --json` 返回 `0.1.0` 与 `latest: 0.1.0`。
- 安装验证：非仓库目录安装 published package 后，CLI 输出 `0.1.0`，setup readiness checks 通过。

不涉及已发布版本更新、GitHub release 或 runtime update channel。

## 本次发布流程教训沉淀

- 隔离 worktree 发布必须贯穿使用主仓库 `.npmrc`：`publish`、`npm view`、`npm install` 都要使用同一个 `NPM_CONFIG_USERCONFIG`，否则会出现用户级 npm 配置未登录导致的 401/404 误判。
- `pnpm publish --publish-branch` 不能在 detached HEAD 直接跑；隔离发布要创建明确 release branch。
- scoped package 首发成功后，`npm view` 或 `npm install` 可能短暂 404，应使用同一 npm config 做有限重试，不要立刻重复 publish。
- marketplace 发布 CLI 当前真实入口是 `packages/nextclaw/dist/cli/app/index.js`，不是旧的 `dist/cli/index.js`。
