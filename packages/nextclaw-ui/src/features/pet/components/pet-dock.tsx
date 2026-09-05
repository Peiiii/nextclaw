import { memo, useCallback, useRef } from 'react';
import { usePetDockStore } from '@/features/pet/stores/pet-dock.store';
import type { PetDockView } from '@/features/pet/types/pet-view.types';
import { PetSprite } from '@/features/pet/components/pet-sprite';
import { buildPetDockLabel } from '@/features/pet/utils/pet-dock-view.utils';

type PetDockProps = {
  view: PetDockView;
  /** 点桌宠/气泡里"去对话"的跳转（由宿主注入，避免与导航耦合） */
  onGoToChat?: () => void;
  /** "换个形象"入口：宿主接入 AI 生成皮链路后注入；未注入时不渲染该按钮 */
  onRequestNewPet?: () => void;
};

/**
 * 右下角可拖可收桌宠浮层：
 * - 默认折叠为小图标（右上角入口可见）
 * - 点击展开气泡：名字/一句话性格 + 交互按钮（生成新形象 / 去对话）
 * - 按住可拖动（百分比定位，持久化到 localStorage）
 */
export const PetDock = memo(function PetDock({
  view,
  onGoToChat,
  onRequestNewPet,
}: PetDockProps) {
  const expanded = usePetDockStore((state) => state.expanded);
  const setExpanded = usePetDockStore((state) => state.setExpanded);
  const xPercent = usePetDockStore((state) => state.xPercent);
  const yPercent = usePetDockStore((state) => state.yPercent);
  const moveTo = usePetDockStore((state) => state.moveTo);
  const dragStateRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    // 点击交互（气泡/按钮）不触发拖动
    if ((event.target as HTMLElement).closest('[data-pet-action]')) {
      return;
    }
    dragStateRef.current = { offsetX: event.clientX, offsetY: event.clientY };
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const start = dragStateRef.current;
    if (!start) {
      return;
    }
    const dx = event.clientX - start.offsetX;
    const dy = event.clientY - start.offsetY;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
      return;
    }
    const nextX = Math.min(96, Math.max(2, xPercent + (dx / window.innerWidth) * 100));
    const nextY = Math.min(92, Math.max(4, yPercent + (dy / window.innerHeight) * 100));
    moveTo(nextX, nextY);
    dragStateRef.current = { offsetX: event.clientX, offsetY: event.clientY };
  }, [moveTo, xPercent, yPercent]);

  const handlePointerUp = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const toggleExpanded = useCallback(() => setExpanded(!expanded), [expanded, setExpanded]);

  const pet = view.pet;
  const label = buildPetDockLabel(view);

  return (
    <div
      className="pet-dock fixed z-50 flex flex-col items-end gap-2"
      style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {expanded && pet ? (
        <div className="pet-dock__bubble w-64 rounded-xl border border-border bg-background p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <PetSprite view={view} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{pet.name}</p>
              <p className="truncate text-xs text-muted-foreground">{pet.emoji} {pet.vibe}</p>
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{pet.description}</p>
          {pet.catchphrase ? (
            <p className="mt-1 text-xs italic">“{pet.catchphrase}”</p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            {onRequestNewPet ? (
              <button
                type="button"
                data-pet-action
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={onRequestNewPet}
              >
                换个形象
              </button>
            ) : null}
            <button
              type="button"
              data-pet-action
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(false)}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        data-pet-action
        className="pet-dock__button flex h-12 items-center gap-1 rounded-full border border-border bg-background px-3 shadow-md transition hover:shadow-lg"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-label={label}
        title={label}
      >
        <PetSprite view={view} size="sm" />
      </button>
      <div className="flex gap-1" data-pet-action>
        <button
          type="button"
          className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(false)}
        >
          收起
        </button>
        {onGoToChat ? (
          <button
            type="button"
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onGoToChat}
          >
            去对话
          </button>
        ) : null}
      </div>
    </div>
  );
});
