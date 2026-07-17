# v0.23.14 不受支持的 UI 注入口与 Skin Studio

## 迭代完成说明

- NextClaw UI 在 React 应用启动前请求 `/api/ui-inject.js`；server 从活动 `$NEXTCLAW_HOME` 读取 `ui-inject.js`，不存在时返回空脚本，存在时返回最新内容，响应固定为 `Cache-Control: no-store`。
- 产品主干只保留一个不受支持的同源 JavaScript 逃生口，没有增加皮肤 CLI、设置页、manifest、数据库、浏览器扩展或兼容层。写入、切换或删除脚本后刷新即可生效，不需要重启 NextClaw。
- 原单皮肤 Skill `@nextclaw/abyssal-compass-theme` 已由通用 `@nextclaw/nextclaw-skin-studio` 替代并从公开 Marketplace 下架。Skin Studio 内置六款皮肤，并提供 `list/status/apply/custom/remove`、本地图片嵌入、未知 owner 冲突保护和旧 Abyssal marker 迁移。
- 新 Skill 已发布到 Marketplace；公开详情为 `install.kind=marketplace`，旧 Skill 详情为 `404`、搜索为零结果。新 Skill 位于“最近发布”首位。
- 设计文档已更新为“一处官方注入口 + 一个通用 Skill”的最终方案：`docs/designs/2026-07-16-unsupported-ui-injection-hook.design.md`。

### Marketplace 列表异常的根因与修复

- 用户可见现象：全部 Skill 首屏显示 `31 / 36`，滚动到底仍停在 31；继续加载末页时出现 `unsupported skill install kind from marketplace api: builtin`，新发布的 Skill 也没有稳定出现在“最近发布”。
- 根因通过端到端证据确认：官方目录曾残留 5 条历史 `builtin` 记录；国内镜像又以未经规范化的原始 query string 作为永久缓存键，导致同一请求因参数顺序不同命中多份、永不过期且总数不同的快照。UI 的“最近发布”同时错误地从相关性首屏做本地排序，而 `31 / 36` 混用了“已加载数”和“服务端总数”。
- 官方 Marketplace 已清理历史公开 `builtin` 和旧单皮肤 Skill；Worker 公共查询增加 `install_kind = 'marketplace'` 约束，防止非商品记录再次进入公共目录。
- 国内镜像对 query 参数排序后再生成缓存键，默认 TTL 为 10 分钟，过期优先刷新，仅在源站失败时 `stale-if-error`；NextClaw server 额外识别超过 20 分钟的国内快照并回退官方源。
- NextClaw server 保持历史 `builtin` 读取兼容，单条旧记录不再让整个分页失败；未知安装类型仍明确报错。
- UI 的“最近发布”改为独立 `sort=updated&pageSize=6` 查询；全部目录只显示服务端总数，窗口聚焦、重连、重新挂载和无搜索状态下的 30 秒轮询都会刷新目录。
- 这组修复处理了事实源、缓存新鲜度、公共数据合同和 UI 查询语义四层根因，而不是只吞掉末页异常。

## 测试/验证/验收方式

