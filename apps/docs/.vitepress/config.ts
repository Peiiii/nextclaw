import { defineConfig } from 'vitepress'

const routeSyncScript = `
  (function() {
    var LOCALE_KEY = 'nextclaw.docs.locale';

    function readSavedLocale() {
      try {
        var saved = localStorage.getItem(LOCALE_KEY);
        return saved === 'en' || saved === 'zh' ? saved : null;
      } catch (_) {
        return null;
      }
    }

    function detectBrowserLocale() {
      var lang = '';
      try {
        lang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
      } catch (_) {}
      return /^zh\\b/i.test(lang) ? 'zh' : 'en';
    }

    function resolvePreferredLocale() {
      return readSavedLocale() || detectBrowserLocale();
    }

    function persistLocaleFromPath() {
      var match = location.pathname.match(/^\\/(en|zh)(\\/|$)/);
      if (!match) {
        return;
      }
      try {
        localStorage.setItem(LOCALE_KEY, match[1]);
      } catch (_) {}
    }

    function redirectRootByLocale() {
      if (location.pathname !== '/' && location.pathname !== '') {
        return false;
      }
      var target = '/' + resolvePreferredLocale() + '/' + location.search + location.hash;
      location.replace(target);
      return true;
    }

    function notify() {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'docs-route-change', url: location.href }, '*');
      }
    }

    if (redirectRootByLocale()) {
      return;
    }

    persistLocaleFromPath();
    notify();
    var lastUrl = location.href;
    new MutationObserver(function() {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        persistLocaleFromPath();
        notify();
      }
    }).observe(document, { subtree: true, childList: true });
    window.addEventListener('popstate', function() {
      persistLocaleFromPath();
      notify();
    });
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'docs-navigate' && typeof e.data.path === 'string') {
        var a = document.createElement('a');
        a.href = e.data.path;
        a.click();
      }
    });
  })();
`

const enSidebar = [
  {
    text: 'Why NextClaw',
    items: [
      { text: 'Introduction', link: '/en/guide/introduction' }
    ]
  },
  {
    text: 'Quick Start',
    items: [
      { text: 'Quick Start', link: '/en/guide/getting-started' },
      { text: 'What To Do After Setup', link: '/en/guide/after-setup' },
      { text: 'Linux Desktop Install (.deb + APT)', link: '/en/guide/tutorials/linux-desktop-deb-apt' }
    ]
  },
  {
    text: 'Connect Your World',
    items: [
      { text: 'Configuration', link: '/en/guide/configuration' },
      { text: 'Model Selection', link: '/en/guide/model-selection' },
      { text: 'Channels', link: '/en/guide/channels' },
      { text: 'Secrets Management', link: '/en/guide/secrets' },
      { text: 'Tools', link: '/en/guide/tools' },
      { text: 'Pick a Provider Path', link: '/en/guide/tutorials/provider-options' },
      { text: 'Skills Tutorial', link: '/en/guide/tutorials/skills' },
      { text: 'Resource Hub', link: '/en/guide/resources' }
    ]
  },
  {
    text: 'Let It Work For You',
    items: [
      { text: 'Chat Capabilities', link: '/en/guide/chat' },
      { text: 'Session Management', link: '/en/guide/sessions' },
      { text: 'Cron & Heartbeat', link: '/en/guide/cron' },
      { text: 'Runtime & Hosting', link: '/en/guide/runtime-hosting' },
      { text: 'Background & Autostart', link: '/en/guide/background-autostart' },
      { text: 'Remote Access', link: '/en/guide/remote-access' },
      { text: 'Docker One-Click Deployment', link: '/en/guide/tutorials/docker-one-click' }
    ]
  },
  {
    text: 'When Something Breaks',
    items: [
      { text: 'Troubleshooting', link: '/en/guide/troubleshooting' }
    ]
  },
  {
    text: 'Reference',
    items: [
      { text: 'Core Commands', link: '/en/guide/core-commands' },
      { text: 'Command Index', link: '/en/guide/commands' },
      { text: 'Advanced Configuration', link: '/en/guide/advanced' },
      { text: 'Multi-Agent Routing', link: '/en/guide/multi-agent' }
    ]
  },
]

