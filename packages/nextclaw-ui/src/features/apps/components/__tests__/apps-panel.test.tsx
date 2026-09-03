import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppsPanel, type AppsPanelTab } from '@/features/apps/components/apps-panel';

vi.mock('@/shared/lib/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/features/apps/components/app-packages-panel', () => ({
  AppPackagesPanel: ({ focusedPackageId }: { focusedPackageId?: string }) => (
    <div>packages-content:{focusedPackageId ?? 'none'}</div>
  ),
}));
vi.mock('@/features/panel-apps', () => ({
  PanelAppsList: () => <div>panel-apps-content</div>,
}));
vi.mock('@/features/service-apps', () => ({
  loadServiceAppsPanel: async () => ({
    ServiceAppsPanel: ({ onManagePackage }: { onManagePackage: (packageId: string) => void }) => (
      <button type="button" onClick={() => onManagePackage('nextclaw.personal-organizer')}>
        service-apps-content
      </button>
    ),
  }),
}));

function AppsPanelHarness() {
  const [activeTab, setActiveTab] = useState<AppsPanelTab>('apps');
  return (
    <AppsPanel
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onOpenPanelApp={vi.fn()}
    />
  );
}

describe('AppsPanel', () => {
  it('keeps one fixed-width navigation instance while switching app types', async () => {
    const user = userEvent.setup();
    render(<AppsPanelHarness />);

    const navigation = screen.getByRole('tablist');
    expect(navigation.className).toContain('w-full');
    expect(navigation.className).toContain('max-w-[390px]');

    await user.click(screen.getByRole('tab', { name: 'panelAppsTitle' }));
    expect(screen.getByText('panel-apps-content')).toBeTruthy();
    expect(screen.getByRole('tablist')).toBe(navigation);

    await user.click(screen.getByRole('tab', { name: 'serviceAppsTitle' }));
    expect(screen.getByText('service-apps-content')).toBeTruthy();
    expect(screen.getByRole('tablist')).toBe(navigation);
  });

  it('supports arrow-key navigation through the shared tab primitive', async () => {
    const user = userEvent.setup();
    render(<AppsPanelHarness />);

    const firstTab = screen.getByRole('tab', { name: 'appsTitle' });
    firstTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'panelAppsTitle' }));
    expect(screen.getByText('panel-apps-content')).toBeTruthy();
  });

  it('focuses the owning package when routing from a package-managed service', async () => {
    const user = userEvent.setup();
    render(<AppsPanelHarness />);

    await user.click(screen.getByRole('tab', { name: 'serviceAppsTitle' }));
    await user.click(screen.getByRole('button', { name: 'service-apps-content' }));

    expect(screen.getByText('packages-content:nextclaw.personal-organizer')).toBeTruthy();
  });
});
