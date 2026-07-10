import './style.css';
import { createIcons, icons } from 'lucide';
import {
  DESKTOP_RELEASE_FALLBACK,
  detectRecommendedDesktopAsset,
  fetchLatestStableDesktopRelease,
  type DesktopReleaseInfo,
  type DownloadAssetKey
} from '@/shared/lib/desktop-release';
import {
  getPageSubtitle,
  getPageTitle,
  isLocale,
  LINKS,
  LOCALE_OPTIONS,
  persistLocale,
  renderEcosystemGroups,
  renderFeatureCards,
  renderIntegrationsPage,
  renderReleasesPage,
  renderShowcaseCards,
  renderUseCasesPage,
  resolvePageLocale,
  resolvePageRoute,
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
    navDownload: 'Download',
    navInstall: 'Install',
    navUseCases: 'Use cases',
    navIntegrations: 'Integrations',
    navDocs: 'Docs',
    heroTitleLine1: 'NextClaw',
    heroEyebrow: 'From a request to usable results',
    heroDescription:
      'Tell NextClaw what you want done. It brings files, models, agents, skills, channels, and local tools into the same task so the work can keep moving toward a result.',
    heroDownloadButton: 'Download Desktop',
    heroInstallButton: 'Install options',
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
    downloadInstallTeaserTitle: 'Need npm or Docker?',
    downloadInstallTeaserDescription: 'Desktop is the easiest path, but terminal and server installs are available too.',
    downloadInstallTeaserButton: 'View install options',
    installTitle: 'Choose your NextClaw install path.',
    installSubtitle:
      'Desktop is the easiest start. npm works well for terminals and servers. Docker is for long-running hosted environments.',
    installCopyLabel: 'Copy',
    installCopiedText: 'Copied',
    installMethods: [
      {
        key: 'desktop',
        icon: 'download',
        title: 'Desktop app',
        description: 'Recommended for most users on macOS, Windows, or Linux.',
        buttonLabel: 'Download desktop'
      },
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
        description: 'Use Docker for a repeatable server or cloud VM setup, reverse proxy, domain, or remote access path.',
        buttonLabel: 'Docker guide', command: 'curl -fsSL https://nextclaw.io/install-docker.sh | bash',
        docsPath: 'guide/tutorials/docker-one-click'
      }
    ],
    docsButton: 'Read the Docs',
    screenshotChatSrc: '/nextclaw-hero-workbench-en.png',
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
        title: 'Manage collaborators with their own context',
        description: 'Create, review, and start chats with agents that keep separate roles, memory, skills, and workspaces.',
        imageSrc: '/nextclaw-agents-page-en.png', imageAlt: 'NextClaw agent management page'
      },
      {
        eyebrow: 'Channels',
        title: 'Bring messaging apps into the same workflow',
        description: 'Connect WeChat, Feishu/Lark, QQ, and other channels so agents can work from the places you already use.',
        imageSrc: '/nextclaw-channels-page-en.png', imageAlt: 'NextClaw message channel settings'
      },
      {
        eyebrow: 'Skill market',
        title: 'Add capabilities without leaving the workspace',
        description: 'Browse, install, and manage skills from the same task surface.',
        imageSrc: '/nextclaw-skills-page-en.png', imageAlt: 'NextClaw skill market'
      }
    ],
    appSurfaceTitle: 'Keep apps, files, and results beside the task.',
    appSurfaceSubtitle:
      'Open a small app, preview local files, render HTML, generate images, or keep references on the side while the conversation continues.',
    appSurfaceItems: [
      {
        eyebrow: 'Panel App',
        title: 'Run a small app while the chat stays open',
        description: 'Use a piano, market board, Markdown editor, or generated page directly on the side.',
        imageSrc: '/nextclaw-panel-app-running-en.png', imageAlt: 'A running NextClaw Panel App'
      },
      {
        eyebrow: 'File preview',
        title: 'Preview code, docs, and local HTML',
        description: 'Switch between local HTML, source files, and Markdown in side tabs while you inspect data or adjust a page.',
        imageSrc: '/nextclaw-workspace-preview-en.png', imageAlt: 'NextClaw file and HTML preview workspace'
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
        title: 'Use built-in providers or a compatible endpoint',
        description: 'Configure OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, MiniMax, Moonshot, DashScope, Zhipu, vLLM, or your own OpenAI-compatible service.',
        imageSrc: '/nextclaw-providers-page-en.png',
        imageAlt: 'NextClaw model provider settings'
      },
      {
        eyebrow: 'Message channels',
        title: 'Let requests arrive from the places people already talk',
        description: 'Connect Weixin, Feishu/Lark, QQ, DingTalk, WeCom, Telegram, Discord, Slack, email, and other channels.',
        imageSrc: '/nextclaw-channels-page-en.png',
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
        description: 'Use built-in providers or point NextClaw at an OpenAI-compatible endpoint.',
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
    releasesTitle: 'Product updates',
    releasesSubtitle:
      'See what changed in recent NextClaw releases, including new capabilities, improvements, fixes, and install or desktop updates.',
    releasesGitHubButton: 'View GitHub Releases',
    releasesDownloadButton: 'Download latest desktop',
    releaseNotes: [
      {
        category: 'New',
        title: 'More complete product site pages',
        description: 'The website now has dedicated pages for use cases, integrations, updates, downloads, and install paths.',
        items: [
          'Use cases are grouped around real tasks such as data analysis, writing, research, file processing, and small personal tools.',
          'Integrations have a clearer home for model providers, custom OpenAI-compatible endpoints, message channels, skills, MCP, CLI tools, and automations.',
          'Updates have a stable public page that can be linked from product update prompts.'
        ]
      },
      {
        category: 'Improved',
        title: 'Stronger desktop and workbench presentation',
        description: 'The homepage focuses more on the main workbench, agents, channels, panel apps, file preview, image generation, and side browser.',
        items: [
          'Screenshots use the current visual style and show richer local examples.',
          'Download and install paths are separated so first-time visitors can understand the product before reading setup details.',
          'npm and Docker remain discoverable from the install page and download flow.'
        ]
      },
      {
        category: 'Fixed',
        title: 'More resilient model stream handling',
        description: 'Runtime handling for interrupted model streams is being tightened so partial answers are not treated as successful runs.',
        items: [
          'Transient native model stream failures can be retried with clearer execution metadata.',
          'Run specs record lightweight contracts that make debugging failed model output easier.',
          'The update notes format separates features, enhancements, fixes, and release/install changes.'
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
    ctaDescription: 'Get started with NextClaw in seconds. One command and your gateway is operational.',
    ctaButton: 'View Documentation',
    footerProject: 'NextClaw Project',
    footerLicense: 'Released under the MIT License.',
    footerDocs: 'Docs',
    footerReleases: 'Updates',
    footerNpm: 'NPM',
    footerDiscord: 'Discord',
    footerWechatGroup: 'WeChat Group',
    communityTitle: 'Join the community',
    communitySubtitle: 'WeChat group for Chinese users, Discord for everyone.',
    communityWechatLabel: 'WeChat Group QR',
    communityDiscordLabel: 'Join Discord',
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
    navDownload: '下载',
    navInstall: '安装方式',
    navUseCases: '使用场景',
    navIntegrations: '集成',
    navDocs: '文档',
    heroTitleLine1: 'NextClaw',
    heroEyebrow: '从一句话到可用结果',
    heroDescription:
      '说出你要做什么。NextClaw 会把资料、模型、Agent、技能、聊天入口和本机工具放进同一个任务里，一路推进到能用的结果。',
    heroDownloadButton: '下载桌面版',
    heroInstallButton: '安装方式',
    downloadTitle: '下载 NextClaw Desktop',
    downloadSubtitle: '从官网下载最新稳定版，支持 macOS、Windows 和 Linux。',
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
    downloadInstallTeaserTitle: '需要 npm 或 Docker？',
    downloadInstallTeaserDescription: '桌面版是最简单的路径，但命令行和服务器部署也有入口。',
    downloadInstallTeaserButton: '查看安装方式',
    installTitle: '选择适合你的安装方式。',
    installSubtitle: '普通用户优先下载桌面版；熟悉命令行可以用 npm；要长期放在服务器上，再看 Docker 部署。',
    installCopyLabel: '复制',
    installCopiedText: '已复制',
    installMethods: [
      {
        key: 'desktop',
        icon: 'download',
        title: '桌面版',
        description: '适合大多数 macOS、Windows 和 Linux 用户，下载后直接打开使用。',
        buttonLabel: '下载桌面版'
      },
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
        description: '适合服务器或云主机长期在线部署，以及需要反向代理、域名或远程访问的环境。',
        buttonLabel: 'Docker 文档', command: 'curl -fsSL https://nextclaw.io/install-docker.sh | bash',
        docsPath: 'guide/tutorials/docker-one-click'
      }
    ],
    docsButton: '查看文档',
    screenshotChatSrc: '/nextclaw-hero-workbench-cn.png',
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
        title: '管理不同分工的协作者',
        description: '创建、查看并启动不同 Agent，每个 Agent 可以有自己的角色、记忆、技能和主目录。',
        imageSrc: '/nextclaw-agents-page-cn.png', imageAlt: 'NextClaw Agent 管理界面'
      },
      {
        eyebrow: '消息渠道',
        title: '微信、飞书等入口可以接进来',
        description: '把微信、飞书/Lark、QQ 等渠道接入后，Agent 可以在你常用的入口里继续工作。',
        imageSrc: '/nextclaw-channels-page-cn.png', imageAlt: 'NextClaw 消息渠道设置'
      },
      {
        eyebrow: '技能市场',
        title: '需要新技能时直接安装',
        description: '浏览、安装和管理技能，不用跳出工作台。',
        imageSrc: '/nextclaw-skills-page-cn.png', imageAlt: 'NextClaw 技能市场'
      }
    ],
    appSurfaceTitle: '小应用、文件和结果都在任务旁边。',
    appSurfaceSubtitle: '做网页、看源码、查资料、生成图片或打开自己的小工具时，右侧工作区会和当前会话一起留着。',
    appSurfaceItems: [
      {
        eyebrow: '面板应用',
        title: '小工具可以边聊边用',
        description: '电子钢琴、行情看板、Markdown 编辑器或临时做出来的页面，可以直接放在右侧运行。',
        imageSrc: '/nextclaw-panel-app-running-cn.png', imageAlt: '正在运行的 NextClaw 面板应用'
      },
      {
        eyebrow: '文件预览',
        title: '源码、文档和 HTML 不用另开窗口',
        description: '本地 HTML、代码和 Markdown 可以在右侧标签里切换，调页面、看数据、查源码时不用离开会话。',
        imageSrc: '/nextclaw-workspace-preview-cn.png', imageAlt: 'NextClaw 文件与 HTML 预览工作区'
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
        title: '可以用内置提供商，也可以接兼容接口',
        description: 'OpenRouter、OpenAI、Anthropic、Gemini、DeepSeek、MiniMax、Moonshot、通义千问、智谱、vLLM 和自定义 OpenAI 兼容服务都可以配置。',
        imageSrc: '/nextclaw-providers-page-cn.png',
        imageAlt: 'NextClaw 模型提供商设置'
      },
      {
        eyebrow: '消息渠道',
        title: '请求可以从常用聊天入口进来',
        description: '微信、飞书/Lark、QQ、钉钉、企业微信、Telegram、Discord、Slack、邮箱等渠道可以接入。',
        imageSrc: '/nextclaw-channels-page-cn.png',
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
        description: '内置常见提供商，也可以接 OpenAI 兼容接口和自定义模型。',
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
    releasesTitle: '版本更新',
    releasesSubtitle: '查看 NextClaw 近期版本新增了什么、增强了什么、修复了什么，以及下载和安装相关变化。',
    releasesGitHubButton: '查看 GitHub Releases',
    releasesDownloadButton: '下载最新版桌面端',
    releaseNotes: [
      {
        category: '新增',
        title: '官网补充更完整的产品页面',
        description: '官网现在有独立的使用场景、集成、更新、下载和安装方式页面。',
        items: [
          '使用场景按真实任务组织，例如数据分析、写作、资料调研、文件处理和个人小工具。',
          '集成页面集中展示模型提供商、自定义 OpenAI 兼容接口、消息渠道、技能、MCP、CLI 工具和自动化。',
          '更新页面提供稳定公开入口，后续产品内检查更新时可以链接到对应版本说明。'
        ]
      },
      {
        category: '增强',
        title: '更充分展示桌面端和工作台能力',
        description: '首页更突出主工作台、Agent、消息渠道、面板应用、文件预览、图片生成和右侧文档浏览器。',
        items: [
          '截图使用当前界面风格，并尽量展示更有代表性的本地示例。',
          '下载和安装方式分开呈现，让新用户先理解产品，再按需要查看安装细节。',
          'npm 和 Docker 仍保留在安装方式页和下载页入口里。'
        ]
      },
      {
        category: '修复',
        title: '模型流式输出处理更稳',
        description: '模型输出异常中断时，运行时会避免把不完整回答当成成功结果。',
        items: [
          '临时性的原生模型流失败可以带着更清晰的执行信息重试。',
          '消息运行记录会保留轻量调试信息，方便定位失败原因。',
          '更新说明按新增、增强、修复和安装发布变化分组。'
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
    ctaDescription: '下载桌面版，或者先看文档了解配置方式。',
    ctaButton: '进入文档',
    footerProject: 'NextClaw 项目',
    footerLicense: '基于 MIT License 发布。',
    footerDocs: '文档',
    footerReleases: '更新',
    footerNpm: 'NPM',
    footerDiscord: 'Discord',
    footerWechatGroup: '微信群',
    communityTitle: '加入社群',
    communitySubtitle: '国内用户可以加微信群，英文交流可以去 Discord。',
    communityWechatLabel: '微信群二维码',
    communityDiscordLabel: '加入 Discord',
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

  private getInstallMethodHref = (method: InstallMethod, downloadRoute: string, docsLink: string): string => {
    if (method.key === 'desktop') {
      return downloadRoute;
    }
    return method.docsPath ? `${docsLink}${method.docsPath}` : LINKS.npm;
  };

  private renderInstallMethodCard = (method: InstallMethod, downloadRoute: string, docsLink: string): string => {
    const href = this.getInstallMethodHref(method, downloadRoute, docsLink);
    const targetAttrs = method.key === 'desktop' ? '' : ' target="_blank" rel="noopener noreferrer"';

    return `
      <article data-install-method-card class="rounded-lg border border-border/70 bg-white p-5 shadow-sm">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <i data-lucide="${method.icon}" class="h-5 w-5"></i>
        </div>
        <h3 class="text-lg font-semibold">${method.title}</h3>
        <p class="mt-3 text-sm leading-relaxed text-muted-foreground">${method.description}</p>
        ${method.command
          ? `<pre class="mt-4 whitespace-pre-wrap break-all rounded-lg border border-border/70 bg-secondary/60 px-3 py-3 text-sm"><code class="font-mono text-foreground">${method.command}</code></pre>`
          : ''}
        <div class="mt-5 flex flex-wrap gap-3">
          ${method.command
            ? `<button data-install-copy-button type="button" class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
                ${this.copy.installCopyLabel}
              </button>`
            : ''}
          <a href="${href}"${targetAttrs} class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            ${method.buttonLabel}
            ${method.key === 'desktop' ? '' : '<i data-lucide="external-link" class="h-4 w-4"></i>'}
          </a>
        </div>
      </article>
    `;
  };

  private renderInstallMethodsSection = (
    downloadRoute: string,
    docsLink: string,
    className = 'py-20 px-6 z-10 w-full max-w-7xl mx-auto',
    showHeading = true
  ): string => `
    <section id="install-methods" class="${className}">
      ${showHeading
        ? `<div class="mb-10 max-w-3xl">
            <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${this.copy.installTitle}</h2>
            <p class="text-muted-foreground text-lg">${this.copy.installSubtitle}</p>
          </div>`
        : ''}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        ${this.copy.installMethods.map((method) => this.renderInstallMethodCard(method, downloadRoute, docsLink)).join('')}
      </div>
    </section>
  `;

  render = (): void => {
    const docsLink = LINKS.docs[this.locale];
    const homeRoute = ROUTES[this.locale].home;
    const downloadRoute = ROUTES[this.locale].download;
    const installRoute = ROUTES[this.locale].install;
    const useCasesRoute = ROUTES[this.locale].useCases;
    const integrationsRoute = ROUTES[this.locale].integrations;
    const releasesRoute = ROUTES[this.locale].releases;

    this.root.innerHTML = `
      <div class="relative min-h-screen flex flex-col bg-background overflow-hidden">
        <header class="fixed top-0 w-full z-50 glass border-b transition-all duration-300">
          <div class="container mx-auto px-6 h-16 flex items-center justify-between">
            <a id="home-link" href="${homeRoute}" class="flex items-center gap-2 group cursor-pointer">
              <img src="/logo-phoenix.svg" alt="NextClaw" class="w-8 h-8 transition-transform group-hover:scale-105" />
              <span class="font-semibold text-lg tracking-normal">NextClaw</span>
            </a>
            <nav class="hidden md:flex gap-6 text-sm font-medium">
              <a href="${downloadRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navDownload}</a>
              <a href="${useCasesRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navUseCases}</a>
              <a href="${integrationsRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navIntegrations}</a>
              <a href="${installRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.navInstall}</a>
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
              <a href="${integrationsRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navIntegrations}</a>
              <a href="${installRoute}" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navInstall}</a>
              <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors py-2">${this.copy.navDocs}</a>
            </nav>
          </div>
        </header>

        <main class="${this.route === 'home'
          ? 'relative flex flex-col overflow-hidden px-6 pt-28 pb-14 text-left z-10 sm:pt-32 sm:pb-16'
          : 'flex-1 flex flex-col items-center text-center px-6 pt-32 pb-20 z-10'}">
          <div class="${this.route === 'home' ? 'relative z-10 w-full max-w-6xl mx-auto' : 'contents'}">
          ${this.route === 'home' ? `
          <p class="mb-4 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-background/80 px-3 py-2 text-sm font-semibold text-primary animate-slide-up opacity-0" style="animation-delay: 0.12s">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
            ${this.copy.heroEyebrow}
          </p>
          ` : ''}
          <h1 class="${this.route === 'home'
            ? 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-normal max-w-3xl mb-6 animate-slide-up opacity-0'
            : 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-normal max-w-6xl mb-6 animate-slide-up opacity-0'}" style="animation-delay: 0.2s">
            <span class="hero-brand">${getPageTitle(this.route, this.copy)}</span>
          </h1>

          <p class="${this.route === 'home'
            ? 'text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 animate-slide-up opacity-0'
            : 'text-lg md:text-xl text-muted-foreground max-w-4xl mx-auto mb-10 animate-slide-up opacity-0'}" style="animation-delay: 0.3s">
            ${getPageSubtitle(this.route, this.copy)}
          </p>

          ${this.route === 'download' ? `
          <section id="download" class="w-full max-w-5xl mx-auto mb-10 text-left animate-slide-up opacity-0" style="animation-delay: 0.35s">
            <div class="glass-card rounded-3xl p-6 md:p-8 border border-primary/20 shadow-2xl">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 class="text-2xl md:text-3xl font-bold tracking-normal">${this.copy.downloadTitle}</h2>
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
                  .map((option) => this.renderDownloadCard(option))
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
          <section class="w-full max-w-5xl mx-auto mb-10 text-left animate-slide-up opacity-0">
            <div class="rounded-2xl border border-border/70 bg-background/80 p-5">
              <h2 class="text-xl font-semibold">${this.copy.downloadInstallTeaserTitle}</h2>
              <p class="mt-2 text-sm text-muted-foreground">${this.copy.downloadInstallTeaserDescription}</p>
              <a href="${installRoute}" class="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                ${this.copy.downloadInstallTeaserButton}
                <i data-lucide="arrow-right" class="h-4 w-4"></i>
              </a>
            </div>
          </section>
          ` : ''}

          ${this.route === 'install' ? this.renderInstallMethodsSection(
            downloadRoute,
            docsLink,
            'w-full max-w-5xl mx-auto mb-10 text-left animate-slide-up opacity-0',
            false
          ) : ''}

          ${this.route === 'useCases' ? renderUseCasesPage(this.copy, downloadRoute, docsLink) : ''}

          ${this.route === 'integrations' ? renderIntegrationsPage(this.copy, installRoute, docsLink) : ''}

          ${this.route === 'releases' ? renderReleasesPage(this.copy, downloadRoute) : ''}

          ${this.route === 'home' ? `
          <div class="flex flex-col sm:flex-row flex-wrap gap-4 mb-8 animate-slide-up opacity-0" style="animation-delay: 0.4s">
            <a href="${downloadRoute}" class="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 focus:ring-2 focus:ring-primary focus:outline-none text-base">
              <i data-lucide="download" class="w-5 h-5"></i>
              ${this.copy.heroDownloadButton}
            </a>
            <a href="${docsLink}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-semibold bg-background/85 text-foreground border border-border hover:bg-secondary transition-colors shadow-sm focus:ring-2 focus:ring-foreground focus:outline-none text-base">
              <i data-lucide="book-open" class="w-5 h-5"></i>
              ${this.copy.docsButton}
            </a>
            <a href="${installRoute}" class="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-semibold bg-background/85 text-foreground border border-border hover:bg-secondary transition-colors shadow-sm focus:ring-2 focus:ring-foreground focus:outline-none text-base">
              <i data-lucide="terminal" class="w-5 h-5"></i>
              ${this.copy.heroInstallButton}
            </a>
          </div>

          <a href="${this.copy.screenshotChatSrc}" target="_blank" rel="noopener noreferrer" class="mt-8 block overflow-hidden rounded-lg border border-border/70 bg-white shadow-2xl shadow-primary/10 animate-slide-up opacity-0" style="animation-delay: 0.48s">
            <img
              src="${this.copy.screenshotChatSrc}"
              alt="${this.copy.heroTitleLine1}"
              class="block aspect-[1512/828] w-full object-contain object-top"
              loading="eager"
            />
          </a>
          ` : ''}
          </div>
        </main>

        ${this.route === 'home' ? `
        <section id="features" class="py-16 px-6 z-10 w-full max-w-7xl mx-auto">
          <div class="mb-12 max-w-3xl">
            <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${this.copy.showcaseTitle}</h2>
            <p class="text-muted-foreground text-lg">${this.copy.showcaseSubtitle}</p>
          </div>
          <div class="showcase-grid">
            ${renderShowcaseCards(this.copy.showcaseItems)}
          </div>
        </section>

        <section class="app-surface-section">
          <div class="w-full max-w-7xl mx-auto">
            <div class="mb-12 max-w-3xl">
              <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${this.copy.appSurfaceTitle}</h2>
              <p class="text-muted-foreground text-lg">${this.copy.appSurfaceSubtitle}</p>
            </div>
            <div class="app-surface-grid">
              ${renderShowcaseCards(this.copy.appSurfaceItems, {
                cardClass: (index) => `app-surface-card ${index < 2 ? 'app-surface-card--feature' : 'app-surface-card--compact'}`,
                eagerCount: 2
              })}
            </div>
          </div>
        </section>

        <section class="py-16 px-6 z-10 w-full max-w-7xl mx-auto">
          <div class="mb-12 max-w-3xl">
            <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${this.copy.useCasesTitle}</h2>
            <p class="text-muted-foreground text-lg">${this.copy.useCasesSubtitle}</p>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            ${renderFeatureCards(this.copy.useCases)}
          </div>
        </section>

        <section class="collaboration-section">
          <div class="collaboration-inner">
            <div class="collaboration-header">
              <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${this.copy.featuresTitle}</h2>
              <p class="text-muted-foreground text-lg">${this.copy.featuresSubtitle}</p>
            </div>
            <div class="collaboration-grid">
              ${this.copy.features
        .map(
          (feature) => `
              <article class="collaboration-card">
                <div class="collaboration-card__icon">
                  <i data-lucide="${feature.icon}" class="h-5 w-5"></i>
                </div>
                <h3 class="collaboration-card__title">${feature.title}</h3>
                <p class="collaboration-card__description">${feature.description}</p>
              </article>`
        )
        .join('')}
            </div>
          </div>
        </section>

        <section class="py-16 px-6 z-10 w-full max-w-7xl mx-auto">
          <div class="mb-12 max-w-3xl">
            <h2 class="text-3xl md:text-5xl font-bold tracking-normal mb-4">${this.copy.ecosystemTitle}</h2>
            <p class="text-muted-foreground text-lg">${this.copy.ecosystemSubtitle}</p>
          </div>
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            ${renderEcosystemGroups(this.copy)}
          </div>
        </section>

        <section id="faq" class="py-20 px-6 z-10 w-full max-w-4xl mx-auto">
          <div class="text-center mb-12">
            <h2 class="text-3xl md:text-4xl font-bold tracking-normal mb-4">${this.copy.faqTitle}</h2>
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
            <h2 class="text-3xl md:text-4xl font-bold tracking-normal mb-3">${this.copy.communityTitle}</h2>
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
              <a href="${releasesRoute}" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.footerReleases}</a>
              <a href="${LINKS.github}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
              <a href="${LINKS.npm}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.footerNpm}</a>
              <a href="${LINKS.discord}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">${this.copy.footerDiscord}</a>
              <a href="${LINKS.wechatGroupImage}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors" title="${this.copy.footerWechatGroup}">${this.copy.footerWechatGroup}</a>
            </div>
          </div>
        </footer>

      </div>
    `;

    this.bindLocaleSelect();
    this.bindHomeLinkAction();
    this.bindMobileMenu();
    this.bindCommunityQrModal();
    this.bindDesktopDownloads();
    this.bindInstallCopyButtons();
    createIcons({ icons, nameAttr: 'data-lucide' });
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
