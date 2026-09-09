import type { LandingCopy } from './landing-content.types';
import { COMPARISON_COPY } from './landing-comparison-content.config';
import { RUNTIME_SHOWCASE_COPY } from './landing-runtime-showcase.config';

export const LANDING_EN_COPY: LandingCopy = {
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
  screenshotChatSrc: '/screenshots/nextclaw-workspace-explorer-en.png',
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
      imageSrc: '/screenshots/nextclaw-agents-page-en.png', imageAlt: 'NextClaw agent management page'
    },
    {
      eyebrow: 'Channels',
      title: 'Bring messaging apps into the same workflow',
      description: 'Connect WeChat, Feishu/Lark, QQ, and other channels so agents can work from the places you already use.',
      imageSrc: '/screenshots/nextclaw-channels-page-en.png', imageAlt: 'NextClaw message channel settings'
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
      imageSrc: '/screenshots/nextclaw-workspace-explorer-en.png', imageAlt: 'NextClaw project Explorer beside a Markdown file preview'
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
      imageSrc: '/screenshots/nextclaw-channels-page-en.png',
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
};