const enProjectSidebar = [
  {
    text: 'Project',
    items: [
      { text: 'Overview', link: '/en/project/' },
      { text: 'Project Pulse', link: '/en/project/project-pulse' },
      { text: 'Vision', link: '/en/project/vision' },
      { text: 'Roadmap', link: '/en/project/roadmap' },
      { text: 'Release Notes', link: '/en/project/release-notes' },
      { text: 'Community', link: '/en/project/community' }
    ]
  }
]

const enNotesSidebar = [
  {
    text: 'Product Notes',
    items: [
      { text: 'Overview', link: '/en/notes/' },
      { text: '2026-05-06: Auto Updates and Long-Context Awareness', link: '/en/notes/2026-05-06-auto-update-and-context-awareness' },
      { text: '2026-04-26: NextClaw Feels Better on Mobile', link: '/en/notes/2026-04-26-mobile-experience-update' },
      { text: '2026-04-03: Sessions Now Actually Stay Project-Aware', link: '/en/notes/2026-04-03-project-aware-sessions-and-unified-patch-release' },
      { text: '2026-03-31: Cron Is Clearer Now, and One-Shot Jobs Finally Feel One-Shot', link: '/en/notes/2026-03-31-cron-clarity-and-one-shot-upgrade' },
      { text: '2026-03-11: Bocha Search Integration + Runtime Alignment', link: '/en/notes/2026-03-11-search-provider-controls-and-runtime-alignment' }
    ]
  }
]

const enBlogSidebar = [
  {
    text: 'Blog',
    items: [
      { text: 'Overview', link: '/en/blog/' },
      { text: '2026-04-03: Why Project-Aware Sessions Matter More Than One More AI Feature', link: '/en/blog/2026-04-03-why-project-aware-sessions-matter' }
    ]
  }
]

const zhSidebar = [
  {
    text: '为什么用 NextClaw',
    items: [
      { text: '介绍', link: '/zh/guide/introduction' }
    ]
  },
  {
    text: '快速开始',
    items: [
      { text: '上手', link: '/zh/guide/getting-started' },
      { text: '配置后做什么', link: '/zh/guide/after-setup' },
      { text: 'Linux 桌面安装（.deb + APT）', link: '/zh/guide/tutorials/linux-desktop-deb-apt' }
    ]
  },
  {
    text: '连接你的世界',
    items: [
      { text: '配置', link: '/zh/guide/configuration' },
      { text: '模型选型', link: '/zh/guide/model-selection' },
      { text: '渠道', link: '/zh/guide/channels' },
      { text: '密钥管理', link: '/zh/guide/secrets' },
      { text: '工具', link: '/zh/guide/tools' },
      { text: '先选接入方式', link: '/zh/guide/tutorials/provider-options' },
      { text: 'Skills 教程', link: '/zh/guide/tutorials/skills' },
      { text: '生态资源', link: '/zh/guide/resources' }
    ]
  },
  {
    text: '让它持续为你工作',
    items: [
      { text: '对话能力', link: '/zh/guide/chat' },
      { text: '会话管理', link: '/zh/guide/sessions' },
      { text: 'Cron 与 Heartbeat', link: '/zh/guide/cron' },
      { text: '运行与托管总览', link: '/zh/guide/runtime-hosting' },
      { text: '后台运行与自启动', link: '/zh/guide/background-autostart' },
      { text: '远程访问', link: '/zh/guide/remote-access' },
      { text: 'Docker 一键部署教程', link: '/zh/guide/tutorials/docker-one-click' }
    ]
  },
  {
    text: '出问题怎么办',
    items: [
      { text: '故障排查', link: '/zh/guide/troubleshooting' }
    ]
  },
  {
    text: '查询参考',
    items: [
      { text: '核心命令', link: '/zh/guide/core-commands' },
      { text: '命令索引', link: '/zh/guide/commands' },
      { text: '进阶配置', link: '/zh/guide/advanced' },
      { text: '多 Agent 路由', link: '/zh/guide/multi-agent' }
    ]
  },
]

