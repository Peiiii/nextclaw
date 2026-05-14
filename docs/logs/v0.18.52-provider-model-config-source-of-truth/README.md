# v0.18.52 Provider Model Config Source Of Truth

## 迭代完成说明

- 根因：前端模型目录与 provider 设置表单在运行期合并了 provider spec 的 `defaultModels`，导致用户从 `config.json` 删除模型并保存后，UI 仍会从默认模板把模型补回。
- 确认方式：新增定向复现测试，模拟 OpenRouter 配置中只保留 `openai/gpt-5.3-codex`，验证已删除的 `openrouter/deepseek/deepseek-v3.2` 不应出现在可选模型目录中；修复前该测试失败。
- 修复方式：运行期模型列表与设置页编辑列表只读取 `config.providers.<provider>.models`；`defaultModels` 仅在内置 provider 第一次生成配置时写入 `config.json`，并补充 store 层测试覆盖初始化语义。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec vitest run src/shared/lib/provider-models/index.test.ts`
- `pnpm --filter @nextclaw/ui exec vitest run src/shared/components/model-config.test.tsx src/shared/lib/provider-models/index.test.ts`
- `pnpm --filter @nextclaw/server exec vitest run src/features/config/stores/server-config.store.runtime.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm -C packages/nextclaw-ui lint` 未通过，失败项是本次触达范围外的既有 UI lint error；本次触达 UI 文件定向 ESLint 通过，仅保留既有 warning。

## 发布/部署方式

未发布、未部署。本次为本地源码修复，等待后续统一发布批次。

## 用户/产品视角的验收步骤

1. 打开模型提供商设置，进入 OpenRouter。
2. 删除 `deepseek/deepseek-v3.2` 并保存。
3. 刷新页面后回到会话界面模型选择器。
4. 确认 OpenRouter 下不再出现 `deepseek/deepseek-v3.2`。
5. 新环境首次配置 OpenRouter 时，确认默认模型只作为初始化内容写入配置文件。

## 可维护性总结汇总

- 本次遵守单一事实源：运行期只读配置文件中的 provider models，不再在 UI 运行期合并模板默认值。
- 删除了前端表单中 legacy default/custom merge 逻辑，非测试代码净减少。
- server 初始化语义收敛为 `createDefaultProviderConfigFromSpec`，避免在调用点重复展开 `defaultWireApi/defaultModels`。
- 目录和文件命名通过治理检查；未新增重复业务路径。
- 已使用 maintainability guard；触达红区文件需记录如下。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：是。
- 说明：只保留 provider 配置创建入口负责初始化默认模型，运行期展示路径不再从 provider spec 回填模型，配置 store 的职责更接近“写入配置事实源”。
- 下一步拆分缝：按 provider config 初始化、config view 构建、runtime update 三个方向继续拆分当前 store，降低单文件红区压力。

## NPM 包发布记录

不涉及 NPM 包发布。
