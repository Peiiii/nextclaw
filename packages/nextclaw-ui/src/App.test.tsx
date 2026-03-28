import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/components/providers/I18nProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import AppContent from '@/App';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useAuthStatus: vi.fn(),
  isTransientAuthStatusBootstrapError: vi.fn()
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuthStatus: mocks.useAuthStatus,
  isTransientAuthStatusBootstrapError: mocks.isTransientAuthStatusBootstrapError
}));

describe('App auth bootstrap', () => {
  function renderApp() {
    return render(
      <ThemeProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/chat']}>
            <AppContent />
          </MemoryRouter>
        </I18nProvider>
      </ThemeProvider>
    );
  }

  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.useAuthStatus.mockReset();
    mocks.isTransientAuthStatusBootstrapError.mockReset();
    mocks.isTransientAuthStatusBootstrapError.mockReturnValue(false);
    vi.useRealTimers();
  });

  it('does not block the app shell for transient bootstrap failures', () => {
    mocks.isTransientAuthStatusBootstrapError.mockReturnValue(true);
    mocks.useAuthStatus.mockReturnValue({
      isLoading: false,
      isError: true,
      isRefetching: false,
      error: new Error('Failed to fetch'),
      refetch: mocks.refetch,
      data: undefined
    });

    renderApp();

    expect(screen.queryByRole('heading', { name: /waiting for the local ui service to start/i })).toBeNull();
    expect(screen.queryByText('Failed to fetch')).toBeNull();
  });

  it('does not block the app shell for stable auth bootstrap failures', async () => {
    mocks.useAuthStatus.mockReturnValue({
      isLoading: false,
      isError: true,
      isRefetching: false,
      error: new Error('Authentication required.'),
      refetch: mocks.refetch,
      data: undefined
    });

    renderApp();

    expect(screen.queryByRole('heading', { name: /load authentication status/i })).toBeNull();
    expect(screen.queryByText('Authentication required.')).toBeNull();
  });
});
