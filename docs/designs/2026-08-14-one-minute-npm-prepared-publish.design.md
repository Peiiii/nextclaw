# NextClaw 一分钟 NPM 发布设计

## 文档状态

- 日期：2026-08-14
- 状态：已实现并通过隔离 L4 验证；待下一次授权的 npmjs stable 发布完成公网 SLA 验收
- 上游语义：`/发布NPM` 仍表示把本批正式版本首次发布到 NPM `latest`
- 被取代的性能目标：`2026-08-14-fast-npm-release-pipeline.design.md` 中 2.5–4.5 分钟目标
- 非授权声明：本文不授权真实发布新版本；真实下一版本用于最终性能验收时仍需要发布授权

## 一、结论

采用“**提前准备不可变 tarball，正式命令只执行并发首次上传与闭环**”模型。

耗时的 version、build、tsc、lint、artifact audit、pack 和 tarball 内容验证进入 `release:npm:prepare`。`npm-release-prepare` workflow 在 `master` 每次 push 后自动判断是否存在 public package drift，并为 exact source commit 产生内容寻址 artifact；该阶段不访问 NPM 写接口。用户说“发布 NPM”时，`release:npm:stable` 优先消费本地证明，否则从同仓库的成功 workflow 下载 HEAD 对应 artifact。证明缺失或源码漂移时快速失败，不静默退回六分钟旧链路。

正式发布仍然首次把稳定版本写入 NPM，不提前公开候选版本，不把“返回早、后台继续”冒充完成。

## 二、硬目标与计时边界

### 2.1 完成条件

`NPM_READY` 只有在以下事实全部成立时输出：

1. prepared batch 中每个精确 `pkg@version` 已发布到配置的 registry，且 registry integrity 与 prepared tarball 一致；
2. 本批每个 package 的 `latest` 都等于对应目标版本；
3. release commit 和本批 package tags 已推送；
4. release commit 已进入目标分支，本地目标分支与 `origin/<target>` 一致；
5. 使用独立空缓存从公网 registry 下载精确 `nextclaw@version` tarball，并验证版本与关键 payload；
6. 整个不可逆正式阶段真实 wall time 小于 60 秒。

### 2.2 计时边界

- `release:npm:prepare` 是 commit/push 后的交付就绪阶段，不是正式发布；release-bearing `master` 交付必须等 exact-commit workflow artifact 成立后才称“可立即发布”。
- `release:npm:stable` 从定位/下载 exact-commit artifact 开始计时，到 `NPM_READY` 为止停止；下载耗时也在 60 秒内，不能藏在计时外。
- 环境隔离、依赖安装和 prepared batch 生成必须独立报告，不能算进一个模糊总数，也不能在正式命令内偷偷执行。
- 缺少 prepared batch 时，正式命令在 10 秒内给出明确恢复命令，不执行旧慢链路。

## 三、为什么不用提前公开候选版本

把 `0.34.1` 先发布到隐藏 dist-tag，确实可以让正式命令只切换 `latest`，但精确稳定版本会提前公开且不可覆盖。若准备后又有代码变化，只能烧掉版本号并重新发布。这个模型改变了授权时点，也制造公共 registry 垃圾版本，因此拒绝。

prepared tarball 只存在于受控文件系统或 CI artifact storage。内容可以失效和重建，正式版本仍只在用户授权时首次公开。

## 四、单一主链路

### 4.1 Prepare

```text
冻结 committed source
-> Changesets canonical release plan
-> version manifests / changelogs
-> strict build + tsc + lint
-> artifact audit
-> 为每个 public release package 执行 pnpm pack
-> 校验 tarball manifest 无 workspace:*、name/version 精确
-> 审计 tarball manifest、payload、hash 和 size
-> 写 prepared manifest（原子 rename）
-> 导出 source patch + prepared batch 为 exact-commit CI artifact
```

Prepare 不调用 `npm publish`、`npm dist-tag` 或 Git push。版本化文件和 tarball 来自同一 worktree 状态；tarball 生成后，manifest 记录其 SHA-512、size、package identity 和当前 release tree fingerprint。

### 4.2 Publish

```text
读取本地 prepared manifest，或下载 HEAD 对应成功 workflow artifact
-> 在干净 source commit 应用 release patch
-> 重新计算 release tree fingerprint
-> 解析并打印项目 userconfig；同配置执行 whoami；校验所有 tarball hash 和 registry/auth
-> 有限并发 npm publish <tarball> --tag latest
-> 有限并发逐包 version + integrity + latest registry verify
-> 并行：Git commit/tag/push/target closure | 空缓存公网精确 tarball 下载与 payload 审计
-> join 两支结果
-> wall < 60s
-> NPM_READY
```

所有 publish 请求都针对不可变 tarball，不在 publish 时运行 package lifecycle script、build 或 pack。并发默认值由真实 NPM 演练决定，第一版上限为 12，可通过 release 专用参数降低；不允许无限并发。

## 五、Prepared manifest

manifest 是 prepared batch 的唯一 owner，放在 Git common directory 下，不提交仓库、不依赖单个 worktree 生命周期：

