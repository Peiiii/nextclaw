export const DESKTOP_UPDATE_LABELS: Record<string, { zh: string; en: string }> = {
  updates: { zh: '更新', en: 'Updates' },
  desktopUpdatesPageTitle: { zh: '桌面端更新', en: 'Desktop Updates' },
  desktopUpdatesPageDescription: {
    zh: '在应用内检查、下载并决定何时应用新的桌面端版本。',
    en: 'Check, download, and decide when to apply new desktop versions without leaving the app.'
  },
  desktopUpdatesDesktopOnlyTitle: { zh: '当前仅桌面端可用', en: 'Currently Desktop Only' },
  desktopUpdatesDesktopOnlyDescription: {
    zh: '这个页面暂时只在 NextClaw Desktop 中可用。',
    en: 'This page is currently only available inside NextClaw Desktop.'
  },
  desktopUpdatesDesktopOnlyFutureHint: {
    zh: '网页端与其他产品形态的更新体验还在继续完善，敬请期待。',
    en: 'Update experiences for the web and other product surfaces are still being built. Stay tuned.'
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
  desktopUpdatesCurrentBundleVersion: { zh: '当前内核版本', en: 'Current Kernel Version' },
  desktopUpdatesAvailableVersion: { zh: '可用版本', en: 'Available Version' },
  desktopUpdatesLastCheckedAt: { zh: '上次检查时间', en: 'Last Checked' },
  desktopUpdatesCurrentChannel: { zh: '当前更新通道', en: 'Current Release Channel' },
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
  desktopUpdatesReleaseChannel: { zh: '更新通道', en: 'Release Channel' },
  desktopUpdatesReleaseChannelHelp: {
    zh: 'Stable 面向日常主力使用；Beta 用于提前体验新版本，但可能更不稳定。',
    en: 'Stable is for everyday use, while Beta lets you try newer builds earlier with more risk.'
  },
  desktopUpdatesReleaseChannelDowngradeHint: {
    zh: '切回 Stable 后不会立刻强制降级；只有当 Stable 追平或超过当前版本时，才会继续提供 Stable 更新。',
    en: 'Switching back to Stable does not force an immediate downgrade. Stable updates resume once that channel catches up with or exceeds your current version.'
  },
  desktopUpdatesChannelStable: { zh: 'Stable', en: 'Stable' },
  desktopUpdatesChannelBeta: { zh: 'Beta', en: 'Beta' },
  desktopUpdatesBetaBadgeTitle: { zh: '当前正在跟随 Beta 通道', en: 'Following the Beta Channel' },
  desktopUpdatesBetaBadgeDescription: {
    zh: '你会更早收到新版本，但也可能遇到更多变动和回归。',
    en: 'You will receive new versions earlier, but you may also encounter more change and regression risk.'
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
  desktopUpdatesChannelChangeFailed: { zh: '切换更新通道失败', en: 'Failed to change the release channel' },
  desktopUpdatesAlreadyLatest: { zh: '当前已经是最新版本。', en: 'You already have the latest version.' },
  desktopUpdatesReadyToApply: { zh: '更新已下载完成，可以在方便的时候重启应用。', en: 'The update is ready. Restart the app whenever you want to apply it.' },
  desktopUpdatesAvailable: { zh: '发现新版本 {version}。', en: 'Version {version} is available.' },
  desktopUpdatesUnknownVersion: { zh: '新版本', en: 'a new version' },
  desktopUpdatesChannelChanged: {
    zh: '已切换到 {channel} 更新通道。',
    en: 'Switched to the {channel} release channel.'
  },
  desktopUpdatesChannelChangedWithUpdate: {
    zh: '已切换到 {channel} 通道，发现版本 {version}。',
    en: 'Switched to the {channel} channel and found version {version}.'
  }
};
