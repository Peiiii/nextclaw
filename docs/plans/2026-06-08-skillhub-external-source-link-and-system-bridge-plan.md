# SkillHub 外部来源入口与系统能力桥方案

**目标：** 在 Skill Marketplace 页面轻量提示用户：SkillHub 上的 skill 也可以按其提示词或安装说明放入 NextClaw workspace 使用；点击入口时在桌面端通过系统默认浏览器打开 SkillHub 官网。

**核心架构：** 不做 SkillHub 专用集成，不接入 SkillHub API，不把 SkillHub skill 伪装成 NextClaw 官方 marketplace item。复用现有 `window.nextclawDesktop` 桌面 bridge，新增一个通用宿主能力分支；UI 侧用 `HostCapabilityManager` 收敛需要调用宿主系统的能力，桌面端用 Electron 实现，当前第一项能力是 `openExternalUrl`。

**技术栈：** React、Electron preload IPC、Electron main service、Vitest。

---

## 背景判断

这个需求的重点不是“集成 SkillHub registry”，而是把 NextClaw 作为用户使用 AI skill 生态的统一入口。SkillHub 上每个 skill 自带提示词或安装说明，用户可以把这些内容复制到 NextClaw workspace 中使用；因此第一阶段只需要让用户知道“这些外部 skill 也能被 NextClaw 使用”，并给出清晰跳转。

这符合 `docs/VISION.md` 的方向：NextClaw 应连接和编排外部生态，而不是把所有外部能力都硬塞成内置功能。

## 现有系统能力盘点

当前仓库已经有几类“调用系统能力”的入口：

- 桌面 bridge：`apps/desktop/src/preload.ts` 已通过 `window.nextclawDesktop` 暴露桌面能力。
- 桌面 IPC channel：`apps/desktop/src/utils/desktop-ipc.utils.ts` 已维护 update、runtime、window、presence、locale channel。
- 桌面业务 owner：
  - `DesktopUpdateManager` 管理检查更新、下载、应用更新和更新弹窗。
  - `DesktopRuntimeControlService` 管理重启 runtime / app。
  - `DesktopWindowManager` 管理窗口控制与窗口状态。
  - `DesktopPresenceService` 管理 close-to-background、launch-at-login、locale 偏好，其中 launch-at-login 已调用 `app.setLoginItemSettings` / `app.getLoginItemSettings`。
- 主 UI 里已有分散外部打开：
  - `packages/nextclaw-ui/src/features/account/managers/account.manager.ts`：登录验证页、NextClaw Web。
  - `packages/nextclaw-ui/src/shared/components/config/provider-form.tsx`：provider device auth verification URI。
  - `packages/nextclaw-ui/src/features/system-status/components/desktop-update-config.tsx`：release notes。
- 其他 app 也有外部打开：
  - `apps/companion/electron/services/companion-window.service.ts`
  - `apps/companion/electron/services/companion-tray.service.ts`
  - `apps/platform-console/**`
  - `apps/platform-admin/**`

结论：不能新增一个 SkillHub 专用 bridge，也不应该把 update、runtime、window、presence 这些已有业务 owner 收进一个万能 manager。正确粒度是“宿主能力 primitive”：由一个统一 manager 承接 UI 对宿主系统能力的请求，但不接管产品领域状态。已有稳定业务能力继续留在各自 owner 下，需要系统原语时再调用宿主能力 manager。

## 非目标

- 不抓取 SkillHub 列表。
- 不实现 SkillHub 搜索、详情页、安装页代理。
- 不新增 SkillHub 专用 manager、service 或 bridge。
- 不承诺 SkillHub skill 已经过 NextClaw marketplace 审核。
- 不在桌面端用内置 WebView 打开 SkillHub。

## 最小方案

新增并收敛两层抽象：

