import './style.css';
import './runtime-showcase.css';
import { createIcons, icons } from 'lucide';
import {
  DESKTOP_RELEASE_FALLBACK,
  detectRecommendedDesktopAsset,
  fetchLatestStableDesktopRelease,
  type DesktopReleaseInfo,
  type DownloadAssetKey
} from '@/shared/lib/desktop-release';
import {
  COMPARISON_COPY,
  isLocale,
  LINKS,
  LOCALE_OPTIONS,
  persistLocale,
  renderHomeSections,
  renderIntegrationsPage,
  renderLandingHomeHero,
  renderLandingRouteHero,
  renderLandingFooter,
  renderReleasesPage,
  renderUseCasesPage,
  resolvePageLocale,
  resolvePageRoute,
  RUNTIME_SHOWCASE_COPY,
  ROUTES,
  type DownloadOption,
  type InstallMethod,
  type LandingCopy,
  type Locale,
  type PageRoute
} from '@/shared/lib/landing-content';

declare global {
  interface Window {
    __NEXTCLAW_LOCALE__?: string;
    __NEXTCLAW_ROUTE__?: string;
  }
}

const COPY: Record<Locale, LandingCopy> = {
  en: {
    navDownload: 'Download & install',
    navUseCases: 'Use cases',
    navCompare: 'Why NextClaw',
    navIntegrations: 'Integrations',
    navCommunity: 'Join community',
    navDocs: 'Docs',
    heroTitleLine1: 'NextClaw, your long-term personal AI partner',
    heroDescription: 'Give NextClaw a task. It uses files and tools on your device to do the work, leaving results you can inspect and refine.',
    heroDownloadButton: 'Download Desktop',
    heroSecondaryButton: 'Browse task guides',
    heroInstallLink: 'View all install options',
    heroInstallDescription: 'Ready to use after installation, with no extra setup',
    heroScreenshotAlt: 'NextClaw project files open beside an inspectable task result',
    downloadTitle: 'Download & install NextClaw',
    downloadSubtitle: 'Desktop is recommended for most people. npm and Docker options are available below for terminals, servers, and NAS devices.',
    downloadDesktopTitle: 'Desktop app (recommended)',
    downloadDesktopSubtitle: 'Choose your device and download the latest stable installer.',
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
      'Run the Setup.exe installer.',
      'Choose the install location and create shortcuts if needed.',
      'Launch NextClaw Desktop from the desktop or Start menu.',
      'If SmartScreen appears, click More info -> Run anyway.'
    ],
    downloadLinuxGuideSteps: [
      'Download the AppImage file.',
      'Run: chmod +x NextClaw.Desktop-*.AppImage',
      'Run: ./NextClaw.Desktop-*.AppImage'
    ],
    downloadWindowsPortableLabel: 'Need the portable ZIP instead?',
    downloadWindowsPortableDescription: 'Use the unpacked ZIP when you want a no-install fallback or portable copy.',
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
        key: 'windowsX64Installer',
        icon: 'monitor',
        title: 'Windows (x64)',
        description: 'Recommended Setup.exe installer with a proper setup wizard and shortcuts.',
        buttonLabel: 'Download Installer'
      },
      {
        key: 'linuxX64AppImage',
        icon: 'terminal',
        title: 'Linux (x64)',
        description: 'Single-file AppImage package for mainstream Linux distributions.',
        buttonLabel: 'Download AppImage'
      }
    ],
    installCopyLabel: 'Copy',
    installCopiedText: 'Copied',
    installMethods: [
      {
        key: 'npm',
        icon: 'terminal',
        title: 'npm CLI',
        description: 'Use this when you already work from a terminal or want to run NextClaw on a server.',
        buttonLabel: 'Quickstart',
        command: 'npm install -g nextclaw && nextclaw start',
        docsPath: 'guide/getting-started'
      },
      {
        key: 'docker',
        icon: 'box',
        title: 'Docker deployment',
        description: 'Keep NextClaw available on a VPS, NAS, or cloud VM. Unused messaging channels do not keep separate processes resident.',
        buttonLabel: 'Docker guide', command: 'curl -fsSL https://nextclaw.io/install-docker.sh | bash',
        docsPath: 'guide/tutorials/docker-one-click'
      }
    ],
    docsButton: 'Read the Docs',
    screenshotChatSrc: new URL('../../../images/screenshots/nextclaw-workspace-explorer-en.png', import.meta.url).href,
    showcaseTitle: 'Start work in one connected workspace.',
    showcaseSubtitle:
      'Use conversations, skills, browser panels, and task context together without switching between separate tools.',
    showcaseItems: [
      {
        eyebrow: 'Main workbench',
        title: 'Start a task and keep its context visible',
        description: 'Ask for a goal, review the current context, and continue from the same conversation.',
        imageSrc: '/nextclaw-chat-page-en.png', imageAlt: 'NextClaw main chat workbench'
      },
      {
        eyebrow: 'Agents',
        title: 'Keep a dedicated Agent for each kind of work',
        description: 'Each Agent can keep its own role, workspace, memory, and skills, with a default Runtime when useful.',
        imageSrc: new URL('../../../images/screenshots/nextclaw-agents-page-en.png', import.meta.url).href, imageAlt: 'NextClaw agent management page'
      },
      {
        eyebrow: 'Channels',
        title: 'Bring messaging apps into the same workflow',
        description: 'Connect WeChat, Feishu/Lark, QQ, and other channels so agents can work from the places you already use.',
        imageSrc: new URL('../../../images/screenshots/nextclaw-channels-page-en.png', import.meta.url).href, imageAlt: 'NextClaw message channel settings'
      },
      {
        eyebrow: 'Skill market',
        title: 'Add capabilities without leaving the workspace',
        description: 'Browse, install, and manage skills from the same task surface.',
        imageSrc: '/nextclaw-skills-page-en.png', imageAlt: 'NextClaw skill market'
      }
    ],
    runtimeShowcase: RUNTIME_SHOWCASE_COPY.en,
    appSurfaceTitle: 'Keep apps, files, and results beside the task.',
    appSurfaceSubtitle:
      'Open a small app, preview local files, render HTML, generate images, or keep references on the side while the conversation continues.',
    appSurfaceItems: [
      {
        eyebrow: 'Panel App',
        title: 'Run a small app while the chat stays open',
        description: 'Use a reading card, market board, Markdown editor, or generated page directly on the side.',
        imageSrc: '/nextclaw-panel-app-running-en.png', imageAlt: 'A running NextClaw Panel App'
      },
      {
        eyebrow: 'Project files',
        title: 'Manage files without leaving the preview',
        description: 'Keep the project tree beside code, Markdown, HTML, Word, Excel, and PowerPoint. Create, upload, rename, download, or add files to the conversation in place.',
        imageSrc: new URL('../../../images/screenshots/nextclaw-workspace-explorer-en.png', import.meta.url).href, imageAlt: 'NextClaw project Explorer beside a Markdown file preview'
      },
      {
        eyebrow: 'Image generation',
        title: 'Reuse generated images in the same task',
        description: 'Create visuals for writing, product drafts, or material collection, then keep the local file with the conversation.',
        imageSrc: '/nextclaw-image-generation-result-en.png', imageAlt: 'NextClaw image generation result'
      },
      {
        eyebrow: 'Doc Browser',
        title: 'Leave references open on the side',
        description: 'Keep docs, skill details, and reference pages in the global side browser while you keep working.',
        imageSrc: '/nextclaw-skills-doc-browser-en.png', imageAlt: 'NextClaw right-side Doc Browser'
      },
      {
        eyebrow: 'App library',
        title: 'Manage the small apps you use often',
        description: 'Find task boards, dashboards, config browsers, and other local tools from the Panel Apps page.',
        imageSrc: '/nextclaw-panel-apps-page-en.png', imageAlt: 'NextClaw Panel Apps list'
      }
    ],
    ecosystemTitle: 'Bring the models, channels, and tools you already use.',
    ecosystemSubtitle:
      'NextClaw is the work surface. Providers, messaging channels, skills, and local tools connect behind it.',
    integrationsTitle: 'Connect the models, channels, and tools around your work.',
    integrationsSubtitle:
      'Use your preferred model provider, receive work from messaging apps, add skills, and keep local files or command-line tools available to the same task.',
    integrationsDocsButton: 'Read integration docs',
    integrationsInstallButton: 'View install options',
    integrationShowcaseItems: [
      {
        eyebrow: 'Model providers',
        title: 'Start free, or connect your own provider',
        description: 'New installations include free-trial models with no API key required. You can also configure OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, and compatible services.',
        imageSrc: '/nextclaw-providers-page-en.png',
        imageAlt: 'NextClaw model provider settings'
      },
      {
        eyebrow: 'Message channels',
        title: 'Let requests arrive from the places people already talk',
        description: 'Connect Weixin, Feishu/Lark, QQ, DingTalk, WeCom, Telegram, Discord, Slack, email, and other channels.',
        imageSrc: new URL('../../../images/screenshots/nextclaw-channels-page-en.png', import.meta.url).href,
        imageAlt: 'NextClaw message channel settings'
      },
      {
        eyebrow: 'Skills',
        title: 'Install new abilities from the workbench',
        description: 'Browse, install, and manage skills so each task can bring in the capability it needs.',
        imageSrc: '/nextclaw-skills-page-en.png',
        imageAlt: 'NextClaw skill market'
      }
    ],
    ecosystemGroups: [
      {
        icon: 'brain-circuit',
        title: 'Model providers',
        description: 'Start with built-in free-trial models, or point NextClaw at your own provider or compatible endpoint.',
        items: [
          { label: 'OpenRouter', logo: '/logos/openrouter.svg' },
          { label: 'OpenAI', logo: '/logos/openai.svg' },
          { label: 'Anthropic', logo: '/logos/anthropic.svg' },
          { label: 'Gemini', logo: '/logos/gemini.svg' },
          { label: 'DeepSeek', logo: '/logos/deepseek.png' },
          { label: 'MiniMax', logo: '/logos/minimax.svg' },
          { label: 'Moonshot', logo: '/logos/moonshot.png' },
          { label: 'DashScope', logo: '/logos/dashscope.png' },
          { label: 'Zhipu', logo: '/logos/zhipu.svg' },
          { label: 'AiHubMix', logo: '/logos/aihubmix.png' },
          { label: 'vLLM', logo: '/logos/vllm.svg' },
          { label: 'Custom model' }
        ]
      },
      {
        icon: 'message-circle',
        title: 'Message channels',
        description: 'Let the same assistant reach the chat apps and work tools your team already uses.',
        items: [
          { label: 'Weixin' },
          { label: 'Feishu', logo: '/logos/feishu.svg' },
          { label: 'QQ', logo: '/logos/qq.svg' },
          { label: 'DingTalk', logo: '/logos/dingtalk.svg' },
          { label: 'WeCom', logo: '/logos/wecom.svg' },
          { label: 'Telegram', logo: '/logos/telegram.svg' },
          { label: 'Discord', logo: '/logos/discord.svg' },
          { label: 'Slack', logo: '/logos/slack.svg' },
          { label: 'Email', logo: '/logos/email.svg' },
          { label: 'WhatsApp', logo: '/logos/whatsapp.svg' }
        ]
      },
      {
        icon: 'blocks',
        title: 'Skills and automations',
        description: 'Add skills, run scheduled work, call CLI tools, and keep results tied to the task.',
        items: [
          { label: 'Skill Market' },
          { label: 'MCP' },
          { label: 'CLI tools' },
          { label: 'Cron jobs' },
          { label: 'Browser work' },
          { label: 'Local files' }
        ]
      }
    ],
    useCasesTitle: 'Hand it the kind of work you already do.',
    useCasesSubtitle:
      'Start with the task, not the tool. NextClaw can pull in models, channels, browser work, files, and skills when the job needs them.',
    useCasesPageTitle: 'What can you do with NextClaw?',
    useCasesPageSubtitle:
      'These are concrete jobs people can hand to a local AI workbench: collect sources, analyze data, write drafts, build small tools, process files, and keep recurring work moving.',
    useCasesCtaTitle: 'Start from one real task.',
    useCasesCtaDescription: 'Download the desktop app, then try a task you already have: a report, a folder of files, a chat request, or a small tool you have been meaning to build.',
    useCases: [
      { icon: 'messages-square', title: 'Handle a question from a team chat', description: 'Let a request arrive from Weixin, Feishu, QQ, DingTalk, Discord, or Telegram, then continue the deeper work in the workbench.' },
      { icon: 'bar-chart-3', title: 'Collect data and turn it into a report', description: 'Pull data from pages, CSVs, or spreadsheets, clean it up, draw charts, and keep the conclusion next to the source material.' },
      { icon: 'search', title: 'Research a topic and compare options', description: 'Gather pages, notes, and references, then produce a short brief, source list, and comparison table.' },
      { icon: 'pen-line', title: 'Draft a report, article, or proposal', description: 'Bring notes, references, and examples into the same task, then shape them into a usable draft.' },
      { icon: 'list-checks', title: 'Sort feedback into priorities', description: 'Turn comments, tickets, or chat logs into issue groups, priority levels, and follow-up actions.' },
      { icon: 'calendar-clock', title: 'Send the morning brief automatically', description: 'Collect updates, reminders, or health checks on a schedule and send the brief to the right channel.' },
      { icon: 'app-window', title: 'Build a small tool for yourself', description: 'Turn a repeated task into a small local app, script, or workflow, then keep improving it from the same conversation.' },
      { icon: 'files', title: 'Clean up a pile of files', description: 'Rename files, extract text, group materials, or turn scattered documents into a short action list.' }
    ],
    comparison: COMPARISON_COPY.en,
    releasesTitle: 'Product updates',
    releasesSubtitle:
      'See what changed in recent NextClaw releases, including new capabilities, improvements, fixes, and install or desktop updates.',
    releasesGitHubButton: 'View GitHub Releases',
    releasesDownloadButton: 'Download latest desktop',
    releaseNotes: [
      {
        category: 'New',
        title: 'A project Explorer beside every file preview',
        description: 'The session workspace now keeps the project tree and file preview together, so file work stays continuous.',
        items: [
          'Open several files in tabs without switching back to a separate directory page.',
          'Create files and folders, upload, download, rename, delete, copy paths, or add project items to the conversation.',
          'Resize the Explorer and keep that width after a refresh; read-only tools from the same Native turn can also run concurrently.'
        ]
      },
      {
        category: 'Improved',
        title: 'File interactions follow familiar editor conventions',
        description: 'Context menus, inline creation, breadcrumbs, and text selection stay compact and predictable.',
        items: [
          'Folders no longer expose an ambiguous Open action.',
          'New items scroll into view, and breadcrumbs remain on one line when space is tight.',
          'Selection controls coexist correctly with Explorer and workspace resizing.'
        ]
      },
      {
        category: 'Fixed',
        title: 'More resilient long-running conversations',
        description: 'Message connections and startup recovery now handle interruptions and large histories more safely.',
        items: [
          'Idle SSE connections send keepalives and short interruptions can recover before reconnecting.',
          'Large journals are scanned one session and one line at a time to reduce peak memory.',
          'Message editing pauses while NCP starts and returns automatically when the service is ready.'
        ]
      }
    ],
    featuresTitle: 'Let different helpers join the same task.',
    featuresSubtitle:
      'Research, data, writing, code, channels, and schedules can each do their part without forcing you to start over in another tool.',
    features: [
      { icon: 'search', title: 'Research helper', description: 'Collect web pages, notes, and references before the answer turns into a brief or comparison.' },
      { icon: 'bar-chart-3', title: 'Data helper', description: 'Read files or pages, clean the numbers, and turn the result into a table, chart, or report.' },
      { icon: 'pen-line', title: 'Writing helper', description: 'Shape rough notes, links, and old drafts into text you can keep editing.' },
      { icon: 'code-2', title: 'Builder helper', description: 'Create a small script, local app, or workflow when a repeated job deserves its own tool.' },
      { icon: 'messages-square', title: 'Channel helper', description: 'Bring work in from chat apps and send the finished answer back where people already are.' },
      { icon: 'calendar-clock', title: 'Schedule helper', description: 'Run briefs, checks, reminders, or follow-ups on a schedule and keep the records visible.' }
    ],
    ctaTitle: 'Ready to upgrade your AI?',
    ctaDescription: 'Install, open a task, and use the built-in free-trial model without adding an API key.',
    ctaButton: 'View Documentation',
    footerProject: 'NextClaw Project',
    footerLicense: 'Released under the MIT License.',
    footerDocs: 'Docs',
    footerReleases: 'Updates',
    footerNpm: 'NPM',
    footerWechatGroup: 'WeChat Group',
    communityTitle: 'Join the community',
    communitySubtitle: 'Scan the QR code to join the NextClaw WeChat group.',
    communityWechatLabel: 'WeChat Group QR',
    communityScanHint: 'Scan to join',
    faqTitle: 'Frequently Asked Questions',
    faqSubtitle: 'Quick answers to common questions about NextClaw.',
    faq: [
      {
        question: 'What is the difference between NextClaw and OpenClaw?',
        answer: 'NextClaw is inspired by OpenClaw and stays compatible with its plugin ecosystem. The main differences are: (1) One-command startup with a built-in UI for configuration, (2) Smaller codebase (~1/20 of OpenClaw) for easier maintenance, (3) Better support for Chinese domestic channels like QQ, Feishu, and DingTalk.'
      }
    ]
  },
  zh: {
    navDownload: '下载与安装',
    navUseCases: '使用场景',
    navCompare: '为什么选择',
    navIntegrations: '集成',
    navCommunity: '加入社群',
    navDocs: '文档',
    heroTitleLine1: 'NextClaw，你的长期个人智能搭档',
    heroDescription: '把任务交给 NextClaw。它会使用你设备上的文件和工具完成工作，结果由你检查和继续完善。',
    heroDownloadButton: '下载桌面版',
    heroSecondaryButton: '查看任务案例',
    heroInstallLink: '查看全部安装方式',
    heroInstallDescription: '安装完成即可使用，无需额外配置',
    heroScreenshotAlt: 'NextClaw 工作台中的任务会话、数据图表与项目文档',
    downloadTitle: '下载与安装 NextClaw',
    downloadSubtitle: '桌面版适合大多数用户；也可以通过 npm 或 Docker 安装到个人电脑、NAS 或服务器。',
    downloadDesktopTitle: '桌面版（推荐）',
    downloadDesktopSubtitle: '选择你的设备，下载最新稳定版安装包。',
    downloadVersionLabel: '当前桌面端版本',
    downloadDetectedLabel: '检测到的设备',
    downloadUnknownPlatform: '未知平台',
    downloadReleaseLabel: '发布标签',
    downloadReleaseLinkText: '查看完整发布资产',
    downloadUnsignedNotice:
      '未签名版本提示：首次打开可能触发系统拦截。macOS 请先点“完成”，再到“隐私与安全性”底部点击“仍要打开”。',
    downloadOpenGuideTitle: '首次打开说明',
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
      '运行 Setup.exe 安装器。',
      '按向导选择安装目录，并按需勾选桌面或开始菜单快捷方式。',
      '安装完成后，从桌面快捷方式或开始菜单启动 NextClaw Desktop。',
      '若出现 SmartScreen，点“更多信息” -> “仍要运行”。'
    ],
    downloadLinuxGuideSteps: [
      '下载 AppImage 文件。',
      '执行：chmod +x NextClaw.Desktop-*.AppImage',
      '执行：./NextClaw.Desktop-*.AppImage'
    ],
    downloadWindowsPortableLabel: '需要便携版 ZIP？',
    downloadWindowsPortableDescription: '想免安装使用，或留一个备用包，可以下载 ZIP 解压版。',
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
        key: 'windowsX64Installer',
        icon: 'monitor',
        title: 'Windows（x64）',
        description: '推荐使用带正式安装向导和快捷方式的 Setup.exe 安装器。',
        buttonLabel: '下载安装器'
      },
      {
        key: 'linuxX64AppImage',
        icon: 'terminal',
        title: 'Linux（x64）',
        description: '适用于主流 Linux 发行版的 AppImage 单文件包。',
        buttonLabel: '下载 AppImage'
      }
    ],
    installCopyLabel: '复制',
    installCopiedText: '已复制',
    installMethods: [
      {
        key: 'npm',
        icon: 'terminal',
        title: 'npm 命令行安装',
        description: '适合已经习惯终端，或想在服务器上运行 NextClaw 的用户。',
        buttonLabel: '快速开始',
        command: 'npm install -g nextclaw && nextclaw start',
        docsPath: 'guide/getting-started'
      },
      {
        key: 'docker',
        icon: 'box',
        title: 'Docker 部署',
        description: '适合在 VPS、NAS 或云主机上长期在线；未启用的消息渠道不会常驻独立进程。',
        buttonLabel: 'Docker 文档', command: 'curl -fsSL https://nextclaw.io/install-docker.sh | bash',
        docsPath: 'guide/tutorials/docker-one-click'
      }
    ],
    docsButton: '查看文档',
    screenshotChatSrc: new URL('../../../images/screenshots/nextclaw-hero-workbench-cn.png', import.meta.url).href,
    showcaseTitle: '把任务放在一个工作台里做。',
    showcaseSubtitle: '对话、技能、浏览器和资料放在一起，少一点来回切换。',
    showcaseItems: [
      {
        eyebrow: '主工作台',
        title: '先说要做什么，再一路接着做',
        description: '目标、资料和后续操作都留在同一个会话里。',
        imageSrc: '/nextclaw-chat-page-cn.png', imageAlt: 'NextClaw 主工作台'
      },
      {
        eyebrow: 'Agent 管理',
        title: '为不同工作保留独立的 Agent',
        description: '每个 Agent 都可以拥有自己的角色、主目录、记忆和技能，也可以设置默认 Runtime。',
        imageSrc: new URL('../../../images/screenshots/nextclaw-agents-page-cn.png', import.meta.url).href, imageAlt: 'NextClaw Agent 管理界面'
      },
      {
        eyebrow: '消息渠道',
        title: '微信、飞书等入口可以接进来',
        description: '把微信、飞书/Lark、QQ 等渠道接入后，Agent 可以在你常用的入口里继续工作。',
        imageSrc: new URL('../../../images/screenshots/nextclaw-channels-page-cn.png', import.meta.url).href, imageAlt: 'NextClaw 消息渠道设置'
      },
      {
        eyebrow: '技能市场',
        title: '需要新技能时直接安装',
        description: '浏览、安装和管理技能，不用跳出工作台。',
        imageSrc: '/nextclaw-skills-page-cn.png', imageAlt: 'NextClaw 技能市场'
      }
    ],
    runtimeShowcase: RUNTIME_SHOWCASE_COPY.zh,
    appSurfaceTitle: '小应用、文件和结果都在任务旁边。',
    appSurfaceSubtitle: '做网页、看源码、查资料、生成图片或打开自己的小工具时，右侧工作区会和当前会话一起留着。',
    appSurfaceItems: [
      {
        eyebrow: '面板应用',
        title: '小工具可以边聊边用',
        description: '阅读卡片、行情看板、Markdown 编辑器或临时做出来的页面，可以直接放在右侧运行。',
        imageSrc: '/nextclaw-panel-app-running-cn.png', imageAlt: '正在运行的 NextClaw 面板应用'
      },
      {
        eyebrow: '项目文件',
        title: '目录和预览同时留在工作区',
        description: '项目目录可以和代码、Markdown、HTML、Word、Excel、PowerPoint 预览同时打开，并就地新建、上传、重命名、下载或添加到聊天。',
        imageSrc: new URL('../../../images/screenshots/nextclaw-workspace-explorer-cn.png', import.meta.url).href, imageAlt: 'NextClaw 项目文件 Explorer 和 Markdown 预览同时打开'
      },
      {
        eyebrow: '图片生成',
        title: '生成图可以继续用在当前任务',
        description: '文章配图、产品草稿或视觉素材生成后保存在本地，也能回到会话里继续整理。',
        imageSrc: '/nextclaw-image-generation-result-cn.png', imageAlt: 'NextClaw 图片生成结果'
      },
      {
        eyebrow: '文档浏览器',
        title: '资料打开后可以一直放在旁边',
        description: '文档、技能详情和参考资料可以留在全局右侧栏，边看边继续操作。',
        imageSrc: '/nextclaw-skills-doc-browser-cn.png', imageAlt: 'NextClaw 右侧 Doc Browser'
      },
      {
        eyebrow: '应用列表',
        title: '常用小应用集中管理',
        description: '任务看板、仪表盘、配置浏览器等应用，可以从面板应用页查看和打开。',
        imageSrc: '/nextclaw-panel-apps-page-cn.png', imageAlt: 'NextClaw 面板应用列表'
      }
    ],
    ecosystemTitle: '把常用模型、聊天工具和技能都接进来。',
    ecosystemSubtitle: 'NextClaw 是工作的地方。模型、渠道、技能和本机工具接进来后，任务仍然回到同一个工作台处理。',
    integrationsTitle: '模型、渠道、技能和本机工具都可以接进来',
    integrationsSubtitle: '选择自己常用的模型，把微信、飞书等消息入口接入任务，再按需要使用技能、MCP、CLI、定时任务和本地文件。',
    integrationsDocsButton: '查看集成文档',
    integrationsInstallButton: '查看安装方式',
    integrationShowcaseItems: [
      {
        eyebrow: '模型提供商',
        title: '可以直接免费试用，也可以接自己的模型',
        description: '全新安装无需 API Key 即可使用内置免费试用，也可以继续配置 OpenRouter、OpenAI、Anthropic、Gemini、DeepSeek 和兼容服务。',
        imageSrc: '/nextclaw-providers-page-cn.png',
        imageAlt: 'NextClaw 模型提供商设置'
      },
      {
        eyebrow: '消息渠道',
        title: '请求可以从常用聊天入口进来',
        description: '微信、飞书/Lark、QQ、钉钉、企业微信、Telegram、Discord、Slack、邮箱等渠道可以接入。',
        imageSrc: new URL('../../../images/screenshots/nextclaw-channels-page-cn.png', import.meta.url).href,
        imageAlt: 'NextClaw 消息渠道设置'
      },
      {
        eyebrow: '技能',
        title: '需要新能力时可以在工作台里安装',
        description: '浏览、安装和管理技能，让每个任务按需要使用不同能力。',
        imageSrc: '/nextclaw-skills-page-cn.png',
        imageAlt: 'NextClaw 技能市场'
      }
    ],
    ecosystemGroups: [
      {
        icon: 'brain-circuit',
        title: '模型可以自己选',
        description: '先用内置免费试用模型，也可以接自己的提供商、OpenAI 兼容接口和自定义模型。',
        items: [
          { label: 'OpenRouter', logo: '/logos/openrouter.svg' },
          { label: 'OpenAI', logo: '/logos/openai.svg' },
          { label: 'Anthropic', logo: '/logos/anthropic.svg' },
          { label: 'Gemini', logo: '/logos/gemini.svg' },
          { label: 'DeepSeek', logo: '/logos/deepseek.png' },
          { label: 'MiniMax', logo: '/logos/minimax.svg' },
          { label: 'Moonshot', logo: '/logos/moonshot.png' },
          { label: '通义千问', logo: '/logos/dashscope.png' },
          { label: '智谱', logo: '/logos/zhipu.svg' },
          { label: 'AiHubMix', logo: '/logos/aihubmix.png' },
          { label: 'vLLM', logo: '/logos/vllm.svg' },
          { label: '自定义模型' }
        ]
      },
      {
        icon: 'message-circle',
        title: 'AI 可以进聊天工具',
        description: '微信、飞书、QQ、钉钉这些入口都能接，团队在哪里沟通，AI 就可以在哪里出现。',
        items: [
          { label: '微信' },
          { label: '飞书', logo: '/logos/feishu.svg' },
          { label: 'QQ', logo: '/logos/qq.svg' },
          { label: '钉钉', logo: '/logos/dingtalk.svg' },
          { label: '企业微信', logo: '/logos/wecom.svg' },
          { label: 'Telegram', logo: '/logos/telegram.svg' },
          { label: 'Discord', logo: '/logos/discord.svg' },
          { label: 'Slack', logo: '/logos/slack.svg' },
          { label: 'Email', logo: '/logos/email.svg' },
          { label: 'WhatsApp', logo: '/logos/whatsapp.svg' }
        ]
      },
      {
        icon: 'blocks',
        title: '技能和自动化也在这里',
        description: '技能市场、MCP、CLI 工具、定时任务和本地文件，可以一起参与同一条任务。',
        items: [
          { label: '技能市场' },
          { label: 'MCP' },
          { label: 'CLI 工具' },
          { label: '定时任务' },
          { label: '浏览器操作' },
          { label: '本地文件' }
        ]
      }
    ],
    useCasesTitle: '这些事可以直接交给它。',
    useCasesSubtitle: '先说要处理什么，后面需要模型、渠道、浏览器、文件或技能时，再一起接进来。',
    useCasesPageTitle: 'NextClaw 能用来做什么？',
    useCasesPageSubtitle: '从具体任务开始：查资料、分析数据、写稿、做小工具、处理文件，或者把群聊里的请求接到同一个工作台里继续完成。',
    useCasesCtaTitle: '先从一个真实任务开始。',
    useCasesCtaDescription: '下载桌面版后，可以直接拿一份报告、一堆文件、一个群聊问题，或者一个想做很久的小工具来试。',
    useCases: [
      { icon: 'messages-square', title: '群里有人问问题，先让 AI 处理', description: '微信、飞书、QQ、钉钉、Discord、Telegram 里的请求，可以先进入同一个工作台。' },
      { icon: 'bar-chart-3', title: '抓取数据，做成图表报告', description: '从网页、CSV 或表格里整理数据，清洗、对比、画图，再把结论放在资料旁边。' },
      { icon: 'search', title: '调研一个主题，整理成对比表', description: '收集网页、笔记和参考资料，输出简报、来源列表和对比结论。' },
      { icon: 'pen-line', title: '写文章、周报或提案初稿', description: '把资料、引用和零散想法放在一起，先写出一版能继续改的稿子。' },
      { icon: 'list-checks', title: '整理客户反馈，排出优先级', description: '把评论、工单或聊天记录归类，提炼问题，再整理成后续行动清单。' },
      { icon: 'calendar-clock', title: '每天早上自动发一份简报', description: '按时间整理日报、提醒或巡检结果，再发到指定渠道。' },
      { icon: 'app-window', title: '给自己做一个小工具', description: '把重复的小事做成一个本地应用、脚本或工作流，后面还能接着改。' },
      { icon: 'files', title: '批量处理一堆文件', description: '重命名、抽取文字、整理资料，或把散落的文档变成一份行动清单。' }
    ],
    comparison: COMPARISON_COPY.zh,
    releasesTitle: '版本更新',
    releasesSubtitle: '查看 NextClaw 近期版本新增了什么、增强了什么、修复了什么，以及下载和安装相关变化。',
    releasesGitHubButton: '查看 GitHub Releases',
    releasesDownloadButton: '下载最新版桌面端',
    releaseNotes: [
      {
        category: '新增',
        title: '文件预览旁加入项目文件 Explorer',
        description: '会话工作区现在可以同时保留项目目录和文件预览，处理文件时不再被不同页面打断。',
        items: [
          '连续打开多个文件时，每个文件保留在自己的标签页。',
          '可以新建文件和文件夹、上传、下载、重命名、删除、复制路径或添加到聊天。',
          'Explorer 宽度可以拖动并在刷新后保留；Native 会话同一轮的只读工具也可以并行执行。'
        ]
      },
      {
        category: '增强',
        title: '文件交互对齐熟悉的编辑器习惯',
        description: '右键菜单、行内新建、面包屑和划选操作保持紧凑、连续且可预期。',
        items: [
          '文件夹不再显示含义不清的“打开”。',
          '新建项目会滚动到输入位置，面包屑空间不足时仍保持单行。',
          '文件和消息划选操作可以与 Explorer、工作区拖拽正确协作。'
        ]
      },
      {
        category: '修复',
        title: '长时间会话更稳',
        description: '消息连接和启动恢复现在能更安全地处理短暂中断和大型历史记录。',
        items: [
          '空闲 SSE 主动保活，短暂断流会先恢复会话再重连。',
          '大型 journal 改为逐会话、逐行读取，降低峰值内存。',
          'NCP 启动期间暂时禁用消息编辑，服务就绪后自动恢复。'
        ]
      }
    ],
    featuresTitle: '一件事，可以让不同帮手一起做。',
    featuresSubtitle: '调研、数据、写作、开发、聊天入口和定时任务各做一段，中间不用反复换工具。',
    features: [
      { icon: 'search', title: '先查资料', description: '需要调研时，先收集网页、笔记和引用，再整理成简报或对比表。' },
      { icon: 'bar-chart-3', title: '再算数据', description: '需要分析时，读取文件或网页数据，清洗、统计、画图并写出结论。' },
      { icon: 'pen-line', title: '接着写稿', description: '把材料、旧文档和零散想法组织成周报、文章、提案或发布说明。' },
      { icon: 'code-2', title: '顺手做工具', description: '重复的小事可以做成本地脚本、小应用或工作流，后面继续改。' },
      { icon: 'messages-square', title: '从群聊接活', description: '微信、飞书、钉钉、QQ 里的请求可以进来，结果也能回到原来的地方。' },
      { icon: 'calendar-clock', title: '按时间继续跑', description: '日报、巡检、提醒和后续跟进可以定时执行，记录留在工作台里。' }
    ],
    ctaTitle: '开始使用 NextClaw',
    ctaDescription: '安装后打开任务，直接使用内置免费试用模型，无需先配置 API Key。',
    ctaButton: '进入文档',
    footerProject: 'NextClaw 项目',
    footerLicense: '基于 MIT License 发布。',
    footerDocs: '文档',
    footerReleases: '更新',
    footerNpm: 'NPM',
    footerWechatGroup: '微信群',
    communityTitle: '加入社群',
    communitySubtitle: '扫描二维码加入 NextClaw 微信群。',
    communityWechatLabel: '微信群二维码',
    communityScanHint: '扫码加群',
    faqTitle: '常见问题',
    faqSubtitle: '这里整理了几个常见问题。',
    faq: [
      {
        question: 'NextClaw 和 OpenClaw 有什么区别？',
        answer: 'NextClaw 受到 OpenClaw 启发，但重点不一样。NextClaw 更想做一个本机 AI 工作台，把 Agent、技能、CLI 工具、自动化和消息应用放到一个可管理的界面里。'
      }
    ]
  }
};

