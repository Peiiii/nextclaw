export const CHANNEL_AUTH_LABELS: Record<string, { zh: string; en: string }> = {
  weixinAuthTitle: { zh: '扫码连接微信', en: 'Connect Weixin by QR' },
  weixinAuthDescription: { zh: '微信渠道现在以扫码连接为主流程。', en: 'Weixin now uses QR login as the primary setup flow.' },
  weixinAuthHint: {
    zh: '通常只需要点击按钮并扫码确认，连接成功后会自动写入配置。',
    en: 'In most cases you only need to start the flow, scan the QR code, and confirm on your phone. The config will be saved automatically.'
  },
  weixinAuthCapabilityHint: {
    zh: '连接成功后，Agent 可以通过微信渠道向已知微信用户主动发消息。',
    en: 'After connecting, the agent can proactively message known Weixin users through this channel.'
  },
  weixinAuthPrimaryAccount: { zh: '当前默认账号', en: 'Current default account' },
  weixinAuthConnectedAccounts: { zh: '已连接账号', en: 'Connected accounts' },
  weixinAuthBaseUrl: { zh: '当前接口地址', en: 'Current API base URL' },
  weixinAuthConnect: { zh: '扫码连接微信', en: 'Scan QR to connect Weixin' },
  weixinAuthReconnect: { zh: '重新扫码连接', en: 'Reconnect with QR' },
  weixinAuthStarting: { zh: '正在生成二维码...', en: 'Generating QR code...' },
  weixinAuthWaiting: { zh: '等待扫码确认', en: 'Waiting for scan confirmation' },
  weixinAuthScanned: { zh: '已扫码，等待确认', en: 'Scanned, waiting for confirmation' },
  weixinAuthAuthorized: { zh: '已连接', en: 'Connected' },
  weixinAuthNotConnected: { zh: '未连接', en: 'Not connected' },
  weixinAuthRetryRequired: { zh: '二维码已失效，请重新扫码。', en: 'QR session expired. Please start again.' },
  weixinAuthQrAlt: { zh: '微信登录二维码', en: 'Weixin login QR code' },
  weixinAuthScanPrompt: { zh: '请用微信扫码，并在手机上确认登录。', en: 'Scan with Weixin and confirm the login on your phone.' },
  weixinAuthExpiresAt: { zh: '二维码过期时间', en: 'QR expires at' },
  weixinAuthOpenQr: { zh: '新窗口打开二维码', en: 'Open QR code in new tab' },
  weixinAuthReadyTitle: { zh: '准备连接微信', en: 'Ready to connect Weixin' },
  weixinAuthReadyDescription: {
    zh: '点击左侧按钮后，这里会显示二维码。整个首配流程默认不需要手动填写底层参数。',
    en: 'After you start the flow, the QR code will appear here. Most first-time setups do not require filling low-level fields manually.'
  },
  weixinAuthAdvancedTitle: { zh: '高级设置', en: 'Advanced settings' },
  weixinAuthAdvancedDescription: {
    zh: '仅在你需要自定义接口地址、账号映射或白名单时再展开这些字段。',
    en: 'Expand these fields only when you need to customize the API base URL, account mapping, or allowlist.'
  }
};
