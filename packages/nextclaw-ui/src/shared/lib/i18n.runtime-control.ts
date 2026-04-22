export const RUNTIME_CONTROL_LABELS: Record<string, { zh: string; en: string }> = {
  runtimePageTitle: { zh: '路由与运行时', en: 'Routing & Runtime' },
  runtimePageDescription: {
    zh: '对齐 OpenClaw 的多 Agent 路由：绑定规则、Agent 池、私聊范围。',
    en: 'Align multi-agent routing with OpenClaw: bindings, agent pool, and DM scope.'
  },
  runtimeLoading: { zh: '加载运行时配置中...', en: 'Loading runtime settings...' },
  runtimeControlTitle: { zh: '服务管理', en: 'Service Management' },
  runtimeControlDescription: {
    zh: '明确当前服务状态，并在宿主允许的范围内执行启动、重启、停止或桌面应用重启。',
    en: 'Make the current service state explicit and manage start, restart, stop, or full desktop app restart when the host allows it.'
  },
  runtimePresenceTitle: { zh: '运行形态与常驻', en: 'Presence & Lifecycle' },
  runtimePresenceDescription: {
    zh: '明确当前环境里“关闭窗口/页面”会发生什么，以及哪些后台能力由宿主层负责。',
    en: 'Make the current environment explicit: what happens when the window or page closes, and which background behaviors belong to the host.'
  },
  runtimePresenceLoading: { zh: '正在读取常驻状态...', en: 'Loading presence settings...' },
  runtimePresenceLoadFailed: { zh: '读取桌面端常驻状态失败', en: 'Failed to load desktop presence settings' },
  runtimePresenceBehaviorLabel: { zh: '当前关闭行为', en: 'Current Close Behavior' },
  runtimePresenceBehaviorBackground: { zh: '关闭窗口时隐藏到后台', en: 'Closing the window hides it to the background' },
  runtimePresenceBehaviorQuit: { zh: '关闭窗口时退出应用', en: 'Closing the window quits the app' },
  runtimePresenceCloseToBackground: { zh: '关闭窗口时继续在后台运行', en: 'Keep running in background when closing the window' },
  runtimePresenceCloseToBackgroundHelp: {
    zh: '开启后，关闭桌面窗口只会隐藏到托盘，不会停止本地 NextClaw 服务。',
    en: 'When enabled, closing the desktop window hides it to the tray instead of stopping the local NextClaw service.'
  },
  runtimePresenceLaunchAtLogin: { zh: '登录系统时自动启动 NextClaw', en: 'Launch NextClaw at login' },
  runtimePresenceLaunchAtLoginHelp: {
    zh: '开启后，桌面端会在登录系统后自动启动，并默认保持后台运行。',
    en: 'When enabled, the desktop app starts automatically after login and stays in the background by default.'
  },
  runtimePresenceLaunchAtLoginUnavailable: {
    zh: '当前环境暂不支持在这里配置开机自启。',
    en: 'Launch-at-login is not configurable in this environment yet.'
  },
  runtimePresenceSaved: { zh: '桌面端常驻设置已保存', en: 'Desktop presence settings saved' },
  runtimePresenceSaveFailed: { zh: '保存桌面端常驻设置失败', en: 'Failed to save desktop presence settings' },
  runtimePresenceManagedLocalTitle: { zh: '浏览器只是本地服务控制面', en: 'The browser is only a control surface for the local service' },
  runtimePresenceManagedLocalDescription: {
    zh: '关闭浏览器标签页不会停止本地 NextClaw 服务。服务生命周期由本地受管服务负责，而不是由页面生命周期决定。',
    en: 'Closing the browser tab does not stop the local NextClaw service. The local managed service owns the lifecycle, not the page.'
  },
  runtimePresenceSelfHostedTitle: { zh: '页面不拥有自托管服务生命周期', en: 'The page does not own the self-hosted service lifecycle' },
  runtimePresenceSelfHostedDescription: {
    zh: '关闭浏览器页面不会影响自托管实例。服务启停和开机常驻应由宿主环境或部署层管理。',
    en: 'Closing the browser page does not affect the self-hosted instance. Service start, stop, and auto-start belong to the host environment or deployment layer.'
  },
  runtimePresenceSharedTitle: { zh: '共享网页端只暴露状态，不暴露进程控制', en: 'Shared web exposes service state, not process ownership' },
  runtimePresenceSharedDescription: {
    zh: '关闭页面只会结束当前连接或会话，不会影响共享服务本体。服务生命周期由平台托管层负责。',
    en: 'Closing the page only ends the current connection or session, not the shared service itself. The platform owns the lifecycle.'
  },
  runtimeControlLoading: { zh: '读取运行时控制能力中...', en: 'Loading runtime control capabilities...' },
  runtimeControlLoadFailed: { zh: '读取运行时控制状态失败', en: 'Failed to load runtime control state' },
  runtimeControlServiceRunning: { zh: '服务运行中', en: 'Service running' },
  runtimeControlServiceStopped: { zh: '服务已停止', en: 'Service stopped' },
  runtimeControlServiceStarting: { zh: '正在启动服务', en: 'Starting service' },
  runtimeControlServiceStopping: { zh: '正在停止服务', en: 'Stopping service' },
  runtimeControlServiceRestarting: { zh: '正在重启服务', en: 'Restarting service' },
  runtimeControlServiceUnknown: { zh: '服务状态未知', en: 'Service state unknown' },
  runtimeControlHealthy: { zh: '运行时正常', en: 'Runtime healthy' },
  runtimeControlStartingService: { zh: '正在启动服务', en: 'Starting service' },
  runtimeControlRestartingService: { zh: '正在重启服务', en: 'Restarting service' },
  runtimeControlStoppingService: { zh: '正在停止服务', en: 'Stopping service' },
  runtimeControlRestartingApp: { zh: '正在重启应用', en: 'Restarting app' },
  runtimeControlRecovering: { zh: '正在恢复连接', en: 'Recovering connection' },
  runtimeControlFailed: { zh: '重启失败', en: 'Restart failed' },
  runtimeControlUnavailable: { zh: '当前不可用', en: 'Currently unavailable' },
  runtimeControlEnvironmentDesktop: { zh: '桌面端内嵌运行时', en: 'Desktop embedded runtime' },
  runtimeControlEnvironmentManagedService: { zh: '本地托管服务', en: 'Managed local service' },
  runtimeControlEnvironmentSelfHosted: { zh: '自托管网页端', en: 'Self-hosted web' },
  runtimeControlEnvironmentSharedWeb: { zh: '共享网页端', en: 'Shared web' },
  runtimeControlStartService: { zh: '启动服务', en: 'Start Service' },
  runtimeControlRestartService: { zh: '重启服务', en: 'Restart Service' },
  runtimeControlStopService: { zh: '停止服务', en: 'Stop Service' },
  runtimeControlRestartApp: { zh: '重启应用', en: 'Restart App' },
  runtimeControlPendingRestartTitle: { zh: '待重启', en: 'Pending Restart' },
  runtimeControlPendingRestartDescription: {
    zh: '这次改动已经保存，但系统不会自动重启。请在你方便的时候手动重启，重启完成后该提示会自动清空。',
    en: 'These changes are saved, but the system will not restart automatically. Restart manually when you are ready, and this notice clears after the restart finishes.'
  },
  runtimeControlPendingRestartPaths: { zh: '待生效项', en: 'Changes Waiting For Restart' },
  runtimeStatusLoadingTitle: { zh: '读取状态中', en: 'Loading status' },
  runtimeStatusLoadingDescription: {
    zh: '正在读取当前系统状态。',
    en: 'Loading the current system status.'
  },
  runtimeStatusHealthyTitle: { zh: '系统正常', en: 'System healthy' },
  runtimeStatusHealthyDescription: {
    zh: '当前没有需要你立即处理的系统动作。',
    en: 'There is no system action that needs your attention right now.'
  },
  runtimeStatusPendingRestartTitle: { zh: '待重启', en: 'Restart required' },
  runtimeStatusPendingRestartDescription: {
    zh: '这些改动已经保存，但不会自动重启。你可以在这里查看原因，并在方便的时候手动重启。',
    en: 'These changes are saved, but the system will not restart automatically. Review the reason here and restart when you are ready.'
  },
  runtimeStatusPendingRestartReasonItem: {
    zh: '{path} 改动将在重启后生效。',
    en: 'Changes in {path} will apply after restart.'
  },
  runtimeStatusActionHint: {
    zh: '准备好时再执行',
    en: 'Run when you are ready'
  },
  runtimeStatusRestartAction: { zh: '立即重启', en: 'Restart now' },
  runtimeStatusRestartingAction: { zh: '重启中...', en: 'Restarting...' },
  runtimeControlStartingServiceHelp: {
    zh: '正在启动 NextClaw 服务，页面可能会在服务恢复后重新连接。',
    en: 'Starting the NextClaw service. The page may reconnect after the service becomes available.'
  },
  runtimeControlRestartingServiceHelp: {
    zh: '正在重启 NextClaw 服务，页面可能会短暂断开。',
    en: 'Restarting the NextClaw service. The page may disconnect briefly.'
  },
  runtimeControlStoppingServiceHelp: {
    zh: '正在停止 NextClaw 服务，当前页面会很快断开。',
    en: 'Stopping the NextClaw service. This page will disconnect shortly.'
  },
  runtimeControlRestartingAppHelp: {
    zh: '正在重新启动桌面应用，当前窗口会短暂关闭并立即拉起。',
    en: 'Restarting the desktop app. The current window will close briefly and relaunch.'
  },
  runtimeControlRecoveringHelp: {
    zh: '正在等待服务恢复连接...',
    en: 'Waiting for the service to come back...'
  },
  runtimeControlRecovered: { zh: '运行时已恢复连接', en: 'Runtime connection restored' },
  runtimeControlActionFailed: { zh: '服务管理动作失败', en: 'Service management action failed' },
  runtimeControlRestartAppConfirm: {
    zh: '这会重启整个 NextClaw 桌面应用，并中断当前窗口。确定继续吗？',
    en: 'This restarts the entire NextClaw desktop app and interrupts the current window. Continue?'
  },
  runtimeControlStopServiceConfirm: {
    zh: '这会停止当前 NextClaw 服务，当前页面会立即断开。确定继续吗？',
    en: 'This stops the current NextClaw service and disconnects the page immediately. Continue?'
  },
  runtimeRestartAppUnavailable: {
    zh: '当前环境不支持从前端重启整个应用。',
    en: 'This environment does not support restarting the entire app from the UI.'
  },
  runtimeControlDesktopServiceHint: {
    zh: '桌面端由 Launcher 持有应用生命周期；普通用户无需单独停止内嵌服务。',
    en: 'The desktop launcher owns the app lifecycle, so end users do not stop the embedded service separately.'
  },
  runtimeRecoveryTimedOut: {
    zh: '等待运行时恢复超时，请稍后重试或查看日志。',
    en: 'Timed out waiting for the runtime to recover. Try again or inspect the logs.'
  }
};
