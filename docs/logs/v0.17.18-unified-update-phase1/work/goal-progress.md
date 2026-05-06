# Goal Progress

## 当前目标

补齐可复用的 NextClaw NPM beta 发布入口：命令、元指令、skill 和文档链路要统一。

## 明确非目标

- 不新造第二套独立发布机制。
- 不把桌面 release owner 混进来。
- 不借这个入口默认抬高 `minimumLauncherVersion`。

## 冻结边界 / 不变量

- NPM beta owner 仍建立在既有 `release:auto` 和 `npm-runtime-update-release.yml` 之上。
- 如果 batch 不包含 `nextclaw`，不应强行触发 runtime update workflow。
- 用户后续既可以通过元指令复用，也可以直接跑仓库命令。

## 已完成进展

- 已新增 `pnpm release:beta` 脚本入口。
- 已新增 `/release-beta` 元指令索引。
- 已新增 `npm-beta-release` skill。
- 已把 NPM 发布合同 skill 与 workflow 文档对齐到新入口。
- 已完成 `--help` / `--dry-run` / governance / maintainability 验证。

## 当前下一步

向用户交付复用方式，并等待是否继续提交 / 推送这批发布入口改动。

## 锚点计数器

13/20
