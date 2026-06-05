import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PwaInstallBanner, PwaInstallCard } from '@/features/pwa';
import { usePwaStore, createInitialPwaState } from '@/features/pwa/stores/pwa.store';

describe('PwaInstallCard', () => {
  beforeEach(() => {
    usePwaStore.setState(createInitialPwaState());
  });

  it('renders install action when prompt install is available', () => {
    usePwaStore.setState({
      initialized: true,
      installability: 'available',
      installMethod: 'prompt',
      blockedReason: null,
      dismissedInstallPrompt: false
    });

    render(<PwaInstallCard />);

    expect(screen.getByRole('button', { name: 'Install NextClaw' })).toBeTruthy();
    expect(screen.getByText('Installable')).toBeTruthy();
  });

  it('renders desktop host description when suppressed', () => {
    usePwaStore.setState({
      initialized: true,
      installability: 'suppressed',
      installMethod: 'none',
      blockedReason: 'desktop-host',
      dismissedInstallPrompt: false
    });

    render(<PwaInstallCard />);

    expect(screen.getByText('Desktop Host Active')).toBeTruthy();
    expect(screen.getByText(/already running inside the Electron desktop host/i)).toBeTruthy();
  });

  it('renders install banner when prompt install is available and not dismissed', () => {
    usePwaStore.setState({
      initialized: true,
      installability: 'available',
      installMethod: 'prompt',
      blockedReason: null,
      dismissedInstallPrompt: false
    });

    render(<PwaInstallBanner />);

    expect(screen.getByText('Pin NextClaw as an App')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Install NextClaw' })).toBeTruthy();
  });

  it('does not render install banner after dismissal', () => {
    usePwaStore.setState({
      initialized: true,
      installability: 'available',
      installMethod: 'prompt',
      blockedReason: null,
      dismissedInstallPrompt: true
    });

    const { container } = render(<PwaInstallBanner />);

    expect(container.textContent).toBe('');
  });
});
