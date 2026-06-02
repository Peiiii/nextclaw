# v0.20.14 生成产物清理流程

## 迭代完成说明

- 新增 `pnpm clean:generated`，用于恢复 `packages/nextclaw/ui-dist` 的 tracked 生成物并删除该目录下 untracked hash 资产。
- 新增 `pnpm check:generated-clean`，用于只检查生成产物 allowlist 是否干净。
- 更新 `nextclaw-delivery-workflow` 与 `nextclaw-validation-workflow`，明确普通开发/验证后默认清理生成产物，发布/打包场景只在交付合同需要时才保留。

## 测试/验证/验收方式

- `pnpm clean:generated`：已清理当前 `packages/nextclaw/ui-dist` 漂移。
- `pnpm check:generated-clean`：通过，生成产物 allowlist 已干净。
- `node --check scripts/dev/clean-generated-artifacts.mjs`：通过。
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"`：通过。

## 发布/部署方式

不涉及部署。该改动是仓库工作流与治理规则改进。

## 用户/产品视角的验收步骤

- 前端或 `nextclaw` 构建后，如果 `packages/nextclaw/ui-dist` 出现 hash 文件漂移，执行 `pnpm clean:generated` 即可回到干净状态。
- 提交前执行 `pnpm check:generated-clean`，确认生成产物没有混入业务提交。

## 可维护性总结汇总

- 通过固定命令消除手工判断成本，避免构建产物与源码 WIP 混在一次提交里。
- 规则落在交付和验证 skill，能在后续开发、验证、发布收尾时自动触发。
- 未改动生成产物追踪策略本身；本次只先建立稳定清理入口和提交纪律。

## NPM 包发布记录

不涉及 NPM 包发布。
