# v0.16.38-builtin-channel-development-source

## 迭代完成说明

- 把产品内置 channel 插件统一补齐为可声明的开发态源码入口，不再让微信这种 `dist` 型插件在本地开发时悄悄落回旧构建产物。
- 本次补齐了以下内置插件的 `openclaw.development.extensions`：
  - `dingtalk`
  - `discord`
  - `email`
  - `feishu`
  - `mochat`
  - `qq`
  - `slack`
  - `telegram`
  - `wecom`
  - `weixin`
  - `whatsapp`
- 其中微信插件额外补了 `exports.development -> ./src/index.ts`，让它在工作区开发态下和其它源码包的行为保持一致。
- 在 [builtin-channels.test.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/channel/builtin-channels.test.ts) 增加守卫测试，要求所有产品内置 channel 插件都必须声明 `openclaw.development.extensions`，并且对应入口文件必须真实存在。

## 测试/验证/验收方式

- 守卫测试：
  - `pnpm --filter nextclaw test -- builtin-channels.test.ts dev-first-party-plugin-load-paths.test.ts`
- 类型检查：
  - `pnpm --filter nextclaw tsc`
  - `pnpm --filter @nextclaw/channel-plugin-weixin tsc`
- 本地插件开发态真实冒烟：
  - `pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-channel-plugin-weixin --timeout-ms 120000 --no-keep-running --json`
  - 验证结果：返回 `sourceMode: "development"`，说明微信插件已按预期进入源码模式
- 治理守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：失败，但失败项来自当前工作区里其它未收口的 Hermes / HTTP runtime 文件预算与历史目录治理问题，不是本次内置 channel development source 改动引入的问题

## 发布/部署方式

- 本次属于开发态加载机制修正，不需要单独发布部署步骤。
- 若要让本地服务立即吃到微信插件最新源码，直接使用：
  - `pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-channel-plugin-weixin --frontend`
- 常规仓库开发态下，first-party 插件在声明了 `openclaw.development.extensions` 后，会自动进入 `source: development`，不再依赖手动先 build `dist`。

## 用户/产品视角的验收步骤

1. 在仓库根目录启动本地插件开发服务：
   - `pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-channel-plugin-weixin --frontend`
2. 确认启动结果里显示微信插件为开发态源码模式，而不是 production / dist 模式。
3. 修改 [index.ts](/Users/peiwang/Projects/nextbot/packages/extensions/nextclaw-channel-plugin-weixin/src/index.ts) 或其它微信插件源码文件。
4. 重启本地插件开发服务后再次验证行为，确认无需手动 build `dist` 也能加载最新代码。
5. 若新增其它内置 channel 插件或调整其 package manifest，运行 `builtin-channels.test.ts`，确认不会漏掉 `openclaw.development.extensions`。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有新增隐藏 fallback、自动猜测或运行时兜底，而是把缺失的开发态入口声明显式补齐。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：没有新增运行时代码层和目录层；文件数只增加了一个守卫测试，没有增加新的 service、helper、adapter 或补丁层。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。修复点保持在每个插件自己的 manifest 边界，没有把问题转移成全局特殊判断，也没有给插件加载器再叠一层“内置插件例外”逻辑。
- 目录结构与文件组织是否满足当前项目治理要求：本次触达的文件满足当前需求；`pnpm lint:maintainability:guard` 的失败来自其它未收口目录与文件预算债务，本次未继续恶化。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：新增 105 行，删除 11 行，净增 94 行
  - 非测试代码增减报告：新增 68 行，删除 11 行，净增 57 行
  - no maintainability findings
  - 可维护性总结：本次净增主要来自 11 个内置插件 manifest 的显式声明，这是把“隐式依赖 dist”纠正成“显式声明 development source”的最小必要改动；除此之外只补了一个守卫测试，没有新增新的运行时复杂度。后续观察点是：凡新增内置 channel 插件，都要同步声明 `openclaw.development.extensions`，避免再次出现“本地开发却加载旧产物”的不一致体验。