1. UI 侧：`HostCapabilityManager`
   - owner：用户级宿主能力调用。
   - 当前只暴露 `openExternalUrl(url)`。
   - 桌面 bridge 存在时调用桌面能力；Web/PWA 环境 fallback 到 `window.open`。
   - 负责基础 URL 校验，只允许 `http` / `https`。
   - 本期迁移主 UI 中已有 `window.open` 调用，避免 SkillHub 成为又一个分散入口。
   - 未来可自然扩展 `openPath`、`revealPath`、`showNotification`、`pickFile` 等宿主能力，但每个新增方法都必须是稳定 OS/browser primitive，不能承接产品领域逻辑。

2. 桌面侧：`DesktopHostCapabilityService`
   - owner：Electron main 到宿主系统能力的 bridge。
   - 当前只处理 `openExternalUrl` IPC。
   - 负责二次 URL 校验，并调用 `shell.openExternal`。

Marketplace 页面只加一个 tab 行右侧外链动作，不拥有平台判断，也不直接调用 `window.open`。

已有 update/runtime/window/presence/locale 保持原 owner，不为这次需求重构。它们已经是稳定业务能力，不属于宿主能力 manager；其中某些 owner 后续可以调用宿主能力 primitive，但职责不能反向并入 `HostCapabilityManager`。

## 代码组织

建议改动文件：

- 新增 `packages/nextclaw-ui/src/shared/lib/host-capabilities/host-capability.manager.ts`
- 新增 `packages/nextclaw-ui/src/shared/lib/host-capabilities/host-capability.manager.test.ts`
- 修改 `packages/nextclaw-ui/src/shared/components/ui/action-link.tsx`
- 新增 `packages/nextclaw-ui/src/features/marketplace/components/marketplace-external-skill-source-action.tsx`
- 修改 `packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.tsx`
- 修改 `packages/nextclaw-ui/src/shared/lib/i18n/marketplace-labels.utils.ts`
- 修改 `packages/nextclaw-ui/src/platforms/desktop/types/desktop-update.types.ts`
- 修改 `apps/desktop/src/utils/desktop-ipc.utils.ts`
- 修改 `apps/desktop/src/preload.ts`
- 新增 `apps/desktop/src/services/desktop-host-capability.service.ts`
- 新增 `apps/desktop/src/services/desktop-host-capability.service.test.ts`
- 修改 `apps/desktop/src/main.ts`
- 修改 `packages/nextclaw-ui/src/features/account/managers/account.manager.ts`
- 修改 `packages/nextclaw-ui/src/shared/components/config/provider-form.tsx`
- 修改 `packages/nextclaw-ui/src/features/system-status/components/desktop-update-config.tsx`

命名说明：

- UI 侧叫 `HostCapabilityManager`，因为它统一的是“宿主环境能力 primitive”，不是单个外链动作，也不是产品系统状态。
- 桌面侧叫 `DesktopHostCapabilityService`，因为它只是 Electron main 的宿主能力执行 bridge。
- 基础展示组件叫 `ExternalActionLink`，放在已有 `action-link.tsx` 组件族里，只表达 primary 色外部跳转链接的 UI 语义，不知道 SkillHub、URL 或宿主 bridge。
- Marketplace 组件叫 `MarketplaceExternalSkillSourceAction`，避免叫 `SkillHubIntegration`，防止误导成正式 registry 集成。
- `window.nextclawDesktop` 是现有桌面 bridge，本期只在其中增加 `host.openExternalUrl`，不新增 `window.nextclawSystem` 或 `window.nextclawSkillHub`。

## 关键代码草图

### UI manager

