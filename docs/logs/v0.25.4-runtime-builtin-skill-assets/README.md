# v0.25.4 NPM 运行时内置 Skill 资产保留

## 迭代完成说明

- 根因是 NPM runtime update 构建器在部署生产依赖后统一裁剪 Markdown，错误地把 `@nextclaw/core/dist/skills/**` 下的 `SKILL.md` 和引用资料当成普通说明文档删除。`@nextclaw/core@0.15.7` 的 NPM tarball 本身完整，丢失发生在后续 runtime bundle 裁剪阶段。
- 端到端证据是：已发布的 `nextclaw@0.25.2` 依赖正确的 `@nextclaw/core@0.15.7`，core tarball 包含 `visualize-output/SKILL.md`；但应用 `0.25.2` runtime bundle 后的 skill API 返回 0 个 builtin，而当前源码实例返回完整 builtin 列表。部署目录中只剩非 Markdown 文件，和构建器的通用 Markdown 裁剪规则逐项吻合。
- 旧内置 skill 曾被历史 workspace 复制件遮蔽，因此缺失没有立即暴露；新加入且没有旧复制件的 `visualize-output` 首先把问题显现出来。修复没有只对白名单中的单个 skill 打补丁，而是保留完整语义资产边界 `@nextclaw/core/dist/skills/**`。
- 该子树之外继续沿用通用 Markdown、source map、类型声明和测试资料裁剪，避免放弃现有包体优化；没有新增资产 manifest、下载器、manager、fallback 或第二条 skill 安装路径。
- 新增源码 skill 目录与部署 skill 目录的文件路径和内容指纹校验，首次部署和缓存恢复两条路径都会执行；空目录不属于 NPM 运行时资产，因此指纹只比较真实文件。任何 skill 文件再次被遗漏或修改都会让构建直接失败。
- runtime deployment cache schema 从 1 提升到 2，旧缓存不会继续复用；真实更新验证在候选 runtime 应用后读取 skill API，并硬性断言存在可用且 `source=builtin` 的 `visualize-output`。
- 本次遵循 [内联可视化资产设计](../../designs/2026-07-17-inline-visualization-assets.design.md) 的轻量边界：skill 是随 core 发布的内置运行时语义资产，会话生成的 HTML 才进入 NextClaw 持久资产目录，两者不混用临时目录或工作区平铺。

## 测试/验证/验收方式

- `node --check` 检查 3 个触达的 `.mjs` 文件，通过。
- 触达文件 ESLint、`pnpm --filter nextclaw lint` 与 `pnpm --filter nextclaw tsc` 通过，无 error。
- `pnpm -C packages/nextclaw smoke:npm-runtime-update` 通过，覆盖现有 launcher 的检查、下载、应用与版本切换回归。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`git diff --check`、`pnpm clean:generated` 与 `pnpm check:generated-clean` 全部通过。
- `pnpm dev:verify-update -- --rebuild --no-open --keep --port 18900` 在显式项目 pnpm store 与隔离 `NEXTCLAW_HOME` 下完成全源码构建、runtime bundle 构建、旧版基线启动、候选下载、候选应用和服务重连。候选版本为 `0.25.2`，PID 从 `95737` 切换到 `3025`，应用后 API 返回 17 个可用 builtin，并包含 `source=builtin` 的 `visualize-output`；fixture 完整重建耗时 92.3 秒。
- 生成的候选 zip 包含 core skill 源目录的全部 27 个真实文件；`@nextclaw/core/README.md` 等 skill 子树外的 Markdown 仍被裁剪，证明例外边界没有扩大到整个 package。
- 包体实测使用同一个 compression level 1 候选包重生成“仅移除 core skills”的对照包：完整包为 30,436,554 bytes，对照包为 30,349,098 bytes，净增 87,456 bytes（约 85.4 KiB、0.288%），低于 100 KiB 目标。skill 文件原始总量为 160,224 bytes，zip 内压缩数据为 75,510 bytes。
- 冷缓存准备耗时 57.3 秒，builder 报告 `runtimeCache: miss` 并写入 `schemaVersion: 2`；随后 fixture cache hit 准备耗时 7.2 秒。另用同一个 schema 2 deployment cache 直接重建签名包，builder 报告 `runtimeCache: hit`、0 个再次裁剪项，且 skill 资产一致性检查通过。
- 使用正常 NextClaw home、端口 18888 与真实 `deepseek/deepseek-chat` 做前向验证。两条未明确说“可视化”的探索提示分别选择 Markdown 表格和线性文本图，原始事件显示只调用了 memory/read 工具，没有读取 `visualize-output`，因此不把它们误记为 skill 自动触发证据。
- 最终使用自然请求“帮我把这组数据可视化一下”创建会话 `visual-runtime-builtin-deepseek-final-20260717`。模型首个能力调用读取 `@nextclaw/core/dist/skills/visualize-output/SKILL.md`，随后用工具计算、写入并确认 7,795-byte HTML，最终输出 `nextclaw-inline` 文件声明；全程没有要求用户指定 HTML、布局、样式、尺寸或存储实现。产物位于 `NEXTCLAW_HOME/assets/visualizations/q2-revenue/result.html`，没有 `<title>`、`<h1>`、根边框、根阴影或不透明根背景。
- 前向抽样仍保留真实边界：另一条同类会话首轮虽然读取了 skill，却在重复查询 `NEXTCLAW_HOME` 后声明了尚不存在的文件，最小纠错轮才实际创建并确认文件；最终干净会话又把资产放在持久 visualizations 根下的语义目录，而不是推荐的 `<session-id>` 子目录。二者属于模型遵循概率性，不影响本次“内置 skill 随 runtime bundle 可用”的确定性验收，也不会被包装成已经消失的问题。

