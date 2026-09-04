# 全平台恢复发布的内容来源

## 目标与证据

- contract-id: desktop-0483；parent-goal: 发布 NextClaw 0.48.3 全平台稳定版并合入、推送主干。
- scope-revision: 1；没有缩减用户范围。
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
| D01 | true | Draft/正式调用使用同版本显式内容，产品 target 不变 | passed | 25 项回归；实际正文合同；恢复 run Draft 成功 |
| D02 | true     | 既有 0.48.3 NPM/runtime 保留且公开可用                                | passed  | NPM latest=0.48.3；原始 release/tag 已发布 |
| D03 | true | 五平台 Desktop build/smoke、30 assets、公开 channel 与 APT 同版本闭环 | not-run | v0.48.3-desktop.1 Draft 已创建，Desktop 执行中 |
| D04 | true | 中英文说明与结构化说明公开可读 | passed | 中英文 200；JSON 0.48.3 stable；全球/国内部署验证通过 |
| D05 | true | 本任务精确提交、推送并同步 master | not-run | 47d73232a 已合入推送；最终记录和 reconcile 待完成 |

当前门：定向回归证明两个调用点参数及双语内容合同，diff-only Review 通过，再恢复同版本发布。最后以父流水线及 Desktop closure 验证 D03，不用局部测试替代真实构建。无需改产品文档/changeset，因为本修复只改变内部发布编排。

契约 Review：不以单平台、NPM 成功或新版本号替代全平台结果；不加入与本次发布无关的性能和源码重构标准。

## 恢复中发现的过期构建补丁

run 33823735524 在 Apply release bundle budget compatibility 失败。0.48.3 的预算已经统一为 product-bundle-assets.config.mjs 中的 520，builder 与 verifier 共同消费；旧 workflow 仍要求在两个文件中正则替换本地常量。删除过期补丁并反向测试 workflow 不再修改源码，不提高预算、不改变 delivered bits，继续复用 v0.48.3-desktop.1 Draft。失败 child 已取消，避免继续消耗构建资源。D03 保持未通过；重新发布验证前不宣称完成。