class LandingPage {
  private readonly root: HTMLDivElement;
  private readonly locale: Locale;
  private readonly route: PageRoute;
  private readonly copy: LandingCopy;

  constructor(root: HTMLDivElement, locale: Locale, route: PageRoute) {
    this.root = root;
    this.locale = locale;
    this.route = route;
    this.copy = COPY[locale];
  }

  private renderDownloadCard = (option: DownloadOption): string => `
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
      ${option.key === 'windowsX64Installer'
        ? `<div class="mt-3 border-t border-border/50 pt-3 text-sm text-muted-foreground">
            <span>${this.copy.downloadWindowsPortableLabel}</span>
            <a
              id="desktop-windows-portable-link"
              href="${DESKTOP_RELEASE_FALLBACK.windowsPortableZipUrl ?? DESKTOP_RELEASE_FALLBACK.url}"
              target="_blank"
              rel="noopener noreferrer"
              class="ml-2 font-semibold text-primary hover:underline"
            >
              ${this.copy.downloadWindowsPortableDescription}
            </a>
          </div>`
        : ''}
    </article>
      `;

  private getInstallMethodHref = (method: InstallMethod, docsLink: string): string =>
    method.docsPath ? `${docsLink}${method.docsPath}` : LINKS.npm;

  private renderInstallMethodCard = (method: InstallMethod, docsLink: string): string => {
    const href = this.getInstallMethodHref(method, docsLink);

    return `
      <article id="install-${method.key}" data-install-method-card class="install-method-panel scroll-mt-28">
        <div class="install-method-panel__header">
          <div class="install-method-panel__icon">
            <i data-lucide="${method.icon}" class="h-5 w-5"></i>
          </div>
          <div>
            <h2 class="install-method-panel__title">${method.title}</h2>
            <p class="install-method-panel__description">${method.description}</p>
          </div>
        </div>
        ${method.command
          ? `<pre class="install-method-panel__command"><code class="font-mono text-foreground">${method.command}</code></pre>`
          : ''}
        <div class="install-method-panel__actions">
          ${method.command
            ? `<button data-install-copy-button type="button" class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
                ${this.copy.installCopyLabel}
              </button>`
            : ''}
          <a href="${href}" target="_blank" rel="noopener noreferrer" class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            ${method.buttonLabel}
            <i data-lucide="external-link" class="h-4 w-4"></i>
          </a>
        </div>
      </article>
    `;
  };