## 发布/部署方式

- 本次只完成源码、验证、changeset 和迭代记录，未执行 git commit、push、NPM publish、runtime update channel 发布、GitHub release 或服务重启。
- 后续统一发布时，`nextclaw` 需要 patch，并重新构建、发布 NPM runtime update channel；`@nextclaw/core` 当前发布 tarball 已包含正确 skill 文件，不需要为了这个修复额外升版。
- 不涉及数据库 migration、独立后端部署、Desktop installer 或 Desktop update manifest。

## 用户/产品视角的验收步骤

1. 从旧 NPM runtime 启动隔离 NextClaw，检查更新并下载、应用包含本修复的候选 runtime。
2. 等待服务自动重连，确认当前 runtime 版本切换到候选版本且 managed service PID 已变化。
3. 请求 `/api/ncp/sessions/<session-id>/skills`，确认 `visualize-output` 为 `available: true` 且 `source: builtin`，并确认其他内置 skill 同样存在。
4. 给 DeepSeek 一条自然的比较、时间线或状态展示请求，不提供 HTML、文件存储或具体视觉指令；确认 Agent 会读取 `visualize-output` 并在 Markdown、表格、Mermaid、图片或内联 HTML 中选择最小合适媒介。
5. 当 Agent 选择内联 HTML 时，确认会话资产进入 `NEXTCLAW_HOME/assets/visualizations/<session-id>/`，消息内预览无文件名、边框和内部工具栏，外部 hover 工具条与自适应高度合同继续生效。

## 可维护性总结汇总

- 实现继续由现有 `NpmRuntimeDeploymentCacheManager` 拥有部署裁剪、缓存和资产一致性，没有新增平行 manager、asset registry、manifest 或专用复制脚本。
- 保留规则是一个精确语义子树边界，而不是 `visualize-output` 单项白名单；新增 skill 会自动继承合同，不需要继续改打包代码。
- 通用裁剪仍负责 skill 子树外的无运行时价值文件，包体增量被实际压缩对照控制在 87,456 bytes；这同时满足“不随便加”和“不随便减”。
- 指纹复用现有 package artifact fingerprint 机制，并删除了对空目录的散列依赖，使比较口径与 NPM 真实文件资产一致；没有为首次部署和缓存恢复复制两套校验逻辑。
- 3 个运行链路脚本合计新增 47 行、删除 8 行，净增 39 行；没有新增测试文件。此次是用户安装态会直接感知的缺陷修复，使用 feature 口径，不适用非功能改动的生产语义净增不大于 0 门槛。
- `post-edit-maintainability-guard` 为 0 error、1 warning：`scripts/dev/verify-update.mjs` 当前 462 行，接近 500 行预算，本次增加 23 行应用后 skill API 断言。当前没有为消除 warning 新建窄 helper 或 manager；若该验证器继续增加其他候选能力断言，再沿“候选 runtime 应用后验收”职责拆出独立 owner。
- `post-edit-maintainability-review` 结论为通过：未发现新的 owner、目录、分支或抽象扩散。正向减债是删除空目录指纹依赖、复用现有文件指纹和更新验证主链路，并用一个完整 skill 子树合同替代逐项白名单。

## NPM 包发布记录

- `nextclaw@0.25.2`：需要 patch；修复影响 NPM runtime update bundle 的用户可见安装态，`.changeset/preserve-runtime-builtin-skills.md` 已记录，状态为 `待统一发布`。
- `@nextclaw/core@0.15.7`：不需要因本修复单独发布；现有 NPM tarball 已包含完整内置 skill 资产，问题位于下游 runtime bundle 裁剪。
- NPM runtime update channel：需要随下一个 `nextclaw` patch 重新构建并发布；本次未发布。
