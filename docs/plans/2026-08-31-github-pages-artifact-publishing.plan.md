# GitHub Pages Artifact 发布与 Git 历史瘦身执行计划

上位设计：[GitHub Pages Artifact 发布与 Git 历史瘦身设计](../designs/2026-08-31-github-pages-artifact-publishing.design.md)

## 最终结果

- contract-id：`pages-artifact-history-cleanup-2026-08-31`
- parent-goal：保持 NextClaw 现有 Pages、APT 和更新 URL/行为不变，停止向 Git 写入发布二进制，清除 `gh-pages` 大对象历史并证明新 clone / pull 不再承担该体积。
- scope-revision / scope-confirmation：`1 / user-confirmed`（用户明确授权设计、实现、验证、提交、部署和历史清理完整闭环）

## 整体验收契约

- 必须成立：Pages 改为 Actions artifact；三类 producer 正常发布；APT 可安装/升级；远端状态历史紧凑；新 clone 不含历史 `.deb`。
- 必须不发生：公开 URL 改变、部分站点覆盖、错误 `.deb` 被部署、`master`/tag 历史被重写、迁移失败后无恢复入口。
- 架构不变量：Release 拥有二进制；紧凑状态分支拥有小型发布状态；统一 materializer 拥有完整 Pages projection。
- 代表性场景：Desktop stable、Desktop beta、APT-only recovery、NPM runtime stable/beta、部署失败重试、首次迁移和历史压缩。
- 交付边界：代码、测试、主线提交与推送、Pages source 切换、线上部署、`gh-pages` 重建、本地 GC、全新 clone 审计全部属于本任务。
- 真实边界：GitHub 服务端不可观察的物理 GC 时间不作为完成阻塞；以远端引用和 fresh clone 实际传输为准。

## 阶段图

| 阶段 | 可验收结果 | 进入下一阶段的门 | 状态 |
| --- | --- | --- | --- |
| 设计 | owner、状态合同、迁移与恢复冻结 | 设计和 active ledger 可直接指导实现 | 已完成 |
| 实现 | materializer、workflow、producer guard、测试完成 | diff 无未解释路径，定向检查可运行 | 已完成 |
| 验证与 Review | 本地行为、合同、类型和维护性证据通过 | findings 关闭，外部迁移条件满足 | 已完成 |
| 主线与部署 | 改动进入 `origin/master`，Actions Pages 首次成功 | 原 URL 三类公开面通过 | 未开始 |
| 历史清理 | 紧凑状态 force-with-lease 生效，本地/fresh clone 审计完成 | Required IDs 全部 passed | 未开始 |

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- | --- |
| GPA-01 | true | 原 `peiiii.github.io/nextclaw` URL 由 Actions Pages 提供 | not-run | 当前仍是 legacy branch source | 实现或 Pages 配置变化 |
| GPA-02 | true | APT `.deb` 从 GitHub Release 物化并通过 filename/size/SHA 校验 | passed | 真实 97,388,124-byte APT 包从紧凑状态物化，SHA 与签名 `Packages` 一致 | materializer 或状态 schema 变化 |
| GPA-03 | true | APT fresh install、upgrade 和 recovery 合同不退化 | not-run | 现有 smoke 与 recovery 路径已调查 | APT workflow 变化 |
| GPA-04 | true | Desktop stable/beta manifest 均保留且公开可读 | not-run | 当前公开路径已取证 | Desktop producer 变化 |
| GPA-05 | true | NPM runtime stable/beta manifest 均保留且公开可读 | not-run | 当前状态路径已取证 | NPM producer 变化 |
| GPA-06 | true | producer 提交前拒绝大文件，`.deb` 不再进入 Git | passed | 三个 producer 均调用 compact state guard；合同测试通过 | guard 或 workflow 变化 |
| GPA-07 | true | `gh-pages` 被重建为单根紧凑状态且不改写 `master`/tag | not-run | 两条历史无共同祖先 | 远端引用变化 |
| GPA-08 | true | 迁移前失败可保留 legacy；迁移后失败可从 Release + state 重试 | not-run | 恢复策略已设计 | rollout 顺序变化 |
| GPA-09 | true | 受影响测试、YAML、lint、TypeScript 和维护性检查通过 | passed | 43 项 release 测试、actionlint、ESLint、治理检查通过；Review 0 findings；未触达 TypeScript，tsc 不适用 | diff 变化 |
| GPA-10 | true | fresh clone / pull 不再下载旧 APT 历史，本地对象完成回收 | not-run | 当前 `.git` pack 约 4.27 GiB | 引用或 GC 状态变化 |
| GPA-11 | true | 设计、执行计划和独立交付留痕完整 | not-run | 设计与计划已创建 | 交付范围变化 |