const zhProjectSidebar = [
  {
    text: '项目信息',
    items: [
      { text: '总览', link: '/zh/project/' },
      { text: 'Project Pulse', link: '/zh/project/project-pulse' },
      { text: '愿景', link: '/zh/project/vision' },
      { text: '路线图', link: '/zh/project/roadmap' },
      { text: '更新笔记', link: '/zh/project/release-notes' },
      { text: '社区', link: '/zh/project/community' }
    ]
  }
]

const zhNotesSidebar = [
  {
    text: '产品更新笔记',
    items: [
      { text: '总览', link: '/zh/notes/' },
      { text: '2026-05-06：自动更新与长会话上下文管理上线', link: '/zh/notes/2026-05-06-auto-update-and-context-awareness' },
      { text: '2026-04-26：手机端访问更顺手了', link: '/zh/notes/2026-04-26-mobile-experience-update' },
      { text: '2026-04-03：会话现在会真正带着项目一起工作', link: '/zh/notes/2026-04-03-project-aware-sessions-and-unified-patch-release' },
      { text: '2026-03-31：定时任务更清楚了，也终于更像“定时”了', link: '/zh/notes/2026-03-31-cron-clarity-and-one-shot-upgrade' },
      { text: '2026-03-11：集成博查搜索 + 运行时对齐', link: '/zh/notes/2026-03-11-search-provider-controls-and-runtime-alignment' }
    ]
  }
]

const zhBlogSidebar = [
  {
    text: '博客',
    items: [
      { text: '总览', link: '/zh/blog/' },
      { text: '2026-04-03：为什么项目感知会话比再多一个 AI 功能更重要', link: '/zh/blog/2026-04-03-why-project-aware-sessions-matter' }
    ]
  }
]

export default defineConfig({
  title: 'NextClaw',
  description: 'NextClaw documentation',
  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
    ['script', {}, routeSyncScript]
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: [],
    sidebar: {},
    socialLinks: [{ icon: 'github', link: 'https://github.com/Peiiii/nextclaw' }],
    search: { provider: 'local' },
    outline: false,
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present NextClaw'
    }
  },
  locales: {
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'NextClaw',
      description: 'Effortlessly Simple Personal AI Assistant — Documentation',
      themeConfig: {
        nav: [
          { text: 'Why NextClaw', link: '/en/guide/introduction' },
          { text: 'Quick Start', link: '/en/guide/getting-started' },
          { text: 'Connect Your World', link: '/en/guide/configuration' },
          { text: 'Let It Work For You', link: '/en/guide/runtime-hosting' },
          { text: 'When Something Breaks', link: '/en/guide/troubleshooting' },
          { text: 'Reference', link: '/en/guide/commands' },
          { text: 'Project', link: '/en/project/' },
        ],
        sidebar: {
          '/en/guide/': enSidebar,
          '/en/project/': enProjectSidebar,
          '/en/notes/': enNotesSidebar,
          '/en/blog/': enBlogSidebar
        },
        outline: { level: [2, 3], label: 'On this page' },
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © 2026-present NextClaw'
        }
      }
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      title: 'NextClaw',
      description: '轻量、易用、兼容 OpenClaw 的个人 AI 助手文档',
      themeConfig: {
        nav: [
          { text: '为什么用 NextClaw', link: '/zh/guide/introduction' },
          { text: '快速开始', link: '/zh/guide/getting-started' },
          { text: '连接你的世界', link: '/zh/guide/configuration' },
          { text: '让它持续为你工作', link: '/zh/guide/runtime-hosting' },
          { text: '出问题怎么办', link: '/zh/guide/troubleshooting' },
          { text: '查询参考', link: '/zh/guide/commands' },
          { text: '项目', link: '/zh/project/' },
        ],
        sidebar: {
          '/zh/guide/': zhSidebar,
          '/zh/project/': zhProjectSidebar,
          '/zh/notes/': zhNotesSidebar,
          '/zh/blog/': zhBlogSidebar
        },
        outline: { level: [2, 3], label: '本页目录' },
        footer: {
          message: '基于 MIT License 发布。',
          copyright: 'Copyright © 2026-present NextClaw'
        }
      }
    }
  }
})
