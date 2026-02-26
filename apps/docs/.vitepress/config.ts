import { defineConfig } from 'vitepress'

const routeSyncScript = `
  (function() {
    function notify() {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'docs-route-change', url: location.href }, '*');
      }
    }
    notify();
    var lastUrl = location.href;
    new MutationObserver(function() {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        notify();
      }
    }).observe(document, { subtree: true, childList: true });
    window.addEventListener('popstate', notify);
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
    text: 'Getting Started',
    items: [
      { text: 'Introduction', link: '/en/guide/introduction' },
      { text: 'Quick Start', link: '/en/guide/getting-started' },
      { text: 'Configuration', link: '/en/guide/configuration' }
    ]
  },
  {
    text: 'Features',
    items: [
      { text: 'Channels', link: '/en/guide/channels' },
      { text: 'Multi-Agent Routing', link: '/en/guide/multi-agent' },
      { text: 'Tools', link: '/en/guide/tools' },
      { text: 'Cron & Heartbeat', link: '/en/guide/cron' },
      { text: 'Session Management', link: '/en/guide/sessions' }
    ]
  },
  {
    text: 'Reference',
    items: [
      { text: 'Commands', link: '/en/guide/commands' },
      { text: 'Troubleshooting', link: '/en/guide/troubleshooting' }
    ]
  },
  {
    text: 'Project',
    items: [{ text: 'Roadmap', link: '/en/guide/roadmap' }]
  }
]

const zhSidebar = [
  {
    text: '快速开始',
    items: [
      { text: '介绍', link: '/zh/guide/introduction' },
      { text: '上手', link: '/zh/guide/getting-started' },
      { text: '配置', link: '/zh/guide/configuration' }
    ]
  },
  {
    text: '功能',
    items: [
      { text: '渠道', link: '/zh/guide/channels' },
      { text: '多 Agent 路由', link: '/zh/guide/multi-agent' },
      { text: '工具', link: '/zh/guide/tools' },
      { text: 'Cron 与 Heartbeat', link: '/zh/guide/cron' },
      { text: '会话管理', link: '/zh/guide/sessions' }
    ]
  },
  {
    text: '参考',
    items: [
      { text: '命令', link: '/zh/guide/commands' },
      { text: '故障排查', link: '/zh/guide/troubleshooting' }
    ]
  },
  {
    text: '项目',
    items: [{ text: '路线图', link: '/zh/guide/roadmap' }]
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
    nav: [{ text: 'GitHub', link: 'https://github.com/Peiiii/nextclaw' }],
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
          { text: 'Guide', link: '/en/guide/getting-started' },
          { text: 'Roadmap', link: '/en/guide/roadmap' },
          { text: 'Channels', link: '/en/guide/channels' },
          { text: 'GitHub', link: 'https://github.com/Peiiii/nextclaw' }
        ],
        sidebar: {
          '/en/guide/': enSidebar
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
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: '路线图', link: '/zh/guide/roadmap' },
          { text: '渠道', link: '/zh/guide/channels' },
          { text: 'GitHub', link: 'https://github.com/Peiiii/nextclaw' }
        ],
        sidebar: {
          '/zh/guide/': zhSidebar
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
