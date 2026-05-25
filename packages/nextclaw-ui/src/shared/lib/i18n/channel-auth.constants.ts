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
  weixinAuthConnectedDisabled: { zh: '已连接，但渠道未启用', en: 'Connected, but channel inactive' },
  weixinAuthNotConnected: { zh: '未连接', en: 'Not connected' },
  weixinAuthDisabledHint: {
    zh: '当前账号已完成扫码连接，但渠道处于未启用状态。打开 Enabled 后才会开始收发消息。',
    en: 'This account is connected, but the channel is inactive. Turn on Enabled before it can send or receive messages.'
  },
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
  },
  feishuAuthTitle: { zh: '扫码连接飞书', en: 'Connect Feishu by QR' },
  feishuAuthCreateNew: { zh: '创建新智能体', en: 'Create new agent' },
  feishuAuthConnectExisting: { zh: '连接已有智能体', en: 'Connect existing agent' },
  feishuAuthDescription: { zh: '飞书渠道使用扫码创建新的智能体，不再要求手动复制应用凭证。', en: 'Feishu can create a new agent by QR, so you no longer need to copy app credentials manually.' },
  feishuAuthHint: {
    zh: '点击按钮后用飞书扫码确认，连接成功后会自动保存新智能体凭证并启用 WebSocket 收发。',
    en: 'Start the flow, scan with Feishu, and the new agent credentials will be saved automatically for WebSocket messaging.'
  },
  feishuAuthCapabilityHint: {
    zh: '连接成功后，Agent 可以通过飞书自建应用收发私聊和群聊消息。',
    en: 'After connecting, the agent can send and receive Feishu direct and group messages through the registered app.'
  },
  feishuAuthDisabledHint: {
    zh: '当前飞书应用已完成扫码连接，但渠道处于未启用状态。打开 Enabled 后才会开始收发消息。',
    en: 'This Feishu app is connected, but the channel is inactive. Turn on Enabled before it can send or receive messages.'
  },
  feishuAuthConnect: { zh: '扫码连接飞书', en: 'Scan QR to connect Feishu' },
  feishuAuthQrAlt: { zh: '飞书智能体创建二维码', en: 'Feishu agent creation QR code' },
  feishuAuthScanPrompt: { zh: '请用飞书扫码，并按页面提示完成智能体创建授权。', en: 'Scan with Feishu and follow the prompts to finish agent creation.' },
  feishuAuthReadyTitle: { zh: '准备连接飞书', en: 'Ready to connect Feishu' },
  feishuAuthReadyDescription: {
    zh: '点击左侧按钮后，这里会显示智能体创建二维码。已有智能体请切换到连接入口。',
    en: 'After you start the flow, the agent creation QR code will appear here. Use the existing-agent tab when you already have one.'
  },
  feishuAuthAdvancedTitle: { zh: '高级设置', en: 'Advanced settings' },
  feishuAuthAdvancedDescription: {
    zh: '仅在你需要切换 Feishu/Lark 域名、指定默认账号、白名单或群聊策略时再展开这些字段。',
    en: 'Expand these fields only when you need to switch Feishu/Lark domains, choose a default account, or adjust allowlist and group policies.'
  },
  feishuAuthDomain: {
    zh: '飞书平台',
    en: 'Feishu platform'
  },
  feishuPlatform: { zh: '平台', en: 'Platform' },
  feishuExistingAgentTitle: { zh: '连接已有飞书智能体', en: 'Connect an existing Feishu agent' },
  feishuExistingAgentDescription: { zh: '填入已有智能体的 App ID 和 App Secret。', en: 'Enter the App ID and App Secret for an existing agent.' },
  feishuExistingAgentHint: {
    zh: '在飞书开放平台选择已有智能体，进入基础信息里的凭证与基础信息，然后复制凭证回来验证。',
    en: 'Open the developer console, choose an existing agent, then copy the credentials from its basic information page.'
  },
  feishuExistingAgentOpenFeishuList: { zh: '打开飞书智能体列表', en: 'Open Feishu agent list' },
  feishuExistingAgentOpenLarkList: { zh: '打开 Lark 智能体列表', en: 'Open Lark agent list' },
  feishuExistingAgentConnect: { zh: '验证并连接', en: 'Verify and connect' },
  feishuExistingAgentConnecting: { zh: '正在验证', en: 'Verifying' },
  feishuExistingAgentConnectSuccess: { zh: '飞书智能体已连接', en: 'Feishu agent connected' }
};
