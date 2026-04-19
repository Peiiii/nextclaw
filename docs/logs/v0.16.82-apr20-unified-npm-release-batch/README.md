# v0.16.82-apr20-unified-npm-release-batch

## 迭代完成说明（改了什么）

本次迭代把仓库里一批已经形成、但尚未完整同步到 npm registry 的公开包统一发布到 npm，重新对齐“仓库当前能力”和“用户实际可安装版本”。

发布前先用仓库既有 release 健康检查确认存在 unpublished drift：`pnpm release:report:health` 明确提示仓库在当前 batch 之外仍有未发布漂移；随后用 `pnpm release:auto:changeset --check` 确认这批漂移涉及 37 个公开包。根因不是“忘了跑一次 publish”这么简单，而是：

- 多个公开包此前已经在仓库内完成版本推进或已累计了超出最近已发布 tag 的有效实现改动；
- 当前 `.changeset` 目录没有待处理批次，直接执行 `release:publish` 只会检查当前 batch 中的包，无法覆盖这 37 个 drift 包；
- 如果继续保持现状，仓库里的版本号、tag、changelog、registry 状态会持续漂移，用户通过 npm 安装到的版本不能完整代表仓库当前已交付能力。

本次修复命中根因的方式是：不走手工逐包发布，也不直接裸跑 publish，而是按仓库既有闭环先补齐自动 release batch，再做 version / publish / verify，使待发布集合、版本号、changelog、registry 和 git tag 一次性重新对齐。

本次实际执行的发布主链路：

1. `pnpm release:auto:prepare`
2. `pnpm release:version`
3. `pnpm release:publish`

其中 `release:auto:prepare` 自动生成了 `.changeset/auto-release-batch-20260419163359309.md`，把 37 个存在 unpublished drift 的公开包收敛为同一个 release batch；`release:version` 完成版本号、内部依赖和 changelog 同步；`release:publish` 完成 npm 发布、发布后版本核验和 git tag 创建。

本次成功发布的公开包如下：

- `nextclaw@0.18.2`
- `@nextclaw/ui@0.12.11`
- `@nextclaw/server@0.12.10`
- `@nextclaw/core@0.12.10`
- `@nextclaw/runtime@0.2.42`
- `@nextclaw/remote@0.1.87`
- `@nextclaw/mcp@0.1.75`
- `@nextclaw/openclaw-compat@1.0.10`
- `@nextclaw/agent-chat-ui@0.3.8`
- `@nextclaw/channel-runtime@0.4.27`
- `@nextclaw/channel-plugin-dingtalk@0.2.41`
- `@nextclaw/channel-plugin-discord@0.2.41`
- `@nextclaw/channel-plugin-email@0.2.41`
- `@nextclaw/channel-plugin-feishu@0.2.27`
- `@nextclaw/channel-plugin-mochat@0.2.41`
- `@nextclaw/channel-plugin-qq@0.2.41`
- `@nextclaw/channel-plugin-slack@0.2.41`
- `@nextclaw/channel-plugin-telegram@0.2.41`
- `@nextclaw/channel-plugin-wecom@0.2.41`
- `@nextclaw/channel-plugin-weixin@0.1.35`
- `@nextclaw/channel-plugin-whatsapp@0.2.41`
- `@nextclaw/ncp@0.5.4`
- `@nextclaw/ncp-agent-runtime@0.3.14`
- `@nextclaw/ncp-http-agent-client@0.3.16`
- `@nextclaw/ncp-http-agent-server@0.3.16`
- `@nextclaw/ncp-mcp@0.1.77`
- `@nextclaw/ncp-react@0.4.24`
- `@nextclaw/ncp-react-ui@0.2.16`
- `@nextclaw/ncp-toolkit@0.5.9`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.1.3`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.1.3`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.1.3`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.4`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.24`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.21`
- `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.54`
- `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.54`

本次发布同时联动更新了若干私有工作区包的版本元数据与 changelog，用于保持工作区依赖关系一致，但这些私有包不会发布到 npm：

- `@nextclaw/desktop@0.0.146`
- `@nextclaw/ncp-demo-backend@0.0.31`
- `@nextclaw/ncp-demo-frontend@0.0.33`

