# NextClaw 0.48.3 全平台发布

## 迭代完成说明

2026-09-04 补齐 0.48.3 全平台发布。最终父 run 33825935214 与 Desktop child 33826355524 均成功，桌面版 0.0.283 已公开。

初次全平台 run 33822701444 在 Desktop Draft 前失败：当前主干的 CONTENT_READY 与旧 NPM release commit 的说明来源不一致。失败日志与文件差异确认根因。修复 47d73232a 在 release.yml 的 Draft/正式调用点复用已有生成器和 notes-file/release-notes-url 参数，保持产品提交 24a6366030d2b3d47dda6808f6656eb25d5d5b67，不移动 tag、不重发 NPM。

## 测试/验证/验收方式

- 发布编排、核心及 Desktop 正文 25 项回归通过，实际 0.48.3 正文通过双语、绝对链接和无提交噪音合同。
- 定向 tsc、治理、backlog ratchet 通过；ESLint 无错误，只有未修改历史测试的 max-statements 警告。diff-only maintainability 无告警。
- 文档 run 33822644033 成功；全球/国内站均验证 commit 49e0b611d 与相同 tree hash；中英文页面 200，公开 JSON 为 0.48.3 stable。
- 最终 run 33825935214 通过 NPM 证据复用、Node guard、Runtime 复用和升级复验；Desktop 五平台 build/smoke、资产、公开、channel、APT 和 Pages jobs 全部成功。
- 公开五平台 manifest 均为 0.48.3，下载指向 v0.48.3-desktop.2，floor 0.0.141，说明 URL 一致；公开 APT Packages 确认为 0.0.283。Git tag 分别指向原始 NPM 提交 24a636603 与 Desktop 提交 d71d7a692，未移动旧身份。

## 发布/部署方式

- 原始产品 run：<https://github.com/Peiiii/nextclaw/actions/runs/33784395008>。
- 最终全平台 run：<https://github.com/Peiiii/nextclaw/actions/runs/33825935214>，仍使用 release.yml target=all。
- Desktop child：<https://github.com/Peiiii/nextclaw/actions/runs/33826355524>；identity：v0.48.3-desktop.2；app version：0.0.283；正式 Release 已公开，30 个合同资产与 1 个 APT Pages 补充包均 uploaded 且非空。
- 核心 Release 占位正文已补成正式双语说明，未改既有资产。
- AUTOMATION_INTERVENTIONS: 3。第一处是 Draft 内容来源不一致；第二处是旧 workflow 的预算源码替换补丁在配置迁移后失效；第三处是固定文件总数 520 与声明资源正常增长冲突（实际 560）。前两处已修复，第三处删除数量硬门槛，保留资源声明、完整 inventory/哈希及平台合同，并补齐 Desktop 独立修复的来源校验和 Draft 序号分配。旧 Draft 未公开，不重定向。
- 最终单次复验干预为 0。父 run 从 01:29:04Z 至 01:59:22Z，共 30 分 18 秒；NPM_READY 为 2 分 27 秒。Desktop 父 job 24 分 41 秒，child 工作区间 23 分 21 秒。最慢矩阵 job 为 Windows x64（15 分 17 秒，最慢 step 为 portable smoke 4 分 36 秒）；全部 job 的最长单 step 为 macOS x64 构建 6 分 05 秒。耗时来自必要的平台构建/冒烟及串行公开投影，没有为提速跳过校验或增加第二套发布器。最终 Git 收尾另行核对。

## 用户/产品视角的验收步骤

1. 对应系统安装并启动 Desktop，确认 runtime 0.48.3。
2. stable 更新确认版本、下载地址和说明一致。
3. Linux APT 包版本与同批 Desktop 安装包一致。
4. 阅读中英文说明；补丁版不生成配图或社交帖子。

## 可维护性总结汇总

第一批只修发布编排 producer，复用已有正文 owner 与显式参数。后续移除失效的源码重写和固定数量门槛，在现有 preflight/recovery owner 内补齐独立 Desktop 来源与 Draft 身份恢复；不增加版本特判、兼容框架或发布器。路径 preflight 与治理通过；不改 NPM/runtime 源码，Desktop app version 随新构建升至 0.0.283。

用户要求把抗版本漂移变成可维护合同：development-delivery 新增条件 reference，覆盖结构化 owner、消费者迁移、产品/内容来源分离与真实演进验证；Desktop 自动化 reference 同步显式内容来源。没有新增 Skill/常驻 AGENTS 规则或抬高预算。入口总量由 161993 降至 161978 bytes，38 个 Skill、description 4368 chars、AGENTS 11951 bytes 不变。

第三次修复明确补充核心原则：依赖稳定语义、减少变化耦合，不积累版本特判或过度设计兼容机制。本地先复现 560 > 520，资源增长测试先失败再通过；6 项资产合同测试及真实 darwin-arm64 bundle 构建成功。发布/正文/来源和 Draft 恢复共 40 项回归、定向 tsc 与 actionlint 通过；最终远程全平台结果通过。

收尾复核增加实际选中历史 Desktop commit 的来源检查，防止当前树已撤销的 runtime 改动仍残留在中间构建提交中。新增回归与现有编排共 13 项通过，定向 tsc 和 diff-only maintainability 通过；本次 d71d7a692 的精确来源检查通过，不需要改变正在发布的 identity。

规则验证以本次两次真实失败为基线，配置迁移后选择删除旧补丁而非扩大正则，内容后补选择显式来源而非移动 tag；现有产物 inventory/漂移/缺失/Windows 合同与 Desktop closure 共 18 项测试通过，actionlint 通过。保留历史产物的反例要求显式受支持迁移，不新增猜测 fallback。未做独立子代理压力测试；仓库 progressive-loading 校验通过，通用 quick_validate 因本机缺少 PyYAML 未执行成功。

## NPM 包发布记录

全平台补发不新增 NPM 发布，复用已公开的 nextclaw@0.48.3（latest=0.48.3）、同批依赖及四平台 runtime。稳定 tag 为 nextclaw@0.48.3；不得因 Desktop 或内容失败重发不可变产物。
