# 当前目标

- 战役名称：`nextclaw-ui` 目录组织自治治理战役
- 本轮目标：沿着已经验证通过的 contract-aligned 路径，继续把 `components/config` 中适合归入既有 feature 的页面实现迁入 allowed roots
- 成功判定：每完成一个 legacy 页面实现的真实迁移，就通过最小验证、更新状态记录，并提交一个独立 commit

# 当前事实

- `packages/nextclaw-ui/src/components/config` 当前直接代码文件数为 `37`
- `packages/nextclaw-ui/src/components/chat` 当前直接代码文件数为 `35`
- `packages/nextclaw-ui/src/lib` 当前直接代码文件数为 `28`
- `packages/nextclaw-ui/src/api` 当前直接代码文件数为 `26`
- `packages/nextclaw-ui/src/components/ui` 当前直接代码文件数为 `22`
- `packages/nextclaw-ui/module-structure.config.json` 将该包声明为 `frontend-l3` 协议，allowed roots 只有 `app`、`features`、`shared`、`platforms`
- 当前 `rootPolicy=legacy-frozen`，不能继续在 `components`、`lib`、`api`、`hooks` 等 legacy roots 下新增新层级或新文件
- 首批尝试在 `components/config` 下新建 provider 子树，真实验证后被 `module-structure`、目录预算和非功能净增闸门阻断，代码尝试已回撤
- 当前仓库存在与本战役无关的未提交改动，本轮必须避免触碰这些路径

# 关键约束 / 不变量

- 必须遵守 `docs/VISION.md`
- 必须遵守 `AGENTS.md` 的 Rulebook / Project Rulebook 与 `docs/logs` 规则
- 必须遵守 `commands/commands.md` 中与治理相关的执行入口
- 当前任务属于非功能改动，默认以 `非测试代码净增 <= 0` 为硬门槛
- 仅在高置信时持续自治推进
- 低置信决策必须停下并记录阻塞原因
- 任何新目录层级都必须先满足 `frontend-l3` 的 allowed roots 约束

# 治理机制核对

- 本轮直接依赖的规则：`business-logic-must-use-class`、`class-over-function-sprawl`、`stateless-utility-first`、`ordinary-function-no-input-mutation`、`class-arrow-methods-by-default`、`react-effect-boundary-only`
- 本轮直接依赖的命令 / skill：`/validate`、`/maintainability-review`、`autonomous-maintainability-campaign`、`iteration-work-notes`、`post-edit-maintainability-guard`、`post-edit-maintainability-review`、`file-organization-governance`、`role-first-file-organization`、`collapsible-feature-root-architecture`
- 本轮是否属于非功能改动：是
- 本轮是否命中 hotspot / 目录预算 / 命名治理等专项场景：命中目录预算、命名治理和 module-structure 合同治理

# 候选问题批次

- [x] `components/config` 合同校准与失败路径回收
- [x] `security-config` 迁入 `features/system-status` 并保留 legacy 薄转发入口
- [ ] 继续从 `components/config` 里挑选下一个已是 kebab-case、能挂入既有 feature 的页面
- [ ] `components/chat` 顶层平铺目录收敛
- [ ] `lib` 混合关注点收敛
- [ ] `api` 契约/客户端/类型拆分

# 当前活跃批次

- 名称：`components/config` allowed-root 连续迁移
- 选中原因：`security-config` 已证明“真实实现迁入 feature、旧路径缩成薄转发”是可通过治理的正确路径
- 预计最小闭环：继续选一个语义稳定、命名已合规的小页面文件，复制同样模式拿到第二个独立 commit

# 已完成

- 新建本次战役的迭代留痕目录与 `work/` 状态文件
- 盘点 `nextclaw-ui` 目录热点，确认首批目标为 `components/config`
- 验证并确认 `nextclaw-ui` 受 `frontend-l3 + legacy-frozen` 合同约束
- 完整跑过一次失败路径并回撤代码尝试，避免把未通过治理检查的半成品留在工作区
- 完成 `components/config/security-config.tsx -> features/system-status/components/security-config.tsx` 的真实实现迁移
- 把 legacy 路径收窄为兼容导出，避免触碰 `app.tsx` 与 `src/app/` 的历史命名冲突
- 通过本批次最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/app.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `pnpm check:governance-backlog-ratchet`

# 已排除项

- 暂不触达已有未提交的内核相关改动路径
- 暂不把低置信的跨 feature 重组和产品语义调整混入本轮目录治理
- 排除继续在 `components/config`、`components/chat`、`lib`、`api` 等 legacy roots 下直接新增子树的做法

# 关键决策

- 当前战役新建独立迭代目录 `v0.16.85-nextclaw-ui-directory-governance-campaign`，因为这不是上一次 skill 创建迭代的同批次续改
- 第一批原定直拆 `components/config`，但经真实验证后确认与模块结构合同冲突，必须改成“先迁入 allowed roots，再做子树收敛”
- 在新的高置信批次形成前，不保留任何未通过治理闸门的代码结构尝试
- `security-config` 这一步不再修改 `app.tsx`，而是通过 legacy 薄转发过渡，避免触发 `src/app.tsx` 与 `src/app/` 的 file-directory collision 治理规则

# 下一步

- 继续扫描 `components/config` 里已是 kebab-case 的页面文件，优先挑选可挂入 `features/system-status`、`features/account` 或 `features/remote` 的候选项
- 只有当无法找到可挂入既有 feature 的小文件时，才重新评估是否需要新增 `shared` 或新的 feature root

# 停止原因 / 阻塞

- 当前首个高置信批次已经形成并通过验证，剩余阻塞不在本批次本身，而在后续候选项必须继续满足：allowed roots、目录预算、命名治理、非功能净增 `<= 0`
- `components/config` 的历史目录预算债务依旧存在，意味着后续批次必须优先搬实现在旧根目录的页面，而不是新增任何新平铺文件

# 交接提醒

- 若上下文压缩，下一轮先重读本文件和 `state.json`
- 下一轮不要再从 legacy `components/config` 里直接长新目录，而要延续“真实实现迁入 feature + legacy 薄转发”的模式