同批次收尾补丁中，又发现并定位了一个 `nextclaw@0.18.2` 的发布后回归：用户执行 `nextclaw update && nextclaw restart` 时，会报 `UI frontend bundle not found`，即使全局安装目录里实际已经存在 `ui-dist/`。根因不是 tarball 漏带静态资源，而是 `resolveUiStaticDir()` 仍然依赖当前模块文件位置的相对层级去反推包根；在发布后的 `dist/cli/app/index.js` 产物里，模块层级和源码目录不同，导致它把包根错误算成了全局 `node_modules` 目录，而不是 `nextclaw` 自身根目录。

本次补丁命中根因的方式是改为先解析 `nextclaw/package.json` 所在的真实包根绝对路径，再从该根目录拼接 `ui-dist`；同时补了一条针对“发布后 dist 入口布局”的回归测试，并顺手删掉了这片 util 中几层无意义薄包装，保证这次纯 bugfix 的非测试代码没有净增长。补丁随后通过单包 patch 方式重新发布为 `nextclaw@0.18.3`，并在真实全局安装链路上完成 `update -> restart` 复验。

## 测试 / 验证 / 验收方式

- 漂移与 batch 判定：
  - `pnpm release:report:health`
  - `pnpm release:auto:changeset --check`
  - 结果：确认仓库存在当前 batch 之外的 unpublished drift，自动 batch 检测识别出 37 个待处理公开包。
- npm 身份校验：
  - `npm whoami`
  - 结果：`peiiii`
- 自动生成 release batch：
  - `pnpm release:auto:prepare`
  - 结果：成功生成 `.changeset/auto-release-batch-20260419163359309.md`
- 版本推进：
  - `pnpm release:version`
  - 结果：成功更新目标包版本、内部依赖和 changelog。
- 正式发布与版本可见性核验：
  - `pnpm release:publish`
  - 结果：37 个公开包发布成功；`[release:verify:published] published 37/37 package versions.`
- 发布后健康检查：
  - `pnpm release:report:health`
  - 结果：`Repository release health is clean.`
- 关键线上版本核验：
  - `npm view nextclaw version`
  - `npm view @nextclaw/ui version`
  - `npm view @nextclaw/core version`
  - `npm view @nextclaw/server version`
  - 结果：分别返回 `0.18.2`、`0.12.11`、`0.12.10`、`0.12.10`
- CLI 安装冒烟：
  - `HOME="$(mktemp -d /tmp/nextclaw-release-npx.XXXXXX)/home" npm exec nextclaw@0.18.2 -- --help`
  - `NEXTCLAW_HOME="$(mktemp -d /tmp/nextclaw-release-pnpm.XXXXXX)/home" pnpm --config.store-dir="$(mktemp -d /tmp/nextclaw-pnpm-store.XXXXXX)" dlx nextclaw@0.18.2 --help`
  - 结果：两条命令都成功输出 `nextclaw` CLI 帮助；`pnpm dlx` 过程中仅出现第三方依赖 deprecation warning，没有阻断安装或运行。
- 发布后回归修复验证：
  - `pnpm -C packages/nextclaw test -- run src/cli/shared/utils/cli.utils.ui-static-dir.test.ts src/cli/shared/utils/cli.utils.which.test.ts`
  - `pnpm -C packages/nextclaw tsc`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw/src/cli/shared/utils/cli.utils.ts packages/nextclaw/src/cli/shared/utils/cli.utils.ui-static-dir.test.ts packages/nextclaw/src/cli/shared/services/workspace/workspace-manager.service.ts`
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`
  - `pnpm -C packages/nextclaw build`
  - `HOME="$(mktemp -d /tmp/nextclaw-rootfix-restart.XXXXXX)" node packages/nextclaw/dist/cli/app/index.js start --ui-port 55741 --start-timeout 15000`
  - `HOME="<same-temp-home>" node packages/nextclaw/dist/cli/app/index.js restart --ui-port 55741 --start-timeout 15000`
  - `HOME="<same-temp-home>" node packages/nextclaw/dist/cli/app/index.js stop`
  - `pnpm release:version`
  - `pnpm release:publish`
  - `npm view nextclaw version`
  - `nextclaw update && nextclaw restart`
  - `nextclaw --version`
  - `nextclaw status --json`
  - 结果：定向单测 `9/9` 通过，`tsc` 通过，非功能改动 maintainability guard 通过且 `非测试代码增减报告` 为净减，治理检查通过；构建后的 CLI 在隔离 HOME 下可成功执行 `start -> restart -> stop`，不再出现 `UI frontend bundle not found`。随后 `nextclaw@0.18.3` 发布成功，`npm view nextclaw version` 返回 `0.18.3`；在当前机器真实执行 `nextclaw update && nextclaw restart` 后，CLI 已从 `0.18.2` 升到 `0.18.3` 并成功重启，`nextclaw status --json` 显示服务健康、UI 地址可用。