## 执行部分

### 1. 发布 projection 实现

- owner：`scripts/release/github-pages-artifact.mjs` 与 `.github/workflows/github-pages-deploy.yml`。
- 输入：紧凑状态目录、GitHub Release `.deb`。
- 结果：完整、已校验的 Pages artifact。
- 设计策略：复用上位设计；不新增通用 catalog。
- 验证：单元测试、fixture 物化、错误 package 拒绝、Pages artifact 结构检查。

### 2. Producer 迁移

- owner：Desktop 与 NPM runtime release workflow。
- 输入：现有 build artifact 和 manifest。
- 结果：只提交小型状态，随后调用统一 Pages workflow。
- 设计策略：复用上位设计；保留现有 channel/recovery 分支，不新增 fallback。
- 验证：workflow 合同测试、YAML 解析、定向 release tests。

### 3. 本地质量闭环

- owner：Validation / Review。
- 结果：GPA-02、GPA-03、GPA-04、GPA-05、GPA-06、GPA-09 获得本地证据。
- 验证：最快定向测试后执行适用 tsc、lint、diff-only maintainability。

### 4. 主线和首次 Pages 部署

- owner：Delivery。
- 结果：提交进入 `origin/master`；Pages build type 切到 workflow；当前完整 `gh-pages` 快照经 artifact 首次部署成功。
- 验证：workflow run、Pages API、公开 URL 和内容身份。
- 恢复入口：首次线上验证前不改写 `gh-pages`；失败则切回 legacy。

### 5. 紧凑历史迁移与回收

- owner：Delivery。
- 结果：以旧 tip 为 lease 重建单根状态提交，删除 `.deb`；再次 artifact 部署；清除本地引用/reflog并 GC；fresh clone 审计。
- 验证：远端 branch commit count、无大 blob、公开 APT/manifest、clone pack 大小和对象可达性。
- 恢复入口：最终验证前保留本地旧 tip 和对象；失败时 force-with-lease 恢复旧 tip并恢复 legacy source。

### 6. Review、留痕与交付

- owner：Review / Retrospective / Delivery。
- 结果：findings 关闭，适用迭代记录落盘，最终证据与未验证边界清楚交付。

## 当前阶段门

- 结果：设计和 plan 能直接指导单一路径实现。
- 保持项：URL、签名、更新 channel、recovery、`master` 历史。
- 场景：五类发布/恢复场景和迁移失败恢复。
- 本阶段不做：尚不执行 Pages 配置、部署和 branch rewrite。
- 待关闭缺口：实现 materializer 与 workflow 后验证 GitHub 权限和实际 artifact 部署。

## 新发现与契约变更

- 事实：`npm-runtime-update-release.yml` 是第三个 `gh-pages` producer。
- 影响：Pages 必须部署完整站点，不能只迁移 APT job。
- 决定：三个 producer 统一调用同一个 projection owner。
- 理由：避免独立 artifact 部署互相覆盖。

- 事实：Desktop Release 原始 `.deb` 与 APT builder 为 Pages 限制重打包后的 `.deb` 字节不同，当前大小分别为 123,634,676 与 97,388,124 bytes。
- 影响：不能用普通 Release `.deb` 直接满足已签名 `Packages` 的 size/SHA，也不能在部署时假设重打包可字节级复现。
- 决定：APT producer 把精确的重打包结果作为同一 Release 的 `.pages.deb` asset 上传，`package-source.json` 同时记录 Release asset 名和 APT 目标路径。
- 理由：让不可变二进制与签名 metadata 等价构造，Pages materializer 只做校验与投影。

## 中断恢复

恢复时先读取本计划的 active ledger，再读取上位设计；从第一个 `not-run` / `failed` Required ID 对应的执行部分继续。任何外部迁移前重新读取 Pages API 状态、远端 `gh-pages` tip 和公开 URL，不从本地旧快照推断。

## 尚未关闭

- GPA-01 至 GPA-11 均待实现、验证或交付证据。
