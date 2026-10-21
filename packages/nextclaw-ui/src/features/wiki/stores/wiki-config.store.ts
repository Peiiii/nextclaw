import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type WikiConfig = {
  /** 知识库存储地址（本地路径或远程 URL） */
  storagePath: string;
  /** 知识库名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
};

type WikiConfigStore = WikiConfig & {
  updateConfig: (patch: Partial<WikiConfig>) => void;
};

const DEFAULT_CONFIG: WikiConfig = {
  storagePath: '~/knowledge-base',
  name: '我的知识库',
  enabled: true,
};

export const useWikiConfigStore = create<WikiConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      updateConfig: (patch) => set(patch),
    }),
    {
      name: 'nextclaw.wiki-config',
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
    },
  ),
);
