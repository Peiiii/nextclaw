/**
 * 主题背景管理器
 * - 预置背景图切换（纯色 / 渐变 / 图片）
 * - 复杂主题由对话内 AI 生成并应用，不在此维护本地 mock 主题
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeBackground = {
  id: string;
  name: string;
  url: string;
  description?: string;
};

export const PRESET_BACKGROUNDS: ThemeBackground[] = [
  { id: 'none', name: '纯色', url: '', description: '无背景图' },
  { id: 'gradient-blue', name: '渐变蓝', url: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', description: '蓝紫渐变' },
  { id: 'gradient-dark', name: '渐变暗', url: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', description: '深色渐变' },
  { id: 'nature', name: '自然', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80', description: '森林风景' },
  { id: 'city', name: '城市', url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&q=80', description: '城市夜景' },
];

type ThemeManagerState = {
  currentBackground: ThemeBackground;
  setCurrentBackground: (bg: ThemeBackground) => void;
};

export const useThemeManagerStore = create<ThemeManagerState>()(
  persist(
    (set) => ({
      currentBackground: PRESET_BACKGROUNDS[0],
      setCurrentBackground: (bg) => set({ currentBackground: bg }),
    }),
    {
      name: 'nextclaw.theme-manager',
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
    },
  ),
);
