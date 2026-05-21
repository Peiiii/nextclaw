# Windows Portable Edition Design

## 1. 文档目的

本文记录 NextClaw Desktop Windows Portable Edition 的产品与技术方案。

Portable Edition 不是安装器里的一个 portable 选项，也不是把默认桌面版改成便携模式，而是一个独立下载产物：

```text
NextClaw-Portable-<desktop-version>-win-x64.zip
NextClaw-Portable-<desktop-version>-win-arm64.zip
```

用户下载后解压，把整个目录放到 U 盘或任意可写目录，双击 `NextClaw Desktop.exe` 即可使用。NextClaw 自己管理的数据默认跟随这个目录移动。

## 2. 范围

第一阶段是 Windows 完整交付：

- 支持 Windows x64 portable zip，并在 GitHub Actions Windows x64 runner 上执行真实启动 smoke。
- 支持 Windows arm64 portable zip，并在 CI 中验证包结构；x64 runner 不执行 arm64 二进制启动。
- 普通 Windows 安装版继续保留，并继续执行 installer smoke。
- Portable Edition 暂不支持应用内更新。升级方式是下载新版 portable zip，保留或迁移旧包的 `data/` 目录。
- macOS / Linux portable 不在本阶段范围。

## 3. 产品定义

解压后的 portable 根目录固定为：

```text
NextClaw-Portable/
  NextClaw Desktop.exe
  nextclaw-portable.json
  data/
    desktop/
      userData/
    runtime-home/
    logs/
```

`nextclaw-portable.json` 是安装形态 marker，不是用户配置文件。它只用于告诉桌面启动链路：当前目录应按 portable root 处理。

`data/` 是 Portable Edition 的用户数据根目录，用于保存 NextClaw 自己管理的桌面状态、Electron `userData`、runtime home、日志、会话、配置和运行时状态。便携包不要求预置用户数据；`data/` 可以不存在，第一次启动时由应用按需创建。

Portable Edition 与普通桌面版的关系：

- 普通桌面版适合长期安装，写入系统默认 app data，保留开始菜单、桌面快捷方式和卸载入口。
- Portable Edition 适合 U 盘、临时电脑和免安装环境，NextClaw 自有数据写入应用目录旁边的 `data/`。
- 两者不是同一个安装流程的不同选项，必须能够共存。

边界也必须清楚：Portable Edition 追求 NextClaw 自有数据随目录走，不承诺操作系统完全零痕迹。系统仍可能留下最近打开记录、系统日志、SmartScreen 记录、GPU 或字体缓存等宿主痕迹。

## 4. 核心设计原则

一句话架构原则：

**Portable Edition 是一个安装形态 profile，不是散落在各处的 `if portable`。**

命中的设计原则：

- `single-domain-owner`：portable 路径归属只有一个事实 owner。
- `information-expert`：知道 portable root、触发条件、路径派生规则的对象负责生成 profile。
- `complete-owner`：安装形态 owner 覆盖路径检测、路径派生、环境注入和 Electron path 应用闭环。
- `responsibility-surface-minimization`：业务层、update 层、runtime 层不直接判断 portable，只消费统一 profile 结果。
- `no-compatibility-by-default`：不为内部实现保留多套平行路径分支；现有 override 可以复用，但入口收敛到 profile。

## 5. Owner 设计

`DesktopInstallationProfile` 是桌面启动链路里的安装形态事实源，不是泛化的 portable manager。

它负责回答：

- 当前是 `installed` 还是 `portable`。
- 如果是 Portable Edition，portable root 在哪里。
- desktop data / Electron `userData` / logs / runtime home 应该落到哪里。
- 当前实例隔离 id 是什么。
- 当前安装形态是否支持应用内更新。
- 需要注入给 runtime 的环境变量补丁是什么。

它不负责：

- 启动窗口。
- 启动 runtime。
- 下载或应用更新。
- 管理 release asset。
- 持有业务状态。

下游链路：

1. `main.ts` 在创建 logger / update shell / runtime 前解析 profile。
2. `applyDesktopInstallationProfile` 应用 Electron `userData` 和 `logs`。
3. runtime path 继续通过既有 `desktop-paths` 读取 override，不新增平行路径系统。
4. update coordinator 只消费 `updateCapability`，portable 时进入明确 blocked 状态。
5. smoke 脚本验证 portable 数据真正落在 portable root 的 `data/` 下。

## 6. 抽象力度约束

只保留一个安装形态 owner。不要提前拆成 resolver / marker reader / path applier / capability service 等多层对象，除非后续出现真实变化轴，例如 macOS portable、加密数据目录或 portable updater。

允许的小抽象：

- 纯常量文件，用于避免测试加载 Electron。
- package / verify 脚本，用于把 release asset 合同自动化。

不允许的小聪明：

- 用安装版路径加环境变量临时伪装 portable。
- 用 fallback 静默吞掉坏 marker 后退回 installed。
- 在消费者包里新增 deep import 或 tsconfig alias 来绕过边界。
- 让普通安装版和 portable 共用同一个 `userData` / runtime home。

## 7. 更新策略

第一阶段 Portable Edition 不支持应用内更新。原因是应用内更新涉及两个额外风险：

- portable 包内程序文件可能位于 U 盘、同步盘或权限受限目录，写入失败和半更新风险更高。
- 普通安装版的 updater 语义是安装器 / bundle 更新，不应该复用到 portable zip 自替换。

因此 portable 模式下 update coordinator 返回 `unsupported-installation`。用户升级时下载新版 portable zip，然后保留旧 `data/` 或迁移 `data/` 到新版目录。

## 8. Release 合同

GitHub beta preview release 必须包含：

```text
NextClaw-Portable-<desktop-version>-win-x64.zip
NextClaw-Portable-<desktop-version>-win-arm64.zip
```

Windows release workflow 需要：

- x64 构建 portable zip。
- x64 解压 portable zip 并执行真实启动 smoke。
- arm64 构建 portable zip。
- arm64 检查 zip 结构和 marker。
- 保留普通 Windows installer 构建与 smoke。
- release asset 发布完成后再宣布交付完成。

## 9. 验收标准

- Windows x64 portable zip 可解压启动。
- Windows arm64 portable zip 结构正确，包含 `nextclaw-portable.json`。
- 首次启动后数据落在 `data/desktop`、`data/runtime-home`、`data/logs`。
- main log 记录 `installationKind=portable`，并记录 portable data / runtime home。
- portable 应用内更新入口进入 unsupported blocked 状态，不触发下载。
- 普通安装版 smoke 仍通过，且与 portable 使用不同数据路径。
- GitHub beta preview release 上能下载 Windows portable zip。

## 10. 第一阶段落地记录

第一阶段已通过 GitHub beta preview release 验证：

- Release tag：`v0.19.17-desktop-beta.4`
- Desktop version：`0.0.174`
- x64 asset：`NextClaw-Portable-0.0.174-win-x64.zip`
- arm64 asset：`NextClaw-Portable-0.0.174-win-arm64.zip`
- GitHub Actions run：`26235866236`

本阶段交付的是 Windows portable 用户能力。NPM release、macOS portable 和 Linux portable 不属于本阶段闭环。
