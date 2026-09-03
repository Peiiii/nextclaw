import mainConfig from './tailwind.config.js';

/** @type {import('tailwindcss').Config} */
export default {
  ...mainConfig,
  content: [
    './panel-standalone.html',
    './src/features/panel-apps/routes/panel-app-standalone.route.tsx',
    './src/app/components/{i18n-provider,theme-provider}.tsx',
    './src/features/account/components/login-page.tsx',
    './src/features/panel-apps/components/panel-app-runtime-surface.tsx',
    './src/features/panel-apps/pages/panel-app-standalone-page.tsx',
    './src/features/panel-apps/components/panel-app-service-action-authorization-dialog.tsx',
    './src/shared/components/ui/{button,card,dialog,input}.tsx',
  ],
};
