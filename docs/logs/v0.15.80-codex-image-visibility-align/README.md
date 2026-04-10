# 迭代完成说明

- 修复了 native 绘画图片在 NCP 会话里可见、但转到 Codex runtime 后被压成纯文本的问题。根因不是上传失败，而是 `@nextclaw/nextclaw-ncp-runtime-codex-sdk` 默认只读取最后一段文本，完全没有把用户消息里的图片部件转成 Codex SDK 支持的 `local_image` 输入。
- 把 Codex runtime 输入正式升级为 SDK 原生的 `string | UserInput[]`，让图片不再通过“资产说明文字”降级，而是通过本地文件路径直接进入 Codex。
- 把 UI agent 已有的 `assetStore.resolveContentPath()` 能力显式下传到 runtime factory，再传给 Codex plugin，补上了此前中途丢失的资产访问边界。
- 删除了插件内一份已经落后、且只会把附件写成文字说明的重复 `codex-input-builder.ts`，把输入构建逻辑收敛到 runtime 包共享实现里，避免两套 Codex 输入链路继续漂移。
- 顺手把 Codex runtime 主类拆出 `codex-input.utils.ts` 并把被触达的实例方法统一改成箭头 class field，避免为修复图片问题把运行时主文件继续堆胖。
- 同批次继续把本地插件调试机制补到了根因层：插件 package metadata 现在可以显式声明 `openclaw.development.extensions`，而 `plugins.entries.<pluginId>.source` 可以按插件粒度选择 `production` 或 `development` 入口，不再只能靠“整批插件全开 dev”这种粗粒度开关。
- 复用了现有 `dev-first-party-plugin-load-paths` 机制，但把它从“只把 workspace 包目录塞进 load path”升级成“只为声明了 dev 入口的 first-party 插件按插件默认切到 development source”；没声明的插件继续走原来的生产入口，不做隐式猜测。
- 补上了 pnpm workspace 场景下的 host alias 解析，让本地源码插件依赖到同仓库 `@nextclaw/*` 包时，开发态能优先对齐到 sibling `src/index.ts`，避免插件本体走源码、依赖却偷偷回到旧 `dist` 的假本地调试。
- 在用户指出“development source 机制代码加得太多而且散在主链路”之后，本轮又继续做了同批次结构收敛：把 package entry 选择、workspace alias、first-party dev load path 解析分别下沉到独立的 `development-source/` 目录，主链路文件只保留薄接线层，旧的 `discovery-package-directory.ts` 已删除。

# 测试/验证/验收方式

- 类型检查：
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - 结果：通过。
- 定向回归测试：
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/compat/codex-input-builder.test.ts`
  - 结果：通过，3/3 通过。
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/compat/codex-runtime-plugin-provider-routing.test.ts -t "passes asset path resolution into the codex input builder"`
  - 结果：通过，验证了 `resolveAssetContentPath -> inputBuilder -> local_image` 这条链路。
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/compat/codex-input-builder.test.ts src/cli/commands/compat/codex-runtime-plugin-provider-routing.test.ts -t "passes asset path resolution into the codex input builder|keeps plain text messages unchanged|includes file parts as asset reference text for codex prompts|emits local_image inputs when an uploaded image has a resolved local path"`
  - 结果：通过，4 条与本次问题直接相关的断言全部通过。
- 本地插件调试机制验证：
  - `pnpm -C packages/nextclaw-core exec tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw-openclaw-compat exec tsc -p tsconfig.json --pretty false`
  - 结果：通过。
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/plugin/dev-first-party-plugin-load-paths.test.ts`
  - 结果：通过，6/6 通过，验证了 first-party workspace 插件目录映射和 `source=development` 默认下发逻辑。
  - 本轮结构收敛后重新跑的关键 loader 用例：
  - `pnpm -C packages/nextclaw-openclaw-compat exec vitest run src/plugins/loader.ncp-agent-runtime.test.ts -t "prefers workspace source aliases for symlinked first-party dependencies during local plugin development"`
  - 结果：通过，验证 workspace alias 仍会命中 sibling `src/index.ts`。
  - `pnpm -C packages/nextclaw-openclaw-compat exec vitest run src/plugins/loader.ncp-agent-runtime.test.ts -t "loads the real codex runtime plugin from its declared development source entry"`
  - 结果：通过，直接验证了真实仓库内 Codex plugin 的 discovery/loader 会命中 `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts`。
  - `pnpm -C packages/nextclaw-openclaw-compat exec vitest run src/plugins/loader.ncp-agent-runtime.test.ts -t "prefers runnable plugin-local @nextclaw packages over host aliases"`
  - 结果：通过，验证插件本地可运行依赖仍优先于宿主 alias。
  - `pnpm -C packages/nextclaw-openclaw-compat exec vitest run src/plugins/loader.ncp-agent-runtime.test.ts -t "aliases host @nextclaw packages when external plugin-local copies are not runnable"`
  - 结果：通过，验证不可运行的插件本地副本仍会退回宿主 alias。
