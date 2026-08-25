# Desktop 发布自动化

## Beta

使用 `pnpm release:desktop:beta`。同一上下文已有等价本地 gate 才允许 `--skip-local-verify`；默认隔离 worktree。发布后用 closure script 验证 workflow、assets、gh-pages 和 public beta manifest，传播延迟不创建新 tag。

## Stable

使用 `pnpm release:desktop:stable`。必须先证明目标 runtime identity 已经作为 stable NPM/runtime 发布且 release target 没有静默混入后续 package 源码，再闭合 clean/non-behind、签名 secret preflight、本地 package verify、GitHub release、workflow、assets、stable manifest 和 APT。正式发布必须提供 GitHub 专用的 `--notes-file`：中文在前、英文在后，且通过双语正文、绝对文档链接、无 frontmatter 和无自动生成提交噪音校验；禁止直接传入单一语言 docs 页面。没有结构化 release notes JSON 或显式恢复 URL 时同样 fail closed。该入口不调用任何 NPM publish 命令。

GitHub Release 必须采用 Draft-first 原子公开：CLI 先创建隐藏 Draft，再从分支入口对同一个 release identity 显式 dispatch `desktop-release.yml`。GitHub Draft 公开前不存在 tag ref，禁止以 Draft tag 作为 workflow ref；CLI 必须显式传递不可变 `release_target` SHA，workflow 先核对 Draft `targetCommitish`，再 checkout 该 SHA，公开后 closure 反向验证新建 tag 精确指向同一 SHA。每次 dispatch 带唯一身份，闭环只等待该次 run。正式 workflow 是生产产物构建与验证的单一 owner：五平台各构建一次，安装/启动冒烟、上传、更新频道与 APT 全部消费同一 run 的 artifact；禁止先等待 `desktop-validate.yml` 构建一批不会发布的平行产物。日常 CI 保持独立，但不参与正式发布状态迁移。全部投影绑定该 release identity，禁止跟随推进中的分支漂移。五平台全部成功、30 个 installer/portable/bundle/manifest/update metadata/public key 资产完整上传并精确核验后，workflow 才能公开同一 Release。禁止以 `release.published` 作为构建触发器，禁止在资产缺失时降级公开。失败或取消时 Draft 对公众不可见；Release 已完整公开但 channel/APT 失败时只恢复未完成投影，不重复创建 release identity。

## 完成门

- workflow overall success，矩阵与 publish jobs 全部成功；
- GitHub Release 在公开前保持 Draft，公开时精确资产集合已经验证；
- installer、portable、bundle、manifest、public key 等 assets 完整；
- `gh-pages` 与公开 manifest 版本、floor、releaseNotesUrl 一致；
- stable 的官网链接只在 release 与公开 channel 验证后更新；
- shipped bits 改变时 launcher/runtime identity 与 asset/manifest 同步变化；
- 隔离发布结果先闭合远程 `master`，再自动运行 `pnpm release:reconcile:mainline`；本地独有提交在隔离 worktree 合并验证，活跃 WIP 由 retry worker 保护并自动续跑，不要求用户手工 rebase。
- standalone desktop 完成后报告 `DESKTOP_READY`；全平台编排在此后由 Delivery 汇总 `ALL_PLATFORMS_READY`。
- closure 必须输出 `nextclaw.desktop-release/v1` 结构化观测，包含 workflow 总 wall time、各 job 时长与最慢 step；失败 run 也输出已完成阶段，作为后续发布复盘的统一事实源。

网络/TLS、Pages 传播、Docker pull 或 upload stalled 先按恢复 reference 分类，不盲目改代码或创建新版本。
