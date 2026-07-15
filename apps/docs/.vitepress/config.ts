import { defineConfig } from 'vitepress'
import { enNav, enSidebar, zhNav, zhSidebar } from './navigation/docs-navigation.config'

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
      description: 'Documentation for the local-first NextClaw AI agent workspace',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
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
      description: '本地优先的 NextClaw AI Agent 工作台文档',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        outline: { level: [2, 3], label: '本页目录' },
        footer: {
          message: '基于 MIT License 发布。',
          copyright: 'Copyright © 2026-present NextClaw'
        }
      }
    }
  }
})
