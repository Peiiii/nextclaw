# 当前目标

文件化统一更新闭环验证法，并用接口层复现“已发布 beta 打开即显示更新失败”这一真实用户问题，复现后命中正确 owner 修复，再做同链路验收。

## 当前事实

- 用户明确要求：主验证方式必须以接口层为主，不靠肉眼盯 UI。
- 已有成功路径验证：`nextclaw@0.18.12-beta.2 -> check beta.3 -> download -> apply -> 新进程版本 0.18.12-beta.3` 已跑通。
- 已有开发态误报“更新异常”问题已单独修复；那是 `pnpm dev start` 场景，不等于当前“已发布 beta 打开即失败”。
- 已完成真实问题复现：隔离安装 `nextclaw@0.18.12-beta.3` 并启动 `serve` 后，`GET /api/runtime/update` 返回 `channel=stable`、`status=failed`、`errorMessage=runtime update manifest request failed with status 404`。
- 当前统一更新接口面固定为：
  - `GET /api/runtime/update`
  - `POST /api/runtime/update/check`
  - `POST /api/runtime/update/download`
  - `POST /api/runtime/update/apply`
  - `PUT /api/runtime/update/preferences`
- NPM managed service 自动更新入口 owner 当前在 `packages/nextclaw/src/cli/shared/services/ui/npm-runtime-update-host.service.ts`。

## 关键约束 / 不变量

- 不提升 `minimumLauncherVersion`，除非有明确特殊情况。
- 不改 `check / download / apply` 语义：下载不等于生效，`apply` 才允许切 current pointer。
- 桌面与 NPM 继续共享 update contract，不新建独立更新协议。
- 复现必须优先走隔离环境，避免污染真实 `~/.nextclaw`。

## 证据 / 观察点

- 更新宿主状态真相源：`/api/runtime/update` 返回的 `UpdateSnapshot`。
- 启动自动检查逻辑：`NpmRuntimeUpdateHost.startAutomaticSync()`。
- 检查后状态分类逻辑：`NpmRuntimeUpdateManager.checkForUpdate()` / `toSnapshotAfterCheck()`。
- UI 只作为映射层，相关标签来自 `packages/nextclaw-ui/src/shared/lib/i18n/desktop-update-labels.utils.ts`。
- 现有手动验收入口：`packages/nextclaw/scripts/smoke-npm-runtime-update.mjs`，但它当前只覆盖 CLI 更新语义，还没有覆盖“已发布 beta 启动后 API 自动状态”。
- 公网更新源现场证据：
  - `beta` manifest 存在。
  - `stable` manifest 对当前平台返回 `404`。

## 活跃假设

- 当前主根因已确认，不再保留原始并列假设。
- 当前仅剩一个发布前观察点：修复后本地打包安装物是否仍能稳定读取包内 update public key 并进入正常自动下载状态。

## 已排除项

- 不是开发态 `pnpm dev start` 的那条 404 host 误报链路。
- 不是“下载即生效”的语义漂移；CLI 成功路径已经证明 `download` 和 `apply` 仍被正确区分。
- 不是 UI 自己瞎猜环境；失败态来自后端真实 `UpdateSnapshot`。

## 关键决策

- 先把问题压成“旧 beta 安装体 + 已发布新 beta + `/api/runtime/update` JSON 状态机”的黄金复现。
- 先判定后端 API 真相，再决定是否需要动 UI。
- 修复位点落在 launcher update source / state 默认值，而不是 UI 映射层。
- 同步补上包内 public key 路径对新构建产物 chunk 布局的兼容，避免修完 channel 后又被 signature block 卡住。

## 下一步

1. 只更新本迭代留痕，不误带用户当前工作区里的其它在途改动。
2. 提交并推送恢复发布与最终验证文档。

## 剩余缺口 / 交接提醒

- 真实 npm beta 用户修复已落地到 `nextclaw@0.18.12-beta.4`，且新的 runtime beta channel 已发布完成。
- 本次额外发现 GitHub Pages 缓存会让裸 `curl` 短时间看到旧 manifest；核对最新发布结果时需要加 cache-busting query，或直接核对 `gh-pages` 最新 commit 内容。
- 旧 `beta.3` 的“默认 stable -> 404 -> failed”问题最终通过 stable recovery manifest 修复，不需要再尝试修改旧安装体代码本身。
- recovery manifest 的边界是：`minimumLauncherVersion=0.18.12-beta.3`，因此只会命中坏掉的 `beta.3+` launcher，不会把 `0.18.11` 这类普通 stable 用户误拉到 beta runtime。

