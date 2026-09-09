import type { LandingCopy } from './landing-content.types';
import { COMPARISON_COPY } from './landing-comparison-content.config';
import { RUNTIME_SHOWCASE_COPY } from './landing-runtime-showcase.config';

export const LANDING_ZH_COPY: LandingCopy = {
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
  screenshotChatSrc: '/screenshots/nextclaw-hero-workbench-cn.webp',
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
      imageSrc: '/screenshots/nextclaw-agents-page-cn.png', imageAlt: 'NextClaw Agent 管理界面'
    },
    {
      eyebrow: '消息渠道',
      title: '微信、飞书等入口可以接进来',
      description: '把微信、飞书/Lark、QQ 等渠道接入后，Agent 可以在你常用的入口里继续工作。',
      imageSrc: '/screenshots/nextclaw-channels-page-cn.png', imageAlt: 'NextClaw 消息渠道设置'
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
      imageSrc: '/screenshots/nextclaw-workspace-explorer-cn.png', imageAlt: 'NextClaw 项目文件 Explorer 和 Markdown 预览同时打开'
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
      imageSrc: '/screenshots/nextclaw-channels-page-cn.png',
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
};
