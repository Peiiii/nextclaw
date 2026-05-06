## 迭代完成说明

- 本轮把“workspace 根必须显式声明 `module-structure.config.json`”从口头要求落成了真实脚本约束，并把现有 workspace 一次性补齐到了全覆盖。
- 根因是现有 `module-structure` 治理只会检查已经声明 contract 的模块，导致 `apps/companion` 这类 workspace 即使完全没有结构协议，也会落在脚本盲区里。
- 通过方式：
  - 在 `scripts/governance/module-structure/module-structure-contracts.mjs` 增加 workspace root 识别与缺失 config 判断能力。
  - 在 `scripts/governance/module-structure/lint-new-code-module-structure.mjs` 增加“被触达 workspace 若缺失 `module-structure.config.json` 则直接报错”的规则。
  - 新增 `source-root-open` 协议，用于那些需要以 `src/` 为治理根、但暂时不适合强套 `package-l1` / `frontend-l3` / `cli-command-first` 的 workspace。
  - 新增 `electron-shell-l1` 协议，避免把 Electron 壳类应用硬塞进 `package-l1`。
  - 为全部 58 个 workspace 显式声明了 root contract；其中 `apps/companion`、`apps/desktop` 走 `electron-shell-l1`，大部分 `src` 形态 workspace 走 `source-root-open`，非 `src` 形态 workspace 则冻结为 legacy root contract。
  - 同步补全 [/.agents/skills/file-organization-governance/SKILL.md](/Users/peiwang/Projects/nextbot/.agents/skills/file-organization-governance/SKILL.md) 中的仓库级规则说明。
- 这次修的是根因，不是症状：不是只给 `apps/companion` 加一个配置文件，而是让脚本以后能直接拦住“新/改 workspace 仍未声明 contract”的情况。
- 当前仓库盘点结果：58 个 workspace 已全部显式声明 `module-structure.config.json`，当前 `missing = []`。

## 测试/验证/验收方式

- 通过：
  - `node --test --test-name-pattern='companion electron shell|desktop electron shell|launcher entry|missing module-structure config' scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
  - `node --test --test-name-pattern='every workspace root declares module-structure config|source-root-open|companion electron shell|desktop electron shell|missing module-structure config' scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
  - `pnpm lint:new-code:governance -- --files scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs apps/companion/module-structure.config.json apps/desktop/module-structure.config.json .agents/skills/file-organization-governance/SKILL.md`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --files scripts/governance/module-structure/module-structure-contracts.mjs scripts/governance/module-structure/lint-new-code-module-structure.mjs scripts/governance/module-structure/lint-new-code-module-structure.test.mjs .agents/skills/file-organization-governance/SKILL.md`
- 全量回归现状：
  - `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
  - 结果仍有 2 条既有失败：
    - `blocks nested directories under flat role dirs inside shared`
    - `blocks parent-relative imports when alias imports are configured`
  - 这两条失败在本轮之前就存在，不是本轮新增回归。
- 默认治理闭环：
  - `pnpm check:governance-backlog-ratchet`
  - 当前仍失败，原因是仓库既有 `docFileNameViolations` 为 `13`，高于 baseline `11`，不属于本轮新增问题。
- `tsc/build` 不适用：
  - 本轮只改动 `.mjs` 治理脚本、JSON contract 与 skill 文本，没有触达 TypeScript 源码或运行时 TS 边界。

## 发布/部署方式

- 不适用
- 本轮仅涉及治理脚本、结构协议与 skill 文本，不涉及运行时发布、部署或 NPM 发包

## 用户/产品视角的验收步骤

1. 打开 [apps/companion/module-structure.config.json](/Users/peiwang/Projects/nextbot/apps/companion/module-structure.config.json) 与 [apps/desktop/module-structure.config.json](/Users/peiwang/Projects/nextbot/apps/desktop/module-structure.config.json)，确认这两个 Electron workspace 已显式声明结构协议。
2. 查看 [scripts/governance/module-structure/module-structure-contracts.mjs](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/module-structure-contracts.mjs)，确认存在 `electron-shell-l1`、`source-root-open` 协议以及 workspace root 检测逻辑。
3. 查看 [scripts/governance/module-structure/lint-new-code-module-structure.mjs](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/lint-new-code-module-structure.mjs)，确认它会在触达缺失 config 的 workspace 时直接报错。
4. 查看 [scripts/governance/module-structure/lint-new-code-module-structure.test.mjs](/Users/peiwang/Projects/nextbot/scripts/governance/module-structure/lint-new-code-module-structure.test.mjs)，确认 companion/desktop 协议识别和缺失 config 报错都已有测试覆盖。
5. 后续若新增或修改某个 workspace，却没有声明 `module-structure.config.json`，治理脚本应阻止该改动以“未声明 contract”的状态进入仓库。

## 可维护性总结汇总

- 本轮选择了“仓库级规则 + 协议化建模 + 显式 contract”这条更干净的路线，没有继续堆单点例外。
- `apps/companion` 与 `apps/desktop` 的结构 owner 更明确了，避免 Electron 壳类应用长期游离在目录治理之外。
- 其余 workspace 也不再处于“未声明 contract、脚本默认漏过”的状态，仓库级目录治理边界第一次做到显式全覆盖。
- 脚本层新增的是统一入口检查，不是散落在个别模块里的兼容胶水，后续继续清 backlog 时可以直接复用。
- 新增协议名 `electron-shell-l1` 虽然是扩展，但它表达的是稳定形态，不是为单一模块硬造的临时目录角色。
- maintainability guard 结果：`Errors: 0`、`Warnings: 0`。
- 虽然很多 workspace 当前还是 legacy / open contract，而不是更理想的强协议形态，但至少 owner 已经明确，后续可以按批次继续从 legacy 向稳定协议收敛。

## NPM 包发布记录

- 不涉及 NPM 包发布