## 追加记录：beta.4 apply 后前台 serve 退出

### 新复现

- 用户在 `0.18.12-beta.4` 上看到版本号旁“更新”按钮，点击后服务退出，刷新页面卡死。
- 真实接口层复现：
  1. 隔离安装公开 `nextclaw@0.18.12-beta.4`。
  2. 启动前台 `nextclaw serve --ui-port 18890`。
  3. 让 `/api/runtime/update` 进入 `downloaded`。
  4. 调用 `POST /api/runtime/update/apply`。
- 结果：
  - apply 响应本身返回 `200`、`status=restart-required`。
  - 约 1.2 秒后再次 `GET /api/runtime/update` 直接 `fetch failed`，确认是服务进程退出，不是前端卡住。

### 根因

- `NpmRuntimeUpdateHost.applyDownloadedUpdate()` 无条件调用 `requestManagedServiceRestart(...)`。
- 该 helper 会落到 `background-service-or-exit`。
- 当前台 `serve` 不是托管后台 service owner 时，没有可重启的后台 service，于是直接 exit 当前进程。

### 修复

- `createServiceUiHosts()` 读取 `managedServiceStateStore`，显式区分当前进程是否就是 managed service owner。
- 把 `applyRestartMode` 传给 `NpmRuntimeUpdateHost`。
- managed service owner 维持原语义：apply 后请求 service restart。
- 前台 `serve` 改为只返回 `restart-required` 与手动重启提示 `recoveryCommand`，不再退出当前进程。

### 修后验证

- 定向测试通过：
  - `pnpm -C packages/nextclaw test src/cli/shared/services/ui/tests/npm-runtime-update-host.service.test.ts src/cli/shared/services/ui/tests/service-ui-hosts.service.test.ts`
- `pnpm -C packages/nextclaw tsc`：通过。
- `pnpm -C packages/nextclaw build`：通过。
- 本地签名更新源下的真实接口 smoke：
  - 启动 `node packages/nextclaw/dist/cli/app/index.js serve --ui-port 18892`
  - `/api/runtime/update` 进入 `downloaded`
  - `POST /api/runtime/update/apply` 返回 `status=restart-required`
  - 1.2 秒后再次 `GET /api/runtime/update` 仍返回 `200`
  - 返回体保留 `recoveryCommand="Restart this NextClaw process to launch the downloaded runtime."`

### 并行发现

- 当前公网 `beta` 与 `stable` runtime update manifest 指向的 `0.18.12-beta.4` bundle 都会在下载末端报 `sha256 mismatch`。
- 这会阻塞新的在线自动下载，但不是这次前台 `serve` apply 自杀问题的根因。
- 该发布物合同问题需要在下一次 runtime channel 发布时单独修复。

## 追加记录：`nextclaw restart` 误判前台 serve 为 unmanaged instance

### 新复现

- 用户在全局安装 `nextclaw@0.18.12-beta.5` 后执行 `nextclaw restart`，CLI 报错：
  - 目标端口已有健康实例
  - 但该实例“不受 `/Users/peiwang/.nextclaw/run/service.json` 跟踪”
  - 因而被判定为 unmanaged listener
- 现场核对：
  - `lsof -nP -iTCP:55667 -sTCP:LISTEN` 命中的是 `node .../lib/node_modules/nextclaw/dist/cli/app/index.js serve`
  - 也就是说，占端口的其实是我们自己的前台 `nextclaw serve`，不是 Docker 或别的外部服务

### 根因

- `RestartCommands` 之前只读取 `managedServiceStateStore`
- 当前台 `serve` 在跑时，它的 owner 状态写在 `localUiRuntimeStore`
- `restart` 没把这份状态纳入判定，所以会把“自己的前台 runtime”错报成 unmanaged external listener

### 修复

- 在 `RestartCommands` 内先解析目标 UI 端口
- 若 `localUiRuntimeStore` 中存在同端口、且 PID 仍存活的前台 runtime：
  - 先停掉该 PID
  - 清理它拥有的 `ui-runtime.json`
  - 再走既有 `startCommands.run()` 主路径，拉起受管后台 service
