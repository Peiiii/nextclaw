import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeConfig } from '@/features/system-status/pages/runtime-config-page';
import { setLanguage } from '@/lib/i18n';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  useConfigResult: null as unknown as {
    data: Record<string, unknown> | null;
    isLoading: boolean;
  },
  useConfigSchemaResult: null as unknown as {
    data: Record<string, unknown> | null;
  }
}));

vi.mock('@/shared/hooks/use-config', () => ({
  useConfig: () => mocks.useConfigResult,
  useConfigSchema: () => mocks.useConfigSchemaResult,
  useUpdateRuntime: () => ({
    mutate: mocks.mutate,
    isPending: false
  })
}));

describe('RuntimeConfig', () => {
  beforeEach(() => {
    setLanguage('en');
    mocks.mutate.mockReset();
    mocks.useConfigResult = {
      isLoading: false,
      data: {
        agents: {
          defaults: {
            model: 'gpt-4.1',
            contextTokens: 120000,
            engine: 'native'
          },
          list: [
            {
              id: 'main',
              default: true,
              workspace: '/tmp/demo',
              model: 'gpt-4.1',
              runtime: 'native'
            }
          ],
          runtimes: {
            entries: {
              hermes: {
                enabled: true,
                label: 'Hermes',
                type: 'narp-stdio',
                config: {
                  command: 'npx',
                  args: ['acp']
                }
              }
            }
          }
        },
        bindings: [
          {
            agentId: 'main',
            match: {
              channel: 'discord'
            }
          }
        ],
        session: {
          dmScope: 'per-peer'
        }
      }
    };
    mocks.useConfigSchemaResult = {
      data: {
        uiHints: {}
      }
    };
  });

  it('saves the migrated runtime page through the system-status feature root', async () => {
    const user = userEvent.setup();

    render(<RuntimeConfig />);

    expect(screen.getByText('Save Runtime Settings')).toBeTruthy();
    expect(screen.getByPlaceholderText('Default runtime (e.g. native or codex)')).toBeTruthy();
    expect(screen.getByDisplayValue('Hermes')).toBeTruthy();

    await user.clear(screen.getByPlaceholderText('Default runtime (e.g. native or codex)'));
    await user.type(screen.getByPlaceholderText('Default runtime (e.g. native or codex)'), '  hermes  ');
    await user.click(screen.getByRole('button', { name: 'Save Runtime Settings' }));

    expect(mocks.mutate).toHaveBeenCalledWith({
      data: {
        agents: {
          defaults: {
            contextTokens: 120000,
            engine: 'hermes'
          },
          list: [
            {
              id: 'main',
              default: true,
              workspace: '/tmp/demo',
              model: 'gpt-4.1',
              engine: 'native'
            }
          ],
          runtimes: {
            entries: {
              hermes: {
                enabled: true,
                label: 'Hermes',
                type: 'narp-stdio',
                config: {
                  command: 'npx',
                  args: ['acp']
                }
              }
            }
          }
        },
        bindings: [
          {
            agentId: 'main',
            match: {
              channel: 'discord'
            }
          }
        ],
        session: {
          dmScope: 'per-peer'
        }
      }
    });
  });
});
