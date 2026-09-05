import { memo } from 'react';
import type { PetDockView } from '@/features/pet/types/pet-view.types';

type PetSpriteProps = {
  view: PetDockView;
  size?: 'sm' | 'md';
};

/** 桌宠形象：纯 emoji 文字形象（无位图依赖），按状态轻微摆动。 */
export const PetSprite = memo(function PetSprite({ view, size = 'md' }: PetSpriteProps) {
  const { emoji = '🐾' } = view.pet ?? {};
  const frameClass =
    view.state === 'working'
      ? 'pet-sprite pet-sprite--working'
      : 'pet-sprite';
  const sizeClass = size === 'sm' ? 'text-2xl' : 'text-4xl';
  return (
    <span
      className={`${frameClass} ${sizeClass} inline-flex select-none`}
      role="img"
      aria-label={view.pet?.name ?? '桌宠'}
    >
      {emoji}
    </span>
  );
});
