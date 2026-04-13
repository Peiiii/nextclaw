import './style.css';
import { createIcons, icons } from 'lucide';

type Locale = 'en' | 'zh';
type PageRoute = 'home' | 'download';
type InstallMode = 'npm' | 'docker';

type FeatureItem = {
  icon: string;
  title: string;
  description: string;
};

type LogoItem = {
  name: string;
  logo: string;
};

type DeployPlatform = {
  icon: string;
  label: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type ComparisonRow = {
  dimension: string;
  values: string[]; // [NextClaw, OpenClaw, NanoBot, ...]
};

type DownloadAssetKey = 'macArm64Dmg' | 'macX64Dmg' | 'windowsX64Zip' | 'linuxX64AppImage';

type DownloadOption = {
  key: DownloadAssetKey;
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
};

type DesktopReleaseInfo = {
  tag: string;
  version: string;
  url: string;
  assets: Record<DownloadAssetKey, string>;
};

type LandingCopy = {
  navDownload: string;
  navFeatures: string;
  navDocs: string;
  navCommunity: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroDescription: string;
  heroDownloadButton: string;
  downloadTitle: string;
  downloadSubtitle: string;
  downloadVersionLabel: string;
  downloadDetectedLabel: string;
  downloadUnknownPlatform: string;
  downloadReleaseLabel: string;
  downloadReleaseLinkText: string;
  downloadUnsignedNotice: string;
  downloadOpenGuideTitle: string;
  downloadMacGuideTitle: string;
  downloadWindowsGuideTitle: string;
  downloadLinuxGuideTitle: string;
  downloadMacGuideSteps: string[];
  downloadWindowsGuideSteps: string[];
  downloadLinuxGuideSteps: string[];
  downloadOptions: DownloadOption[];
  copyTitle: string;
  installOptionDesktop: string;
  installOptionNpm: string;
  installOptionDocker: string;
  docsButton: string;
  githubButton: string;
  screenshotChatAlt: string;
  screenshotChatSrc: string;
  screenshotAlt: string;
  screenshotSrc: string;
  screenshotChannelsAlt: string;
  screenshotChannelsSrc: string;
  screenshotBrowserAlt: string;
  screenshotBrowserSrc: string;
  featuresTitle: string;
  featuresSubtitle: string;
  features: FeatureItem[];
  ctaTitle: string;
  ctaDescription: string;
  ctaButton: string;
  footerProject: string;
  footerLicense: string;
  footerDocs: string;
  footerNpm: string;
  footerDiscord: string;
  footerWechatGroup: string;
  communityTitle: string;
  communitySubtitle: string;
  communityWechatLabel: string;
  communityDiscordLabel: string;
  communityScanHint: string;
  terminalHeader: string;
  terminalStarted: string;
  copiedText: string;
  providersTitle: string;
  providersSubtitle: string;
  providers: LogoItem[];
  channelsTitle: string;
  channelsSubtitle: string;
  channels: LogoItem[];
  deployTitle: string;
  deploySubtitle: string;
  deployPlatforms: DeployPlatform[];
  faqTitle: string;
  faqSubtitle: string;
  faq: FAQItem[];
  comparisonTitle: string;
  comparisonSubtitle: string;
  comparisonProjects: string[];
  comparison: ComparisonRow[];
};

declare global {
  interface Window {
    __NEXTCLAW_LOCALE__?: string;
    __NEXTCLAW_ROUTE__?: string;
  }
}

const LOCALE_STORAGE_KEY = 'nextclaw.landing.locale';

const ROUTES: Record<Locale, Record<PageRoute, string>> = {
  en: {
    home: '/en/',
    download: '/en/download/'
  },
  zh: {
    home: '/zh/',
    download: '/zh/download/'
  }
};

const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' }
];

const LINKS: Record<'github' | 'npm' | 'discord' | 'wechatGroupImage', string> & { docs: Record<Locale, string> } = {
  github: 'https://github.com/Peiiii/nextclaw',
  npm: 'https://www.npmjs.com/package/nextclaw',
  discord: 'https://discord.gg/j4Skbgye',
  wechatGroupImage: '/contact/nextclaw-contact-wechat-group-2026-04-08.png',
  docs: {
    en: 'https://docs.nextclaw.io/en/',
    zh: 'https://docs.nextclaw.io/zh/'
  }
};

const DESKTOP_RELEASE_FALLBACK: DesktopReleaseInfo = {
  tag: 'v0.17.8-desktop.1',
  version: '0.0.136',
  url: 'https://github.com/Peiiii/nextclaw/releases/tag/v0.17.8-desktop.1',
  assets: {
    macArm64Dmg:
      'https://github.com/Peiiii/nextclaw/releases/download/v0.17.8-desktop.1/NextClaw.Desktop-0.0.136-arm64.dmg',
    macX64Dmg:
      'https://github.com/Peiiii/nextclaw/releases/download/v0.17.8-desktop.1/NextClaw.Desktop-0.0.136-x64.dmg',
    windowsX64Zip:
      'https://github.com/Peiiii/nextclaw/releases/download/v0.17.8-desktop.1/NextClaw.Desktop-0.0.136-win32-x64-unpacked.zip',
    linuxX64AppImage:
      'https://github.com/Peiiii/nextclaw/releases/download/v0.17.8-desktop.1/NextClaw.Desktop-0.0.136-linux-x64.AppImage'
  }
};

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Peiiii/nextclaw/releases?per_page=20';

const DESKTOP_ASSET_PATTERNS: Record<DownloadAssetKey, RegExp> = {
  macArm64Dmg: /NextClaw\.Desktop-(\d+\.\d+\.\d+)-arm64\.dmg$/,
  macX64Dmg: /NextClaw\.Desktop-(\d+\.\d+\.\d+)(?:-x64)?\.dmg$/,
  windowsX64Zip: /NextClaw\.Desktop-win32-x64-unpacked\.zip$/,
  linuxX64AppImage: /NextClaw(?:\.Desktop| Desktop)-(\d+\.\d+\.\d+)(?:-linux-x64)?\.AppImage$/i
};

function inferDesktopVersionFromAssetName(assetName: string): string | null {
  const match = assetName.match(DESKTOP_ASSET_PATTERNS.macArm64Dmg) ?? assetName.match(DESKTOP_ASSET_PATTERNS.macX64Dmg);
  return match?.[1] ?? null;
}

function resolveDesktopReleaseInfo(input: unknown): DesktopReleaseInfo | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const release = input as {
    draft?: boolean;
    prerelease?: boolean;
    tag_name?: string;
    html_url?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };

  if (release.draft || release.prerelease) {
    return null;
  }

  if (typeof release.tag_name !== 'string' || !/^v\d+\.\d+\.\d+-desktop\.\d+$/.test(release.tag_name)) {
    return null;
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const macArmAsset = assets.find((item) => typeof item.name === 'string' && DESKTOP_ASSET_PATTERNS.macArm64Dmg.test(item.name));
  const macX64Asset = assets.find((item) => typeof item.name === 'string' && DESKTOP_ASSET_PATTERNS.macX64Dmg.test(item.name));
  const windowsAsset = assets.find(
    (item) => typeof item.name === 'string' && DESKTOP_ASSET_PATTERNS.windowsX64Zip.test(item.name)
  );
  const linuxAsset = assets.find(
    (item) => typeof item.name === 'string' && DESKTOP_ASSET_PATTERNS.linuxX64AppImage.test(item.name)
  );

  if (
    !macArmAsset?.browser_download_url ||
    !macX64Asset?.browser_download_url ||
    !windowsAsset?.browser_download_url ||
    !linuxAsset?.browser_download_url ||
    !macArmAsset.name
  ) {
    return null;
  }

  const version = inferDesktopVersionFromAssetName(macArmAsset.name) ?? DESKTOP_RELEASE_FALLBACK.version;

  return {
    tag: release.tag_name,
    version,
    url: release.html_url ?? `https://github.com/Peiiii/nextclaw/releases/tag/${release.tag_name}`,
    assets: {
      macArm64Dmg: macArmAsset.browser_download_url,
      macX64Dmg: macX64Asset.browser_download_url,
      windowsX64Zip: windowsAsset.browser_download_url,
      linuxX64AppImage: linuxAsset.browser_download_url
    }
  };
}

