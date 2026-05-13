export const DESKTOP_UPDATE_LABELS: Record<string, { zh: string; en: string }> = {
  updates: { zh: '更新', en: 'Updates' },
  runtimeUpdatesPageTitle: { zh: '版本更新', en: 'Runtime Updates' },
  runtimeUpdatesPageDescription: {
    zh: '自动检查并后台下载新版本，由你决定何时切换到新的运行版本。',
    en: 'Check and download new versions automatically, then decide when to switch to the new runtime.'
  },
  runtimeUpdatesUnavailableTitle: { zh: '当前环境暂不支持更新', en: 'Updates Are Currently Unavailable' },
  runtimeUpdatesUnavailableDescription: {
    zh: '这个运行环境暂时没有可用的更新宿主。',
    en: 'This runtime environment does not currently expose an update host.'
  },
  runtimeUpdatesUnavailableHint: {
    zh: '更新入口会在宿主支持后自动出现，不需要前端单独区分环境。',
    en: 'The update entry appears automatically once the host supports updates.'
  },
  runtimeUpdatesHostVersion: { zh: '宿主版本', en: 'Host Version' },
  runtimeUpdatesDownloadedBannerDescription: {
    zh: '版本 {version} 已下载完成，确认后即可切换到新版本。',
    en: 'Version {version} has finished downloading and is ready to switch over when you confirm.'
  },
  runtimeUpdatesActionsDescription: {
    zh: '支持手动检查、手动下载，以及在你准备好之后切换到已下载的新版本。',
    en: 'Manually check, manually download, and switch to a downloaded version whenever you are ready.'
  },
  runtimeUpdatesApplyNow: { zh: '立即更新', en: 'Update Now' },
  runtimeUpdatesLoadFailed: { zh: '读取更新状态失败', en: 'Failed to load update state' },
  runtimeUpdatesCheckFailed: { zh: '检查更新失败', en: 'Failed to check for updates' },
  runtimeUpdatesDownloadFailed: { zh: '下载更新失败', en: 'Failed to download update' },
  runtimeUpdatesApplyFailed: { zh: '应用更新失败', en: 'Failed to apply update' },
  runtimeUpdatesPreferencesFailed: { zh: '保存更新偏好失败', en: 'Failed to save update preferences' },
  runtimeUpdatesChannelChangeFailed: { zh: '切换更新通道失败', en: 'Failed to change the release channel' },
  runtimeUpdatesAlreadyLatest: { zh: '当前已经是最新版本。', en: 'You already have the latest version.' },
  runtimeUpdatesReadyToApply: { zh: '更新已下载完成，已经可以切换到新版本。', en: 'The update is ready and can be applied now.' },
  runtimeUpdatesAvailable: { zh: '发现新版本 {version}。', en: 'Version {version} is available.' },
  runtimeUpdatesUnknownVersion: { zh: '新版本', en: 'a new version' },
  runtimeUpdatesChannelChanged: {
    zh: '已切换到 {channel} 更新通道。',
    en: 'Switched to the {channel} release channel.'
  },
  runtimeUpdatesChannelChangedWithUpdate: {
    zh: '已切换到 {channel} 通道，发现版本 {version}。',
    en: 'Switched to the {channel} channel and found version {version}.'
  },
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
  desktopUpdatesStatusBlocked: { zh: '更新被阻塞', en: 'Blocked' },
  desktopUpdatesStatusFailed: { zh: '更新失败', en: 'Failed' },
  desktopUpdatesInlineDownload: { zh: '下载', en: 'Download' },
  desktopUpdatesInlineDownloading: { zh: '下载中', en: 'Downloading' },
  desktopUpdatesInlineDownloadingPercent: { zh: '下载 {percent}%', en: '{percent}%' },
  desktopUpdatesInlineReady: { zh: '更新', en: 'Update' },
  desktopUpdatesInlineApplying: { zh: '应用中', en: 'Applying' },
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
  desktopUpdatesDownloadProgressPercent: {
    zh: '正在下载 {percent}%',
    en: 'Downloading {percent}%'
  },
  desktopUpdatesDownloadProgressUnknown: {
    zh: '正在下载',
    en: 'Downloading'
  },
  desktopUpdatesBlockedTitle: {
    zh: '更新暂时无法继续',
    en: 'Update Blocked'
  },
  desktopUpdatesBlockedDescription: {
    zh: '当前安装环境需要先处理阻塞项，之后才能继续更新。',
    en: 'Resolve the current installation requirement before continuing the update.'
  },
  'desktopUpdatesBlockedRootCause.signature-verification-unavailable': { zh: '根因：缺少更新签名公钥，无法验证更新包来源；请安装包含正确更新配置的新版本，或由维护者配置更新公钥。', en: 'Root cause: missing update public key; install a configured build or ask the maintainer to set the key.' },
  'desktopUpdatesBlockedRootCause.host-too-old': { zh: '根因：当前宿主版本太旧，不满足新运行包的最低宿主版本要求；请先升级 NextClaw 启动器。', en: 'Root cause: the host is too old for this runtime bundle; upgrade the NextClaw launcher first.' },
  'desktopUpdatesBlockedRootCause.unsupported-installation': { zh: '根因：当前安装形态或更新源配置不支持自动更新；请安装支持自动更新的版本，或由维护者补齐更新源配置。', en: 'Root cause: this installation or update source does not support auto-update; use a configured build.' },
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