- 只有既不是 managed state、也不是本地前台 runtime 时，才继续报真正的 unmanaged listener 错误

### 修后验证

- 定向测试：
  - `pnpm -C packages/nextclaw test tests/cli/restart-commands.test.ts`
- `pnpm -C packages/nextclaw tsc`
- 真实前台重启 smoke：
  1. 隔离 `NEXTCLAW_HOME=/tmp/nextclaw-restart-verify-home`
  2. 在非仓库工作目录启动前台 `serve --ui-port 18795`
  3. 确认 `run/ui-runtime.json` 写入当前 PID 与端口
  4. 第二个进程执行 `restart --ui-port 18795`
  5. 观察到前台 PID 被停止，随后成功拉起后台 service
  6. `run/service.json` 与 `run/ui-runtime.json` 都更新为新后台 PID
  7. `curl http://127.0.0.1:18795/api/health` 返回 `200`

### 结论

- 这次用户看到的“healthy unmanaged instance”不是端口冲突本身，而是 restart owner 判定缺了一条前台 runtime 主路径
- 修复后，`restart` 已能正确接管并重启我们自己的前台 `serve`

## 追加记录：为什么本机还会继续出现 stale `ui-runtime.json`

### 新证据

- 现场 `~/.nextclaw/run/ui-runtime.json` 一度记录的是已经死掉的 PID，而真正健康监听 `55667` 的是另一个仍存活的 `nextclaw ... serve`。
- `~/.nextclaw/logs/service.log` 里能看到大量短命进程反复尝试绑定同一端口并报 `EADDRINUSE`。
- `~/Library/LaunchAgents/io.nextclaw.host-agent.plist` 现场确认是直接执行 `nextclaw serve`，且 `KeepAlive=true`。

### 根因 1：`startUiServer()` 过早返回

- 旧实现里，`startUiServer()` 在真正 listen 成功前就同步返回了 server handle。
- 结果是：一个随后会因 `EADDRINUSE` 失败的进程，也能继续执行 startup 后续逻辑，并写入 `ui-runtime.json`。
- 这会让失败进程把健康 owner 覆盖掉。

### 根因 2：LaunchAgent 无限重拉前台 `serve`

- 旧的 macOS LaunchAgent 配置是 `RunAtLoad=true + KeepAlive=true`，命令直接跑 `nextclaw serve`。
- 当受管后台 service 已经占住 `55667` 时，`launchd` 仍会持续重拉这条前台 `serve`。
- 每次重拉都会重新尝试绑定端口、报 `EADDRINUSE`，并不断制造“失败但先写 owner”的竞争。

### 修复

- `startUiServer()` 改为只在 Hono `serve()` 真正进入 listening 回调后才 resolve；listen error 直接 reject。
- `startUiShell()` 改为等待这个真实 ready 再继续后续 runtime owner 写入。
- macOS LaunchAgent 改成 `KeepAlive=false`，保留登录启动，但不再对退出后的 runtime 做无限监督重拉。

### 修后验证

- 隔离 `NEXTCLAW_HOME` 下，先启动一个健康 `serve --ui-port 53282`，再启动第二个同端口 `serve`：
  - 第二个现在直接 `EADDRINUSE` 退出；
  - `ui-runtime.json` 保持第一条健康进程的 PID，不再被失败进程污染。
- 本机 LaunchAgent 重装后：
  - `launchctl print gui/501/io.nextclaw.host-agent` 显示 `state = not running`
  - stdout/stderr 日志行数在多次轮询中保持不变，证明无限重拉已经停止
- 随后真实执行全局 `nextclaw restart`：
  - 不再报 `healthy unmanaged instance`
  - 最终恢复 `http://127.0.0.1:55667/api/health = ok`

## 追加记录：beta 发布入口收敛

### 目标

- 把“以后直接发一个 beta”从口头流程收敛成可复用入口
- 同时给 AI 与人类各一条稳定入口

### 落地

- 新增仓库命令：
  - `pnpm release:beta`
- 新增元指令：
  - `/release-beta`
- 新增 skill：
  - `npm-beta-release`

### 入口契约

