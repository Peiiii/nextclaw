import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PetDock } from '@/features/pet/components/pet-dock';
import { PetSprite } from '@/features/pet/components/pet-sprite';
import { usePetDockStore } from '@/features/pet/stores/pet-dock.store';
import { DEFAULT_PET_VIEW } from '@/features/pet/utils/pet-dock-view.utils';
import type { PetDockView } from '@/features/pet/types/pet-view.types';

const idleView: PetDockView = { ...DEFAULT_PET_VIEW, expanded: false };

describe('PetSprite', () => {
  it('renders the pet emoji with accessible label', () => {
    const { container } = render(<PetSprite view={idleView} />);
    expect(screen.getByRole('img', { name: '小爪' }).textContent).toContain('🐾');
    expect(container.querySelector('.pet-sprite')).not.toBeNull();
  });
});

describe('PetDock', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // zustand store 是模块级单例，重置到默认避免跨用例污染
    usePetDockStore.setState({ expanded: false, xPercent: 92, yPercent: 84 });
  });

  it('renders a collapsed dock button with pet emoji', () => {
    render(<PetDock view={idleView} />);
    const button = screen.getByRole('button', { name: /小爪/ });
    expect(button.textContent).toContain('🐾');
  });

  it('expands a bubble showing pet identity when clicked', () => {
    render(<PetDock view={idleView} />);
    fireEvent.click(screen.getByRole('button', { name: /小爪/ }));
    expect(screen.getByText('一只暖洋洋的爪爪桌宠，陪你查资料、写文件、整理表格。')).not.toBeNull();
    // catchphrase 渲染时带中文引号
    expect(screen.getByText('“爪爪到，事办妥。”')).not.toBeNull();
  });

  it('renders the new-pet entry only when the host injects onRequestNewPet', () => {
    const onRequestNewPet = vi.fn();
    render(<PetDock view={idleView} onRequestNewPet={onRequestNewPet} />);
    fireEvent.click(screen.getByRole('button', { name: /小爪/ }));
    fireEvent.click(screen.getByRole('button', { name: '换个形象' }));
    expect(onRequestNewPet).toHaveBeenCalledOnce();
  });

  it('keeps the new-pet entry hidden when no host callback is provided', () => {
    render(<PetDock view={idleView} />);
    fireEvent.click(screen.getByRole('button', { name: /小爪/ }));
    expect(screen.queryByRole('button', { name: '换个形象' })).toBeNull();
  });
});
