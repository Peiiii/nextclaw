# v0.15.51 linux-deb-and-apt-repo

## 迭代完成说明（改了什么）

- 为 Linux desktop 发布链路补齐 `.deb` 产物：
  - [apps/desktop/package.json](../../../apps/desktop/package.json)
  - [scripts/desktop-package-build.mjs](../../../scripts/desktop-package-build.mjs)
  - [scripts/desktop-package-verify.mjs](../../../scripts/desktop-package-verify.mjs)
- 新增 Linux 产物与 APT 仓库脚本：
  - [apps/desktop/scripts/normalize-linux-release-artifacts.sh](../../../apps/desktop/scripts/normalize-linux-release-artifacts.sh)
  - [apps/desktop/scripts/smoke-linux-deb.sh](../../../apps/desktop/scripts/smoke-linux-deb.sh)
  - [apps/desktop/scripts/smoke-linux-apt-repo.sh](../../../apps/desktop/scripts/smoke-linux-apt-repo.sh)
  - [scripts/build-linux-apt-repo.mjs](../../../scripts/build-linux-apt-repo.mjs)
  - [scripts/export-linux-apt-public-key.mjs](../../../scripts/export-linux-apt-public-key.mjs)
- 扩展 GitHub Actions：
  - [desktop-validate.yml](../../../.github/workflows/desktop-validate.yml)
  - [desktop-release.yml](../../../.github/workflows/desktop-release.yml)
- Linux 验证链路现在覆盖：
  - AppImage 冒烟
  - `.deb` 安装/删除冒烟
  - 临时签名 APT repo 安装冒烟
  - 发布时基于 `gh-pages` 的真实 APT repo 生成与发布
  - 若已有旧 APT 仓库，则在发布时额外执行一次 `apt upgrade` 升级烟测
- 更新用户文档：
  - [apps/desktop/README.md](../../../apps/desktop/README.md)
  - [Linux Desktop Install (.deb + APT)](../../../apps/docs/en/guide/tutorials/linux-desktop-deb-apt.md)
  - [Linux 桌面安装（.deb + APT）](../../../apps/docs/zh/guide/tutorials/linux-desktop-deb-apt.md)
  - [实现方案](../../plans/2026-04-08-linux-deb-and-apt-repo-implementation-plan.md)

## 测试/验证/验收方式

- 本地已执行：
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/build-linux-apt-repo.mjs`
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/export-linux-apt-public-key.mjs`
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/desktop-package-build.mjs`
  - `PATH=/opt/homebrew/bin:$PATH node --check scripts/desktop-package-verify.mjs`
  - `bash -n apps/desktop/scripts/normalize-linux-release-artifacts.sh`
  - `bash -n apps/desktop/scripts/smoke-linux-deb.sh`
  - `bash -n apps/desktop/scripts/smoke-linux-apt-repo.sh`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/docs build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/desktop tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/desktop-validate.yml"); YAML.load_file(".github/workflows/desktop-release.yml")'`
- 本地未执行：
  - 真正的 Linux `.deb` 构建、Docker 内安装/删除、APT 安装/升级烟测
  - 原因：当前开发机为 macOS，Linux 包管理链路依赖 Ubuntu runner / Docker Linux 环境
- 已接入 GitHub Actions 的 Linux 验证：
  - `desktop-validate`：
    - Linux `AppImage + deb` 构建
    - `.deb` 安装/删除烟测
    - test-signed APT repo 构建与安装烟测
  - `desktop-release`：
    - GitHub Release 上传 `.deb`
    - 真实签名 APT repo 构建
    - 新仓库安装烟测
    - 若存在旧仓库则执行一次升级烟测

## 发布/部署方式

1. 在仓库 Secrets 中配置：
   - `NEXTCLAW_APT_GPG_PRIVATE_KEY`
   - `NEXTCLAW_APT_GPG_PASSPHRASE`
   - `NEXTCLAW_APT_GPG_KEY_ID`
2. 将 GitHub Pages 指向 `gh-pages` 分支根目录。
3. 通过 tag 或 `workflow_dispatch` 触发 [desktop-release.yml](../../../.github/workflows/desktop-release.yml)。
4. 工作流会：
   - 生成并上传 Linux `.deb` 到 GitHub Release
   - 从现有 `gh-pages/apt/pool` 复用已发布 `.deb`
   - 重新生成完整 APT 仓库元数据与签名
   - 将最新 `apt/` 发布到 `gh-pages`
