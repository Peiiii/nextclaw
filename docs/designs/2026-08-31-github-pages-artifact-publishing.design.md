# GitHub Pages Artifact 发布与 Git 历史瘦身设计

## 背景

NextClaw 当前把公开发布面直接提交到 `gh-pages`，再由 GitHub Pages 的 legacy branch source 提供：

- `desktop-updates/`：Desktop stable / beta 更新 manifest；
- `npm-runtime-updates/`：NPM runtime stable / beta 更新 manifest；
- `apt/` 与 `install-apt.sh`：签名 APT 仓库和 Linux Desktop `.deb`。

manifest 和签名元数据很小，但每次稳定 Desktop 发布都会把一个约 90–100 MiB 的 `.deb` 写入 `gh-pages` 历史。当前 `gh-pages` 与 `master` 是无共同祖先的孤立历史，包含 44 个至少 20 MiB 的大 blob，大对象逻辑体积约 4.06 GiB。普通 clone / fetch 的 refspec 会同步所有远端分支，因此源码使用者会承担与源码无关的 APT 二进制历史。

## 目标

保持现有公开 URL 和更新协议不变，把 GitHub Pages 从 branch source 改为 Actions artifact source，并把 `gh-pages` 收敛为不含发布二进制的紧凑状态快照。完成后：

- `https://peiiii.github.io/nextclaw/...` 路径不变；
- APT fresh install、upgrade、Desktop 更新、NPM runtime 更新行为不变；
- `.deb` 只存在于 GitHub Release、Actions 临时目录和 Pages 部署 artifact；
- 新 clone / pull 不再下载历史 `.deb`；
- `master`、tag 和产品提交历史不重写。

## 当前链路

```text
Desktop release ─┬─> desktop-updates manifest ─┐
                 └─> signed apt + .deb ────────┼─> commit/push gh-pages
NPM release ────────> npm-runtime manifest ────┘          │
                                                          v
                                               legacy GitHub Pages
                                                          │
                     Desktop / NPM runtime / apt clients <-┘
```

问题不是 APT 协议要求使用 Git，而是 Pages 的 branch source 把发布投影和 Git 持久化错误地绑定在一起。

## 候选方案

### 独立 APT 仓库

独立仓库可以隔离源码仓库，但默认 Pages URL 会变化，已安装机器的 APT source 需要迁移；跨仓库 dispatch 和凭据也会成为新 owner。若独立仓库仍用 branch source，二进制历史只会搬家，不会消失。

### 完全无状态地重建 Pages

每次从所有历史 GitHub Release 重新发现 Desktop stable / beta、NPM runtime stable / beta 和 APT 资产，可以完全删除状态分支，但需要跨多类 release 做动态发现和冲突裁决。当前没有第二个消费者证明这套通用 catalog 值得建立。

### 紧凑状态分支 + Pages Artifact（采用）

保留 `gh-pages` 作为小型、可审计的发布状态 owner，但禁止存放大二进制。GitHub Release 是 `.deb` 的唯一二进制事实源；统一 Pages workflow 在部署时下载 APT 专用 Release asset，校验后与状态快照一起上传为 Pages artifact。

真实回放确认 Desktop 原始 `.deb`（当前 123.6 MB）与 APT 发布包（当前 97.4 MB）不是同一字节流：现有 APT builder 会删除可恢复资源并以 xz 重新打包，以满足旧版 Pages 的 100 MiB 单文件限制。部署时重新执行这一步不能保证字节级重现已经签名的 APT metadata。因此 stable APT producer 必须把最终 APT `.deb` 以 `.pages.deb` 名称上传到同一个 GitHub Release；它与普通 Desktop `.deb` 分工明确，Pages 直接下载精确产物，不动态重打包。

此方案保留现有 raw GitHub manifest 验证、现有 URL 和三个 producer 的清晰 owner，同时从正常 Git 链路删除大对象。

## 目标架构

```text
Desktop release ─┬─> desktop-updates manifest ─┐
                 └─> apt metadata + source.json ├─> compact gh-pages state
NPM release ────────> npm-runtime manifest ────┘              │
                                                                │
GitHub Release (.deb owner) ───────────────────────────────┐    │
                                                           v    v
                                                Pages materializer
                                                           │
                                    verify filename / size / sha256
                                                           │
                                                           v
                                                Pages deployment artifact
                                                           │
                                                           v
                                                existing public URLs
```

### Owner 与不变量

- GitHub Release 是普通 Desktop `.deb` 与 APT 专用 `.pages.deb` 内容和不可变 release tag 的唯一 owner。
- 紧凑 `gh-pages` 是当前公开 manifest、APT 索引/签名和 `apt/package-source.json` 的唯一状态 owner。
- `github-pages-deploy.yml` 是“状态 + Release 资产 -> 完整 Pages 站点”的唯一 projection owner。
- producer 只能提交小型状态；提交前必须拒绝至少 20 MiB 的文件。
- Pages materializer 必须根据 APT `Packages` 校验 `.pages.deb` 的目标相对路径、字节数和 SHA-256；缺失或不匹配时 fail-fast，不能部署部分站点。
- Pages artifact 每次包含完整站点，不能让某个 producer 覆盖其它发布面。

