# GitHub Pages Artifact 发布与 Git 历史瘦身

## 迭代完成说明

本批次把 NextClaw 的公开下载与更新站点从 GitHub Pages legacy branch source 迁移为 Actions artifact source，并把 `gh-pages` 收敛为只保存 manifest、APT 索引/签名和二进制来源描述的紧凑状态分支。

根因不是普通源码发布变大，而是稳定 Desktop 发布长期把 APT `.deb` 提交进孤立的 `gh-pages` 历史。该分支累计 293 个提交、44 个至少 20 MiB 的 blob，大对象逻辑体积约 4.06 GiB；普通 clone/fetch 的默认 refspec 会取得远端所有分支，因此源码使用者也承担了发布二进制历史。

调查同时确认普通 Desktop Release `.deb`（123,634,676 bytes）与 APT 专用重打包结果（97,388,124 bytes）不是同一字节流。最终方案让 APT producer 把与签名 `Packages` 精确对应的 `.pages.deb` 作为同一 GitHub Release 的补充 asset 保存，Pages materializer 只负责 filename、目标路径、size 和 SHA-256 校验及完整站点投影，不在部署时尝试重现已签名包。

## 测试/验证/验收方式

- 43 项定向 release 测试通过，覆盖 Desktop asset closure、APT source schema、错误包拒绝、紧凑状态 guard、三个 producer 和 Pages workflow 合同。
- `actionlint`、定向 ESLint、`lint:new-code:governance`、governance backlog ratchet 与 `git diff --check` 通过。
- 使用真实 `origin/gh-pages` 状态和当前 APT 包完成本地物化：紧凑状态为 29 个文件，输出 artifact 为 100,843,520 bytes，包 SHA-256 为 `f22a4c70f5171d44a6e06276a044833c4158c8eb945eb97086d775a660ff3cb8`，与签名 `Packages` 一致。
- 本机 Docker daemon 未运行，因此容器化 fresh install/upgrade 没有在本地冒充通过；正式 APT recovery workflow [`33402591007`](https://github.com/Peiiii/nextclaw/actions/runs/33402591007) 在 GitHub Ubuntu runner 完成重建、fresh install、upgrade、状态提交和 Pages deploy，全部通过。

## 发布/部署方式

基础设施提交 `e67e3e985` 与最新远端主线合并为 `2ba4b9150` 并普通推送到 `origin/master`。Actions Pages 首次部署 run [`33402130115`](https://github.com/Peiiii/nextclaw/actions/runs/33402130115) 通过后，以旧 tip `ff08605b9` 为 exact lease 把 `gh-pages` 重建为 root `2f5036e51`；紧凑分支二次部署 run [`33402467650`](https://github.com/Peiiii/nextclaw/actions/runs/33402467650) 通过。最终 APT recovery 把状态推进到 `12779d409` 并自动部署。

GitHub Pages API 最终为 `build_type=workflow`。交付中只发生用户授权的首次 dispatch、Pages source 切换、Release asset 上传和 exact-lease 历史重建，没有外部人工救援：`AUTOMATION_INTERVENTIONS: 0`。

## 用户/产品视角的验收步骤

1. 原 `https://peiiii.github.io/nextclaw/` 域名和 APT、Desktop 更新、NPM runtime 更新路径保持可读。
2. Linux APT fresh install 与从上一仓库状态升级通过。
3. 远端 `gh-pages` 不含 `.deb` 或至少 20 MiB 文件，且只有一个根提交。
4. 全新 clone 不再取得旧 APT 大 blob；后续 stable/beta producer 仍能部署完整站点。

最终线上核对结果：Desktop stable/beta、NPM runtime stable/beta、APT `Packages`、`InRelease` 和安装脚本均与紧凑状态逐字节一致；公开 `.deb` 为 97,366,144 bytes，SHA-256 为 `877a7fcec3dd176f5174f6c16434bf3506bfa1f7a9b91c29ef2a6a753154701c`。

远端 `gh-pages` 有 2 个提交、1 个根，当前状态树 22,164 bytes，零 `.deb` 和零至少 20 MiB 文件。标准、无 shallow/filter 的 HTTPS fresh clone 用时 96 秒，pack 259,839,734 bytes，整个 `.git` 274,788,352 bytes，APT `.deb` 对象为 0。共享本地 `.git` 经定向 reflog 过期和 `git gc --prune=now` 从 5,145,067,520 bytes 降至 610,967,552 bytes，共回收 4,534,099,968 bytes；旧历史 tip 已不可读，Git garbage 为 0。

## 可维护性总结汇总

- 二进制、状态和公开投影分别由 GitHub Release、紧凑 `gh-pages` 和统一 Pages workflow 单一拥有，删除了把同一 `.deb` 同时当作 Git 状态和部署制品的双 owner。
- producer 在提交前统一执行大文件、`.deb`、symlink/hard-link guard；materializer fail-fast，不保留静默 fallback。
- 新增文件和目录已通过命名、角色、模块结构治理。第一次 maintainability 检查发现旧 Desktop 大测试被追加断言后触发函数预算，已把 Pages 合同移回独立测试 owner；复验为 0 error。
- `desktop-release-closure.mjs` 当前 472/500 行，自动检查给出邻近预算 warning；本次只增加严格命名的可选 APT asset 合同，拆分会增加无收益跳转，未扩大范围。

## NPM 包发布记录

不涉及 NPM 包发布。
