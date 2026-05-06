# Goal Progress

## 当前目标

修复“npm 全局外壳已升级到 `0.18.12-beta.7`，但产品实际仍启动 `current.json` 里的 `0.18.12-beta.4` bundle，导致版本号继续显示 beta.4”这一启动语义 bug。

## 明确非目标

- 不把问题错判成纯 UI 文案 bug。
- 不抬高 `minimumLauncherVersion`。
- 不改变 `download` / `apply` 的既有语义。

## 冻结边界 / 不变量

- 仍保持 NPM “外壳 + runtime bundle” 双层模型，不回退到 `npm install -g` 覆盖即生效的旧语义。
- 真正的修复 owner 在 launcher / runtime update manager，而不是 brand header。
- 必须同时校验 `nextclaw --version`、`current.json` 语义和 `/api/runtime/update` 的 `currentVersion`。

## 已完成进展

- 已在用户现场复现：
  - `NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER=1 nextclaw --version = 0.18.12-beta.7`
  - `nextclaw --version = 0.18.12-beta.4`
  - `current.json = 0.18.12-beta.4`
- 已确认根因：launcher 之前无条件优先跑旧 current bundle，不比较外壳版本和 bundle 版本。
- 已实现统一 `effective current version` 规则：
  - 运行时版本取 `launcher version` 与 `current bundle version` 中较新的那个
- 已完成定向验证：
  - `pnpm -C packages/nextclaw test src/cli/launcher/npm-runtime-update.manager.test.ts`
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C packages/nextclaw build`
  - 隔离 home 下 `node dist/cli/launcher/index.js --version = 0.18.12-beta.7`
  - 隔离 `serve` 下 `/api/runtime/update.currentVersion = 0.18.12-beta.7`

## 当前下一步

运行本轮收尾治理校验，确认没有新的可维护性或治理回归；如果通过，再按用户意图提交这次修复。

## 锚点计数器

14/20
