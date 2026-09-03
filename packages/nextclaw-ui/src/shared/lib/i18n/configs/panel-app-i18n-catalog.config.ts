import enCore from '@/shared/lib/i18n/locales/en-US/core.json';
import enPanelApp from '@/shared/lib/i18n/locales/en-US/panel-app.json';
import zhCore from '@/shared/lib/i18n/locales/zh-CN/core.json';
import zhPanelApp from '@/shared/lib/i18n/locales/zh-CN/panel-app.json';
import { registerI18nCatalogs } from '@/shared/lib/i18n';

export function installPanelAppI18nCatalog(): void {
  registerI18nCatalogs({
    zh: { ...zhCore, ...zhPanelApp },
    en: { ...enCore, ...enPanelApp },
  });
}