- 镜像缓存单测：`python3 -m unittest scripts/deploy/nextclaw-net-marketplace-mirror/marketplace-mirror-server-test.py`，5/5 通过；覆盖 query 参数顺序归一化、fresh hit、stale refresh、stale-if-error 和首次 miss 失败。
- Marketplace server 定向测试：`pnpm -C packages/nextclaw-server exec vitest run src/app/router.marketplace-content.test.ts`，7/7 通过；覆盖历史 `builtin` 兼容、国内源优先、陈旧镜像回退和未知安装类型拒绝。
- Server 全量测试：首次在受限沙箱中因 127.0.0.1 监听被系统拒绝而出现 `EPERM`；按真实需求在允许本机端口的环境复跑后，29/29 个测试文件通过，143 个测试通过、2 个跳过。
- Marketplace UI 定向测试：`pnpm -C packages/nextclaw-ui exec vitest run src/features/marketplace`，7 个测试文件、26/26 通过；覆盖独立最近发布查询、刷新策略、总数表达、分页和页面行为。
- UI 全量测试另有 9 个失败，全部位于当前工作区其它聊天改动触达的 3 个测试文件：4 个 `session-conversation-input.streaming` 和 4 个 `chat-conversation-welcome` 因缺少 `QueryClientProvider`，1 个 `chat-session-workspace-panel` 因查询键预期未同步。它们不经过 Marketplace 代码，未在本批次擅自修改；本批次 Marketplace 定向套件仍为 26/26。
- Skin Studio 测试：`node --test tests/skills/nextclaw-skin-studio.test.mjs`，5/5 通过；覆盖六款目录、应用、定制、未知 owner 保护和旧 Skill 迁移/移除。
- `node --check skills/nextclaw-skin-studio/scripts/skin.mjs` 与 `node --check skills/nextclaw-skin-studio/assets/renderer.js`：通过。
- `pnpm -C packages/nextclaw-server tsc`、`pnpm -C packages/nextclaw-ui tsc`、`pnpm -C workers/marketplace-api tsc`：通过。
- `pnpm -C packages/nextclaw-server lint`、`pnpm -C packages/nextclaw-ui lint`、`pnpm -C workers/marketplace-api lint`：通过；server 8 条、UI 1 条均为既有 warning，0 error；Worker 0 warning、0 error。
- `pnpm -C packages/nextclaw-server build`、`pnpm -C packages/nextclaw-ui build`、`pnpm -C workers/marketplace-api build`：通过；构建输出只有既有依赖和 bundle size warning。
- Marketplace Skill validator：`python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/nextclaw-skin-studio`，0 error、0 warning。
- 从正式 Marketplace 全新安装 `@nextclaw/nextclaw-skin-studio` 到仓库外临时目录，排除安装器生成的 `.nextclaw-install.json` 后与发布源目录 diff 为零；仅使用回装副本依次完成六款预设的应用、最终状态和恢复默认矩阵。
- 在隔离源码实例真实显示 Violet Orbit 与 Noir Gold，切换只需刷新；执行 remove 后 marker 消失、页面恢复默认、无横向溢出。
- 最终 Marketplace 浏览器终态验收使用隔离源码实例，不只验证 API/首屏：滚动到 `atBottom=true`，`scrollTop=1945`、`scrollHeight=2526`、`clientHeight=582`；总数 32、唯一卡片 32、首项为 `@nextclaw/nextclaw-skin-studio`、末项为 `@nextclaw/bird`，无旧 Skill、无 `builtin`、无错误、无残留 loading。
- 公网镜像修复文件已通过远程语法与 SHA-256 校验并安全暂存；当前服务保持 `active`，尚未替换或重启。
- 官方公共 API 终态复核：新 Skill 详情 200、双语 summary 和 `install.kind=marketplace` 正确；旧 Skill 详情 404；最近更新总数 32 且新 Skill 排第一；全部目录一次取回 32 条且 `builtin` 为 0。

## 发布/部署方式

- Marketplace Skill `@nextclaw/nextclaw-skin-studio` 已发布；旧 `@nextclaw/abyssal-compass-theme` 已从公开目录下架。
- 官方 Marketplace 当前公开目录为 32 条，新 Skill 位于最近发布首位，旧 Skill 详情为 404。
- Worker 查询约束的源码、类型、lint 和 build 已通过；当前环境没有 `CLOUDFLARE_API_TOKEN`，尚未部署 Worker。现有公开数据已通过历史记录清理恢复正确，长期防回归仍需后续 Worker 部署。
- 国内镜像修复已暂存至 ECS，替换活动文件和服务短重启需要用户知情许可；在许可前没有改动线上运行服务。
- 本次没有执行 NextClaw NPM 发布或 GitHub release。后续统一发布时由 changeset 驱动 `@nextclaw/server`、`@nextclaw/ui` 与 `nextclaw` patch 版本。
- 不涉及数据库 migration。