## 发布 / 部署方式

- 本次属于 npm 生态统一发版，不涉及数据库 migration，也不涉及 Cloudflare Pages、worker 或桌面安装包的独立部署。
- 推荐执行顺序：
  1. `pnpm release:report:health`
  2. `pnpm release:auto:changeset --check`
  3. `pnpm release:auto:prepare`
  4. `pnpm release:version`
  5. `pnpm release:publish`
  6. `pnpm release:report:health`
  7. `npm view <pkg> version`
  8. 在非仓库临时目录运行 `npm exec nextclaw@<version> -- --help` 或隔离 store 的 `pnpm dlx`
- 当前状态：
  - npm 发布：已完成
  - registry 版本核验：已完成
  - git tag：已完成
  - release health：本次热修发布已完成，但当前重新执行 `pnpm release:report:health` 仍会提示一批历史包存在 tag 与 HEAD 的版本漂移；`nextclaw@0.18.3` 本身的发布和安装验证不受影响
  - CLI 安装冒烟：已完成
  - `nextclaw@0.18.2` 发布后回归 hotfix：已补发 `nextclaw@0.18.3`，并完成真实全局更新重启验证

## 用户 / 产品视角的验收步骤

1. 执行 `npm view nextclaw version`，确认返回 `0.18.3`。
2. 执行 `npm view @nextclaw/ui version`、`npm view @nextclaw/core version`、`npm view @nextclaw/server version`，确认分别为 `0.12.11`、`0.12.10`、`0.12.10`。
3. 在任意非仓库临时目录执行 `npm exec nextclaw@0.18.3 -- --help`。
4. 确认 CLI 能成功安装并输出完整帮助与命令列表。
5. 如果业务侧依赖 channel runtime、NCP 或 NextClaw runtime 相关公开包，安装本次新版本并确认依赖解析无缺包、无版本冲突。
6. 若本地已安装 `nextclaw@0.18.2` 或更早版本，执行 `nextclaw update && nextclaw restart`，确认可以升级到 `0.18.3` 且后台服务成功重启。
7. 执行 `nextclaw --version` 与 `nextclaw status --json`，确认版本为 `0.18.3`，且健康状态为正常。
8. 若要进一步验证本次发布后回归的修复，在隔离 HOME 下执行构建后的 `start -> restart -> stop` 链路，确认后台服务可正常重启，不再出现 `UI frontend bundle not found`。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次不是增加孤立功能，而是让 NextClaw 作为统一入口产品的“仓库状态、公开包版本、用户可安装版本”重新对齐，减少交付链路上的漂移与不确定性。
  - 本次在可维护性上的推进是继续复用既有 release 自动化，而不是新增一套手工发布清单、旁路脚本或 incident-specific workaround。
- 本次是否已尽最大努力优化可维护性：
  - 是。统一 release 部分继续走既有 `release:auto:prepare -> release:version -> release:publish` 主链路；发布后回归补丁也没有加 incident-specific 相对路径猜测，而是收敛为“先找绝对包根，再找 `ui-dist`”。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。release 主体通过自动 batch 一次性收口；回归补丁则顺手删除了 util 里的薄包装和重复路径判断，没有为修复去叠加新的脆弱分支。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - release 主体新增主要是 changelog、版本号、tag 与日志留痕；发布后回归补丁在排除测试后为净减。`packages/nextclaw/ui-dist` 的变更属于随 CLI 打包流程同步生成的构建产物更新，而不是额外新增一套实现。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。发布逻辑仍由既有 release 脚本负责；`nextclaw` 回归补丁也没有新增一层路径适配器，而是把“包根定位”收敛到现有 util 边界内，避免继续把复杂度往调用方扩散。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 是。新增留痕仅位于 `docs/logs/v0.16.82-apr20-unified-npm-release-batch/README.md`；其余改动都在既有包目录下的 `package.json`、`CHANGELOG.md` 与必要构建产物范围内。
