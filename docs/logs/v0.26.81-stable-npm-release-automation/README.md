# Stable NPM 一键发布自动化

## 迭代完成说明

本次新增根级 `pnpm release:stable`，把 stable NPM 的版本化、严格发布检查、registry 发布验证、release commit/tag/push、stable runtime、GitHub Release/公开 manifest，以及真实 Registry 安装和旧版升级串成一个默认完整闭环。`--dry-run` 纯读展示目标版本和所有阶段；发布后失败使用显式 `--resume-from git|runtime|install`，不重复执行不可逆 publish。

根因是底层能力虽然已经分别存在于 `release:auto`、`release:stable:runtime` 和 `smoke-npm-runtime-update`，stable 没有统一生命周期 owner；操作者必须记住提交、重打 tag、推送、runtime 和真实安装顺序，任何一步遗漏都可能把“包已上传”误报为发布完成。代码、发布文档和最近 0.29.0 发布记录共同确认了这个缺口。本次修复复用所有既有底层 owner，只增加一层明确编排和 fail-fast 门禁，不新建第二套 publish/manifest 实现。

## 测试/验证/验收方式

- `scripts/release/*.test.mjs` 共 13 项通过，覆盖 release scope、summary、stable 参数、版本 plan、skip/resume、恢复命令、runtime/install 参数和 package tags。
- 新增/修改脚本 Node 语法检查通过，定向 ESLint 0 warning；新文件、目录、owner、import 和 context 治理检查通过。
- `release:auto:changeset --check` 确认当前 pending changesets 已覆盖全部 public drift；release groups 和 repository health 通过。
- `release:stable --dry-run` 从真实 Changesets plan 得到 28 个 package、`nextclaw 0.29.0 -> 0.30.0`，明确显示结构化 release notes 尚缺；运行前后 git status、HEAD 和 tags 均未变化。
- 非 dry-run 在当前脏工作树稳定 fail-fast，没有进入 version、publish、commit、tag、push 或 workflow dispatch。
- 公开 Registry 真实验证两次通过：精确安装 `nextclaw@0.29.0` 后 app、launcher、update public key 和 embedded UI 均存在；从 `nextclaw@0.28.1` 依次执行 stable check、download-only、apply，下载阶段未切 current pointer，应用后新进程版本为 `0.29.0`。
- skill progressive-loading、governance backlog ratchet 和最终 maintainability guard 通过；最终 guard 为 0 error / 0 warning。

## 发布/部署方式

本次只实现和验证发布自动化，没有执行 NPM publish、release commit、tag、push、GitHub workflow、runtime channel 或部署。未来 stable 发布从已经提交并推送、版本语义和 release notes 已冻结的干净分支运行 `pnpm release:stable`；本地入口依赖非交互可用的 NPM/GitHub 身份，因此属于“一次授权后的本地一键闭环”，不是无需个人凭证的 CI 无人值守发布。

## 用户/产品视角的验收步骤

1. 在 pending changesets 存在时执行 `pnpm release:stable -- --dry-run`，确认 package 数、previous/target version、release notes 状态和完整阶段正确，仓库无变化。
2. 缺少 release notes、NPM 身份、分支同步或干净工作树时执行真实入口，确认在 publish 前明确阻断。
3. 完整发布后确认输出包含 release commit、package tag 数、nextclaw version、stable runtime verified 和 published install verified。
4. 在 runtime 或 install 阶段制造可恢复失败，使用输出的精确 `--resume-from` 命令继续，确认不会再次 publish。
5. 从公开 Registry 安装目标版本，再从上一 stable 完成 check/download-only/apply，确认下载与应用状态边界和新进程版本。

## 可维护性总结汇总

stable 副作用 owner 最终收敛为 398 行，只保留外部命令、门禁和阶段生命周期；参数、dry-run、恢复命令与命令参数构造归 279 行无副作用 utils。原来的 runtime smoke 被拆成 276 行本地签名 fixture owner 和 253 行公开 Registry verifier，避免两类环境继续互相膨胀。没有新增 raw publish、manifest writer、retry fallback 或兼容入口。

首次 guard 提醒 stable owner 和 runtime smoke 接近预算；按真实职责缝拆分后最终 guard 0 warning。planned-path preflight、命名、目录、module structure 和 skill 分层均通过；没有触达现有 maintainability hotspot 红区。

## NPM 包发布记录

不涉及 NPM 包发布。本次没有新增用户产品 changeset；只把既有按需扩展 runtime changeset 中 `nextclaw` 的版本级别从 patch 校正为 minor，使包含明显新能力的完整批次按合同计划为 `nextclaw@0.30.0`。真正发布仍需先补结构化 0.30.0 release notes，并满足该产品批次已经记录的发布验收门槛。