```ts
export type OpenExternalUrlFailureReason =
  | "unsupported-url"
  | "bridge-failed";

export type OpenExternalUrlResult =
  | { opened: true }
  | { opened: false; reason: OpenExternalUrlFailureReason };

const normalizeExternalHttpUrl = (rawUrl: string): string | undefined => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
};

export class HostCapabilityManager {
  openExternalUrl = async (rawUrl: string): Promise<OpenExternalUrlResult> => {
    const url = normalizeExternalHttpUrl(rawUrl);
    if (!url) {
      return { opened: false, reason: "unsupported-url" };
    }

    try {
      const desktopOpen = window.nextclawDesktop?.host?.openExternalUrl;
      if (desktopOpen) {
        return await desktopOpen(url);
      }
      window.open(url, "_blank", "noopener,noreferrer");
      return { opened: true };
    } catch {
      return { opened: false, reason: "bridge-failed" };
    }
  };
}

export const hostCapabilityManager = new HostCapabilityManager();
```

这里的重点是让组件不用知道当前是桌面端还是 Web 端。`HostCapabilityManager` 的边界是“宿主能力 primitive”：打开外部 URL、打开/定位本地路径、文件选择、系统通知这类能力可以进来；更新状态、运行时重启、presence 偏好、Marketplace 安装流程不能进来。

### 桌面 bridge

```ts
export const DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL =
  "nextclaw-desktop:host:open-external-url";
```

```ts
type DesktopHostCapabilityServiceOptions = {
  ipcMain: Pick<typeof ipcMain, "handle" | "removeHandler">;
  shell: Pick<typeof shell, "openExternal">;
};

export class DesktopHostCapabilityService {
  constructor(private readonly options: DesktopHostCapabilityServiceOptions) {}

  start = () => {
    this.options.ipcMain.handle(
      DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL,
      this.handleOpenExternalUrl,
    );
  };

  stop = () => {
    this.options.ipcMain.removeHandler(
      DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL,
    );
  };

  private handleOpenExternalUrl = async (_event: unknown, rawUrl: unknown) => {
    if (typeof rawUrl !== "string") {
      return { opened: false, reason: "unsupported-url" as const };
    }

    const url = normalizeExternalHttpUrl(rawUrl);
    if (!url) {
      return { opened: false, reason: "unsupported-url" as const };
    }

    await this.options.shell.openExternal(url);
    return { opened: true as const };
  };
}
```

`normalizeExternalHttpUrl` 可以放在同文件内，保持局部私有；如果 UI 与 desktop 都需要同一份纯校验逻辑，后续再抽共享包。本阶段不为一个 URL 校验引入跨包依赖。

### Preload 类型与暴露

`window.nextclawDesktop` 增加一个 `host` namespace，沿用现有 bridge，不另建全局对象：

```ts
host: {
  openExternalUrl: (url: string) =>
    ipcRenderer.invoke(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL, url),
},
```

类型上新增：

```ts
host?: {
  openExternalUrl: (url: string) => Promise<OpenExternalUrlResult>;
};
```

`host` 标为可选，是为了让 UI 在旧桌面 preload 或纯 Web 环境下自然 fallback。

### Marketplace 组件

```tsx
const SKILLHUB_URL = "https://skillhub.cn/";

export function MarketplaceExternalSkillSourceAction() {
  return (
    <ExternalActionLink
      label={t("marketplaceExternalSkillSourceTitle")}
      onClick={() => void hostCapabilityManager.openExternalUrl(SKILLHUB_URL)}
    />
  );
}
```

Marketplace 文案必须迁到 `marketplace-labels.utils.ts`，组件只消费 label，不自己判断中英文。按钮视觉由 shared `ExternalActionLink` 承接；Marketplace 组件只负责业务入口和 host bridge 调用。禁止用 `language.startsWith(...)` / `isZh ? ... : ...` 在组件里临时写双语文案。

插入位置建议在 Marketplace tab 同一行最右侧，非精选场景页展示。这样它是“发现更多 skill 来源”的轻量跳转，不占用列表纵向空间，也不误导成已安装页专属功能。

## 交互文案

中文：

- 按钮：`SkillHub`

英文：

- 按钮：`SkillHub`

注意文案不写“已支持安装 SkillHub”，也不写“官方认证”，避免承诺超出事实。

