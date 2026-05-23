# v0.19.14 IDE 声明映射修复

## 迭代完成说明

本次定位并修复跨 package 跳转定义退回 `dist/*.d.ts` 的开发体验问题。确认当前 TypeScript 解析 package exports 时默认条件为 `import/types/node`，不会命中各包 exports 中的 `development -> src/*.ts` 分支，因此 IDE 会先落到 `types -> dist/*.d.ts`。

直接全局加入 `customConditions: ["development"]` 可以让解析回到源码，但会把依赖包源码中的包内 alias 暴露到消费者项目上下文，导致 `@nextclaw/service` 编译依赖源码时无法解析 `@core/*`、`@kernel/*` 等包内路径。因此最终没有采用全局 development 条件，而是让所有 NPM 包构建统一产出 `.d.ts.map`。这样 TypeScript/IDE 仍按发布 contract 读取 `dist` 声明文件，同时通过 declaration map 跳回真实 `src`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-service exec tsc -p tsconfig.json --noEmit --traceResolution`：确认当前默认解析仍命中 `@nextclaw/kernel` 的 `types -> dist/index.d.ts`。
- 临时使用 `--customConditions development` 复现替代方案：确认可解析到 `src/index.ts`，但会引出跨包源码 alias 编译问题，因此不作为最终方案。
- `pnpm -C packages/nextclaw-kernel build`：通过，并产出 `dist/index.d.ts.map`。
- 检查 `packages/nextclaw-kernel/dist/index.d.ts.map`：`sources` 指向 `../src/...`。
- `pnpm -C packages/nextclaw-service tsc`：通过。
- `pnpm -C packages/nextclaw-server tsc`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react-ui tsc`：通过。
- `pnpm -C packages/nextclaw-service build`：通过，并产出服务包声明映射。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：不适用；本次没有 changed code-like files。

## 发布/部署方式

本次只修改各 workspace package 的构建脚本，未执行 NPM 发布、runtime update channel 发布、远程部署或数据库 migration。下一次统一 NPM 发布时，新产物会随 package build 带上 `.d.ts.map`，从而改善安装包和本地 workspace 的 IDE 跳转体验。

## 用户/产品视角的验收步骤

在 IDE 中从一个包点击另一个 workspace 包的导出类型或符号定义，预期不再停留在 `dist/*.d.ts`，而是通过 `//# sourceMappingURL=...d.ts.map` 跳回对应 `src` 文件。

若 IDE 已缓存旧 tsserver 状态，重启 TypeScript Server 或重新打开 workspace 后再验收。

## 可维护性总结汇总

本次使用 `post-edit-maintainability-review` 口径复核：改动为非功能修复，触达 38 个 package 构建脚本，总体新增 38 行、删除 38 行、净增 0 行；非测试口径同样净增 0 行。正向减债动作是复用现有 package exports/types 发布 contract 和 tsdown/rolldown-plugin-dts 的声明映射能力，避免恢复旧的消费者 tsconfig 跨包源码 alias 表，也没有引入 IDE 专用平行路径。

本次没有新增源码、函数、目录或 runtime fallback；保留的折中是 `--dts.sourcemap` 也会让 tsdown 输出 JS sourcemap，这会略增发布包体积，但换来声明跳源码和运行调试映射的一致产物。

## NPM 包发布记录

不涉及 NPM 包发布。本次只修改构建脚本；需要等下一次统一发布后，registry 上的 package 才会包含新的 `.d.ts.map`。