命中的架构原则是 `information-expert`、`single-complete-owner`、`equivalence-by-construction` 和 `deletion-first`。过小方案只改本地 fetch，会保留远端污染；过大方案建立跨 release catalog，没有当前证据。平衡点是保留小型状态 owner、删除二进制 Git owner。

## 状态合同

`apt/package-source.json` 使用最小稳定结构：

```json
{
  "schema": "nextclaw.github-pages-apt-source/v1",
  "releaseTag": "v0.47.0-desktop.1",
  "assetName": "nextclaw-desktop_0.0.278_amd64.pages.deb",
  "packagePath": "pool/main/n/nextclaw-desktop/nextclaw-desktop_0.0.278_amd64.deb",
  "size": 97388124,
  "sha256": "..."
}
```

APT `Packages` 继续拥有客户端协议字段；`package-source.json` 只提供 GitHub Release 定位和部署前交叉校验，不成为用户安装协议。

## 生命周期

### Desktop stable

1. 构建、签名并 smoke 完整 APT 仓库。
2. 把与签名 metadata 精确对应的 APT `.deb` 作为 `.pages.deb` Release asset 上传。
3. 把 manifest、APT 索引/签名、安装脚本和 `package-source.json` 写入紧凑状态，删除 `.deb` 后才允许提交。
4. Pages workflow 下载对应 GitHub Release `.pages.deb`，校验并部署完整 artifact。
5. release closure 同时验证 raw 状态和公开 Pages。

### Desktop beta

只更新 beta Desktop manifest；APT 状态保持 stable，Pages workflow 用现有 `package-source.json` 重新物化 stable `.deb` 后部署完整站点。

### APT-only recovery

沿用现有显式 recovery 输入，重新生成签名 APT 状态和 `package-source.json`，再部署完整 Pages；不从 cwd 或旧 `.deb` Git blob 隐式救援。

### NPM runtime stable / beta

只更新对应 runtime manifest，随后从同一个紧凑状态部署完整站点。NPM bundle 仍由 GitHub Release URL 消费，不复制到 Pages。

### 失败与重试

- 状态提交前失败：不改变状态与线上 Pages。
- 状态提交成功、Pages 部署失败：线上仍保留上一次成功部署；重跑 deploy workflow 即可从当前状态恢复。
- APT 专用 Release asset 缺失、大小或 SHA 不符：materializer fail-fast，禁止 Pages deployment。
- Pages 传播超时：保持现有轮询与显式失败，不回退到 legacy branch source。

这里不保留长期双发布。legacy branch source 只存在于迁移窗口，退出事件是 Actions Pages 首次线上 APT、Desktop manifest 和 NPM manifest 验证通过。

## 迁移与回滚

1. 先在 `master` 交付 workflow、materializer、producer guard 和测试。
2. 用当前完整 `gh-pages` 快照执行首次 Pages artifact 部署；此时旧分支仍含 `.deb`，可作为迁移输入。
3. 把仓库 Pages `build_type` 切换为 `workflow`，验证原 URL 的三类公开面。
4. 记录旧 `gh-pages` 精确 tip，在本地保留对象；以 force-with-lease 把远端重建为单根紧凑状态提交，删除所有 `.deb`，补入当前 `package-source.json`。
5. 再次执行 Pages artifact 部署，验证紧凑状态能够独立物化完整站点。
6. 验证通过后删除本地 remote-tracking 旧引用、过期 reflog 并 GC；用全新 clone 测量对象体积。

在步骤 4 前失败时，继续使用 untouched legacy branch source。步骤 4 后、最终验证前失败时，用记录的旧 tip 恢复分支并把 Pages source 切回 legacy。最终验证通过后，旧历史不再是恢复合同；恢复统一从紧凑状态和 GitHub Release 重建。

## 验证标准

- materializer 单元测试覆盖完整 legacy 快照、紧凑状态物化、缺失 source、错误 size/SHA、大文件 state guard。
- workflow 合同测试覆盖三个 producer、Pages 权限、完整站点部署和禁止提交 `.deb`。
- 匹配范围的 YAML 解析、Node 测试、lint 和 TypeScript 检查通过。
- 本地使用当前 APT 状态与 Release `.deb` 物化站点，并通过 APT metadata / 签名 / package 校验。
- 线上原 URL 的 APT、Desktop stable/beta manifest、NPM runtime stable/beta manifest 均可读。
- 紧凑 `gh-pages` 不含至少 20 MiB 文件，且与 `master` 仍为孤立状态历史。
- 全新 clone 不再取得旧 APT blob；新 clone 与当前工作副本的 `.git` 体积有可记录证据。

## 非目标

- 不改变 APT URL、包名、签名密钥或用户安装命令。
- 不迁移到独立仓库或新域名。
- 不重写 `master`、tag、PR 或产品提交历史。
- 不把 Pages state 升级为通用 release catalog。
