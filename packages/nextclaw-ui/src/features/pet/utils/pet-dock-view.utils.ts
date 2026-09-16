import type { PetDockView } from '@/features/pet/types/pet-view.types';

/** 默认皮视图数据（UI 展示层，纯 emoji 文字形象，无需位图/服务端）。 */
export const DEFAULT_PET_VIEW: PetDockView = {
  pet: {
    id: 'mochi-claw',
    name: '小爪',
    description: '一只暖洋洋的爪爪桌宠，陪你查资料、写文件、整理表格。',
    emoji: '🐾',
    vibe: 'warm',
    catchphrase: '爪爪到，事办妥。',
  },
  expanded: false,
  state: 'idle',
};

/** 展示标签：当前皮名 + 状态提示。 */
export function buildPetDockLabel(view: PetDockView): string {
  const name = view.pet?.name ?? '桌宠';
  return view.state === 'working' ? `${name} · 忙ing` : name;
}