async function fetchLatestStableDesktopRelease(): Promise<DesktopReleaseInfo | null> {
  try {
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
      return null;
    }

    for (const candidate of releases) {
      const resolved = resolveDesktopReleaseInfo(candidate);
      if (resolved) {
        return resolved;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch desktop release metadata', error);
  }

  return null;
}

function detectRecommendedDesktopAsset(): DownloadAssetKey | 'unknown' {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('windows')) {
    return 'windowsX64Zip';
  }

  if (userAgent.includes('linux') && !userAgent.includes('android')) {
    return 'linuxX64AppImage';
  }

  const userAgentData = (navigator as Navigator & { userAgentData?: { architecture?: string; platform?: string } }).userAgentData;
  if (userAgentData?.platform?.toLowerCase() === 'macos') {
    const arch = userAgentData.architecture?.toLowerCase();
    if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
      return 'macArm64Dmg';
    }
    if (arch === 'x86' || arch === 'x86_64' || arch === 'x64') {
      return 'macX64Dmg';
    }
  }

  return 'unknown';
}

const COPY: Record<Locale, LandingCopy> = {
  en: {
    navDownload: 'Download',
    navFeatures: 'Features',
    navDocs: 'Docs',
    navCommunity: 'Community',
    heroTitleLine1: 'NextClaw',
    heroTitleLine2: '',
    heroDescription:
      'Your omnipotent personal assistant, residing above the digital realm. NextClaw orchestrates the entire internet and raw compute, bending every bit and byte to manifest your intent into reality. Runs entirely on your machine.',
    heroDownloadButton: 'Download Desktop',
    downloadTitle: 'Download NextClaw Desktop',
    downloadSubtitle: 'Official installer assets from the latest stable desktop release (macOS + Windows + Linux).',
    downloadVersionLabel: 'Current desktop version',
    downloadDetectedLabel: 'Detected device',
    downloadUnknownPlatform: 'Unknown platform',
    downloadReleaseLabel: 'Release tag',
    downloadReleaseLinkText: 'View all release assets',
    downloadUnsignedNotice:
      'Unsigned build notice: first launch may show system warnings. For macOS, click Done first, then go to Privacy & Security and click Open Anyway.',
    downloadOpenGuideTitle: 'Beginner open guide',
    downloadMacGuideTitle: 'macOS first launch',
    downloadWindowsGuideTitle: 'Windows first launch',
    downloadLinuxGuideTitle: 'Linux first launch',
    downloadMacGuideSteps: [
      'Open the .dmg and drag NextClaw Desktop.app into Applications.',
      'Double-click the app once. If blocked, click Done.',
      'Go to System Settings -> Privacy & Security, then click Open Anyway.',
      'If still blocked as damaged, run: xattr -cr "/Applications/NextClaw Desktop.app".'
    ],
    downloadWindowsGuideSteps: [
      'Unzip the downloaded package.',
      'Run NextClaw Desktop.exe.',
      'If SmartScreen appears, click More info -> Run anyway.'
    ],
    downloadLinuxGuideSteps: [
      'Download the AppImage file.',
      'Run: chmod +x NextClaw.Desktop-*.AppImage',
      'Run: ./NextClaw.Desktop-*.AppImage'
    ],
    downloadOptions: [
      {
        key: 'macArm64Dmg',
        icon: 'apple',
        title: 'macOS (Apple Silicon)',
        description: 'DMG package for M-series Macs.',
        buttonLabel: 'Download DMG'
      },
      {
        key: 'macX64Dmg',
        icon: 'apple',
        title: 'macOS (Intel)',
        description: 'DMG package for Intel Macs.',
        buttonLabel: 'Download DMG'
      },
      {
        key: 'windowsX64Zip',
        icon: 'monitor',
        title: 'Windows (x64)',
        description: 'Unpacked zip containing NextClaw Desktop.exe.',
        buttonLabel: 'Download ZIP'
      },
      {
        key: 'linuxX64AppImage',
        icon: 'terminal',
        title: 'Linux (x64)',
        description: 'Single-file AppImage package for mainstream Linux distributions.',
        buttonLabel: 'Download AppImage'
      }
    ],
    copyTitle: 'Copy commands',
    installOptionDesktop: 'Desktop Download',
    installOptionNpm: 'npm Install',
    installOptionDocker: 'Docker Install',
    docsButton: 'Read the Docs',
    githubButton: 'View on GitHub',
    screenshotChatAlt: 'NextClaw Agent chat',
    screenshotChatSrc: '/nextclaw-chat-page-en.png',
    screenshotAlt: 'NextClaw provider management',
    screenshotSrc: '/nextclaw-providers-page-en.png',
    screenshotChannelsAlt: 'NextClaw message channels',
    screenshotChannelsSrc: '/nextclaw-channels-page-en.png',
    screenshotBrowserAlt: 'NextClaw skills with detail browser',
    screenshotBrowserSrc: '/nextclaw-skills-doc-browser-en.png',
    featuresTitle: 'Everything you need.',
    featuresSubtitle:
      'A powerful core wrapped in a seamless interface. Run NextClaw locally or expose it safely.',
    features: [
      {
        icon: 'layers',
        title: 'Zero-Config UI',
        description:
          'Manage your providers, models, and agents from an elegant dashboard. No hunting through JSON files.'
      },
      {
        icon: 'cpu',
        title: 'Multi-Provider',
        description: 'OpenRouter, OpenAI, vLLM, DeepSeek, MiniMax, and more. Switch models in minutes.'
      },
      {
        icon: 'message-square',
        title: 'Multi-Channel',
        description: 'Connect Telegram, Discord, Feishu, Slack, and WhatsApp from one gateway.'
      },
      {
        icon: 'blocks',
        title: 'OpenClaw Compatible',
        description: 'Compatible with OpenClaw plugin ecosystem and channel plugin conventions.'
      },
      {
        icon: 'clock',
        title: 'Automation Built-in',
        description: 'Cron and Heartbeat let your assistant run scheduled autonomous tasks.'
      },
      {
        icon: 'zap',
        title: 'Local & Private',
        description: 'Runs on your machine, keeping configs, chat history, and tokens under your control.'
      }
    ],
    ctaTitle: 'Ready to upgrade your AI?',
    ctaDescription: 'Get started with NextClaw in seconds. One command and your gateway is operational.',
    ctaButton: 'View Documentation',
    footerProject: 'NextClaw Project',
    footerLicense: 'Released under the MIT License.',
    footerDocs: 'Docs',
    footerNpm: 'NPM',
    footerDiscord: 'Discord',
    footerWechatGroup: 'WeChat Group',
    communityTitle: 'Join the community',
    communitySubtitle: 'WeChat group for Chinese users, Discord for everyone.',
    communityWechatLabel: 'WeChat Group QR',
    communityDiscordLabel: 'Join Discord',
    communityScanHint: 'Scan to join',
    terminalHeader: 'nextclaw - bash',
    terminalStarted: 'NextClaw started',
    copiedText: 'Copied',
    providersTitle: '10+ AI Providers',
    providersSubtitle: 'Switch between any major AI provider. No lock-in, no rewiring.',
    providers: [
      { name: 'OpenRouter', logo: '/logos/openrouter.svg' },
      { name: 'OpenAI', logo: '/logos/openai.svg' },
      { name: 'Anthropic', logo: '/logos/anthropic.svg' },
      { name: 'Gemini', logo: '/logos/gemini.svg' },
      { name: 'DeepSeek', logo: '/logos/deepseek.png' },
      { name: 'Groq', logo: '/logos/groq.svg' },
      { name: 'MiniMax', logo: '/logos/minimax.svg' },
      { name: 'Moonshot', logo: '/logos/moonshot.png' },
      { name: 'DashScope', logo: '/logos/dashscope.png' },
      { name: 'Zhipu', logo: '/logos/zhipu.svg' },
      { name: 'AiHubMix', logo: '/logos/aihubmix.png' },
      { name: 'vLLM', logo: '/logos/vllm.svg' }
    ],
    channelsTitle: '10+ Message Channels',
    channelsSubtitle: 'Connect your agent to every major messaging platform — including Chinese domestic apps.',
    channels: [
      { name: 'Discord', logo: '/logos/discord.svg' },
      { name: 'Telegram', logo: '/logos/telegram.svg' },
      { name: 'Feishu', logo: '/logos/feishu.svg' },
      { name: 'QQ', logo: '/logos/qq.svg' },
      { name: 'WhatsApp', logo: '/logos/whatsapp.svg' },
      { name: 'Slack', logo: '/logos/slack.svg' },
      { name: 'DingTalk', logo: '/logos/dingtalk.svg' },
      { name: 'WeCom', logo: '/logos/wecom.svg' },
      { name: 'Mochat', logo: '/logos/mochat.svg' },
      { name: 'Email', logo: '/logos/email.svg' }
    ],
    deployTitle: 'Deploy Anywhere',
    deploySubtitle: 'Runs on your laptop, a cloud VM, or a Docker container. Windows, macOS, and Linux all supported.',
    deployPlatforms: [
      { icon: 'monitor', label: 'Windows' },
      { icon: 'laptop-2', label: 'macOS' },
      { icon: 'terminal', label: 'Linux' },
      { icon: 'cloud', label: 'Cloud VMs' },
      { icon: 'box', label: 'Docker' }
    ],
    faqTitle: 'Frequently Asked Questions',
    faqSubtitle: 'Quick answers to common questions about NextClaw.',
    faq: [
      {
        question: 'What is the difference between NextClaw and OpenClaw?',
        answer: 'NextClaw is inspired by OpenClaw and stays compatible with its plugin ecosystem. The main differences are: (1) One-command startup with a built-in UI for configuration, (2) Smaller codebase (~1/20 of OpenClaw) for easier maintenance, (3) Better support for Chinese domestic channels like QQ, Feishu, and DingTalk.'
      }
    ],
    comparisonTitle: 'Ecosystem Comparison',
    comparisonSubtitle: 'How NextClaw compares to other projects in the Claw ecosystem.',
    comparisonProjects: ['NextClaw', 'OpenClaw', 'NanoBot', 'NanoClaw', 'ZeroClaw', 'PicoClaw'],
    comparison: [
      {
        dimension: 'Positioning',
        values: ['OpenClaw-compatible + UI-first', 'Full-stack AI platform', 'Lightweight Python agent', 'Minimal + container isolation', 'Rust security-first', 'Go lightweight']
      },
      {
        dimension: 'Stack',
        values: ['TS/Node monorepo', 'TS/Node + Swift/Kotlin', 'Python', 'TS/Node + container', 'Rust', 'Go']
      },
      {
        dimension: 'Setup',
        values: ['One command + Web UI', 'Wizard + daemon', 'pip + config.json', 'Claude Code + /setup', 'Bootstrap/binary', 'onboard + config']
      },
      {
        dimension: 'Built-in UI',
        values: ['Chat + Config + Plugins', 'Control UI + WebChat + Apps', 'CLI-focused', 'No dashboard', 'CLI/config-focused', 'Webhook/config']
      },
      {
        dimension: 'CN Channels',
        values: ['QQ/Feishu/DingTalk/WeCom', 'Partial', 'QQ/Feishu/DingTalk', 'Core channels only', 'QQ/DingTalk/Lark', 'QQ/DingTalk/WeCom']
      },
      {
        dimension: 'Complexity',
        values: ['Balanced', 'High', 'Low', 'Minimal', 'Medium', 'Low']
      }
    ]
  },
  zh: {
    navDownload: '下载',
    navFeatures: '功能',
    navDocs: '文档',
    navCommunity: '社群',
    heroTitleLine1: 'NextClaw',
    heroTitleLine2: '',
    heroDescription: '你的数字世界全能管家。NextClaw 替你俯瞰并调度整个互联网与海量算力，让每一寸比特与字节都听从你的意图运转。权柄归你，完全本地运行。',
    heroDownloadButton: '下载桌面版',
    downloadTitle: '下载 NextClaw Desktop',
    downloadSubtitle: '官网直连最新稳定版 Desktop 产物（macOS + Windows + Linux）。',
    downloadVersionLabel: '当前桌面端版本',
    downloadDetectedLabel: '检测到的设备',
    downloadUnknownPlatform: '未知平台',
    downloadReleaseLabel: '发布标签',
    downloadReleaseLinkText: '查看完整发布资产',
    downloadUnsignedNotice:
      '未签名版本提示：首次打开可能触发系统拦截。macOS 请先点“完成”，再到“隐私与安全性”底部点击“仍要打开”。',
    downloadOpenGuideTitle: '小白打开教程',
    downloadMacGuideTitle: 'macOS 首次打开',
    downloadWindowsGuideTitle: 'Windows 首次打开',
    downloadLinuxGuideTitle: 'Linux 首次打开',
    downloadMacGuideSteps: [
      '打开 .dmg，把 NextClaw Desktop.app 拖到“应用程序”。',
      '先双击一次应用；若系统拦截，先点“完成”。',
      '进入“系统设置 -> 隐私与安全性”，在页面底部点“仍要打开”。',
      '若仍提示已损坏，执行：xattr -cr "/Applications/NextClaw Desktop.app"。'
    ],
    downloadWindowsGuideSteps: [
      '先解压下载的 zip 包。',
      '双击运行 NextClaw Desktop.exe。',
      '若出现 SmartScreen，点“更多信息” -> “仍要运行”。'
    ],
    downloadLinuxGuideSteps: [
      '下载 AppImage 文件。',
      '执行：chmod +x NextClaw.Desktop-*.AppImage',
      '执行：./NextClaw.Desktop-*.AppImage'
    ],
    downloadOptions: [
      {
        key: 'macArm64Dmg',
        icon: 'apple',
        title: 'macOS（Apple Silicon）',
        description: '适用于 M 系列芯片 Mac 的 DMG 包。',
        buttonLabel: '下载 DMG'
      },
      {
        key: 'macX64Dmg',
        icon: 'apple',
        title: 'macOS（Intel）',
        description: '适用于 Intel 芯片 Mac 的 DMG 包。',
        buttonLabel: '下载 DMG'
      },
      {
        key: 'windowsX64Zip',
        icon: 'monitor',
        title: 'Windows（x64）',
        description: '解压后可直接运行 NextClaw Desktop.exe。',
        buttonLabel: '下载 ZIP'
      },
      {
        key: 'linuxX64AppImage',
        icon: 'terminal',
        title: 'Linux（x64）',
        description: '适用于主流 Linux 发行版的 AppImage 单文件包。',
        buttonLabel: '下载 AppImage'
      }
    ],
    copyTitle: '复制命令',
    installOptionDesktop: '桌面端下载',
    installOptionNpm: 'npm 安装',
    installOptionDocker: 'Docker 安装',
    docsButton: '查看文档',
    githubButton: '查看 GitHub',
    screenshotChatAlt: 'NextClaw Agent 对话',
    screenshotChatSrc: '/nextclaw-chat-page-cn.png',
    screenshotAlt: 'NextClaw 提供商管理',
    screenshotSrc: '/nextclaw-providers-page-cn.png',
    screenshotChannelsAlt: 'NextClaw 消息渠道',
    screenshotChannelsSrc: '/nextclaw-channels-page-cn.png',
    screenshotBrowserAlt: 'NextClaw 技能详情浏览器',
    screenshotBrowserSrc: '/nextclaw-skills-doc-browser-cn.png',
    featuresTitle: '你需要的能力都在这里。',
    featuresSubtitle: '强大的核心能力与顺手的交互体验统一在一个入口中。',
    features: [
      {
        icon: 'layers',
        title: '零配置 UI',
        description: '通过统一控制台管理 Provider、模型和 Agent，无需频繁手改 JSON。'
      },
      {
        icon: 'cpu',
        title: '多 Provider',
        description: '支持 OpenRouter、OpenAI、vLLM、DeepSeek、MiniMax 等，切换更灵活。'
      },
      {
        icon: 'message-square',
        title: '多渠道接入',
        description: '可连接 Telegram、Discord、飞书、Slack、WhatsApp 等主流渠道。'
      },
      {
        icon: 'blocks',
        title: '兼容 OpenClaw',
        description: '兼容 OpenClaw 插件生态与渠道插件约定，迁移成本低。'
      },
      {
        icon: 'clock',
        title: '内置自动化',
        description: '通过 Cron 与 Heartbeat 让 AI 按计划执行后台任务。'
      },
      {
        icon: 'zap',
        title: '本地可控',
        description: '本机运行，配置、会话与密钥保留在你自己的环境中。'
      }
    ],
    ctaTitle: '准备好升级你的 AI 工作流了吗？',
    ctaDescription: '一条命令启动 NextClaw，快速进入可用状态。',
    ctaButton: '进入文档',
    footerProject: 'NextClaw 项目',
    footerLicense: '基于 MIT License 发布。',
    footerDocs: '文档',
    footerNpm: 'NPM',
    footerDiscord: 'Discord',
    footerWechatGroup: '微信群',
    communityTitle: '加入社群',
    communitySubtitle: '国内用户可扫码加入微信群，海外与英文用户欢迎来 Discord。',
    communityWechatLabel: '微信群二维码',
    communityDiscordLabel: '加入 Discord',
    communityScanHint: '扫码加群',
    terminalHeader: 'nextclaw - bash',
    terminalStarted: 'NextClaw 已启动',
    copiedText: '已复制',
    providersTitle: '10+ AI 提供商',
    providersSubtitle: '随时切换任意主流 AI 提供商，不锁定，不重新配置。',
    providers: [
      { name: 'OpenRouter', logo: '/logos/openrouter.svg' },
      { name: 'OpenAI', logo: '/logos/openai.svg' },
      { name: 'Anthropic', logo: '/logos/anthropic.svg' },
      { name: 'Gemini', logo: '/logos/gemini.svg' },
      { name: 'DeepSeek', logo: '/logos/deepseek.png' },
      { name: 'Groq', logo: '/logos/groq.svg' },
      { name: 'MiniMax', logo: '/logos/minimax.svg' },
      { name: 'Moonshot', logo: '/logos/moonshot.png' },
      { name: '通义千问', logo: '/logos/dashscope.png' },
      { name: '智谱', logo: '/logos/zhipu.svg' },
      { name: 'AiHubMix', logo: '/logos/aihubmix.png' },
      { name: 'vLLM', logo: '/logos/vllm.svg' }
    ],
    channelsTitle: '10+ 消息渠道',
    channelsSubtitle: '一个网关覆盖所有主流消息平台，国内外渠道全支持。',
    channels: [
      { name: 'Discord', logo: '/logos/discord.svg' },
      { name: 'Telegram', logo: '/logos/telegram.svg' },
      { name: '飞书', logo: '/logos/feishu.svg' },
      { name: 'QQ', logo: '/logos/qq.svg' },
      { name: 'WhatsApp', logo: '/logos/whatsapp.svg' },
      { name: 'Slack', logo: '/logos/slack.svg' },
      { name: '钉钉', logo: '/logos/dingtalk.svg' },
      { name: '企业微信', logo: '/logos/wecom.svg' },
      { name: 'Mochat', logo: '/logos/mochat.svg' },
      { name: 'Email', logo: '/logos/email.svg' }
    ],
    deployTitle: '随处部署',
    deploySubtitle: '支持本地笔记本、云服务器或 Docker 容器部署，兼容 Windows、macOS、Linux。',
    deployPlatforms: [
      { icon: 'monitor', label: 'Windows' },
      { icon: 'laptop-2', label: 'macOS' },
      { icon: 'terminal', label: 'Linux' },
      { icon: 'cloud', label: '云服务器' },
      { icon: 'box', label: 'Docker' }
    ],
    faqTitle: '常见问题',
    faqSubtitle: '关于 NextClaw 的常见问题解答。',
    faq: [
      {
        question: 'NextClaw 和 OpenClaw 有什么区别？',
        answer: 'NextClaw 受 OpenClaw 启发，并保持与其插件生态兼容。主要区别：(1) 一条命令启动，内置 UI 配置界面；(2) 代码量约为 OpenClaw 的 1/20，更易维护；(3) 更好地支持国内渠道如 QQ、飞书、钉钉等。'
      }
    ],
    comparisonTitle: '生态对比',
    comparisonSubtitle: 'NextClaw 与 Claw 生态其他项目的横向对比。',
    comparisonProjects: ['NextClaw', 'OpenClaw', 'NanoBot', 'NanoClaw', 'ZeroClaw', 'PicoClaw'],
    comparison: [
      {
        dimension: '核心定位',
        values: ['OpenClaw 兼容 + UI 优先', '全栈 AI 助手平台', '轻量 Python Agent', '极简 + 容器隔离', 'Rust 安全优先', 'Go 轻量多渠道']
      },
      {
        dimension: '技术栈',
        values: ['TS/Node monorepo', 'TS/Node + Swift/Kotlin', 'Python', 'TS/Node + 容器', 'Rust', 'Go']
      },
      {
        dimension: '上手路径',
        values: ['一条命令 + Web UI', '向导 + 守护进程', 'pip + config.json', 'Claude Code + /setup', 'Bootstrap/二进制', 'onboard + config']
      },
      {
        dimension: '内置 UI',
        values: ['对话 + 配置 + 插件', 'Control UI + WebChat + 多端', 'CLI 为主', '无 dashboard', 'CLI/配置为主', 'Webhook/配置']
      },
      {
        dimension: '国内渠道',
        values: ['QQ/飞书/钉钉/企微', '部分支持', 'QQ/飞书/钉钉', '核心渠道', 'QQ/钉钉/飞书', 'QQ/钉钉/企微']
      },
      {
        dimension: '复杂度',
        values: ['均衡', '高', '低', '极简', '中等', '低']
      }
    ]
  }
};

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'zh';
}

