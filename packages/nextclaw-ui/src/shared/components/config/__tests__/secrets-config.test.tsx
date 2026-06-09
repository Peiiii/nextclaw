import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecretsConfig } from '@/shared/components/config/secrets-config';
import { setLanguage } from '@/shared/lib/i18n';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  useConfigData: {
    isLoading: false,
    data: {
      secrets: {
        enabled: true,
        defaults: {
          env: 'vault-env',
          file: 'vault-file',
        },
        providers: {
          'vault-env': { source: 'env', prefix: 'NEXTCLAW_' },
          'vault-file': { source: 'file', path: '/tmp/secrets.json', format: 'json' },
        },
        refs: {
          'agents.defaults.model': {
            source: 'env',
            provider: 'vault-env',
            id: 'DEFAULT_MODEL',
          },
        },
      },
    },
  },
}));

vi.mock('@/shared/hooks/use-config', () => ({
  useConfig: () => mocks.useConfigData,
  useUpdateSecrets: () => ({
    mutate: mocks.mutate,
    isPending: false,
  }),
}));

describe('SecretsConfig', () => {
  beforeEach(() => {
    setLanguage('zh');
    mocks.mutate.mockReset();
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }
  });

  it('submits the loaded secrets config through updateSecrets', async () => {
    const user = userEvent.setup();

    render(<SecretsConfig />);

    expect(screen.getByText('Secret Providers')).toBeTruthy();
    expect(screen.getByDisplayValue('vault-env')).toBeTruthy();
    expect(screen.getByDisplayValue('NEXTCLAW_')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(mocks.mutate).toHaveBeenCalledWith({
      data: {
        enabled: true,
        defaults: {
          env: 'vault-env',
          file: 'vault-file',
          exec: null,
        },
        providers: {
          'vault-env': { source: 'env', prefix: 'NEXTCLAW_' },
          'vault-file': { source: 'file', path: '/tmp/secrets.json', format: 'json' },
        },
        refs: {
          'agents.defaults.model': {
            source: 'env',
            provider: 'vault-env',
            id: 'DEFAULT_MODEL',
          },
        },
      },
    });
  });
});