  private renderInstallMethodNav = (): string => {
    const methods = [
      { key: 'desktop', icon: 'monitor', title: this.copy.downloadDesktopTitle },
      ...this.copy.installMethods
    ];

    return `
      <nav class="install-method-nav" aria-label="${this.copy.navDownload}">
        ${methods.map((method, index) => `
          <a
            href="#install-${method.key}"
            data-install-method-link="install-${method.key}"
            class="install-method-nav__item${index === 0 ? ' is-recommended' : ''}"
            ${index === 0 ? 'aria-current="true"' : ''}
          >
            <i data-lucide="${method.icon}" class="h-4 w-4"></i>
            <span>${method.title}</span>
          </a>
        `).join('')}
      </nav>
    `;
  };

  render = (): void => {
    const docsLink = LINKS.docs[this.locale];
    const homeRoute = ROUTES[this.locale].home;
    const downloadRoute = ROUTES[this.locale].download;
    const useCasesRoute = ROUTES[this.locale].useCases;
    const integrationsRoute = ROUTES[this.locale].integrations;
    const releasesRoute = ROUTES[this.locale].releases;
    const comparisonRoute = `${homeRoute}#compare`;
    const communityRoute = `${homeRoute}#community`;

    this.root.innerHTML = `
      <div class="landing-site relative min-h-screen flex flex-col bg-background">
        <header class="landing-header fixed z-50 glass border-b transition-all duration-300">
          <div class="landing-header__inner container mx-auto px-6 h-16 flex items-center justify-between">
            <a id="home-link" href="${homeRoute}" class="flex items-center gap-2 group cursor-pointer">
              <img src="/logo-phoenix.svg" alt="NextClaw" class="w-8 h-8 transition-transform group-hover:scale-105" />
              <span class="font-semibold text-lg tracking-normal">NextClaw</span>
            </a>
            <nav class="hidden md:flex gap-6 text-sm font-medium">
              <a href="${downloadRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navDownload}</a>
              <a href="${useCasesRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navUseCases}</a>
              <a href="${comparisonRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navCompare}</a>
              <a href="${integrationsRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navIntegrations}</a>
              <a href="${communityRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navCommunity}</a>
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
              <a href="${useCasesRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navUseCases}</a>
              <a href="${comparisonRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navCompare}</a>
              <a href="${integrationsRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navIntegrations}</a>
              <a href="${communityRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navCommunity}</a>
              <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navDocs}</a>
            </nav>
          </div>
        </header>

        <main class="landing-main ${this.route === 'home'
          ? 'landing-main--home relative flex flex-col px-6 text-left z-10'
          : 'landing-main--route flex-1 flex flex-col items-center text-center px-6 pt-32 pb-20 z-10'}">
          <div class="${this.route === 'home' ? 'landing-home-shell relative z-10 w-full mx-auto' : 'contents'}">
          ${this.route === 'home' ? `
          ${renderLandingHomeHero(this.copy, downloadRoute, useCasesRoute)}
          ` : `
          ${renderLandingRouteHero(this.route, this.copy)}
          `}

          ${this.route === 'download' ? `
          <section id="install-methods" class="install-method-layout w-full max-w-6xl mx-auto mb-10 text-left animate-slide-up opacity-0 scroll-mt-28" style="animation-delay: 0.35s">
            ${this.renderInstallMethodNav()}
            <div class="install-method-panels">
              <section id="install-desktop" class="install-method-panel install-method-panel--desktop scroll-mt-28">
                <div class="install-method-panel__header install-method-panel__header--desktop">
                  <div class="flex items-start gap-3">
                    <div class="install-method-panel__icon">
                      <i data-lucide="monitor" class="h-5 w-5"></i>
                    </div>
                    <div>
                      <h2 class="install-method-panel__title">${this.copy.downloadDesktopTitle}</h2>
                      <p class="install-method-panel__description">${this.copy.downloadDesktopSubtitle}</p>
                    </div>
                  </div>
                  <div class="install-method-panel__meta">
                    <div>${this.copy.downloadVersionLabel}: <span id="desktop-version" class="font-semibold text-foreground">${DESKTOP_RELEASE_FALLBACK.version}</span></div>
                    <div>${this.copy.downloadDetectedLabel}: <span id="desktop-detected-platform" class="font-semibold text-foreground">${this.copy.downloadUnknownPlatform}</span></div>
                    <div>${this.copy.downloadReleaseLabel}: <a id="desktop-release-link" href="${DESKTOP_RELEASE_FALLBACK.url}" target="_blank" rel="noopener noreferrer" class="font-semibold text-primary hover:underline">${DESKTOP_RELEASE_FALLBACK.tag}</a></div>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${this.copy.downloadOptions.map((option) => this.renderDownloadCard(option)).join('')}
                </div>

                <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                  ${this.copy.downloadUnsignedNotice}
                </div>

                <a id="desktop-release-link-secondary" href="${DESKTOP_RELEASE_FALLBACK.url}" target="_blank" rel="noopener noreferrer" class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  <i data-lucide="external-link" class="w-4 h-4"></i>
                  ${this.copy.downloadReleaseLinkText}
                </a>

                <details class="desktop-open-guide">
                  <summary>
                    <span>${this.copy.downloadOpenGuideTitle}</span>
                    <i data-lucide="chevron-down" class="h-4 w-4"></i>
                  </summary>
                  <div class="desktop-open-guide__grid">
                    <div>
                      <h3>${this.copy.downloadMacGuideTitle}</h3>
                      <ol>${this.copy.downloadMacGuideSteps.map((step) => `<li>${step}</li>`).join('')}</ol>
                    </div>
                    <div>
                      <h3>${this.copy.downloadWindowsGuideTitle}</h3>
                      <ol>${this.copy.downloadWindowsGuideSteps.map((step) => `<li>${step}</li>`).join('')}</ol>
                    </div>
                    <div>
                      <h3>${this.copy.downloadLinuxGuideTitle}</h3>
                      <ol>${this.copy.downloadLinuxGuideSteps.map((step) => `<li>${step}</li>`).join('')}</ol>
                    </div>
                  </div>
                </details>
              </section>

              ${this.copy.installMethods.map((method) => this.renderInstallMethodCard(method, docsLink)).join('')}
            </div>
          </section>
          ` : ''}

          ${this.route === 'useCases' ? renderUseCasesPage(this.copy, downloadRoute, docsLink) : ''}

          ${this.route === 'integrations' ? renderIntegrationsPage(this.copy, downloadRoute, docsLink) : ''}

          ${this.route === 'releases' ? renderReleasesPage(this.copy, downloadRoute) : ''}

          </div>
        </main>

        ${this.route === 'home' ? renderHomeSections(this.copy, docsLink, this.locale) : ''}

        ${renderLandingFooter(this.copy, docsLink, releasesRoute)}

      </div>
    `;

    this.bindLocaleSelect();
    this.bindHomeLinkAction();
    this.bindMobileMenu();
    this.bindCommunityQrModal();
    this.bindDesktopDownloads();
    this.bindInstallCopyButtons();
    this.bindInstallMethodNavigation();
    createIcons({ icons, nameAttr: 'data-lucide' });
  };