5. 对外安装入口：

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://peiiii.github.io/nextbot/apt/nextclaw-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/nextclaw-archive-keyring.gpg >/dev/null

echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/nextclaw-archive-keyring.gpg] https://peiiii.github.io/nextbot/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/nextclaw.list >/dev/null

sudo apt update
sudo apt install nextclaw-desktop
```

## 用户/产品视角的验收步骤

1. 打开 GitHub Release，确认 Linux 产物里同时存在：
   - `NextClaw.Desktop-<version>-linux-x64.AppImage`
   - `nextclaw-desktop_<version>_amd64.deb`
2. 打开 GitHub Actions 的 `desktop-validate`，确认 Linux job 通过：
   - `.deb` 安装/删除烟测通过
   - APT repo 安装烟测通过
3. 打开 GitHub Actions 的 `desktop-release`，确认：
   - `publish-release-assets` 已上传 `.deb`
   - `publish-linux-apt-repo` 通过
4. 在 Debian / Ubuntu 机器执行安装命令后，确认：
   - `apt policy nextclaw-desktop` 能看到 `Candidate`
   - `sudo apt install nextclaw-desktop` 成功
5. 发布一个更高版本后，在同一台机器执行：
   - `sudo apt update`
   - `sudo apt upgrade`
   - 确认 `nextclaw-desktop` 从旧版本升级到新版本
6. 执行：
   - `sudo apt remove nextclaw-desktop`
   - `sudo apt purge nextclaw-desktop`
   - 确认卸载路径符合文档说明

## 可维护性总结汇总

- 独立复核方式：
  - 已在实现后执行一次独立于实现阶段的 `post-edit-maintainability-review` 判断，并结合 `pnpm lint:maintainability:guard` 结果填写本节。
- 本次是否已尽最大努力优化可维护性：
  - 是。
  - 这次没有把 Linux 升级逻辑塞回 Electron 应用内，而是复用系统 `apt` 机制；同时把 APT 仓库生成、key 导出、Linux 产物重命名、`.deb`/APT 烟测拆成独立脚本，避免复杂度继续堆进 workflow YAML。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。
  - 关键简化点：
    - 没有新增 Linux 应用内自动更新子系统。
    - 没有单独引入重型 APT 托管服务。
    - 通过 [normalize-linux-release-artifacts.sh](../../../apps/desktop/scripts/normalize-linux-release-artifacts.sh) 消除了两份 workflow 内联重命名逻辑。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 否，本次为新增能力，总代码与文件数净增长。
  - 代码增减报告：
    - 新增：1571 行
    - 删除：31 行
    - 净增：+1540 行
  - 非测试代码增减报告：
    - 新增：1571 行
    - 删除：31 行
    - 净增：+1540 行
  - 增长原因与最小必要性：
    - 本次新增的是完整 Linux 分发能力，不是简单修补；增长主要来自 workflow、APT 仓库脚本、双语文档与方案文件。
    - 已同步偿还的维护性债务是把 Linux 产物标准化和烟测逻辑抽成脚本，避免未来继续把命名规则和安装验证复制到多个 workflow step。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。
  - 现在边界更清晰：
    - Electron builder 继续只负责产物构建。
    - `build-linux-apt-repo.mjs` 负责仓库生成与签名。
    - `export-linux-apt-public-key.mjs` 负责 key 导出。
    - `smoke-linux-deb.sh` 与 `smoke-linux-apt-repo.sh` 负责安装/升级链路验证。
    - workflow 只负责编排，不再承载过多业务细节。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 基本满足。
  - 新增文件主要落在现有 `scripts/`、`apps/desktop/scripts/`、`apps/docs/...` 与 workflow 边界内，没有继续把逻辑塞进桌面运行时代码或 UI 热点目录。
  - 仍存在的已知治理债务是根 `scripts/` 目录长期扁平化，但该目录已有治理例外说明，本次未进一步恶化其结构问题。
- 若本次涉及代码可维护性评估，是否基于一次独立于实现阶段的 `post-edit-maintainability-review`：
  - 是。
- 可维护性复核结论：
  - 通过。
  - `no maintainability findings`
  - 本次顺手减债：是。
  - 仍需关注的下一步 seam：
    - 若后续 Linux 分发继续扩展到 `rpm`、多 channel、repo 元数据复用，优先考虑把根 `scripts/` 目录按 `release/desktop/docs` 维度分层，而不是继续横向平铺。
