## 当前目标

补齐统一更新系统的开发态/用户视角验证入口，重点是 NPM 安装态也能像用户一样手动验证。

## 明确非目标

- 不接真实 npm registry。
- 不用 `npm install -g` 作为自动更新主路径。
- 不改真实 `~/.nextclaw`。
- 不提升 minimum launcher version。

## 冻结边界 / 不变量

- NPM 更新模型仍是：check 只检查，download 只下载，apply 才切 current pointer。
- 桌面与 NPM 共享 update contract，不新增独立 update 包。
- 验证入口优先复用现有 smoke fixture，不复制一套更新实现。

## 已完成进展

- 已提交统一 runtime update flow。
- 桌面已有 `validation:dev-update` 手动验收入口。
- 已补 NPM `validation:npm-update` 用户视角入口。

## 当前下一步

提交 NPM 用户视角验证入口补充。

## 锚点计数器

7/20
