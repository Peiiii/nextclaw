## 当前目标

文件化统一更新闭环验证法，并用接口层复现“已发布 beta 打开即显示更新失败”问题；现已完成修复、发布新的 beta，并通过真实已发布安装物的接口层闭环验收。

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
- 已把目标模式新增规则冻结为 skill 约束：`0/20` 和 `20/20` 都是强制 review 点。
- 已完成真实问题复现：公开 `nextclaw@0.18.12-beta.3` 启动后 `/api/runtime/update` 返回 `channel=stable`、`status=failed`、`404`。
- 已修复默认 channel 归属：beta launcher 现在默认走 beta channel，而不是 stable。
- 已修复新构建 shared chunk 下的包内 public key 路径兼容；本地打包安装物启动后 `/api/runtime/update` 已进入 `channel=beta`、`status=downloading`，并带连续 progress。
- 已提交并推送修复：`493b7de7 fix: default beta launcher updates to beta channel`。
- 已发布 `nextclaw@0.18.12-beta.4` 到 npm `beta` dist-tag，并 deprecated `0.18.12-beta.3`。
- 已重新发布 NPM runtime beta channel；workflow `25435357020` 成功，`gh-pages` 最新 commit 为 `95d29a83`。
- 已完成真实已发布安装物 API 闭环验收：全新安装 `nextclaw@beta` 得到 `0.18.12-beta.4`；`GET /api/runtime/update` 启动即返回 `channel=beta`、`status=downloading`、连续 `progress`；下载完成后变为 `downloaded`；`POST /api/runtime/update/apply` 返回 `restart-required`；同一 `NEXTCLAW_HOME` 重启后 `currentVersion=0.18.12-beta.4`、`status=up-to-date`。
- 已发布 stable recovery manifest：workflow `25436582081` 成功，`gh-pages` 最新 commit 为 `0e0288eb`。
- 已确认旧 `nextclaw@0.18.12-beta.3` 自动恢复生效：原样走 stable channel 启动后，`/api/runtime/update` 直接返回 `availableVersion=0.18.12-beta.4`、`status=downloading`，随后自动到 `downloaded`；`POST /api/runtime/update/apply` 后同一安装体新进程版本为 `0.18.12-beta.4`。

## 当前下一步

更新恢复发布留痕并提交/推送本次最终收尾文档。

## 锚点计数器

20/20
