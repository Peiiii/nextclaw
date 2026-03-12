# v0.13.85-model-config-empty-when-no-valid-provider

## 迭代完成说明（改了什么）
- 调整 Model 配置页 provider/model 初始化策略：仅使用“有效 provider（已配置且有模型）”作为可选来源。
- 移除“无匹配时自动回退到第一个 provider”的行为；当没有有效 provider 时，provider 与默认模型均保持为空。
- 当当前默认模型无法映射到有效 provider 时，Model 页不再展示残留模型值，避免误导。
- `SearchableModelInput` 新增 `disabled` 能力；在 provider 未选择时禁用模型输入与下拉切换，避免空 provider 场景下误填模型。
- 补充模型归属兜底：当默认模型未命中 provider 前缀时，若命中某个有效 provider 的模型目录（`defaultModels + custom models`），仍可正确映射该 provider（修复初始配置 `dashscope/qwen3.5-flash` + `nextclaw` 场景下的空白显示）。

## 测试/验证/验收方式
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- 构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
  - 结果：通过，`ModelConfig` 打包产物生成成功。
- 目标文件 ESLint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/lib/provider-models.ts src/components/config/ModelConfig.tsx src/components/common/SearchableModelInput.tsx`
  - 结果：通过。
- Lint 说明：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
  - 结果：未通过，失败点为仓库既有文件（如 `ChatConversationPanel.tsx`）中的 React Compiler/规则告警与错误，非本次改动引入。

## 发布/部署方式
- 本次仅为前端 UI 行为修正，无数据库/后端迁移。
- 按既有前端发布流程执行：构建通过后走仓库前端发布命令（如需要发布时由发布 owner 执行统一流程）。

## 用户/产品视角的验收步骤
1. 进入 Model 配置页，且当前没有任何“已配置且有模型”的 provider。
2. 观察 provider 下拉应保持未选择（占位态），模型输入应为禁用态，默认模型不应被自动填充。
3. 在 Providers 页完成至少一个 provider 的配置并保存模型后返回 Model 页。
4. 手动选择 provider，并选择/输入模型后保存；保存后刷新页面，所选 provider + model 可正确回显。