## 用户/产品视角的验收步骤

1. 在 Skill Marketplace 的“最近发布”看到 `NextClaw Skin Studio`，或搜索 `skin` / `皮肤` / `appearance`。
2. 安装 `@nextclaw/nextclaw-skin-studio`；安装本身不修改界面。
3. 对 Agent 说“有哪些 NextClaw 皮肤”，确认返回六款内置皮肤。
4. 说“应用 Violet Orbit”，刷新桌面端或浏览器页面，确认皮肤生效；同一实例连接的浏览器无需扩展。
5. 说“基于 Glass Tide，把主色改成青色”或提供本地 PNG/JPEG/WebP，刷新后确认自定义皮肤生效。
6. 说“当前是什么皮肤”查看状态；说“恢复默认界面”后刷新，确认默认 UI 恢复。
7. 在“全部 Skill”持续滚动到底：总数应为 32，终态应加载 32 张唯一卡片，不出现 `builtin` 错误或持续 loading。
8. 使用者必须知晓 `ui-inject.js` 拥有页面同源权限，NextClaw 不保证安全性、DOM 稳定性、可靠性或跨版本兼容。

## 可维护性总结汇总

- 产品主干仍只有一个 server 读取入口和一个 UI 启动加载点；没有引入皮肤 owner、schema、资源系统或第二条状态链路。
- Skin Studio 的预设收敛为数据，渲染收敛到单一 `renderer.js`，所有写操作收敛到单一 `skin.mjs`；新增皮肤不需要复制 Skill、脚本或 Marketplace 条目。
- Marketplace 修复复用现有查询和国内/官方回退 owner，没有增加平行 cache service 或额外 UI store；删除了“从相关性首屏伪造最近发布”的本地排序路径。
- `post-edit-maintainability-guard` 对 18 个本批次实现/测试文件的统计为：总新增 955 行、删除 84 行、净增 871 行；排除测试后新增 670 行、删除 83 行、净增 587 行。本次包含明确新增用户能力，增长主要位于可独立删除的 Skin Studio 数据、渲染器和脚本，不进入产品主干皮肤 owner。
- Guard 为 0 error、4 warning：`packages/nextclaw-server/src/app` 仍是 17 个直接文件且已有豁免、数量未增长；Marketplace 路由测试从 506 行增至 658 行但仍低于测试预算 900；`marketplace-catalog.utils.ts` 为 347/400；镜像脚本为 400/500。后两者是后续拆分观察点，本次没有新增抽象或平行链路来掩盖文件增长。
- 新代码治理、治理 backlog ratchet 和 generated-clean 均通过。治理检查曾发现新 Python 测试文件不是 kebab-case，已改为 `marketplace-mirror-server-test.py` 后复跑通过。
- 可维护性复核结论：通过；本次顺手减债：是。正向动作包括删除按“本机已知 Skill”过滤上游分页的旧辅助路径、删除最近发布的本地伪排序、复用现有 Marketplace fetch/fallback owner，并把所有皮肤状态变更收敛到一个脚本。no maintainability findings；保留上述 4 个非阻塞 warning 作为明确观察点。

## NPM 包发布记录

- `@nextclaw/server`：需要 patch，待统一发布；包含 UI 注入口、Marketplace 历史类型兼容和陈旧国内镜像回退。
- `@nextclaw/ui`：需要 patch，待统一发布；包含 UI 注入口加载、最近发布查询、目录刷新和总数表达修复。
- `nextclaw`：需要 patch，待统一发布；聚合上述产品能力。
- `@nextclaw/marketplace-api-worker`：非 NPM 发布包；源码防回归改动待凭据可用时部署。
- 本次未执行 NPM 发布。
