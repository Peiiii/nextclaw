## 当前目标

补齐统一更新系统的用户可用闭环，重点是 NPM beta 也能发布、验签、下载、手动应用。

## 明确非目标

- 不把真实 npm registry 当 runtime bundle 更新源。
- 不用 `npm install -g` 作为自动更新主路径。
- 不改真实 `~/.nextclaw`。
- 不提升 minimum launcher version。

## 冻结边界 / 不变量

- NPM 更新模型仍是：check 只检查，download 只下载，apply 才切 current pointer。
- 桌面与 NPM 共享 update contract，不新增独立 update 包。
- beta 用户不应手动理解 manifest URL / public key。

## 已完成进展

- 已提交统一 runtime update flow。
- 桌面已有 `validation:dev-update` 手动验收入口。
- 已补 NPM `validation:npm-update` 用户视角入口。
- 已补 NPM runtime update channel builder、默认公网 update source 和发布 workflow。
- 已补齐 NPM 安装态 UI 更新链路：统一 runtime update host/API、统一 manager/store、版本号旁边进度与更新按钮、`/updates` 页入口。
- 已修正开发态 `pnpm dev start`：默认重新使用 `~/.nextclaw`，并禁用 dev runtime update host，避免左上角误报“更新异常”。
- 已统一发布 NPM beta 批次：`nextclaw@0.18.12-beta.3`、`@nextclaw/core@0.12.13-beta.1`、`@nextclaw/server@0.12.13-beta.0`、`@nextclaw/remote@0.1.90-beta.0` 等已上 npm。
- 已修复 runtime channel 发布链路：大 zip 改走 GitHub Release assets，`gh-pages` 只保留 manifest 与 public key。
- 已完成真实用户路径验收：`nextclaw@0.18.12-beta.2 -> check beta.3 -> download -> apply -> 新进程版本 0.18.12-beta.3`。

## 当前下一步

等待用户继续做 beta 体验验收；若用户确认没问题，再发布正式版。

## 锚点计数器

0/20
