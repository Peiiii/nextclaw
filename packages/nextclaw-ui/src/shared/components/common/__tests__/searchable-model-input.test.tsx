import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchableModelInput } from '@/shared/components/common/searchable-model-input';
import { createPopoverAvailableHeightLimit } from '@/shared/components/ui/popover';

describe('SearchableModelInput', () => {
  it('keeps the model option panel bounded with an internal scroll region', async () => {
    render(
      <SearchableModelInput
        value=""
        onChange={vi.fn()}
        options={Array.from({ length: 40 }, (_, index) => `model-${index}`)}
        placeholder="Model"
        emptyText="No models"
        createText="Use {value}"
        toggleLabel="Toggle models"
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Model'));

    const firstOption = await screen.findByRole('button', { name: 'model-0' });
    const panel = firstOption.closest('[data-state="open"]') as HTMLElement | null;
    const scrollRegion = firstOption.closest('.overflow-y-auto');

    expect(panel?.style.maxHeight).toBe(createPopoverAvailableHeightLimit('15rem'));
    expect(panel?.style.maxHeight).toContain('max(0px');
    expect(panel?.style.maxHeight).toContain('100vh');
    expect(panel?.style.maxHeight).toContain('2rem');
    expect(panel?.className).toContain('flex-col');
    expect(scrollRegion?.className).toContain('flex-1');
    expect(scrollRegion?.className).toContain('overflow-y-auto');
  });
});