- `pnpm release:beta` 默认执行：
  1. `pnpm release:auto`
  2. 如有 version/changelog 变更，自动创建 release commit
  3. 推送当前分支与 local tags
  4. 若 batch 包含 `nextclaw`，自动触发 `npm-runtime-update-release` 的 `beta` channel
  5. 等待 workflow 成功，并验证 runtime release assets 与 GitHub Pages 公网 beta manifest

## 追加记录：beta.7 发布闭环与脚本修正

### 发布结果

- 真实发布命令：`pnpm release:beta -- --branch master`
- npm registry 已发布：
  - `nextclaw@beta = 0.18.12-beta.7`
- release commit：
  - `a11f4fd1 chore: release beta batch`
- runtime workflow：
  - `25449644478`
- runtime release：
  - `nextclaw@0.18.12-beta.7`

### 暴露出来的自动化缺口

- `release-beta.mjs` 在 npm publish 成功后执行了 `git push origin --tags`
- 这会把仓库里的历史 tag 一并推送
- 远端若已存在不相关旧 tag，就会在“其实发布已成功”的情况下被 tag push reject 打断后续闭环

### 修复

- `release-beta.mjs` 改为只根据最新 release checkpoint 计算“本次 batch 的 package tags”
- 推送逻辑改成：
  - 先推 `HEAD:${branch}`
  - 再只推本次 batch 的 `refs/tags/<package>@<version>`
- 这样后续复用 `pnpm release:beta` 时，不会再因为历史 tag 冲突把成功发布误报为失败

### 发布后验证

- `gh release view nextclaw@0.18.12-beta.7 --repo Peiiii/nextclaw --json url,isPrerelease,assets`
  - 四个平台 runtime zip assets 齐全
- `git show origin/gh-pages:npm-runtime-updates/beta/manifest-beta-<platform>-<arch>.json`
  - gh-pages 分支上的四个平台 manifest 已全部指向 `0.18.12-beta.7`
- 额外观察：
  - GitHub Pages 公网 CDN 在 workflow 刚完成后的短时间内仍会返回 `beta.6`
  - 因此发布验收应优先区分“gh-pages 分支内容是否已更新”和“公网 CDN 是否已传播完成”，避免把传播延迟误判成发布失败

## 追加记录：beta.7 外壳仍显示 beta.4

### 新复现

- 用户现场状态：
  - 已安装 npm 全局 `nextclaw@0.18.12-beta.7`
  - 但 `nextclaw --version` 仍输出 `0.18.12-beta.4`
  - 左上角产品版本号也仍显示 beta.4
- 现场证据：
  - `NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER=1 nextclaw --version` 输出 `0.18.12-beta.7`
  - 普通 `nextclaw --version` 输出 `0.18.12-beta.4`
  - `~/.nextclaw/launcher/runtime-bundles/current.json` 仍指向 `0.18.12-beta.4`
  - `~/.nextclaw/launcher/runtime-bundles/versions/` 下只有 `0.18.12-beta.4`

### 根因

- 这不是单纯的 UI 展示 bug
- 真正的问题是 launcher 启动语义：
  - 之前只要 `current.json` 存在，就无条件优先启动 current runtime bundle
  - 不会比较“当前 bundle 版本”和“新装上的 npm 外壳版本”谁更新
- 所以当用户通过 `npm install -g nextclaw@beta` 把外壳升级到 `beta.7` 后：
  - 包内 app 已经是 `beta.7`
  - 但 launcher 仍会先跳进旧的 `beta.4` runtime bundle
  - 结果就是用户以为自己已经升到 beta.7，产品实际还活在 beta.4

### 修复

- 在 launcher / runtime update manager 里引入统一的 `effective current version` 规则：
  - `effective current version = current bundle version` 与 `launcher version` 之间较新的那个
- 当 `launcher version > current bundle version` 时：
  - launcher 直接运行包内 app，而不是旧 bundle
  - runtime update snapshot / state store 里的 `currentVersion` 同步成 launcher version
- 这样 UI 左上角、`/api/runtime/update`、`nextclaw --version` 都会回到同一个真实版本

### 修后验证