function isInstallMode(value: string | null | undefined): value is InstallMode {
  return value === 'npm' || value === 'docker';
}

function isPageRoute(value: string | null | undefined): value is PageRoute {
  return value === 'home' || value === 'download';
}

function readSavedLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null;
  }
}

function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore persistence failures
  }
}

function resolvePageLocale(): Locale {
  if (isLocale(window.__NEXTCLAW_LOCALE__)) {
    return window.__NEXTCLAW_LOCALE__;
  }

  const pathLocale = window.location.pathname.split('/')[1];
  if (isLocale(pathLocale)) {
    return pathLocale;
  }

  const saved = readSavedLocale();
  if (saved) {
    return saved;
  }

  const browserLang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  return /^zh\b/i.test(browserLang) ? 'zh' : 'en';
}

function resolvePageRoute(): PageRoute {
  if (isPageRoute(window.__NEXTCLAW_ROUTE__)) {
    return window.__NEXTCLAW_ROUTE__;
  }

  const [, maybeLocale, maybeRoute] = window.location.pathname.split('/');
  if (isLocale(maybeLocale) && maybeRoute === 'download') {
    return 'download';
  }

  return 'home';
}

class LandingPage {
  private readonly root: HTMLDivElement;
  private readonly locale: Locale;
  private readonly route: PageRoute;
  private readonly copy: LandingCopy;
  private activeInstallMode: InstallMode = 'npm';
  private terminalAnimationTimer: number | null = null;
  private terminalAnimationRunId = 0;

