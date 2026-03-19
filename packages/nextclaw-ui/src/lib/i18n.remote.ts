export const REMOTE_LABELS: Record<string, { zh: string; en: string }> = {
  remotePageTitle: { zh: '远程访问', en: 'Remote Access' },
  remotePageDescription: {
    zh: '直接在界面内完成平台登录、设备配置、后台服务控制与诊断。',
    en: 'Handle platform login, device settings, managed service control, and diagnostics directly in the UI.'
  },
  remoteLoading: { zh: '正在加载远程访问状态...', en: 'Loading remote access status...' },
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
    zh: '在界面内登录或注册 NextClaw 平台账号。',
    en: 'Log in or register your NextClaw platform account inside the UI.'
  },
  remoteAccountEmail: { zh: '邮箱', en: 'Email' },
  remoteAccountRole: { zh: '角色', en: 'Role' },
  remoteApiBase: { zh: 'API Base', en: 'API Base' },
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