## 实现任务

### Task 1：补桌面宿主能力 bridge

文件：

- 修改 `apps/desktop/src/utils/desktop-ipc.utils.ts`
- 新增 `apps/desktop/src/services/desktop-host-capability.service.ts`
- 新增 `apps/desktop/src/services/desktop-host-capability.service.test.ts`
- 修改 `apps/desktop/src/preload.ts`
- 修改 `apps/desktop/src/main.ts`
- 修改 `packages/nextclaw-ui/src/platforms/desktop/types/desktop-update.types.ts`

验收：

- `https://skillhub.cn/` 会调用 `shell.openExternal`。
- `file:///tmp/a`、`javascript:alert(1)`、空字符串被拒绝。
- service `stop()` 会移除 IPC handler。

### Task 2：补 UI 宿主能力 manager

文件：

- 新增 `packages/nextclaw-ui/src/shared/lib/host-capabilities/host-capability.manager.ts`
- 新增 `packages/nextclaw-ui/src/shared/lib/host-capabilities/host-capability.manager.test.ts`

验收：

- desktop bridge 存在时优先调用 bridge。
- bridge 不存在时 fallback 到 `window.open`。
- 非 http/https URL 不打开。

### Task 3：补 Marketplace 外部来源动作

文件：

- 新增 `packages/nextclaw-ui/src/features/marketplace/components/marketplace-external-skill-source-action.tsx`
- 修改 `packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.tsx`
- 修改 `packages/nextclaw-ui/src/shared/lib/i18n/marketplace-labels.utils.ts`
- 可选修改 `packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.test.tsx`

验收：

- Skill marketplace 的 tab 行最右侧展示 SkillHub 入口。
- 精选场景页不展示。
- 点击按钮调用 `hostCapabilityManager.openExternalUrl("https://skillhub.cn/")`。

### Task 4：迁移主 UI 现有外部打开入口

文件：

- 修改 `packages/nextclaw-ui/src/features/account/managers/account.manager.ts`
- 修改 `packages/nextclaw-ui/src/shared/components/config/provider-form.tsx`
- 修改 `packages/nextclaw-ui/src/features/system-status/components/desktop-update-config.tsx`

验收：

- 账号浏览器登录验证页仍可打开。
- provider device auth verification URI 仍可打开。
- runtime update release notes 仍可打开。
- 这些入口不再直接调用 `window.open`。

本期不迁移 `apps/platform-console/**`、`apps/platform-admin/**` 与 `apps/companion/**`。这些 app 与主 `packages/nextclaw-ui` / `apps/desktop` 不在同一个 bridge 运行面里；应在后续独立任务里决定是否引入同名 manager 或共享包，避免为了 SkillHub 把跨 app 架构一次性扩大。

## 验证命令

实现后建议跑：

```bash
pnpm --filter @nextclaw/desktop test -- desktop-host-capability.service.test.ts
pnpm --filter @nextclaw/ui test -- host-capability.manager.test.ts marketplace-page.test.tsx
pnpm --filter @nextclaw/desktop tsc
pnpm --filter @nextclaw/ui tsc
```

如果包名与当前 workspace filter 不一致，以 `package.json` 的实际 package name 为准。桌面端还需要手工冒烟：在本地桌面版 Marketplace 页面点击 `SkillHub`，确认系统默认浏览器打开 `https://skillhub.cn/`。

## 后续演进

只有当用户真实需要“一键安装 SkillHub skill”时，再进入下一阶段：

- 研究 SkillHub API 合同稳定性。
- 区分 NextClaw marketplace item 与外部来源 item。
- 增加外部来源 trust / preview / install confirmation。
- 决定是否支持把 SkillHub 的 `SKILL.md` 导入 NextClaw workspace。

在进入下一阶段前，不新增 SkillHub registry adapter，也不把 SkillHub 数据混进现有 marketplace catalog。
