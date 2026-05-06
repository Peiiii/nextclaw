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
