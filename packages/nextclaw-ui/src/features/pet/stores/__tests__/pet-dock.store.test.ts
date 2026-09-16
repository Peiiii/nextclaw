import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  mergePetDockPersistedLayout,
  usePetDockStore,
} from '@/features/pet/stores/pet-dock.store';
import type { PetDockLayoutPreferences } from '@/features/pet/types/pet-view.types';

const defaultLayout: PetDockLayoutPreferences = {
  expanded: false,
  xPercent: 92,
  yPercent: 84,
};

describe('mergePetDockPersistedLayout', () => {
  it('applies valid persisted values', () => {
    const merged = mergePetDockPersistedLayout(
      { expanded: true, xPercent: 40, yPercent: 60 },
      defaultLayout,
    );
    expect(merged).toEqual({ expanded: true, xPercent: 40, yPercent: 60 });
  });

  it('ignores invalid persisted layout values on merge', () => {
    const merged = mergePetDockPersistedLayout(
      { expanded: 'yes', xPercent: 'bad', yPercent: 130 },
      defaultLayout,
    );
    expect(merged).toEqual({ expanded: false, xPercent: 92, yPercent: 84 });
  });

  it('falls back to current layout when persisted payload is not an object', () => {
    expect(mergePetDockPersistedLayout(null, defaultLayout)).toEqual(defaultLayout);
  });
});

describe('usePetDockStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePetDockStore.setState(defaultLayout);
  });

  it('starts collapsed at the default dock position', () => {
    const { result } = renderHook(() => usePetDockStore());
    expect(result.current.expanded).toBe(false);
    expect(result.current.xPercent).toBe(92);
    expect(result.current.yPercent).toBe(84);
  });

  it('toggles expanded', () => {
    const { result } = renderHook(() => usePetDockStore());
    act(() => result.current.setExpanded(true));
    expect(result.current.expanded).toBe(true);
    act(() => result.current.setExpanded(false));
    expect(result.current.expanded).toBe(false);
  });

  it('persists position after move', () => {
    const { result } = renderHook(() => usePetDockStore());
    act(() => result.current.moveTo(50, 40));
    expect(result.current.xPercent).toBe(50);
    expect(result.current.yPercent).toBe(40);
  });
});
