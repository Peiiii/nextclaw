English Version

NextClaw Desktop 0.0.215 stable release for runtime 0.21.12.

Highlights:

- Promotes the verified NextClaw 0.21.12 runtime to the stable desktop channel.
- Uses the nextclaw.net domestic marketplace mirror by default for marketplace reads, with automatic fallback to the official marketplace API when the mirror is unavailable.
- Keeps marketplace publishing and admin write paths on the official source, so the domestic mirror remains a read-only acceleration layer.
- Includes signed stable update bundles, desktop installers, Linux packages, and stable update manifests.

Validation:

- NPM `nextclaw@latest` is 0.21.12.
- Published NPM install smoke passed and stable update check returned `up-to-date`.
- NPM stable runtime manifests for macOS, Linux, and Windows point to 0.21.12 with manifest and bundle signatures.
- Desktop release automation verifies local package health, release assets, stable update manifests, and Linux APT publication.

Minimum launcher version: 0.0.141

中文版

NextClaw Desktop 0.0.215 正式版，运行时版本 0.21.12。

重点：

- 将已验证的 NextClaw 0.21.12 runtime 推进到桌面 stable 通道。
- 技能市场读取默认使用 nextclaw.net 国内镜像；镜像不可用时自动回退到官方 marketplace API。
- 技能发布和 admin 写路径仍保持官方源，国内镜像只作为只读加速层。
- 包含签名 stable 更新包、桌面安装包、Linux 包和 stable 更新 manifest。

验证：

- NPM `nextclaw@latest` 已是 0.21.12。
- 公开 NPM 安装 smoke 已通过，stable update check 返回 `up-to-date`。
- NPM stable runtime manifests 在 macOS、Linux、Windows 上均指向 0.21.12，并带 manifest / bundle 签名。
- 桌面发布自动化会验证本地包健康、release assets、stable update manifests 与 Linux APT 发布。

最低 launcher 版本：0.0.141