  constructor(root: HTMLDivElement, locale: Locale, route: PageRoute) {
    this.root = root;
    this.locale = locale;
    this.route = route;
    this.copy = COPY[locale];
  }

  render = (): void => {
    const docsLink = LINKS.docs[this.locale];
    const homeRoute = ROUTES[this.locale].home;
    const downloadRoute = ROUTES[this.locale].download;
    const featuresLink = this.route === 'home' ? '#features' : `${homeRoute}#features`;
    const communityLink = this.route === 'home' ? '#community' : `${homeRoute}#community`;

    this.root.innerHTML = `
      <div class="relative min-h-screen flex flex-col bg-gradient-radial overflow-hidden">
        <header class="fixed top-0 w-full z-50 glass border-b transition-all duration-300">
          <div class="container mx-auto px-6 h-16 flex items-center justify-between">
            <a id="home-link" href="${homeRoute}" class="flex items-center gap-2 group cursor-pointer">
              <img src="/logo-phoenix.svg" alt="NextClaw" class="w-8 h-8 transition-transform group-hover:scale-105" />
              <span class="font-semibold text-lg tracking-tight">NextClaw</span>
            </a>
            <nav class="hidden md:flex gap-8 text-sm font-medium">
              <a href="${downloadRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navDownload}</a>
              <a href="${featuresLink}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navFeatures}</a>
              <a href="${communityLink}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navCommunity}</a>
              <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navDocs}</a>
            </nav>
            <div class="flex items-center gap-2">
              <div class="relative flex items-center text-sm">
                <i data-lucide="languages" class="w-4 h-4 text-muted-foreground absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                <select
                  id="locale-select"
                  class="h-8 pl-6 pr-4 bg-transparent border-0 text-muted-foreground hover:text-foreground transition-colors focus:outline-none appearance-none cursor-pointer"
                  aria-label="Select language"
                >
                  ${LOCALE_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === this.locale ? 'selected' : ''}>${option.label}</option>`).join('')}
                </select>
                <i data-lucide="chevron-down" class="w-3 h-3 text-muted-foreground absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"></i>
              </div>
              <a href="${LINKS.github}" target="_blank" rel="noopener noreferrer" class="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary" aria-label="GitHub">
                <i data-lucide="github" class="w-5 h-5"></i>
              </a>
              <button id="mobile-menu-btn" class="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary" aria-label="Menu">
                <i data-lucide="menu" class="w-5 h-5"></i>
              </button>
            </div>
          </div>
          <!-- Mobile menu -->
          <div id="mobile-menu" class="hidden md:hidden border-t border-border/40 bg-background/95 backdrop-blur-sm">
            <nav class="container mx-auto px-6 py-4 flex flex-col gap-4 text-sm font-medium">
              <a href="${downloadRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navDownload}</a>
              <a href="${featuresLink}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navFeatures}</a>
              <a href="${communityLink}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navCommunity}</a>
              <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navDocs}</a>
            </nav>
          </div>
        </header>

        <main class="flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 z-10">
          <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight max-w-6xl mb-6 animate-slide-up opacity-0" style="animation-delay: 0.2s">
            ${this.route === 'download'
              ? `<span class="hero-brand">${this.copy.downloadTitle}</span>`
              : `<span class="hero-brand">${this.copy.heroTitleLine1}</span>${this.copy.heroTitleLine2 ? `<br /><span class="text-gradient">${this.copy.heroTitleLine2}</span>` : ''}`}
          </h1>

          <p class="text-lg md:text-xl text-muted-foreground max-w-4xl mx-auto mb-10 animate-slide-up opacity-0" style="animation-delay: 0.3s">
            ${this.route === 'download' ? this.copy.downloadSubtitle : this.copy.heroDescription}
          </p>

          ${this.route === 'download' ? `
          <section id="download" class="w-full max-w-5xl mx-auto mb-10 text-left animate-slide-up opacity-0" style="animation-delay: 0.35s">
            <div class="glass-card rounded-3xl p-6 md:p-8 border border-primary/20 shadow-2xl">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 class="text-2xl md:text-3xl font-bold tracking-tight">${this.copy.downloadTitle}</h2>
                  <p class="text-muted-foreground mt-2">${this.copy.downloadSubtitle}</p>
                </div>
                <div class="text-sm text-muted-foreground space-y-1 md:text-right">
                  <div>${this.copy.downloadVersionLabel}: <span id="desktop-version" class="font-semibold text-foreground">${DESKTOP_RELEASE_FALLBACK.version}</span></div>
                  <div>${this.copy.downloadDetectedLabel}: <span id="desktop-detected-platform" class="font-semibold text-foreground">${this.copy.downloadUnknownPlatform}</span></div>
                  <div>${this.copy.downloadReleaseLabel}: <a id="desktop-release-link" href="${DESKTOP_RELEASE_FALLBACK.url}" target="_blank" rel="noopener noreferrer" class="font-semibold text-primary hover:underline">${DESKTOP_RELEASE_FALLBACK.tag}</a></div>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${this.copy.downloadOptions
                  .map(
                    (option) => `
                      <article data-download-card="${option.key}" class="rounded-2xl border border-border/70 bg-background/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div class="flex items-start gap-3">
                            <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <i data-lucide="${option.icon}" class="w-5 h-5"></i>
                            </div>
                            <div>
                              <h3 class="font-semibold text-lg">${option.title}</h3>
                              <p class="text-sm text-muted-foreground mt-1">${option.description}</p>
                            </div>
                          </div>
                          <a
                            data-download-link="${option.key}"
                            href="#"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex h-11 min-w-[128px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            ${option.buttonLabel}
                          </a>
                        </div>
                      </article>
                    `
                  )
                  .join('')}
              </div>

              <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                ${this.copy.downloadUnsignedNotice}
              </div>

              <div class="mt-5">
                <a
                  id="desktop-release-link-secondary"
                  href="${DESKTOP_RELEASE_FALLBACK.url}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <i data-lucide="external-link" class="w-4 h-4"></i>
                  ${this.copy.downloadReleaseLinkText}
                </a>
              </div>

              <div class="mt-6">
                <h3 class="text-base font-semibold mb-3">${this.copy.downloadOpenGuideTitle}</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <h4 class="font-medium mb-2">${this.copy.downloadMacGuideTitle}</h4>
                    <ol class="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
                      ${this.copy.downloadMacGuideSteps.map((step) => `<li>${step}</li>`).join('')}
                    </ol>
                  </div>
                  <div class="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <h4 class="font-medium mb-2">${this.copy.downloadWindowsGuideTitle}</h4>
                    <ol class="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
                      ${this.copy.downloadWindowsGuideSteps.map((step) => `<li>${step}</li>`).join('')}
                    </ol>
                  </div>
                  <div class="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <h4 class="font-medium mb-2">${this.copy.downloadLinuxGuideTitle}</h4>
                    <ol class="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
                      ${this.copy.downloadLinuxGuideSteps.map((step) => `<li>${step}</li>`).join('')}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </section>
          ` : ''}

          ${this.route === 'home' ? `
          <div class="flex flex-col items-center gap-4 mb-6 animate-slide-up opacity-0" style="animation-delay: 0.4s">
            <div class="inline-flex flex-wrap justify-center rounded-full border border-border bg-background/80 p-1 shadow-sm">
              <a href="${downloadRoute}" class="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors text-sm sm:text-base">
                <i data-lucide="download" class="w-4 h-4"></i>
                ${this.copy.installOptionDesktop}
              </a>
              <button
                type="button"
                data-install-mode="npm"
                class="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full font-semibold transition-colors text-sm sm:text-base bg-primary text-primary-foreground"
              >
                <i data-lucide="package" class="w-4 h-4"></i>
                ${this.copy.installOptionNpm}
              </button>
              <button
                type="button"
                data-install-mode="docker"
                class="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full font-semibold transition-colors text-sm sm:text-base text-muted-foreground hover:text-foreground"
              >
                <i data-lucide="box" class="w-4 h-4"></i>
                ${this.copy.installOptionDocker}
              </button>
            </div>
          </div>

          <div class="w-full max-w-2xl mx-auto mb-10 text-left animate-slide-up opacity-0" style="animation-delay: 0.5s">
            <div class="rounded-2xl overflow-hidden bg-[#332c28] shadow-2xl border border-white/5">
              <div class="flex items-center justify-between px-4 py-3 bg-[#2c2522]">
                <div class="flex gap-2">
                  <div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                  <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                  <div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                </div>
                <div class="text-xs text-[#a0938a] font-mono">${this.copy.terminalHeader}</div>
                <button id="copy-btn" class="text-[#a0938a] hover:text-white transition-colors" title="${this.copy.copyTitle}">
                  <i data-lucide="copy" class="w-4 h-4"></i>
                </button>
              </div>
              <div id="terminal-content" class="p-6 font-mono text-sm sm:text-base leading-relaxed">
                <div class="flex items-center text-[#d4c8be]">
                  <span class="text-[#8eb079] mr-2">~</span>
                  <span class="text-[#e29e57] mr-2 font-bold">$</span>
                  <span id="install-cmd"></span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row flex-wrap justify-center gap-4 mb-6 animate-slide-up opacity-0" style="animation-delay: 0.53s">
            <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 shadow-md shadow-primary/25 focus:ring-2 focus:ring-primary focus:outline-none text-base">
              <i data-lucide="book-open" class="w-5 h-5"></i>
              ${this.copy.docsButton}
            </a>
            <a href="${LINKS.github}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-medium bg-background text-foreground border border-border hover:bg-secondary transition-all hover:scale-105 shadow-sm focus:ring-2 focus:ring-foreground focus:outline-none text-base">
              <i data-lucide="github" class="w-5 h-5"></i>
              ${this.copy.githubButton}
            </a>
          </div>

          <div class="flex flex-row flex-wrap justify-center gap-4 mb-20 animate-slide-up opacity-0" style="animation-delay: 0.55s">
            <button id="community-qr-btn" type="button" class="inline-flex items-center justify-center gap-2 h-12 w-48 rounded-full font-medium bg-[#07C160] text-white hover:bg-[#06AD56] transition-all hover:scale-105 shadow-sm focus:ring-2 focus:ring-[#07C160] focus:outline-none text-base cursor-pointer">
              <i data-lucide="message-circle" class="w-5 h-5"></i>
              ${this.locale === 'zh' ? '加入微信群' : 'WeChat Group'}
            </button>
            <a href="${LINKS.discord}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 h-12 w-48 rounded-full font-medium bg-[#5865F2] text-white hover:bg-[#4752C4] transition-all hover:scale-105 shadow-sm focus:ring-2 focus:ring-[#5865F2] focus:outline-none text-base">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.075.075 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              ${this.copy.communityDiscordLabel}
            </a>
          </div>

          <!-- Community QR Code Modal -->
          <div id="community-qr-modal" class="fixed inset-0 z-[100] hidden items-center justify-center bg-black/50 backdrop-blur-sm">
            <div class="glass-card rounded-2xl p-6 shadow-2xl max-w-xs mx-4 text-center">
              <img src="${LINKS.wechatGroupImage}" alt="${this.copy.communityWechatLabel}" class="w-56 h-56 object-contain rounded-lg mx-auto mb-4" />
              <p class="text-sm text-muted-foreground">${this.copy.communityScanHint}</p>
            </div>
          </div>

          <div class="relative w-full max-w-5xl mx-auto animate-fade-in opacity-0" style="animation-delay: 0.6s">
            <div class="absolute inset-0 bg-primary/10 blur-[100px] rounded-full"></div>
            <div class="glass-card rounded-2xl overflow-hidden border border-border/50 shadow-2xl animate-float">
              <div class="w-full bg-background flex flex-col">
                <div class="h-10 border-b flex items-center px-4 gap-2 bg-background/80 shrink-0">
                  <div class="w-3 h-3 rounded-full bg-red-400"></div>
                  <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div class="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
                  <img src="${this.copy.screenshotChatSrc}" alt="${this.copy.screenshotChatAlt}" class="w-full h-auto object-cover border-t border-border/40" />
                  <img src="${this.copy.screenshotSrc}" alt="${this.copy.screenshotAlt}" class="w-full h-auto object-cover border-t border-border/40" />
                  <img src="${this.copy.screenshotChannelsSrc}" alt="${this.copy.screenshotChannelsAlt}" class="w-full h-auto object-cover border-t border-border/40" />
                  <img src="${this.copy.screenshotBrowserSrc}" alt="${this.copy.screenshotBrowserAlt}" class="w-full h-auto object-cover border-t border-border/40" />
                </div>
              </div>
            </div>
          </div>
          ` : ''}
        </main>

        ${this.route === 'home' ? `
        <section class="py-20 px-6 z-10 w-full max-w-5xl mx-auto">
          <div class="text-center mb-12">
            <h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-4">${this.copy.deployTitle}</h2>
            <p class="text-muted-foreground text-lg max-w-2xl mx-auto">${this.copy.deploySubtitle}</p>
          </div>
          <div class="flex flex-wrap justify-center gap-6">
            ${this.copy.deployPlatforms.map((p) => `
              <div class="glass-card rounded-2xl p-6 flex flex-col items-center gap-3 w-36 hover:-translate-y-1 transition-transform border border-border/50">
                <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <i data-lucide="${p.icon}" class="w-6 h-6"></i>
                </div>
                <span class="text-sm font-medium">${p.label}</span>
              </div>`).join('')}
          </div>
        </section>

        <section class="py-20 px-6 z-10 w-full max-w-6xl mx-auto">
          <div class="text-center mb-12">
            <h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-4">${this.copy.channelsTitle}</h2>
            <p class="text-muted-foreground text-lg max-w-2xl mx-auto">${this.copy.channelsSubtitle}</p>
          </div>
          <div class="flex flex-wrap justify-center gap-4">
            ${this.copy.channels.map((c) => `
              <div class="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 hover:-translate-y-0.5 transition-transform border border-border/50">
                <img src="${c.logo}" alt="${c.name}" class="w-7 h-7 object-contain flex-shrink-0" />
                <span class="text-sm font-medium whitespace-nowrap">${c.name}</span>
              </div>`).join('')}
          </div>
        </section>

        <section class="py-20 px-6 z-10 w-full max-w-6xl mx-auto">
          <div class="text-center mb-12">
            <h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-4">${this.copy.providersTitle}</h2>
            <p class="text-muted-foreground text-lg max-w-2xl mx-auto">${this.copy.providersSubtitle}</p>
          </div>
          <div class="flex flex-wrap justify-center gap-4">
            ${this.copy.providers.map((p) => `
              <div class="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 hover:-translate-y-0.5 transition-transform border border-border/50">
                <img src="${p.logo}" alt="${p.name}" class="w-7 h-7 object-contain flex-shrink-0" />
                <span class="text-sm font-medium whitespace-nowrap">${p.name}</span>
              </div>`).join('')}
          </div>
        </section>

        ${this.locale === 'zh' ? `
        <section class="py-20 px-6 z-10 w-full max-w-5xl mx-auto">
          <div class="text-center mb-10">
            <h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-4">一图看懂 NextClaw</h2>
            <p class="text-muted-foreground text-lg max-w-2xl mx-auto">核心优势、生态定位与技术对比，一目了然。</p>
          </div>
          <div class="glass-card rounded-2xl overflow-hidden border border-border/50 shadow-xl">
            <img
              src="/nextclaw-omni-assistant-cn.jpg"
              alt="NextClaw 产品全景：核心优势、生态对比与自动化功能"
              class="w-full h-auto"
              loading="lazy"
            />
          </div>
        </section>
        ` : ''}

        <section id="features" class="relative py-24 px-6 z-10 w-full max-w-7xl mx-auto">
          <div class="text-center mb-16 animate-slide-up opacity-0 relative" style="animation-delay: 0.1s">
            <h2 class="text-3xl md:text-5xl font-bold tracking-tight mb-4">${this.copy.featuresTitle}</h2>
            <p class="text-muted-foreground text-lg max-w-2xl mx-auto">${this.copy.featuresSubtitle}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${this.copy.features
        .map(
          (feature, index) => `
              <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: ${0.2 + index * 0.1}s">
                <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
                  <i data-lucide="${feature.icon}" class="w-6 h-6"></i>
                </div>
                <h3 class="text-xl font-semibold mb-2">${feature.title}</h3>
                <p class="text-muted-foreground leading-relaxed">${feature.description}</p>
              </div>`
        )
        .join('')}
          </div>
        </section>

        <section class="py-20 px-6 z-10 w-full max-w-6xl mx-auto">
          <div class="text-center mb-12">
            <h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-4">${this.copy.comparisonTitle}</h2>
            <p class="text-muted-foreground text-lg max-w-2xl mx-auto">${this.copy.comparisonSubtitle}</p>
          </div>
          <div class="glass-card rounded-2xl border border-border/50 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border/40">
                  <th class="px-4 py-4 text-left font-semibold sticky left-0 bg-white/90 backdrop-blur-sm z-10 min-w-[100px]"></th>
                  ${this.copy.comparisonProjects.map((p, i) => `
                    <th class="px-4 py-4 text-center font-semibold min-w-[120px] ${i === 0 ? 'text-primary' : ''}">${p}</th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${this.copy.comparison.map((row) => `
                  <tr class="border-b border-border/20 last:border-0">
                    <td class="px-4 py-4 font-medium text-muted-foreground sticky left-0 bg-white/90 backdrop-blur-sm z-10">${row.dimension}</td>
                    ${row.values.map((v, i) => `
                      <td class="px-4 py-4 text-center ${i === 0 ? 'text-primary font-medium' : 'text-muted-foreground'}">${v}</td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" class="py-20 px-6 z-10 w-full max-w-4xl mx-auto">
          <div class="text-center mb-12">
            <h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-4">${this.copy.faqTitle}</h2>
            <p class="text-muted-foreground text-lg max-w-2xl mx-auto">${this.copy.faqSubtitle}</p>
          </div>
          <div class="space-y-4">
            ${this.copy.faq.map((item) => `
              <details class="glass-card rounded-2xl border border-border/50 group">
                <summary class="px-6 py-5 cursor-pointer flex items-center justify-between text-left font-medium hover:text-primary transition-colors list-none">
                  <span>${item.question}</span>
                  <i data-lucide="chevron-down" class="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform shrink-0 ml-4"></i>
                </summary>
                <div class="px-6 pb-5 text-muted-foreground leading-relaxed">
                  ${item.answer}
                </div>
              </details>`).join('')}
          </div>
        </section>

        <section class="py-24 px-6 z-10 w-full max-w-4xl mx-auto text-center">
          <div class="glass-card rounded-[2rem] p-12 relative overflow-hidden">
            <div class="absolute inset-0 bg-primary/5"></div>
            <div class="relative z-10">
              <h2 class="text-3xl md:text-5xl font-bold mb-6">${this.copy.ctaTitle}</h2>
              <p class="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">${this.copy.ctaDescription}</p>
              <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 shadow-xl shadow-primary/20 focus:ring-2 focus:ring-primary focus:outline-none text-lg">
                ${this.copy.ctaButton}
                <i data-lucide="arrow-right" class="w-5 h-5 ml-1"></i>
              </a>
            </div>
          </div>
        </section>

        <section id="community" class="py-20 px-6 z-10 w-full max-w-4xl mx-auto">
          <div class="text-center mb-12">
            <h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-3">${this.copy.communityTitle}</h2>
            <p class="text-muted-foreground text-lg">${this.copy.communitySubtitle}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <a href="${LINKS.wechatGroupImage}" target="_blank" rel="noopener noreferrer" class="glass-card rounded-2xl p-6 flex flex-col items-center gap-4 hover:-translate-y-1 transition-transform focus:ring-2 focus:ring-primary focus:outline-none">
              <img src="${LINKS.wechatGroupImage}" alt="${this.copy.communityWechatLabel}" class="w-40 h-40 object-contain rounded-lg" />
              <span class="font-medium text-foreground">${this.copy.communityWechatLabel}</span>
              <span class="text-sm text-muted-foreground">${this.copy.communityScanHint}</span>
            </a>
            <a href="${LINKS.discord}" target="_blank" rel="noopener noreferrer" class="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:-translate-y-1 transition-transform focus:ring-2 focus:ring-primary focus:outline-none">
              <div class="w-20 h-20 rounded-2xl bg-[#5865F2] flex items-center justify-center text-white">
                <svg class="w-12 h-12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.075.075 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </div>
              <span class="font-medium text-foreground text-lg">${this.copy.communityDiscordLabel}</span>
              <span class="text-sm text-muted-foreground">NextClaw / OpenClaw</span>
            </a>
          </div>
        </section>
        ` : ''}

        <footer class="w-full border-t border-border/40 py-10 z-10 bg-background/50 backdrop-blur-sm mt-auto">
          <div class="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div class="flex items-center gap-2 opacity-80">
              <img src="/logo-phoenix.svg" alt="NextClaw" class="w-6 h-6" />
              <span class="font-medium text-sm">${this.copy.footerProject}</span>
            </div>
            <div class="text-sm text-muted-foreground">${this.copy.footerLicense}</div>
            <div class="flex gap-4">
              <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.footerDocs}</a>
              <a href="${LINKS.github}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
              <a href="${LINKS.npm}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.footerNpm}</a>
              <a href="${LINKS.discord}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.footerDiscord}</a>
              <a href="${LINKS.wechatGroupImage}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors" title="${this.copy.footerWechatGroup}">${this.copy.footerWechatGroup}</a>
            </div>
          </div>
        </footer>

        <div class="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div class="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]"></div>
          <div class="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px]"></div>
        </div>
      </div>
    `;

    this.bindLocaleSelect();
    this.bindHomeLinkAction();
    this.bindInstallModeActions();
    this.bindCopyAction();
    this.bindMobileMenu();
    this.bindCommunityQrModal();
    this.bindDesktopDownloads();
    this.runTerminalAnimation();
    createIcons({ icons, nameAttr: 'data-lucide' });
  };

  private bindDesktopDownloads = (): void => {
    const versionNode = document.querySelector<HTMLElement>('#desktop-version');
    const detectedNode = document.querySelector<HTMLElement>('#desktop-detected-platform');
    const releasePrimary = document.querySelector<HTMLAnchorElement>('#desktop-release-link');
    const releaseSecondary = document.querySelector<HTMLAnchorElement>('#desktop-release-link-secondary');

    const linkNodes: Record<DownloadAssetKey, HTMLAnchorElement | null> = {
      macArm64Dmg: document.querySelector<HTMLAnchorElement>('[data-download-link="macArm64Dmg"]'),
      macX64Dmg: document.querySelector<HTMLAnchorElement>('[data-download-link="macX64Dmg"]'),
      windowsX64Zip: document.querySelector<HTMLAnchorElement>('[data-download-link="windowsX64Zip"]'),
      linuxX64AppImage: document.querySelector<HTMLAnchorElement>('[data-download-link="linuxX64AppImage"]')
    };

    if (
      !linkNodes.macArm64Dmg ||
      !linkNodes.macX64Dmg ||
      !linkNodes.windowsX64Zip ||
      !linkNodes.linuxX64AppImage ||
      !releasePrimary ||
      !releaseSecondary
    ) {
      return;
    }
    const macDownloadLink = linkNodes.macArm64Dmg;
    const macX64DownloadLink = linkNodes.macX64Dmg;
    const windowsDownloadLink = linkNodes.windowsX64Zip;
    const linuxDownloadLink = linkNodes.linuxX64AppImage;

    const cardNodes: Record<DownloadAssetKey, HTMLElement | null> = {
      macArm64Dmg: document.querySelector<HTMLElement>('[data-download-card="macArm64Dmg"]'),
      macX64Dmg: document.querySelector<HTMLElement>('[data-download-card="macX64Dmg"]'),
      windowsX64Zip: document.querySelector<HTMLElement>('[data-download-card="windowsX64Zip"]'),
      linuxX64AppImage: document.querySelector<HTMLElement>('[data-download-card="linuxX64AppImage"]')
    };

    const applyReleaseInfo = (release: DesktopReleaseInfo): void => {
      if (versionNode) {
        versionNode.textContent = release.version;
      }
      if (releasePrimary) {
        releasePrimary.textContent = release.tag;
        releasePrimary.href = release.url;
      }
      if (releaseSecondary) {
        releaseSecondary.href = release.url;
      }
      macDownloadLink.setAttribute('href', release.assets.macArm64Dmg);
      macX64DownloadLink.setAttribute('href', release.assets.macX64Dmg);
      windowsDownloadLink.setAttribute('href', release.assets.windowsX64Zip);
      linuxDownloadLink.setAttribute('href', release.assets.linuxX64AppImage);
    };

    const recommended = detectRecommendedDesktopAsset();
    const userAgent = navigator.userAgent.toLowerCase();
    if (detectedNode) {
      if (recommended === 'unknown') {
        if (userAgent.includes('mac')) {
          detectedNode.textContent = this.locale === 'zh' ? 'macOS（请选择芯片）' : 'macOS (choose your chip)';
        } else {
          detectedNode.textContent = this.copy.downloadUnknownPlatform;
        }
      } else {
        const match = this.copy.downloadOptions.find((option) => option.key === recommended);
        detectedNode.textContent = match?.title ?? this.copy.downloadUnknownPlatform;
      }
    }

    if (recommended !== 'unknown') {
      const recommendedCard = cardNodes[recommended];
      if (recommendedCard) {
        recommendedCard.classList.add('ring-2', 'ring-primary/60', 'shadow-xl', 'shadow-primary/10');
      }
    }

    applyReleaseInfo(DESKTOP_RELEASE_FALLBACK);

    void (async () => {
      const latestRelease = await fetchLatestStableDesktopRelease();
      if (!latestRelease) {
        return;
      }
      applyReleaseInfo(latestRelease);
    })();
  };

  private bindMobileMenu = (): void => {
    const menuBtn = document.querySelector<HTMLButtonElement>('#mobile-menu-btn');
    const mobileMenu = document.querySelector<HTMLElement>('#mobile-menu');
    if (!menuBtn || !mobileMenu) {
      return;
    }
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
    // Close menu when clicking a link
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  };

  private bindCommunityQrModal = (): void => {
    const btn = document.querySelector<HTMLButtonElement>('#community-qr-btn');
    const modal = document.querySelector<HTMLElement>('#community-qr-modal');
    if (!btn || !modal) {
      return;
    }
    btn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    });
    modal.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  };

  private bindLocaleSelect = (): void => {
    const select = document.querySelector<HTMLSelectElement>('#locale-select');
    if (!select) {
      return;
    }
    select.addEventListener('change', () => {
      const next = select.value;
      if (!isLocale(next) || next === this.locale) {
        return;
      }
      persistLocale(next);
      window.location.href = ROUTES[next][this.route];
    });
  };

  private bindHomeLinkAction = (): void => {
    const homeLink = document.querySelector<HTMLAnchorElement>('#home-link');
    if (!homeLink) {
      return;
    }
    homeLink.addEventListener('click', (event) => {
      if (this.route !== 'home') {
        return;
      }
      event.preventDefault();
      if (window.location.hash) {
        window.history.replaceState(null, '', ROUTES[this.locale].home);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    });
  };

  private bindCopyAction = (): void => {
    const copyBtn = document.querySelector<HTMLButtonElement>('#copy-btn');
    if (!copyBtn) {
      return;
    }
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.getInstallCommand());
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = `<span class="text-xs">${this.copy.copiedText}</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = original;
          createIcons({ icons, nameAttr: 'data-lucide' });
        }, 1500);
      } catch (error) {
        console.error('Failed to copy command', error);
      }
    });
  };

  private bindInstallModeActions = (): void => {
    const installButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-install-mode]'));
    if (!installButtons.length) {
      return;
    }

    this.updateInstallModeButtonStates(installButtons);

    for (const button of installButtons) {
      button.addEventListener('click', () => {
        const mode = button.dataset.installMode;
        if (!isInstallMode(mode) || mode === this.activeInstallMode) {
          return;
        }
        this.activeInstallMode = mode;
        this.updateInstallModeButtonStates(installButtons);
        this.runTerminalAnimation();
      });
    }
  };

  private updateInstallModeButtonStates = (buttons: HTMLButtonElement[]): void => {
    for (const button of buttons) {
      const mode = button.dataset.installMode;
      const isActive = isInstallMode(mode) && mode === this.activeInstallMode;
      button.classList.toggle('bg-primary', isActive);
      button.classList.toggle('text-primary-foreground', isActive);
      button.classList.toggle('hover:bg-primary/90', isActive);
      button.classList.toggle('text-muted-foreground', !isActive);
      button.classList.toggle('hover:text-foreground', !isActive);
    }
  };

  private getInstallCommand = (mode: InstallMode = this.activeInstallMode): string => {
    if (mode === 'docker') {
      return 'curl -fsSL https://nextclaw.io/install-docker.sh | bash';
    }
    return 'npm install -g nextclaw && nextclaw start';
  };

  private runTerminalAnimation = (): void => {
    const terminalContent = document.querySelector<HTMLElement>('#terminal-content');
    if (!terminalContent) {
      return;
    }

    if (this.terminalAnimationTimer !== null) {
      window.clearTimeout(this.terminalAnimationTimer);
      this.terminalAnimationTimer = null;
    }

    this.terminalAnimationRunId += 1;
    const runId = this.terminalAnimationRunId;
    const installCommand = this.getInstallCommand();

    terminalContent.innerHTML = `
      <div class="flex items-center text-[#d4c8be]">
        <span class="text-[#8eb079] mr-2">~</span>
        <span class="text-[#e29e57] mr-2 font-bold">$</span>
        <span id="install-cmd"></span>
      </div>
    `;
    const installCmd = terminalContent.querySelector<HTMLElement>('#install-cmd');
    if (!installCmd) {
      return;
    }

    const startupSequence: Array<{ text: string; icon?: string; color?: string }> = [
      { text: this.copy.terminalStarted, icon: '✓', color: '#8eb079' },
      { text: 'UI:  http://127.0.0.1:55667', icon: '→', color: '#7eb6d4' },
      { text: 'API: http://127.0.0.1:55667/api', icon: '→', color: '#7eb6d4' }
    ];

    const isStale = (): boolean => runId !== this.terminalAnimationRunId;
    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const typeText = async (element: HTMLElement, text: string, speed = 36): Promise<void> => {
      for (let index = 0; index < text.length; index += 1) {
        if (isStale()) {
          return;
        }
        element.textContent += text[index];
        await sleep(speed);
      }
    };

    const addLine = async (content: { text: string; icon?: string; color?: string }): Promise<void> => {
      if (isStale()) {
        return;
      }
      const line = document.createElement('div');
      line.className = 'flex items-center mt-3';
      line.innerHTML = `
        <span class="mr-2 font-bold" style="color: ${content.color}">${content.icon}</span>
        <span style="color: ${content.color}">${content.text}</span>
      `;
      terminalContent.appendChild(line);
      await sleep(120);
    };

    const addCursor = (): void => {
      if (isStale()) {
        return;
      }
      const cursorLine = document.createElement('div');
      cursorLine.className = 'flex items-center mt-3';
      cursorLine.innerHTML = `
        <span class="text-[#8eb079] mr-2">~</span>
        <span class="text-[#e29e57] mr-2 font-bold">$</span>
        <span class="terminal-cursor"></span>
      `;
      terminalContent.appendChild(cursorLine);
    };

    const run = async (): Promise<void> => {
      await typeText(installCmd, installCommand, 34);
      await sleep(550);
      if (isStale()) {
        return;
      }
      for (const item of startupSequence) {
        await addLine(item);
        await sleep(180);
        if (isStale()) {
          return;
        }
      }
      addCursor();
    };

    this.terminalAnimationTimer = window.setTimeout(() => {
      this.terminalAnimationTimer = null;
      void run();
    }, 360);
  };
}

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('Missing #app mount element');
}

const locale = resolvePageLocale();
const route = resolvePageRoute();
persistLocale(locale);
new LandingPage(root, locale, route).render();
