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
    text: 'Start Using',
    items: [
      { text: 'Introduction', link: '/en/guide/introduction' },
      { text: 'Quick Start', link: '/en/guide/getting-started' },
      { text: 'Configuration', link: '/en/guide/configuration' },
      { text: 'Model Selection', link: '/en/guide/model-selection' },
      { text: 'What To Do After Setup', link: '/en/guide/after-setup' },
    ]
  },
  {
    text: 'Features',
    items: [
      { text: 'Chat Capabilities', link: '/en/guide/chat' },
      { text: 'Channels', link: '/en/guide/channels' },
      { text: 'Secrets Management', link: '/en/guide/secrets' },
      { text: 'Remote Access', link: '/en/guide/remote-access' },
      { text: 'Tools', link: '/en/guide/tools' },
      { text: 'Cron & Heartbeat', link: '/en/guide/cron' },
      { text: 'Session Management', link: '/en/guide/sessions' }
    ]
  },
  {
    text: 'Learn & Resources',
    items: [
      { text: 'Tutorial Hub', link: '/en/guide/tutorials' },
      { text: 'First Step: Pick Provider Path', link: '/en/guide/tutorials/provider-options' },
      { text: 'Claude Code / Codex / Hermes', link: '/en/guide/tutorials/claude-codex-hermes' },
      { text: 'Docker One-Click Deployment', link: '/en/guide/tutorials/docker-one-click' },
      { text: 'Qwen Portal Setup', link: '/en/guide/tutorials/qwen-portal' },
      { text: 'Feishu Setup', link: '/en/guide/tutorials/feishu' },
      { text: 'Skills Tutorial', link: '/en/guide/tutorials/skills' },
      { text: 'Remote Access UI Tutorial', link: '/en/guide/tutorials/remote-access-ui' },
      { text: 'MCP Tutorial', link: '/en/guide/tutorials/mcp-marketplace' },
      { text: 'Local Ollama + Qwen3 (macOS)', link: '/en/guide/tutorials/local-ollama-qwen3' },
      { text: 'Unsigned Desktop Install', link: '/en/guide/tutorials/desktop-install-unsigned' },
      { text: 'Linux Desktop Install (.deb + APT)', link: '/en/guide/tutorials/linux-desktop-deb-apt' },
      { text: 'Resource Hub', link: '/en/guide/resources' }
    ]
  },
  {
    text: 'Reference & Troubleshooting',
    items: [
      { text: 'Commands', link: '/en/guide/commands' },
      { text: 'Troubleshooting', link: '/en/guide/troubleshooting' }
    ]
  },
  {
    text: 'Advanced',
    items: [
      { text: 'Advanced Configuration', link: '/en/guide/advanced' },
      { text: 'Multi-Agent Routing', link: '/en/guide/multi-agent' }
    ]
  },
  {
    text: 'Project',
    items: [
      { text: 'Project Pulse', link: '/en/guide/project-pulse' },
      { text: 'Vision', link: '/en/guide/vision' },
      { text: 'Roadmap', link: '/en/guide/roadmap' }
    ]
  }
]

const enNotesSidebar = [
  {
    text: 'Product Notes',
    items: [
      { text: 'Overview', link: '/en/notes/' },
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
    text: '开始使用',
    items: [
      { text: '介绍', link: '/zh/guide/introduction' },
      { text: '上手', link: '/zh/guide/getting-started' },
      { text: '配置', link: '/zh/guide/configuration' },
      { text: '模型选型', link: '/zh/guide/model-selection' },
      { text: '配置后做什么', link: '/zh/guide/after-setup' },
    ]
  },
  {
    text: '功能',
    items: [
      { text: '对话能力', link: '/zh/guide/chat' },
      { text: '渠道', link: '/zh/guide/channels' },
      { text: '密钥管理', link: '/zh/guide/secrets' },
      { text: '远程访问', link: '/zh/guide/remote-access' },
      { text: '工具', link: '/zh/guide/tools' },
      { text: 'Cron 与 Heartbeat', link: '/zh/guide/cron' },
      { text: '会话管理', link: '/zh/guide/sessions' }
    ]
  },
  {
    text: '学习与资源',
    items: [
      { text: '教程总览', link: '/zh/guide/tutorials' },
      { text: '安装后第一步：先选接入方式', link: '/zh/guide/tutorials/provider-options' },
      { text: 'Claude Code / Codex / Hermes 集成', link: '/zh/guide/tutorials/claude-codex-hermes' },
      { text: 'Docker 一键部署教程', link: '/zh/guide/tutorials/docker-one-click' },
      { text: 'Qwen Portal 免费配置教程', link: '/zh/guide/tutorials/qwen-portal' },
      { text: '飞书配置教程', link: '/zh/guide/tutorials/feishu' },
      { text: 'Skills 教程', link: '/zh/guide/tutorials/skills' },
      { text: '远程访问 UI 教程', link: '/zh/guide/tutorials/remote-access-ui' },
      { text: 'MCP 教程', link: '/zh/guide/tutorials/mcp-marketplace' },
      { text: '本地 Ollama + Qwen3 教程（macOS）', link: '/zh/guide/tutorials/local-ollama-qwen3' },
      { text: '桌面端无签名安装教程', link: '/zh/guide/tutorials/desktop-install-unsigned' },
      { text: 'Linux 桌面安装（.deb + APT）', link: '/zh/guide/tutorials/linux-desktop-deb-apt' },
      { text: '生态资源', link: '/zh/guide/resources' }
    ]
  },
  {
    text: '参考与排错',
    items: [
      { text: '命令', link: '/zh/guide/commands' },
      { text: '故障排查', link: '/zh/guide/troubleshooting' }
    ]
  },
  {
    text: '进阶',
    items: [
      { text: '进阶配置', link: '/zh/guide/advanced' },
      { text: '多 Agent 路由', link: '/zh/guide/multi-agent' }
    ]
  },
  {
    text: '项目',
    items: [
      { text: 'Project Pulse', link: '/zh/guide/project-pulse' },
      { text: '愿景', link: '/zh/guide/vision' },
      { text: '路线图', link: '/zh/guide/roadmap' }
    ]
  }
]

const zhNotesSidebar = [
  {
    text: '产品更新笔记',
    items: [
      { text: '总览', link: '/zh/notes/' },
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
          { text: 'Start Using', link: '/en/guide/getting-started' },
          { text: 'Features', link: '/en/guide/channels' },
          { text: 'Notes', link: '/en/notes/' },
          { text: 'Blog', link: '/en/blog/' },
          { text: 'Learn & Resources', link: '/en/guide/tutorials' },
          { text: 'Reference', link: '/en/guide/commands' },
          { text: 'Advanced', link: '/en/guide/advanced' },
          { text: 'Project', link: '/en/guide/project-pulse' },
        ],
        sidebar: {
          '/en/guide/': enSidebar,
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
          { text: '开始使用', link: '/zh/guide/getting-started' },
          { text: '功能', link: '/zh/guide/channels' },
          { text: '更新笔记', link: '/zh/notes/' },
          { text: '博客', link: '/zh/blog/' },
          { text: '学习与资源', link: '/zh/guide/tutorials' },
          { text: '参考与排错', link: '/zh/guide/commands' },
          { text: '进阶', link: '/zh/guide/advanced' },
          { text: '项目', link: '/zh/guide/project-pulse' },
        ],
        sidebar: {
          '/zh/guide/': zhSidebar,
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
