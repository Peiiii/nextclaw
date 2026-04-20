# 当前目标

完成 `workers/nextclaw-provider-gateway-api` 一轮非功能可维护性治理，优先解决目录平铺、命名漂移、context destructuring lint 债务，以及由治理动作触发的目录预算问题。

# 最终事实

- 迭代版本：`v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign`
- `src/` 根层直接源码文件数：`25 -> 5`
- `src/services/` 根层直接文件数：回落到 `12`
- `module-structure.config.json` 已放到包根；在续改里进一步确认 `legacy + protocol-package-l1` 属于伪协议配置，现已收回为 `legacy-package-shell`
- `module-structure` 检测系统已补齐：legacy contract 不再允许复用 `protocol-*`，坏配置会产出 `invalid-module-structure-config`，协议结构检查分支也已顺手压缩
- `pnpm -C workers/nextclaw-provider-gateway-api lint` 已通过
- `pnpm -C workers/nextclaw-provider-gateway-api tsc` 已通过
- `pnpm -C workers/nextclaw-provider-gateway-api test:quota` 已通过，`10/10`
- `pnpm lint:new-code:governance -- $(git diff --name-only --diff-filter=AMDR -- workers/nextclaw-provider-gateway-api | sort | tr '\n' ' ')` 已通过
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths $(git diff --name-only --diff-filter=AMDR -- workers/nextclaw-provider-gateway-api | sort)` 已通过，`0 error / 0 warning`
- `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs` 已通过，`31/31`
- `pnpm lint:new-code:governance -- scripts/governance/module-structure/...` 已通过
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths scripts/governance/module-structure/...` 已通过，`0 error / 1 warning`，非测试代码净变化 `-15`
- `pnpm check:governance-backlog-ratchet` 已通过

# 关键动作

- 把 `auth-browser*` 收回 [`src/auth-browser/`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/auth-browser)
- 把 `remote-quota*` 收回 [`src/remote-quota/`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/remote-quota)
- 把 `remote-relay*` 收回 [`src/remote-relay/`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/remote-relay)
- 把 controller / repository / service / utils / routes 相关旧命名全部改成治理允许的后缀
- 清空全部 `params` 顶层解构 lint warning
- 为了压回 `src/services/` 预算，把平台认证相关逻辑继续收进 [`src/services/platform/`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/services/platform)

# 关键判断

- 这轮根因不是单个 bug，而是长期平铺 + 命名漂移 + 缺少统一 contract 约束叠加造成的治理脆弱性。
- 不能只修 `module config` 位置或只清 `33` 条 lint warning；如果不顺手把命名和目录预算一起收口，后续每次触碰这个 worker 都会继续被整片历史债务阻断。
- `services/README.md` 只能记录边界，不能替代真实拆分；因此在服务目录超预算后继续下沉到了 `services/platform/`。

# 剩余边界

- 当前 worker 仍使用 `legacy-package-shell`，而不是正式 `protocol` 模块；这是刻意保留的边界，不再伪装成 `package-l1`。
- `module-structure` 检测系统已补齐一致性校验，后续不会再把 legacy 伪装配置误当成“已经对齐 package-l1”。
- 当前唯一剩余提醒是 [`scripts/governance/module-structure/module-structure-protocol-checks.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-protocol-checks.mjs) 接近文件预算，下一轮若继续治理可考虑拆成更细的结构/导入边界子模块。
- 后续若要真的升级为 `package-l1` 协议，需要先统一 alias / build contract，再把剩余 legacy root 也收敛到协议允许结构。

# 本轮结论

本轮可维护性治理完成，可作为下一轮更深层热点文件拆分（例如 `types/platform.ts`）之前的结构基线。