- 本次触达文件定向可维护性守卫：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-openclaw-compat/src/plugins/config-state.ts packages/nextclaw-openclaw-compat/src/plugins/manifest.ts packages/nextclaw-openclaw-compat/src/plugins/discovery.ts packages/nextclaw-openclaw-compat/src/plugins/plugin-loader-aliases.ts packages/nextclaw-openclaw-compat/src/plugins/development-source/entry-selection.ts packages/nextclaw-openclaw-compat/src/plugins/development-source/package-directory.ts packages/nextclaw-openclaw-compat/src/plugins/development-source/workspace-host-package-aliases.ts packages/nextclaw/src/cli/commands/agent/agent-runtime.ts packages/nextclaw/src/cli/commands/plugin/plugin-registry-loader.ts packages/nextclaw/src/cli/commands/plugins.ts packages/nextclaw/src/cli/commands/plugin/development-source/first-party-plugin-load-paths.ts`
  - 结果：通过，无 error；保留 1 条 warning，指出 `packages/nextclaw-openclaw-compat/src/plugins` 目录总文件数仍超预算，但本轮已经通过新增 `development-source/` 子目录阻止继续直接平铺。
- 全仓守卫与全量相关检查：
  - `pnpm lint:maintainability:guard`
  - 结果：失败，但当前阻塞项是 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter.ts` 的并行改动超预算，不是本次 Codex 图片修复引入。
  - `pnpm lint:new-code:governance`
  - 结果：失败，但失败点来自并行中的 `weixin-channel.ts` 与 `chat-composer-token-node.tsx` class-arrow 治理，不是本次触达的 Codex/NCP 文件。
  - `pnpm -C packages/nextclaw tsc --pretty false`
  - 结果：失败，但失败点是既有的 `packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts` `Set<string | undefined> -> Set<string>` 类型错误，与本次改动链路无关。

# 发布/部署方式