```text
<git-common-dir>/nextclaw-release/prepared/<batch-id>/manifest.json
<git-common-dir>/nextclaw-release/prepared/<batch-id>/packages/*.tgz
```

核心字段：

```json
{
  "schemaVersion": 1,
  "batchId": "...",
  "sourceCommit": "...",
  "treeFingerprint": "...",
  "registry": "https://registry.npmjs.org/",
  "targetBranch": "master",
  "targetVersion": "0.34.1",
  "preparedAt": "...",
  "packages": [
    {
      "name": "nextclaw",
      "version": "0.34.1",
      "tarballPath": "packages/nextclaw-0.34.1.tgz",
      "sha512": "...",
      "size": 123
    }
  ],
  "proof": {
    "strictValidation": "passed",
    "artifactAudit": "passed",
    "tarballManifestAudit": "passed"
  }
}
```

manifest 不保存 token、`.npmrc` 或环境变量。写入使用临时目录加原子 rename；失败批次不能成为 latest prepared batch。

CI artifact 额外保存 `artifact.json` 与 binary `release.patch`。导入时要求工作区干净、`HEAD === sourceCommit`、workflow 成功且 artifact 名包含同一 SHA；先 `git apply --check`，应用后再验证 tree fingerprint 与每个 tarball hash。branch 名不是内容身份，release branch 只要从同一 source commit 建立即可消费 `master` 预制物。

## 六、不变量和失败恢复

1. Changesets `status.releases` 是 prepare 前 release closure 的唯一 owner；禁止再用直接 changeset seed 预测上传集合。
2. manifest package 集合必须与 version 后 public package 集合完全一致。
3. source commit、tarball hash、tree fingerprint、registry、目标版本、目标分支任一失配都 fail fast。
4. publish 部分失败后先按 manifest 精确查询 registry；只上传缺失版本，不重复发布已存在版本。
5. registry 成立后 Git 或精确 payload 下载审计失败，只恢复失败分支，不重新 version、build、pack 或 publish。
6. Git 闭环同时检查执行分支和目标分支；最终本地目标分支必须等于远程目标分支。
7. 超过 60 秒不撤销已经成立的 registry 事实，但命令失败并输出精确阶段、耗时和恢复入口；不能谎报 `NPM_READY`。
8. 正式发布只接受显式、当前 worktree 或主 worktree 的项目 `.npmrc`；找不到时 fail closed，不读取环境默认 `~/.npmrc`。所有 auth 诊断必须报告实际 userconfig，publish 与 package-setting 强认证分别判定。

## 七、删除与收敛

- `release:npm:stable` 不再内联 `release:auto:prepare -> version -> strict -> publish` 慢路径。
- validated publish 不再重复 UI / nextclaw build。
- registry verifier 不再逐包串行调用 `npm view`。
- 正式 publish 不再调用 Changesets 内部同时负责发现、pack、上传和 tag 的黑盒路径；Changesets 继续拥有 plan/version，prepared publisher 拥有 tarball 上传。
- 不新增第二个 release plan、第二套 package scope 或“超时仍返回成功”的兼容路径。

## 八、验证标准

### 合同测试

- canonical Changesets plan 等于 prepared package 集合；覆盖内部依赖传播。
- manifest 原子写入、hash/fingerprint/registry/version 漂移拒绝。
- exact-commit artifact 导出/导入覆盖 tracked、untracked release 文件；脏 source tree、错误 commit 和失败 workflow 拒绝。
- partial publish 只重试缺失包。
- Git 和公网精确 payload 审计 all-settled join；任一失败不输出 `NPM_READY`。
- 本地与远程目标分支不一致时拒绝完成。
- duration 大于等于 60 秒时拒绝输出 `NPM_READY`。

### 组装验证

- 使用临时 Git 仓库、fixture tarball 和隔离 Verdaccio 跑完整 prepare/publish DAG。
- 对本次 22 包执行真实只读 registry 查询并发基准。
- 未获新版本发布授权时，不再用 public dist-tag 做“可逆”性能演练；token policy 可能允许写入却拒绝删除。NPM 写并发在隔离 registry 验证，公开 registry 只做只读查询与真实授权发布。
- 对公开 `nextclaw` 使用独立空缓存执行精确 tarball 下载和 payload 审计计时。
- 下一次被授权的真实稳定发布必须以同一命令得到 `<60s` 的顶层 timing proof；在此之前只能称实现与演练通过，不能宣称真实新版本 SLA 已证明。

## 九、非目标

- 不发布 desktop、runtime channel、docs、website 或 X。
- 不减少 build、tsc、lint、artifact、逐包 registry identity 或公网精确 payload 门禁；完整依赖安装/升级属于产品正式版后续集成阶段，不阻塞 NPM-only `NPM_READY`。
- 不承诺 NPM/CDN 故障时仍低于 60 秒。
- 不让用户学习第二条正式发布命令；准备动作由 delivery/CI 自动完成，用户仍只表达“发布 NPM”。
