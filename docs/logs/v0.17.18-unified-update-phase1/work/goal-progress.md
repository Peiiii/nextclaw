# Goal Progress

## 当前目标

完成 `nextclaw@0.18.12-beta.7` 的 beta 发布闭环，并把一键 beta 发布入口补到可长期复用。

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
- 已真实发布 npm beta batch，`nextclaw@beta` 现为 `0.18.12-beta.7`。
- 已完成 runtime workflow `25449644478`，四个平台 release asset 已上传成功。
- 已确认 `gh-pages` 分支上的 beta manifest 已全部更新为 `0.18.12-beta.7`。
- 已修复 `release-beta.mjs` 的 tag push 过宽问题，后续只推本次 batch 的 release tags。

## 当前下一步

等待 GitHub Pages 公网 CDN 追上 `beta.7`，完成最后一层公网 manifest 验收后提交并推送脚本修复留痕。

## 锚点计数器

13/20
