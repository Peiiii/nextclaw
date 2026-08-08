# Exa 网页搜索提供商

## 迭代完成说明

- 将贡献者 PR 中已经实现的 Exa 请求与结果归一化链路，补齐到 NextClaw 的完整产品合同：配置 schema、kernel 工具可用性、server API、设置界面、双语文案和用户文档保持一致。
- 删除 Exa 私有的 `numResults` 配置，继续由 `search.defaults.maxResults` 统一拥有结果数量，避免同一语义出现两个配置来源。
- kernel 按当前 provider 索引 API Key，不再通过枚举分支维护可用性判断；新增搜索提供商时不会因为遗漏分支而被错误判定为未配置。
- server 更新沿现有单一配置 mutation 链路写入 Exa API Key 与 Base URL，并在切换显式密钥时清除旧的 secret reference。
- 本轮没有引入新的 manager、adapter、factory 或平行搜索链路。
- 贡献归属：本能力由 [@suantea](https://github.com/suantea) 在 [PR #23](https://github.com/Peiiii/nextclaw/pull/23) 发起；changeset 已保留公开署名，后续生成最终 changelog 与版本更新笔记时必须继续保留贡献者链接和 PR 链接。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core tsc`、`pnpm -C packages/nextclaw-kernel tsc`、`pnpm -C packages/nextclaw-server tsc`、`pnpm -C packages/nextclaw-ui tsc` 均通过。
- PR 分支定向测试通过：core 8 条、kernel 4 条、server 1 条、UI 2 条；覆盖 Exa 请求与结果归一化、配置保留、工具 readiness、配置 API view/update，以及设置页渲染和提交。
- 在 `origin/master@100283d82` 的临时调和态中，四个包的 TypeScript 检查与 17 条定向测试再次通过。当前 PR 分支与最新主干在 UI 公共 API 类型文件存在一处文本冲突；实际提交前需要合入最新主干并保留 provider model discovery 类型与 Exa union，两者组合后的验证已通过。
- 四个 package lint 均为零错误；core 的 24 条 warning 与 server 的 8 条 warning 均位于本次未触达文件，kernel 与 UI 无 warning；本次触达文件 targeted ESLint 为零问题。
- 全 PR diff 的 governance、backlog ratchet、release summary 与 generated-artifact clean 检查均通过。
- 未使用真实 Exa API Key 执行外部网络搜索，也未重启当前 NextClaw 实例；真实凭据搜索与运行中设置页的最终人工验收仍待合并后执行。

## 发布/部署方式

- 本轮仅在隔离工作树中优化 PR，尚未提交、推送、合并、发布或部署，也未重启任何 NextClaw 实例。
- 已添加 changeset；后续由统一 patch 发布流程发布相关 workspace 包与 `nextclaw`。
- 最终 changelog 与中英文 release note 需要公开感谢 [@suantea](https://github.com/suantea)，并链接 [PR #23](https://github.com/Peiiii/nextclaw/pull/23)；本轮尚未进入统一发版，因此不提前创建具体版本的 release note 文档。
- 数据库 migration、线上 API smoke、desktop/runtime update manifest：不适用；本次是本地搜索提供商配置与调用能力扩展。

## 用户/产品视角的验收步骤

1. 打开设置中的“网页搜索”，选择 Exa Search。
2. 填写 Exa API Key；如使用代理或兼容服务，再填写自定义 Base URL，然后保存。
3. 确认 Exa 显示为已配置，并让 AI 执行一次需要网页调研的搜索任务。
4. 确认搜索结果遵守全局最大结果数，并包含可供后续总结使用的网页正文。
5. 清空或替换 API Key 后再次保存，确认旧的 secret reference 不会继续生效。

## 可维护性总结汇总

- 遵循单一 owner 原则：全局 defaults 继续拥有结果数量，core 拥有搜索执行，kernel 拥有工具可用性，server 拥有配置 API，UI 只负责呈现和提交草稿。
- 复用了 Brave 与 Exa 相同的 API Key / Base URL 设置骨架，没有复制一套独立表单，也没有增加 provider-specific helper。
- server 的 provider patch 调用改为顺序更新，减少深层嵌套与新增 provider 时的结构噪音。
- Exa 与 Tavily 共用列表结果归一化主流程，将贡献者版本的 `web.tools.ts` 从 414 行降到 393 行，重新回到 400 行预算内；没有为降行数削弱类型或压缩可读性。
- 全 PR TypeScript/TSX 代码增减为新增 319 行、删除 67 行、净增 252 行；排除测试后新增 142 行、删除 53 行、净增 89 行。净增长来自新的用户能力、配置/API 合同与明确 provider 分支。
- maintainability guard 无阻塞项；7 条 warning 分别来自接近预算的 `web.tools.ts`、search config/API 类型文件，以及已有完整目录豁免的 kernel provider 与 UI API 目录。本轮没有新增目录文件，也没有让历史目录数量继续增长。
- 已完成独立 `post-edit-maintainability-review`：结论为通过，no maintainability findings。剩余观察点是未来再增加搜索提供商前，应评估把 provider request/normalization 从 `web.tools.ts` 收敛到明确的搜索 provider owner，而不是继续推高单文件。

## NPM 包发布记录

- `@nextclaw/core`：需要 patch，待统一发布。
- `@nextclaw/kernel`：需要 patch，待统一发布。
- `@nextclaw/server`：需要 patch，待统一发布。
- `@nextclaw/ui`：需要 patch，待统一发布。
- `nextclaw`：需要 patch，待统一发布。
- 本轮未执行 NPM publish；该能力没有必须绑定的正式产品截图，release-note 图片不适用。
