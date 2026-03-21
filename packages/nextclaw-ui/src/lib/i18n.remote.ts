export const REMOTE_LABELS: Record<string, { zh: string; en: string }> = {
  remotePageTitle: { zh: '远程访问', en: 'Remote Access' },
  remotePageDescription: {
    zh: '只管理这台设备是否可在 NextClaw Web 中被查看和打开。',
    en: 'Manage whether this device can be viewed and opened in NextClaw Web.'
  },
  remoteOpenWeb: { zh: '前往 NextClaw Web', en: 'Open NextClaw Web' },
  remoteOpenWebHint: {
    zh: '开启后，这台设备会出现在 NextClaw Web 中，你可以在那里点击打开并继续使用。',
    en: 'Once enabled, this device appears in NextClaw Web, where you can open it and keep working.'
  },
  remoteOpenWebUnavailable: {
    zh: '暂时还没有可用的平台地址，请先完成登录。',
    en: 'No platform URL is available yet. Sign in first.'
  },
  remoteLoading: { zh: '正在加载远程访问状态...', en: 'Loading remote access status...' },
  remoteStatusNeedsSignIn: { zh: '先登录 NextClaw', en: 'Sign in to NextClaw first' },
  remoteStatusNeedsSignInDescription: {
    zh: '远程访问依赖 NextClaw 账号。登录后，这台设备才能和网页版关联起来。',
    en: 'Remote access depends on your NextClaw account. Sign in first to link this device to the web app.'
  },
  remoteStatusNeedsEnable: { zh: '还没有开启远程访问', en: 'Remote access is not enabled yet' },
  remoteStatusNeedsEnableDescription: {
    zh: '你已经登录 NextClaw。开启后，这台设备会出现在网页版的设备列表中。',
    en: 'You are already signed in. Enable remote access and this device will appear in your web device list.'
  },
  remoteStatusConnectingTitle: { zh: '正在把这台设备接入 NextClaw Web', en: 'Connecting this device to NextClaw Web' },
  remoteStatusConnectingDescription: {
    zh: '后台服务正在建立连接，几秒后刷新即可看到最新状态。',
    en: 'The managed service is establishing the connection. Refresh in a few seconds to see the latest state.'
  },
  remoteStatusReadyTitle: { zh: '这台设备已经可在网页中打开', en: 'This device is ready in the web app' },
  remoteStatusReadyDescription: {
    zh: '你现在可以前往 NextClaw Web，在设备列表中点击打开，继续这条 Agent 链路。',
    en: 'You can now open NextClaw Web, find this device in the list, and continue your agent workflow there.'
  },
  remoteStatusNeedsServiceTitle: { zh: '需要拉起后台服务', en: 'The managed service needs to run' },
  remoteStatusNeedsServiceDescription: {
    zh: '远程访问已经开启，但后台服务没有运行。拉起后才会真正连到网页版。',
    en: 'Remote access is enabled, but the managed service is not running yet. Start it to connect to the web app.'
  },
  remoteStatusIssueTitle: { zh: '远程连接当前有异常', en: 'The remote connection needs attention' },
  remoteStatusIssueDescription: {
    zh: '账号和设备配置都还在，但连接器当前没有稳定在线。你可以重新连接。',
    en: 'Your account and device settings are still there, but the connector is not stably online right now. Reconnect it.'
  },
  remoteSignInAndEnable: { zh: '登录并开启远程访问', en: 'Sign In and Enable Remote Access' },
  remoteEnableNow: { zh: '开启远程访问', en: 'Enable Remote Access' },
  remoteReconnectNow: { zh: '重新连接', en: 'Reconnect' },
  remoteDisable: { zh: '关闭远程访问', en: 'Disable Remote Access' },
  remoteDeviceSummaryTitle: { zh: '当前设备', en: 'This Device' },
  remoteDeviceSummaryDescription: {
    zh: '普通用户只需要关心账号、设备名、连接状态和网页版入口。',
    en: 'Users only need the account, device name, connection state, and web entry.'
  },
  remoteSignedInAccount: { zh: '当前账号', en: 'Signed-in Account' },
  remoteConnectionStatus: { zh: '连接状态', en: 'Connection Status' },
  remoteAdvancedTitle: { zh: '高级设置', en: 'Advanced Settings' },
  remoteAdvancedDescription: {
    zh: '只有在排查或自定义平台地址时，才需要打开这一层。',
    en: 'Only open this section when you need diagnostics or a custom platform API base.'
  },
  remoteAdvancedToggleOpen: { zh: '展开高级设置', en: 'Show Advanced Settings' },
  remoteAdvancedToggleClose: { zh: '收起高级设置', en: 'Hide Advanced Settings' },
  remoteAdvancedSaved: { zh: '高级设置已保存', en: 'Advanced settings saved' },
  remoteEnabledReady: { zh: '远程访问已开启，现在可以前往 NextClaw Web 使用', en: 'Remote access is enabled. You can now use NextClaw Web.' },
  remoteDisabledDone: { zh: '远程访问已关闭', en: 'Remote access is disabled' },
  remoteServiceRecovered: { zh: '后台服务已重新接上远程访问', en: 'The managed service is connected again' },
  remoteActionEnabling: { zh: '正在开启远程访问...', en: 'Enabling remote access...' },
  remoteActionDisabling: { zh: '正在关闭远程访问...', en: 'Disabling remote access...' },
  remoteActionSavingAdvanced: { zh: '正在保存高级设置...', en: 'Saving advanced settings...' },
  remoteActionStarting: { zh: '正在启动后台服务...', en: 'Starting the managed service...' },
  remoteActionRestarting: { zh: '正在重启后台服务...', en: 'Restarting the managed service...' },
  remoteActionStopping: { zh: '正在停止后台服务...', en: 'Stopping the managed service...' },
  remoteAccountEntryTitle: { zh: 'NextClaw 账号', en: 'NextClaw Account' },
  remoteAccountEntryDisconnected: { zh: '未登录，点击连接', en: 'Not signed in. Click to connect.' },
  remoteAccountEntryConnected: { zh: '已连接到 NextClaw', en: 'Connected to NextClaw' },
  accountPanelTitle: { zh: 'NextClaw 账号', en: 'NextClaw Account' },
  accountPanelDescription: {
    zh: '远程访问依赖这个账号登录。后续 token、授权和更多云端能力也会基于它展开。',
    en: 'Remote access depends on this account. Tokens, authorization, and future cloud capabilities will build on it.'
  },
  accountPanelSignedInTitle: { zh: '账号已连接', en: 'Account Connected' },
  accountPanelSignedInDescription: {
    zh: '这台设备已经和你的 NextClaw 账号关联，可以直接去网页版查看设备。',
    en: 'This device is linked to your NextClaw account. You can go to the web app and open the device there.'
  },
  accountPanelSignedOutTitle: { zh: '通过浏览器完成登录', en: 'Continue Sign-In in Your Browser' },
  accountPanelSignedOutDescription: {
    zh: '点击下方按钮后会打开 NextClaw 网页，在网页中登录或注册，当前设备会自动接入。',
    en: 'Click the button below to open NextClaw Web, sign in or create an account there, and this device will attach automatically.'
  },
  remoteOverviewTitle: { zh: '连接总览', en: 'Connection Overview' },
  remoteOverviewDescription: {
    zh: '快速确认平台账号、托管服务和远程连接器状态。',
    en: 'Quickly verify platform account, managed service, and connector state.'
  },
  remoteAccountConnected: { zh: '平台已登录', en: 'Platform Connected' },
  remoteAccountNotConnected: { zh: '平台未登录', en: 'Platform Not Connected' },
  remoteRuntimeMissing: { zh: '连接器未运行', en: 'Connector Not Running' },
  remoteStateConnected: { zh: '已连接', en: 'Connected' },
  remoteStateConnecting: { zh: '连接中', en: 'Connecting' },
  remoteStateError: { zh: '连接异常', en: 'Error' },
  remoteStateDisconnected: { zh: '已断开', en: 'Disconnected' },
  remoteStateDisabled: { zh: '未启用', en: 'Disabled' },
  remoteLocalOrigin: { zh: '本地服务地址', en: 'Local Origin' },
  remotePublicPlatform: { zh: '平台地址', en: 'Platform Base' },
  remoteDeviceId: { zh: '设备 ID', en: 'Device ID' },
  remoteRuntimeUpdatedAt: { zh: '状态更新时间', en: 'Status Updated At' },
  remoteLastConnectedAt: { zh: '上次连接时间', en: 'Last Connected At' },
  remoteLastError: { zh: '最近错误', en: 'Last Error' },
  remoteDeviceTitle: { zh: '设备配置', en: 'Device Settings' },
  remoteDeviceDescription: {
    zh: '保存远程访问开关、设备名和平台 API Base。',
    en: 'Save remote access state, device name, and platform API base.'
  },
  remoteEnabled: { zh: '启用远程访问', en: 'Enable Remote Access' },
  remoteEnabledHelp: {
    zh: '保存后需要启动或重启后台服务，新的远程配置才会真正生效。',
    en: 'After saving, start or restart the managed service to apply the new remote configuration.'
  },
  remoteDeviceName: { zh: '设备名称', en: 'Device Name' },
  remoteDeviceNamePlaceholder: { zh: '例如：PeideMacBook-Pro', en: 'For example: PeideMacBook-Pro' },
  remotePlatformApiBase: { zh: '平台 API Base', en: 'Platform API Base' },
  remotePlatformApiBaseHelp: {
    zh: '留空可回退到登录时写入的 providers.nextclaw.apiBase。',
    en: 'Leave empty to fall back to providers.nextclaw.apiBase saved at login time.'
  },
  remoteSaveSettings: { zh: '保存设置', en: 'Save Settings' },
  remoteSettingsSaved: { zh: '远程设置已保存', en: 'Remote settings saved' },
  remoteSettingsSaveFailed: { zh: '远程设置保存失败', en: 'Failed to save remote settings' },
  remoteSaveHint: {
    zh: '推荐流程：先保存设置，再启动或重启服务，最后运行诊断确认。',
    en: 'Recommended flow: save settings, start or restart the service, then run diagnostics.'
  },
  remoteAccountTitle: { zh: '平台账号', en: 'Platform Account' },
  remoteAccountDescription: {
    zh: '通过浏览器授权把当前设备安全连接到 NextClaw 平台。',
    en: 'Authorize this device in your browser and connect it to the NextClaw platform.'
  },
  remoteAccountEmail: { zh: '邮箱', en: 'Email' },
  remoteAccountRole: { zh: '角色', en: 'Role' },
  remoteApiBase: { zh: 'API Base', en: 'API Base' },
  remoteBrowserAuthTitle: { zh: '浏览器授权登录', en: 'Browser Authorization' },
  remoteBrowserAuthDescription: {
    zh: '点击后会打开平台授权页，在浏览器内登录或注册并授权当前设备。',
    en: 'Open the platform authorization page in your browser, then sign in or create an account there.'
  },
  remoteBrowserAuthAction: { zh: '前往浏览器授权', en: 'Continue in Browser' },
  remoteBrowserAuthActionRetry: { zh: '重新发起浏览器登录', en: 'Restart Browser Sign-In' },
  remoteBrowserAuthResume: { zh: '重新打开授权页', en: 'Reopen Authorization Page' },
  remoteBrowserAuthStarting: { zh: '正在创建授权会话...', en: 'Starting authorization...' },
  remoteBrowserAuthAuthorizing: { zh: '等待浏览器完成授权...', en: 'Waiting for browser authorization...' },
  remoteBrowserAuthWaiting: {
    zh: '浏览器授权页已打开。请在网页中完成登录或注册，然后此页面会自动接入。',
    en: 'The authorization page is open. Complete sign in or registration there and this page will connect automatically.'
  },
  remoteBrowserAuthCompleted: { zh: '浏览器授权完成，正在刷新登录状态。', en: 'Authorization completed. Refreshing account status.' },
  remoteBrowserAuthExpired: { zh: '授权会话已过期，请重新发起。', en: 'Authorization session expired. Start again.' },
  remoteBrowserAuthPopupBlocked: {
    zh: '浏览器没有自动打开，请点击“重新打开授权页”。',
    en: 'Your browser did not open automatically. Use "Reopen Authorization Page".'
  },
  remoteBrowserAuthSession: { zh: '授权会话', en: 'Auth Session' },
  remoteBrowserAuthExpiresAt: { zh: '授权过期时间', en: 'Auth Expires At' },
  remoteBrowserAuthHint: {
    zh: '如果你刚修改了上方 Platform API Base，建议先保存设置；未保存时当前页面也会沿用你输入的新地址发起授权。',
    en: 'If you just changed the Platform API Base above, saving settings is recommended. This page will still use the current value for browser authorization.'
  },
  remoteBrowserAuthStartFailed: { zh: '启动浏览器授权失败', en: 'Failed to start browser authorization' },
  remoteBrowserAuthPollFailed: { zh: '浏览器授权状态检查失败', en: 'Failed to check browser authorization status' },
  remoteEmail: { zh: '邮箱', en: 'Email' },
  remotePassword: { zh: '密码', en: 'Password' },
  remotePasswordPlaceholder: { zh: '请输入你的平台密码', en: 'Enter your platform password' },
  remoteRegisterIfNeeded: { zh: '如果账号不存在则注册', en: 'Register If Needed' },
  remoteRegisterIfNeededHelp: {
    zh: '开启后会走平台注册接口，然后自动保存登录态。',
    en: 'When enabled, the UI will register first and then save the resulting login token.'
  },
  remoteLogin: { zh: '登录平台', en: 'Login to Platform' },
  remoteCreateAccount: { zh: '注册并登录', en: 'Create Account & Login' },
  remoteLoggingIn: { zh: '登录中...', en: 'Logging in...' },
  remoteLoginSuccess: { zh: '平台登录成功', en: 'Platform login succeeded' },
  remoteLoginFailed: { zh: '平台登录失败', en: 'Platform login failed' },
  remoteLogout: { zh: '退出登录', en: 'Logout' },
  remoteLoggingOut: { zh: '退出中...', en: 'Logging out...' },
  remoteLogoutSuccess: { zh: '已退出平台登录', en: 'Logged out from platform' },
  remoteLogoutFailed: { zh: '退出登录失败', en: 'Failed to logout' },
  remoteServiceTitle: { zh: '后台服务', en: 'Managed Service' },
  remoteServiceDescription: {
    zh: '直接控制托管当前 UI 的后台服务。',
    en: 'Directly control the managed service that hosts the current UI.'
  },
  remoteServiceRunning: { zh: '服务运行中', en: 'Service Running' },
  remoteServiceManagedRunning: { zh: '当前就是托管服务', en: 'Current Managed Service' },
  remoteServiceStopped: { zh: '服务未运行', en: 'Service Stopped' },
  remoteServicePid: { zh: '进程 PID', en: 'Process PID' },
  remoteServiceUiUrl: { zh: 'UI 地址', en: 'UI URL' },
  remoteServiceCurrentProcess: { zh: '当前页面是否由该服务提供', en: 'Current Page Served By It' },
  remoteStartService: { zh: '启动服务', en: 'Start Service' },
  remoteRestartService: { zh: '重启服务', en: 'Restart Service' },
  remoteStopService: { zh: '停止服务', en: 'Stop Service' },
  remoteServiceHint: {
    zh: '如果当前页面本身就是托管服务，停止或重启时页面会短暂断开，这是预期行为。',
    en: 'If this page is served by the managed service itself, stop/restart may briefly disconnect the page.'
  },
  remoteServiceActionFailed: { zh: '服务操作失败', en: 'Service action failed' },
  remoteDoctorTitle: { zh: '远程诊断', en: 'Remote Diagnostics' },
  remoteDoctorDescription: {
    zh: '检查开关、平台登录、本地 UI 健康和连接器状态。',
    en: 'Check config state, platform login, local UI health, and connector status.'
  },
  remoteRunDoctor: { zh: '运行诊断', en: 'Run Diagnostics' },
  remoteDoctorRunning: { zh: '诊断中...', en: 'Running diagnostics...' },
  remoteDoctorCompleted: { zh: '诊断完成', en: 'Diagnostics completed' },
  remoteDoctorFailed: { zh: '诊断失败', en: 'Diagnostics failed' },
  remoteDoctorGeneratedAt: { zh: '生成时间', en: 'Generated At' },
  remoteDoctorEmpty: { zh: '点击上方按钮运行一次诊断。', en: 'Run diagnostics to see the latest checks here.' },
  remoteCheckPassed: { zh: '通过', en: 'Passed' },
  remoteCheckFailed: { zh: '失败', en: 'Failed' },
  connected: { zh: '已连接', en: 'Connected' },
  disconnected: { zh: '未连接', en: 'Disconnected' },
  connecting: { zh: '连接中...', en: 'Connecting...' },
  feishuConnecting: { zh: '验证 / 连接中...', en: 'Verifying / connecting...' },
  statusReady: { zh: '就绪', en: 'Ready' },
  statusSetup: { zh: '待配置', en: 'Setup' },
  statusActive: { zh: '活跃', en: 'Active' },
  statusInactive: { zh: '未启用', en: 'Inactive' }
};
