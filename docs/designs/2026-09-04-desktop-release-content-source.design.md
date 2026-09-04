# 全平台恢复发布的内容来源

## 目标与证据

- contract-id: desktop-0483；parent-goal: 发布 NextClaw 0.48.3 全平台稳定版并合入、推送主干。
- scope-revision: 2；用户补充维护抗版本漂移的发布原则，没有缩减发布范围。
- 类型 bugfix，风险 L4；design-document: required；plan: not-required（单批修复，随后恢复发布）。
- reproduce: run 33822701444 已复现。恢复路径以当前 checkout 判断 CONTENT_READY，却把旧 NPM release commit 24a636603 作为 Desktop 说明来源，导致 Draft 创建前失败。
- 原始产品提交没有补发后新增的说明；49e0b611d 已含同版本中英文说明。

## 冻结方案

保留原始产品 target 和版本，release.yml 在 Draft 与正式 Desktop 两个调用点用现有 release-core-notes.mjs 从冻结的当前 checkout 生成正文和 URL，并通过已有 --notes-file / --release-notes-url 参数显式传入。Desktop 原有双语、绝对链接、无提交噪音验证继续生效。

不移动 tag，不用新主干作为产品 target，不重发 NPM，不在 Desktop consumer 增加目录扫描或隐式 fallback。调用点产生的临时 Markdown 由 Runner 管理，不进入仓库。内容缺失或无效仍明确失败。

这属于发布编排 owner 的参数修复；复用现有生成器和已有显式恢复合同，没有新增抽象或公共配置。相比更换产品提交，避免意外带入后续产品代码；相比手工 standalone 发布，保留父流水线闭环。

## 阶段与验收

修复与回归验证 → 冻结远程主干并恢复 target=all → 验证公开产物与主干同步。

| ID  | Required | 合同                                                                  | Status  | 当前证据                                   |
| --- | -------- | --------------------------------------------------------------------- | ------- | ------------------------------------------ |
| D01 | true | Draft/正式调用使用同版本显式内容；NPM/runtime target 不变，Desktop 修复使用经漂移检查的独立 target | passed | 40 项回归、来源隔离与 Draft 序号测试；实际正文合同 |
| D02 | true     | 既有 0.48.3 NPM/runtime 保留且公开可用                                | passed  | NPM latest=0.48.3；原始 release/tag 已发布 |
| D03 | true | 五平台 Desktop build/smoke、30 assets、公开 channel 与 APT 同版本闭环 | not-run | 第三次失败已修复，本地 bundle build 与 6 项资产合同通过；远程待复验 |
| D04 | true | 中英文说明与结构化说明公开可读 | passed | 中英文 200；JSON 0.48.3 stable；全球/国内部署验证通过 |
| D05 | true | 本任务精确提交、推送并同步 master | not-run | 47d73232a 已合入推送；最终记录和 reconcile 待完成 |
| D06 | true | 发布 Skill 明确稳定契约、减少耦合与不过度设计原则 | passed | release-evolution.md 核心原则及条件路由；progressive-loading 通过 |

当前门：定向回归证明两个调用点参数及双语内容合同，diff-only Review 通过，再恢复同版本发布。最后以父流水线及 Desktop closure 验证 D03，不用局部测试替代真实构建。无需改产品文档/changeset，因为本修复只改变内部发布编排。

契约 Review：不以单平台、NPM 成功或新版本号替代全平台结果；不加入与本次发布无关的性能和源码重构标准。

## 恢复中发现的过期构建补丁

run 33823735524 在 Apply release bundle budget compatibility 失败。0.48.3 的预算已经统一为 product-bundle-assets.config.mjs 中的 520，builder 与 verifier 共同消费；旧 workflow 仍要求在两个文件中正则替换本地常量。删除过期补丁并反向测试 workflow 不再修改源码，不提高预算、不改变 delivered bits，继续复用 v0.48.3-desktop.1 Draft。失败 child 已取消，避免继续消耗构建资源。D03 保持未通过；重新发布验证前不宣称完成。

## 资产正常增长与桌面独立修复

run 33824683188 及本地 bundle build 均复现 560 > 520。按现有声明解析，550 个 runtime 文件直接来自资产合同（UI 386、resources 94、Skills 33 等）；即使不算生成入口也超过固定数量门槛。声明 tree 支持正常新增，却又固定总文件数，属于合同冲突。

冻结方案：删除数量硬门槛，保留数量观测、声明范围、唯一目标、必需资源、禁止嵌套 node_modules、完整 inventory/哈希和平台 native 校验；不增大数字、不添加版本特判。增加资源树正常增长的行为回归，原有缺失/多余/篡改/平台不匹配测试必须仍失败。

Desktop 打包修复独立于已发布 NPM/runtime：恢复入口先拒绝任何非 Desktop/控制或文档范围的源码漂移，再以最近影响 apps/desktop 或 scripts/desktop 的不可变提交为 Desktop target；仅后补文档或 workflow 变化不制造新产品 identity。NPM/runtime 继续绑定原始 release commit。新构建使用新 Desktop app version，旧无资产 Draft 保持不可见；构建序号同时考虑 Draft 和公开 tag，只有同一 target/channel 的 Draft 可复用。该行为归既有 preflight/recovery owner，不创建第二发布器。