- 若本次涉及代码可维护性评估，是否基于独立于实现阶段的 `post-edit-maintainability-review` 填写：
  - 是。对于发布后回归补丁，已在实现完成后独立复核：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：70 行
    - 删除：54 行
    - 净增：+16 行
  - 非测试代码增减报告：
    - 新增：51 行
    - 删除：54 行
    - 净增：-3 行
  - 可维护性总结：no maintainability findings。修复继续沿着“先找绝对包根，再定位资源目录”的更稳边界推进，没有保留相对层级 fallback；同时顺手删掉了 util 中的薄包装与重复判断，让这次纯 bugfix 在排除测试后实现净减。

## NPM 包发布记录

- 本次是否需要发包：
  - 需要。原因是仓库存在 37 个公开包的 unpublished drift，继续不发会让仓库版本、tag 和用户可安装版本长期漂移。
- 本次已发布的公开包：
  - `nextclaw@0.18.2`：已发布
  - `@nextclaw/ui@0.12.11`：已发布
  - `@nextclaw/server@0.12.10`：已发布
  - `@nextclaw/core@0.12.10`：已发布
  - `@nextclaw/runtime@0.2.42`：已发布
  - `@nextclaw/remote@0.1.87`：已发布
  - `@nextclaw/mcp@0.1.75`：已发布
  - `@nextclaw/openclaw-compat@1.0.10`：已发布
  - `@nextclaw/agent-chat-ui@0.3.8`：已发布
  - `@nextclaw/channel-runtime@0.4.27`：已发布
  - `@nextclaw/channel-plugin-dingtalk@0.2.41`：已发布
  - `@nextclaw/channel-plugin-discord@0.2.41`：已发布
  - `@nextclaw/channel-plugin-email@0.2.41`：已发布
  - `@nextclaw/channel-plugin-feishu@0.2.27`：已发布
  - `@nextclaw/channel-plugin-mochat@0.2.41`：已发布
  - `@nextclaw/channel-plugin-qq@0.2.41`：已发布
  - `@nextclaw/channel-plugin-slack@0.2.41`：已发布
  - `@nextclaw/channel-plugin-telegram@0.2.41`：已发布
  - `@nextclaw/channel-plugin-wecom@0.2.41`：已发布
  - `@nextclaw/channel-plugin-weixin@0.1.35`：已发布
  - `@nextclaw/channel-plugin-whatsapp@0.2.41`：已发布
  - `@nextclaw/ncp@0.5.4`：已发布
  - `@nextclaw/ncp-agent-runtime@0.3.14`：已发布
  - `@nextclaw/ncp-http-agent-client@0.3.16`：已发布
  - `@nextclaw/ncp-http-agent-server@0.3.16`：已发布
  - `@nextclaw/ncp-mcp@0.1.77`：已发布
  - `@nextclaw/ncp-react@0.4.24`：已发布
  - `@nextclaw/ncp-react-ui@0.2.16`：已发布
  - `@nextclaw/ncp-toolkit@0.5.9`：已发布
  - `@nextclaw/nextclaw-hermes-acp-bridge@0.1.3`：已发布
  - `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.1.3`：已发布
  - `@nextclaw/nextclaw-ncp-runtime-http-client@0.1.3`：已发布
  - `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.4`：已发布
  - `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.24`：已发布
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.21`：已发布
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.54`：已发布
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.54`：已发布
- 本次检查到但无需再次发布的公开包：
  - `@nextclaw/feishu-core@0.2.6`：无需发布，原因是该版本已在 npm 上存在
  - `@nextclaw/agent-chat@0.1.10`：无需发布，原因是该版本已在 npm 上存在
  - `@nextclaw/app-runtime@0.4.1`：无需发布，原因是该版本已在 npm 上存在
  - `@nextclaw/app-sdk@0.1.0`：无需发布，原因是该版本已在 npm 上存在
- 本次联动更新但不发布到 npm 的私有工作区包：
  - `@nextclaw/desktop@0.0.146`：未发布，原因是私有包
  - `@nextclaw/ncp-demo-backend@0.0.31`：未发布，原因是私有包
  - `@nextclaw/ncp-demo-frontend@0.0.33`：未发布，原因是私有包
- 同批次补发的公开包：
  - `nextclaw@0.18.3`：已发布。原因是 `0.18.2` 存在发布后 `restart` 回归，需要单包 patch 补发。
- 待统一发布 / 外部阻塞：
  - 无。当前已知与本批次相关的公开包发布和补发均已完成，未发现额外待补发阻塞。
