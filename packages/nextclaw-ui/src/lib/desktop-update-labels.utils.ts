export const DESKTOP_UPDATE_LABELS: Record<string, { zh: string; en: string }> = {
  updates: { zh: '更新', en: 'Updates' },
  desktopUpdatesPageTitle: { zh: '桌面端更新', en: 'Desktop Updates' },
  desktopUpdatesPageDescription: {
    zh: '在应用内检查、下载并决定何时应用新的桌面端版本。',
    en: 'Check, download, and decide when to apply new desktop versions without leaving the app.'
  },
  desktopUpdatesDesktopOnlyTitle: { zh: '仅桌面端可用', en: 'Desktop Only' },
  desktopUpdatesDesktopOnlyDescription: {
    zh: '这个页面只在 NextClaw Desktop 中可用。',
    en: 'This page is only available inside NextClaw Desktop.'
  },
  desktopUpdatesOverviewTitle: { zh: '当前状态', en: 'Current Status' },
  desktopUpdatesOverviewDescription: {
    zh: '查看当前已运行版本、可用版本和最近一次检查结果。',
    en: 'Review the running version, the available version, and the latest check result.'
  },
  desktopUpdatesStatusLabel: { zh: '更新状态', en: 'Update Status' },
  desktopUpdatesStatusIdle: { zh: '待命', en: 'Idle' },
  desktopUpdatesStatusChecking: { zh: '检查中', en: 'Checking' },
  desktopUpdatesStatusAvailable: { zh: '有可用更新', en: 'Update Available' },
  desktopUpdatesStatusDownloading: { zh: '下载中', en: 'Downloading' },
  desktopUpdatesStatusDownloaded: { zh: '已下载待应用', en: 'Downloaded' },
  desktopUpdatesStatusUpToDate: { zh: '已是最新', en: 'Up to Date' },
  desktopUpdatesStatusFailed: { zh: '更新失败', en: 'Failed' },
  desktopUpdatesLauncherVersion: { zh: '桌面壳版本', en: 'Launcher Version' },
  desktopUpdatesCurrentBundleVersion: { zh: '当前产品版本', en: 'Current Product Version' },
  desktopUpdatesAvailableVersion: { zh: '可用版本', en: 'Available Version' },
  desktopUpdatesLastCheckedAt: { zh: '上次检查时间', en: 'Last Checked' },
  desktopUpdatesDownloadedBannerTitle: { zh: '更新已就绪', en: 'Update Ready' },
  desktopUpdatesDownloadedBannerDescription: {
    zh: '版本 {version} 已下载完成，等你确认后即可重启应用并完成更新。',
    en: 'Version {version} is ready. Restart the app whenever you want to apply it.'
  },
  desktopUpdatesPreferencesTitle: { zh: '更新偏好', en: 'Update Preferences' },
  desktopUpdatesPreferencesDescription: {
    zh: '默认自动检查更新，但是否后台下载由你决定。',
    en: 'Automatic checks stay on by default, while background download remains under your control.'
  },
  desktopUpdatesAutomaticChecks: { zh: '自动检查更新', en: 'Automatic Update Checks' },
  desktopUpdatesAutomaticChecksHelp: {
    zh: '启动应用后自动检查是否有新版本。',
    en: 'Check for new versions automatically after the app starts.'
  },
  desktopUpdatesAutoDownload: { zh: '发现更新后自动后台下载', en: 'Auto Download in Background' },
  desktopUpdatesAutoDownloadHelp: {
    zh: '检查到更新后自动把新版本下载到本地，但仍由你决定何时应用。',
    en: 'Download new versions automatically after detection, while still letting you decide when to apply them.'
  },
  desktopUpdatesActionsTitle: { zh: '更新操作', en: 'Update Actions' },
  desktopUpdatesActionsDescription: {
    zh: '支持手动检查、手动下载，以及在你准备好之后重启应用完成更新。',
    en: 'Manually check, manually download, and restart the app when you are ready to finish the update.'
  },
  desktopUpdatesCheckNow: { zh: '检查更新', en: 'Check for Updates' },
  desktopUpdatesDownloadNow: { zh: '下载更新', en: 'Download Update' },
  desktopUpdatesApplyNow: { zh: '立即重启更新', en: 'Restart to Update' },
  desktopUpdatesReleaseNotes: { zh: '查看更新说明', en: 'Release Notes' },
  desktopUpdatesLoadFailed: { zh: '读取更新状态失败', en: 'Failed to load update state' },
  desktopUpdatesCheckFailed: { zh: '检查更新失败', en: 'Failed to check for updates' },
  desktopUpdatesDownloadFailed: { zh: '下载更新失败', en: 'Failed to download update' },
  desktopUpdatesApplyFailed: { zh: '应用更新失败', en: 'Failed to apply update' },
  desktopUpdatesPreferencesFailed: { zh: '保存更新偏好失败', en: 'Failed to save update preferences' },
  desktopUpdatesAlreadyLatest: { zh: '当前已经是最新版本。', en: 'You already have the latest version.' },
  desktopUpdatesReadyToApply: { zh: '更新已下载完成，可以在方便的时候重启应用。', en: 'The update is ready. Restart the app whenever you want to apply it.' },
  desktopUpdatesAvailable: { zh: '发现新版本 {version}。', en: 'Version {version} is available.' },
  desktopUpdatesUnknownVersion: { zh: '新版本', en: 'a new version' }
};