  private bindInstallMethodNavigation = (): void => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-install-method-link]'));
    if (links.length === 0) {
      return;
    }
    const navigation = links[0]?.closest<HTMLElement>('.install-method-nav');
    if (!navigation) {
      return;
    }

    const setCurrent = (panelId: string): void => {
      links.forEach((link) => {
        if (link.dataset.installMethodLink === panelId) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };

    links.forEach((link) => {
      link.addEventListener('click', () => {
        const panelId = link.dataset.installMethodLink;
        if (panelId) {
          setCurrent(panelId);
        }
      });
    });

    const panels = links
      .map((link) => document.getElementById(link.dataset.installMethodLink ?? ''))
      .filter((panel): panel is HTMLElement => panel !== null);
    let frameRequest: number | null = null;
    const updateNavigationState = (): void => {
      frameRequest = null;
      const stickyTop = Number.parseFloat(window.getComputedStyle(navigation).top) || 0;
      navigation.classList.toggle('is-stuck', navigation.getBoundingClientRect().top <= stickyTop + 1);
      const viewportCenter = window.innerHeight / 2;
      const closestPanel = panels
        .map((panel) => {
          const bounds = panel.getBoundingClientRect();
          return { panel, distance: Math.abs((bounds.top + bounds.bottom) / 2 - viewportCenter) };
        })
        .sort((left, right) => left.distance - right.distance)[0]?.panel;
      if (closestPanel) {
        setCurrent(closestPanel.id);
      }
    };

    window.addEventListener('scroll', () => {
      if (frameRequest === null) {
        frameRequest = window.requestAnimationFrame(updateNavigationState);
      }
    }, { passive: true });
    updateNavigationState();
  };

  private bindDesktopDownloads = (): void => {
    const versionNode = document.querySelector<HTMLElement>('#desktop-version');
    const detectedNode = document.querySelector<HTMLElement>('#desktop-detected-platform');
    const releasePrimary = document.querySelector<HTMLAnchorElement>('#desktop-release-link');
    const releaseSecondary = document.querySelector<HTMLAnchorElement>('#desktop-release-link-secondary');
    const windowsPortableLink = document.querySelector<HTMLAnchorElement>('#desktop-windows-portable-link');

    const linkNodes: Record<DownloadAssetKey, HTMLAnchorElement | null> = {
      macArm64Dmg: document.querySelector<HTMLAnchorElement>('[data-download-link="macArm64Dmg"]'),
      macX64Dmg: document.querySelector<HTMLAnchorElement>('[data-download-link="macX64Dmg"]'),
      windowsX64Installer: document.querySelector<HTMLAnchorElement>('[data-download-link="windowsX64Installer"]'),
      linuxX64AppImage: document.querySelector<HTMLAnchorElement>('[data-download-link="linuxX64AppImage"]')
    };

    if (
      !linkNodes.macArm64Dmg ||
      !linkNodes.macX64Dmg ||
      !linkNodes.windowsX64Installer ||
      !linkNodes.linuxX64AppImage ||
      !releasePrimary ||
      !releaseSecondary
    ) {
      return;
    }
    const macDownloadLink = linkNodes.macArm64Dmg;
    const macX64DownloadLink = linkNodes.macX64Dmg;
    const windowsDownloadLink = linkNodes.windowsX64Installer;
    const linuxDownloadLink = linkNodes.linuxX64AppImage;

    const cardNodes: Record<DownloadAssetKey, HTMLElement | null> = {
      macArm64Dmg: document.querySelector<HTMLElement>('[data-download-card="macArm64Dmg"]'),
      macX64Dmg: document.querySelector<HTMLElement>('[data-download-card="macX64Dmg"]'),
      windowsX64Installer: document.querySelector<HTMLElement>('[data-download-card="windowsX64Installer"]'),
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
      windowsDownloadLink.setAttribute('href', release.assets.windowsX64Installer);
      linuxDownloadLink.setAttribute('href', release.assets.linuxX64AppImage);
      if (windowsPortableLink) {
        windowsPortableLink.href = release.windowsPortableZipUrl ?? release.url;
      }
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

  private bindInstallCopyButtons = (): void => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-install-copy-button]'));
    for (const button of buttons) {
      button.addEventListener('click', async () => {
        const card = button.closest<HTMLElement>('[data-install-method-card]');
        const command = card?.querySelector<HTMLElement>('code')?.textContent?.trim();
        if (!command) {
          return;
        }

        try {
          await navigator.clipboard.writeText(command);
          button.textContent = this.copy.installCopiedText;
          window.setTimeout(() => {
            button.textContent = this.copy.installCopyLabel;
          }, 1200);
        } catch (error) {
          console.error('Failed to copy install command', error);
        }
      });
    }
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

}

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('Missing #app mount element');
}

const locale = resolvePageLocale();
const route = resolvePageRoute();
persistLocale(locale);
new LandingPage(root, locale, route).render();
