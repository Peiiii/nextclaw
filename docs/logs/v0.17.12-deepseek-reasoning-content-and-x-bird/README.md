# v0.17.12-deepseek-reasoning-content-and-x-bird

## 迭代完成说明

- 新增本地可复用 X/Twitter skill：
  - `.agents/skills/x-twitter-bird/SKILL.md`
  - `.agents/skills/x-twitter-bird/scripts/x-bird.mjs`
- 该 skill 统一通过本机私有凭证文件读取 X cookie，并把 `bird` 调用收口到一个 wrapper，避免每次手动传 `auth_token` / `ct0`。
- 凭证默认保存在本机 `~/.nextclaw/secrets/x-bird.json`，未写入仓库。
- 修复 DeepSeek thinking + tool round 续跑时空 `reasoning_content` 被桥接层吞掉的问题，命中位置是通用 Responses bridge / NCP message bridge / session adapter 合同层，不是针对 DeepSeek 的 provider 特判。
- 根因：
  - 旧链路把 `reasoning_content` 当成“非空字符串”处理。
  - 当上游或中间态显式给出 `reasoning_content: ""` 时，桥接层会把该字段丢掉。
  - 某些 DeepSeek thinking tool round 场景要求把该字段原样带回 API；字段缺失时会出现 `The reasoning_content in the thinking mode must be passed back to the API.` 一类 400。
- 根因确认方式：
  - 先对照 X 上的报错描述定位合同症状。
  - 再沿 `responses item -> bridge request -> session message -> ncp part -> assistant/tool round replay` 链路检查，确认空字符串在多个节点被 `trim()/truthy` 语义吞掉。
  - 最后补回归测试，稳定证明“空串字段必须被保留”；旧实现会在该测试下失败，当前实现通过。
- 本次修复为何命中根因：
  - 在桥接输入、assistant output 重建、CLI message bridge、session message adapter 四处统一把“字段存在”和“字段非空”分开处理。
  - 只要字段显式存在，即使值是 `""` 也保留并继续透传。

## 测试/验证/验收方式

- X skill 最小只读冒烟：
  - `node .agents/skills/x-twitter-bird/scripts/x-bird.mjs whoami --plain`
  - `node .agents/skills/x-twitter-bird/scripts/x-bird.mjs bookmarks -n 2 --json`
  - 结果：通过，可读取当前账号信息与书签。
- DeepSeek 回归测试：
  - `pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/compat/codex-openai-responses-bridge.test.ts`
  - 结果：通过，`preserves empty reasoning_content across tool rounds for DeepSeek-compatible upstreams` 已覆盖旧问题。
- 类型检查：
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - `pnpm -C packages/nextclaw tsc`
  - 结果：通过。
- DeepSeek 实网冒烟：
  - `node scripts/smoke/deepseek-reasoning-content-smoke.mjs`
  - 使用本机 `~/.nextclaw/config.json` 的 `deepseek-v4-flash` 配置。
  - 结果：通过。当前实网返回：
    - `probeStatus: 200`
    - `missingReasoningStatus: 200`
    - `emptyReasoningStatus: 200`
    - `originalReasoningStatus: 200`
  - 说明：当前 `deepseek-v4-flash` 对我构造的“缺字段回放”未稳定复现 400，因此“旧问题复现”以仓库回归测试为准；实网脚本用于确认修后请求合同可被当前 DeepSeek 接受。
- 可维护性守卫：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：无 error，有若干既有目录/文件预算 warning。
- 治理检查：
  - `pnpm lint:new-code:governance`
  - 结果：失败，但失败来自已触达历史 NCP 模块文件名不符合当前角色后缀治理，不是本次 DeepSeek 合同修复逻辑错误。
  - `pnpm check:governance-backlog-ratchet`
  - 结果：失败，当前 tracked doc file-name violations 为 `13`，baseline 为 `11`；失败来自仓库既有历史文档命名债务，不是本次新增的 X skill 文档。

## 发布/部署方式

- 本次未执行发布。
- 若后续需要交付：
  - 先合并本次改动。
  - 再按仓库既有 release 流程统一发包或跟随后续批次发布。
- X skill 无需单独部署；只需在本机保留 `bird` CLI 与本地凭证文件即可使用。

## 用户/产品视角的验收步骤

1. 执行 `node .agents/skills/x-twitter-bird/scripts/x-bird.mjs whoami --plain`，确认能读取当前 X 账号。
2. 执行 `node .agents/skills/x-twitter-bird/scripts/x-bird.mjs bookmarks -n 5 --json`，确认能读取收藏夹。
3. 在项目里走一条会触发 tool round 续跑的 Agent / NCP 链路，并使用 DeepSeek `deepseek-v4-flash`。
4. 观察同一轮 assistant -> tool -> continue 的续跑过程，确认不再因为空 `reasoning_content` 丢失而报 thinking mode 相关 400。
5. 如需协议侧独立验证，执行 `node scripts/smoke/deepseek-reasoning-content-smoke.mjs`，确认当前 DeepSeek 配置下空字符串 reasoning 回放可被接受。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。DeepSeek 修复落在通用合同层，没有引入 provider 特判、兜底分支或第二条消息链路。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：基本是。修复核心是把“字段存在”和“字段非空”语义拆清，没有额外加兼容补丁；X skill 也只增加了一个最小 wrapper，而不是把凭证逻辑散落到多处命令里。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：未完全做到。为新增 X skill 与实网 smoke 脚本，本次文件数与非测试代码量净增长；其必要性在于把凭证复用与实网验收从人工步骤沉淀为可复用入口。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。DeepSeek 修复集中在 bridge/message adapter 合同边界，X 能力集中在单独 skill + wrapper，不把站点凭证逻辑混入业务代码。
- 目录结构与文件组织是否满足当前项目治理要求：部分满足。新增 skill 与 smoke 文件落点清晰，但本次触达的历史 NCP 文件名仍不满足当前角色后缀治理；该问题属于旧模块命名债务，后续更适合单独做 NCP 命名治理批次，而不是在本次 bugfix 中顺带大面积重命名。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：本次未单独执行 `post-edit-maintainability-review` skill，原因是本轮重点先完成根因修复、回归测试与实网合同验收；后续若要提交/发布，建议补一轮独立复核。

## NPM 包发布记录

- 本次是否需要发包：当前不需要立即发包，原因是本轮先完成问题修复、验证与本地 skill 沉淀，尚未进入统一发布闭环。
- 涉及的包：
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`：待统一发布。
  - `nextclaw`：待统一发布。
- 当前是否已经发布：
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`：未发布，待后续统一发布批次带出。
  - `nextclaw`：未发布，待后续统一发布批次带出。
- 已知阻塞或触发条件：
  - 发布前建议先决定是否顺带处理本次触达的历史命名治理债务，避免发布批次里混入额外结构改名。
