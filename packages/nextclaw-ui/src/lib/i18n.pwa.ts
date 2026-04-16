export const PWA_LABELS: Record<string, { zh: string; en: string }> = {
  pwaInstallTitle: { zh: '安装为应用', en: 'Install as App' },
  pwaInstallDescription: {
    zh: '把当前 NextClaw UI 安装为独立入口，方便从桌面、启动器或任务栏直接打开。',
    en: 'Install this NextClaw UI as a standalone entry point you can launch from your desktop, launcher, or dock.'
  },
  pwaInstallAction: { zh: '安装 NextClaw', en: 'Install NextClaw' },
  pwaInstallDismiss: { zh: '不再提示', en: "Don't Ask Again" },
  pwaInstallAccepted: { zh: '已打开安装面板。', en: 'Install prompt opened.' },
  pwaInstalledToast: { zh: 'NextClaw 已安装为应用入口。', en: 'NextClaw is now installed as an app.' },
  pwaInstallStatusAvailable: { zh: '可安装', en: 'Installable' },
  pwaInstallStatusInstalled: { zh: '已安装', en: 'Installed' },
  pwaInstallStatusDesktopHost: { zh: '桌面宿主已接管', en: 'Desktop Host Active' },
  pwaInstallStatusUnavailable: { zh: '当前不可安装', en: 'Unavailable' },
  pwaInstallCardPrompt: {
    zh: '当前浏览器已经准备好安装面板。安装后，NextClaw 会以独立窗口形态打开，但仍沿用同一套 Web UI 和运行时连接逻辑。',
    en: 'Your browser is ready to install NextClaw. Once installed, it opens in a standalone window while keeping the same Web UI and runtime behavior.'
  },
  pwaInstallCardManual: {
    zh: '当前环境支持把 NextClaw 安装为应用，但浏览器没有提供即时安装弹窗。你仍可通过浏览器菜单中的“安装应用”或“添加到主屏幕”完成安装。',
    en: 'This environment can install NextClaw as an app, but the browser did not expose an immediate install prompt. Use your browser menu to install or add it to the home screen.'
  },
  pwaInstallCardInstalled: {
    zh: '当前已经以应用形态运行。浏览器访问与已安装形态共用同一套 NextClaw UI，不会分叉成第二套产品逻辑。',
    en: 'NextClaw is already running as an installed app. Browser access and the installed experience share the same UI and product behavior.'
  },
  pwaInstallCardSuppressed: {
    zh: '当前 UI 已运行在 Electron 桌面宿主中，原生桌面壳优先于 PWA 入口，因此这里不会继续展示安装入口。',
    en: 'This UI is already running inside the Electron desktop host. The native desktop shell takes priority, so the PWA install entry stays hidden here.'
  },
  pwaInstallCardInsecureContext: {
    zh: '当前地址不是浏览器允许安装 PWA 的安全上下文。请使用 `localhost`、`127.0.0.1` 或 HTTPS 域名访问。',
    en: 'This address is not a secure context for browser-managed app installation. Use localhost, 127.0.0.1, or an HTTPS origin instead.'
  },
  pwaInstallCardDevServer: {
    zh: '当前是 Vite 开发环境。为避免 service worker 缓存和 HMR 热更新互相干扰，开发态默认关闭 PWA 安装与更新能力；请使用 preview 或正式构建验证 PWA。',
    en: 'This is the Vite development server. PWA install and update are disabled in dev to avoid service worker caching conflicts with HMR; use preview or a production build to verify the PWA.'
  },
  pwaInstallCardUnsupported: {
    zh: '当前浏览器环境不支持这套安装能力，或缺少 PWA 所需的关键运行能力。',
    en: 'This browser environment does not support the required installation capabilities for this PWA shell.'
  },
  pwaInstallPromptHint: {
    zh: '安装后仍然连接当前本地或远端 NextClaw 服务，不会额外生成一套离线副本。',
    en: 'The installed app still connects to the same local or remote NextClaw service instead of creating an offline copy.'
  },
  pwaInstallManualHint: {
    zh: '如果浏览器没有弹出安装面板，请打开浏览器菜单，选择“安装应用”“安装此站点”或“添加到主屏幕”等同类入口。',
    en: 'If the browser does not show an install prompt, open the browser menu and look for actions such as Install App, Install Site, or Add to Home Screen.'
  },
  pwaInstallBannerTitle: { zh: '把 NextClaw 固定成桌面入口', en: 'Pin NextClaw as an App' },
  pwaInstallBannerDescription: {
    zh: '当前站点已经满足安装条件。安装后你可以像打开普通应用一样直接进入 NextClaw。',
    en: 'This site is ready to install. Once installed, you can launch NextClaw like a regular app.'
  },
  pwaUpdateBannerTitle: { zh: 'NextClaw 已准备好更新', en: 'NextClaw Update Ready' },
  pwaUpdateBannerDescription: {
    zh: '检测到新的 PWA 壳版本，刷新后即可切换到最新 UI 资源。',
    en: 'A newer PWA shell version is ready. Refresh to switch to the latest UI assets.'
  },
  pwaUpdateAction: { zh: '刷新更新', en: 'Refresh Now' }
};