- `pnpm -C packages/nextclaw test src/cli/launcher/npm-runtime-update.manager.test.ts`：通过，7 个用例
- `pnpm -C packages/nextclaw tsc`：通过
- `pnpm -C packages/nextclaw build`：通过
- 隔离 home 真实复现 smoke：
  - 复制一个真实 `0.18.12-beta.4` current bundle 到临时 `NEXTCLAW_HOME`
  - 保持 `current.json = 0.18.12-beta.4`
  - 用本地修后的 `nextclaw@0.18.12-beta.7` 构建执行 `node dist/cli/launcher/index.js --version`
  - 结果输出 `0.18.12-beta.7`
- 接口层 smoke：
  - 同一隔离 home 启动 `serve`
  - `GET /api/runtime/update` 返回：
    - `hostVersion = 0.18.12-beta.7`
    - `currentVersion = 0.18.12-beta.7`
  - `launcher/npm-runtime-update-state.json` 也同步写成 `currentVersion = 0.18.12-beta.7`

### 验证

- `node scripts/release/release-beta.mjs --help`：通过
- `node scripts/release/release-beta.mjs --dry-run`：通过
- `pnpm lint:new-code:governance`：通过
- maintainability guard：通过，只有文件预算 warning，无 error

### 边界

- 这条入口复用既有 `release:auto` 与 `npm-runtime-update-release.yml`，没有额外新造一条发布机制
- 仍然禁止默认抬高 `minimumLauncherVersion`
- `--minimum-launcher-version-override` 只保留给 recovery publish

## 追加记录：beta release 的 runtime workflow 为什么慢

### 结论

- `pnpm release:beta` 里真正慢的不是 npm publish 本身
- 慢的是 `nextclaw` 进入“自动更新通道闭环”后的 runtime workflow
- 这条 workflow 不是单纯写 manifest 元数据，而是要：
  - 在 4 个平台 runner 上分别构建真实 runtime bundle
  - 给 bundle 签名
  - 上传到 GitHub Release assets
  - 再把小体积 manifest 与公钥发布到 `gh-pages`

### 必要耗时

- 四个平台 runtime bundle 构建本身就是实打实的产物构建，不是纯元数据写入
- GitHub Pages 在 `gh-pages` 推送后还会有一段 `building` / CDN 传播延迟

### 已确认的非必要耗时

- 原 `release-beta.mjs` 会在 workflow 成功后立刻强校验公网 Pages URL
- 如果 `gh-pages` 分支上的 manifest 已经更新到新版本，但 GitHub Pages 还在 `building` 或 CDN 还没刷新，脚本就会误报“public manifest mismatch”
- 这种误报会逼人重复 rerun `release:beta`，属于非必要发布耗时

### 本次优化

- 新增 `scripts/release/release-runtime-manifest-verify.mjs`
- `release-beta.mjs` 现在先验证 `gh-pages` 分支内容是否已正确指向新版本
- 再短轮询公网 Pages URL
- 如果 `gh-pages` 已正确、Pages 仍处于 `building`，则输出提醒而不是把整个 beta 发布误判为失败

### 收益

- 消除了“workflow 明明成功了，但因为 Pages 传播延迟被脚本误判失败”的重复发版损耗
- 保留了真正的发布合同：`gh-pages` 内容必须正确；公网 URL 在 Pages 构建完成后也必须对上

## 追加记录：beta 发布入口按语义拆分

### 用户需求

- 有时只想先把 npm beta 包快速发出去
- 不想每次都立即开放自动更新通道
- 需要把“发包”和“发 runtime bundle/update channel”从一个笼统动作拆成清晰的两步

### 本次落地

- 保留全闭环入口：
  - `pnpm release:beta`
- 新增 npm-only 快速入口：
  - `pnpm release:beta:npm`
- 新增 runtime-only 补发入口：
  - `pnpm release:beta:runtime`

### 语义

- `release:beta`：包 + runtime update channel 全闭环
- `release:beta:npm`：只发 npm beta 包，不触发 runtime workflow
- `release:beta:runtime`：读取当前已发布的 `nextclaw@beta` 版本，只补发 runtime workflow / release assets / gh-pages / 公网 manifest

### 配套同步

- `package.json` scripts 已补齐
- `commands/commands.md` 已新增 `/release-beta-npm` 与 `/release-beta-runtime`
- `npm-beta-release` / `npm-release-contract-guard` skill 已同步新语义
- `AGENTS.md` 命令索引已补齐新入口
