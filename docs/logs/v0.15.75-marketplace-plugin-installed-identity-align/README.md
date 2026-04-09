# v0.15.75-marketplace-plugin-installed-identity-align

## 迭代完成说明（改了什么）

- 重新实现 marketplace 插件已安装判定里的 identity 归一逻辑，修复“本地生产态里 Codex / Claude 插件已实际存在且已加载，但市场页仍显示未安装，点击安装后又报已存在”的矛盾状态。
- 问题根因是插件市场列表使用 canonical npm spec（例如 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`），而本地 `installed` 视图对无 `plugins.installs` 记录、但已从全局/工作区目录发现到的插件，只返回了不带 scope 的 plugin id/spec（例如 `nextclaw-ncp-runtime-plugin-codex-sdk`），导致前端匹配不到已安装状态。
- 本次将“发现到的本地插件如何映射为 canonical marketplace spec”收敛为统一规则：
  - `packages/nextclaw-server/src/ui/ui-routes/marketplace/spec.ts` 新增发现态插件 canonical spec 解析入口，优先使用 install record 的 spec；若 install record 缺失，则回溯插件源码路径所属包的 `package.json.name`，统一转成 marketplace 侧使用的 npm spec。
  - `packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts` 不再内嵌临时路径解析逻辑，而是只负责收集三类来源（discovered / installed-only / config-only）并统一走 canonical spec 归一。
  - `packages/nextclaw-server/src/ui/router.marketplace-installed.test.ts` 新增无 `installs` 记录时的回归测试，确保“本地已发现插件”也会输出 `@scope/pkg` 形式的 marketplace spec。
- 同时顺手把 installed 收集逻辑改成纯返回值风格，去掉普通函数里对入参集合/数组的原地 `push/add`，避免继续沿着补丁式写法膨胀。

## 测试 / 验证 / 验收方式

- 诊断本地生产态实例：
  - `curl -sS http://127.0.0.1:55667/api/marketplace/plugins/installed | jq '.'`
  - `curl -sS 'http://127.0.0.1:55667/api/marketplace/plugins/items?page=1&pageSize=50' | jq '.data.items[] | {id,slug,name,spec:.install.spec}'`
  - 结果确认：本地实例实际已返回 `nextclaw-ncp-runtime-plugin-codex-sdk` / `nextclaw-ncp-runtime-plugin-claude-code-sdk` 为 `loaded`，但 marketplace 列表使用的是 `@nextclaw/nextclaw-ncp-runtime-plugin-*`，二者 identity 不一致。
- 定向测试：
  - `pnpm -C packages/nextclaw-server test -- --run src/ui/router.marketplace-installed.test.ts`
- 治理/守卫：
  - `pnpm lint:maintainability:guard`

结果：

- 定向测试通过，覆盖“有 install record”和“无 install record 但本地已发现”两种 installed 视图场景。
- `lint:maintainability:guard` 通过；仅保留仓库既有的 `packages/nextclaw-server/src/ui` 目录预算 warning，以及 `installed.ts` 接近预算 warning，但本次已把该文件从 397 行压到 383 行，没有继续恶化。

## 发布 / 部署方式

- 本次未执行发布或部署。
- 该修复要真正进入用户本地生产态，需要后续随发布批次带出至少 `@nextclaw/server` 与消费它的 `nextclaw` 包；否则本地已安装的旧版本实例仍会继续返回错误的 installed spec。
- 不涉及数据库、后端 migration 或远程部署步骤。

## 用户 / 产品视角的验收步骤

1. 使用带本地全局插件目录的 NextClaw 实例打开插件市场。
2. 确认 Codex / Claude 这类已经实际存在且已加载的插件，在 marketplace 插件列表中直接显示为已安装状态，而不是继续出现“安装”按钮。
3. 再次点击对应插件时，不应再走到“已存在”报错链路。
4. 若插件来自 `plugins.installs`、工作区扩展目录或全局扩展目录，marketplace 都应基于同一 canonical spec 判断 installed 状态。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 代码增减报告：
  - 新增：193 行
  - 删除：55 行
  - 净增：+138 行
- 非测试代码增减报告：
  - 新增：141 行
  - 删除：55 行
  - 净增：+86 行
- no maintainability findings
- 可维护性总结：这次不是新增用户能力，而是一次 installed identity 对齐修正。最终没有继续把路径回溯、canonical spec 推断、installed 收集混在一个函数里打补丁，而是把 identity 规则收敛到 `spec.ts`，并把 `installed.ts` 改回更可推理的纯收集流程；仍保留的债务是 `packages/nextclaw-server/src/ui` 顶层目录预算过高，以及 `installed.ts` 仍接近单文件预算，需要后续继续按责任拆分。
- 本次是否已尽最大努力优化可维护性：是。在不扩大功能面和发布范围的前提下，已经把“发现态插件 identity 归一”提升为单一规则，并顺手删掉了 `installed.ts` 内部的参数原地修改与临时解析逻辑。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有继续在 `installed.ts` 上层叠条件分支，而是先删掉内嵌补丁逻辑，再把 identity 推断收敛到已有 `spec` 归一层。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。按仓库要求纳入迭代 README 后，非测试净增为 `+86` 行；其中真正实现代码部分为 `+25` 行，增长来自统一的“发现态插件 canonical spec”入口，而 `installed.ts` 主文件本身净减 14 行，且没有新增额外目录平铺。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`spec.ts` 负责 identity 归一，`installed.ts` 负责 installed 记录汇总，测试文件负责回归场景覆盖；没有再把 incident-specific 逻辑留在收集层做一次性补丁。
- 目录结构与文件组织是否满足当前项目治理要求：未完全满足。`packages/nextclaw-server/src/ui` 目录仍存在既有预算 warning；本次未继续拆分其顶层结构，因为目标是先收敛 marketplace identity 缺陷。下一步整理入口是继续把 `ui-routes/marketplace` 下的 identity/collection/view 逻辑按职责抽出更细的 domain 模块。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。本节结论基于守卫通过后的独立复核，重点判断了本次非功能修正里的代码增长是否最小必要，以及是否真正把复杂度从补丁式收集层移走。
