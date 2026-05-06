## 迭代完成说明

- 将 `packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/progressive-bundled-plugin-loader.ts` 中 bundled 渠道插件的 progressive 加载路径改为：
  - 生产态 `.js/.mjs/.cjs` 入口走原生 `import()`
  - 仅保留 `ts` 等非原生入口继续走 `jiti`
- 根因：
  - bundled 渠道插件虽然多数只是薄 wrapper，但原先每个插件都会再次走无缓存加载路径，重复付出重型 `channel-runtime` 依赖图解释成本。
- 根因确认方式：
  - 变更前启动 trace 显示多数 bundled 渠道插件单个加载耗时约 `1.4s-1.6s`，总插件加载约 `17.5s`。
  - 变更后同一路径 trace 显示多数 bundled `.js` 渠道插件下降到 `1ms-12ms`，插件总加载约 `2.5s`。
- 为什么这是根因修复而不是症状修补：
  - 这次没有增加新 fallback，也没有额外补丁分支，而是直接替换掉 bundled 生产态插件的模块加载机制，让 Node 共享原生模块缓存。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- `pnpm -C packages/nextclaw-openclaw-compat build`
- `pnpm -C packages/nextclaw-openclaw-compat test -- loader.bundled-enable-state.test.ts`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/progressive-bundled-plugin-loader.ts`
- 真实启动 trace：
  - `NEXTCLAW_STARTUP_TRACE=1 node packages/nextclaw/dist/cli/app/index.js serve --ui-port 55702`

## 发布/部署方式

- 不适用。
- 本次仅为本地源码级性能优化验证，未执行发布或部署闭环。

## 用户/产品视角的验收步骤

1. 在工作区构建 `@nextclaw/openclaw-compat`。
2. 用 `NEXTCLAW_STARTUP_TRACE=1` 启动 `nextclaw serve`。
3. 观察 `plugin.loader.bundled_plugin` 日志。
4. 确认 bundled `.js` 渠道插件不再出现每个 `1s+` 的冷加载。
5. 确认 `plugin.loader.total` 明显下降，且 Feishu 这类 `ts` 入口仍可正常注册。

## 可维护性总结汇总

- 本次是否尽力改善可维护性：是。
- 正向减债动作：简化。
- 说明：
  - 只收敛了一个真实 owner 点：`progressive-bundled-plugin-loader.ts` 的模块加载分支。
  - 没有新增 fallback、兼容兜底或额外抽象层。
  - `post-edit-maintainability-guard` 针对触达文件已通过，非测试代码净增为负。
- 未闭合项：
  - `pnpm lint:new-code:governance` 仍会因为该历史文件名 `progressive-bundled-plugin-loader.ts` 不符合当前 role-suffix 白名单而失败。
  - 该问题是既有命名治理债，不是本次加载逻辑回归；本次未扩 scope 去做整目录命名迁移。
- `post-edit-maintainability-review`：已在本次交付收尾中进行人工复核。

## NPM 包发布记录

- 不涉及 NPM 包发布。
