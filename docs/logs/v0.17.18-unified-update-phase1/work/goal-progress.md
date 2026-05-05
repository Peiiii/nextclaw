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

## 当前下一步

修复真实 `nextclaw@beta` 发消息时 `this.inputBudgetPruner.estimate is not a function`，确认是否由 beta package / runtime bundle 依赖版本不匹配引起，并重新复验 npm beta 聊天路径。

## 锚点计数器

0/20