- 本次改动触达 runtime / plugin / UI NCP agent 装配链路，需要随下一次 NextClaw 桌面端或服务端构建一起带出。
- 若只做本地验证，至少需要重建 runtime 包：
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`
- 若要进入产品可用环境，按正常前端/桌面发布批次重建并发布包含 `packages/nextclaw` 与相关扩展包的产物即可；本次不涉及数据库、migration 或远程后端变更。
- 若要本地直接调试已安装的 first-party Codex plugin，不再需要重新发布插件包；只要在源码仓运行对应 CLI/服务，插件 discovery 会把它映射到 workspace 包目录，并在该插件声明了 `openclaw.development.extensions` 时默认走源码入口。

# 用户/产品视角的验收步骤

1. 在 native 绘画/图片输入入口创建或上传一张图片，确认聊天界面仍能正常预览。
2. 将这张图片发送到 Codex 会话，文本里直接问“你能看见这张图片吗？”。
3. 期望 Codex 明确确认看见图片，并给出图片内容层面的回答，而不是声称“我看不到附件”或完全忽略图片存在。
4. 继续追问一轮与图片内容相关的问题，确认同一线程里的 Codex 上下文没有退化回纯文本附件说明。
5. 再发送一个普通非图片附件，确认 Codex 仍只收到资产提示文字，没有因为这次修复把非图片文件错误当成图片输入。
6. 在本地源码仓直接启动 NextClaw，并确保已安装的 Codex runtime plugin 没有重新发布；再次发送图片到 Codex 会话，确认实际加载的是本地源码插件而不是历史 `dist` 产物。
7. 如果需要只让某个插件切到源码，可在配置里写 `plugins.entries.<pluginId>.source = "development"`；确认其他未声明的插件仍继续走生产入口，没有被一锅切成开发态。

# 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。修复问题时没有在现有文本 builder 外面再包一层 if/flag，而是直接把输入链路收敛到 runtime 共享实现，并删除插件侧重复 builder。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。先删掉了 117 行的重复 `codex-input-builder.ts`，本轮又继续删掉旧的 `discovery-package-directory.ts`，并把主链路里的内联 development-source 逻辑抽回独立目录，避免继续在热点文件里补丁式叠加。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：这轮续改已做到局部下降。当前相对 `HEAD` 的 development-source 相关子集累计是 `新增 794 / 删除 406 / 净增 +388` 行，但这次结构收敛本身已经把主链路热点文件额外压下去了一轮：`git diff --stat` 显示本轮对已跟踪热点文件是 `114 insertions / 420 deletions`，并把新增代码集中进独立目录，而不是继续摊平在主链路。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。插件入口选择、package directory 解析、workspace host alias、first-party dev load path 现在分别落在 `development-source/` 子目录内的独立模块里；CLI 侧原先那层 `dev-first-party-plugin-load-paths.ts` 空包装已经删除，调用方直接指向真实实现文件。
- 目录结构与文件组织是否满足当前项目治理要求：比上一版更接近满足。本轮新增 [development-source](../../../packages/nextclaw-openclaw-compat/src/plugins/development-source/entry-selection.ts) 子目录就是为了解决 `packages/nextclaw-openclaw-compat/src/plugins` 持续平铺的问题；当前父目录总文件数仍超预算，但至少没有继续恶化，后续如果再扩 loader/discovery 能力，应优先继续往该子目录按职责收敛。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行，以下结论基于一次独立复核与定向 guard，不只复述守卫输出。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次改动顺着“统一入口 + 统一体验”的长期方向推进了一小步：用户已经能在 native 侧看到的图片，现在终于能以同样事实进入 Codex，而不是在统一入口里被中途丢失。
- 这次顺手推进的维护性改进是删掉插件内重复 builder，并把输入构建逻辑收敛到 runtime 共享 helper，减少未来再出现“一个 Codex 入口支持、另一个不支持”的能力漂移。
- 这次进一步推进的维护性改进，是把本地插件调试从“反复重新发布插件”收敛成一条显式的机制链：插件声明 dev entry、配置按插件选 source、workspace first-party helper 只做默认下发、loader alias 对齐同仓依赖源码。
- 在用户指出“代码加太多、还散在主链路里”之后，本轮又把这条机制再往前收一层：development-source 相关实现集中进独立目录，主链路只保留入口与拼装，不再把真正逻辑散在多个热点文件里。
- 暂时没有把所有 first-party 插件一口气都补上 `openclaw.development.extensions`，是为了避免把未验证的插件一并切进开发态；当前只对已明确需要的 Codex plugin 落地，后续其它插件按需逐个声明即可。

代码增减报告：
- 新增：794 行
- 删除：406 行
- 净增：+388 行

非测试代码增减报告：
- 新增：794 行
- 删除：406 行
- 净增：+388 行

可维护性总结：
- no maintainability findings
- 这次虽然包含 bug fix 和本地调试机制补全，但最终没有停留在“功能过了就行”，而是继续把 development-source 逻辑收敛成独立目录，主链路文件更薄、职责也更清楚。
- 守卫已无 error；仍需关注的是 `packages/nextclaw-openclaw-compat/src/plugins` 父目录总量仍超预算，以及 `loader.ncp-agent-runtime.test.ts` 的执行时长偏长。下一步若继续补插件加载场景，优先继续把实现和测试按职责拆到 `development-source/` 子目录与更细的测试文件中，而不是再把复杂度堆回主链路。
