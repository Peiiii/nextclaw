import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelsList } from '@/components/config/ChannelsList';

const mocks = vi.hoisted(() => ({
  updateChannelMutate: vi.fn(),
  updateChannelMutateAsync: vi.fn(),
  startChannelAuthMutateAsync: vi.fn(),
  pollChannelAuthMutateAsync: vi.fn(),
  configQuery: {
    data: {
      channels: {
        weixin: {
          enabled: false,
          defaultAccountId: '1344b2b24720@im.bot',
          baseUrl: 'https://ilinkai.weixin.qq.com',
          pollTimeoutMs: 35000,
          allowFrom: ['o9cq804svxfyCCTIqzddDqRBeMC0@im.wechat'],
          accounts: {
            '1344b2b24720@im.bot': {
              enabled: true
            }
          }
        }
      }
    },
    isLoading: false
  },
  metaQuery: {
    data: {
      channels: [
        {
          name: 'weixin',
          displayName: 'Weixin',
          enabled: false
        }
      ]
    }
  },
  schemaQuery: {
    data: {
      uiHints: {
        'channels.weixin': {
          label: 'Weixin',
          help: 'Weixin QR login + getupdates long-poll channel'
        },
        'channels.weixin.baseUrl': {
          label: 'API Base URL'
        }
      },
      actions: []
    }
  }
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn().mockResolvedValue(undefined)
    })
  };
});

vi.mock('@/hooks/useConfig', () => ({
  useConfig: () => mocks.configQuery,
  useConfigMeta: () => mocks.metaQuery,
  useConfigSchema: () => mocks.schemaQuery,
  useUpdateChannel: () => ({
    mutate: mocks.updateChannelMutate,
    mutateAsync: mocks.updateChannelMutateAsync,
    isPending: false
  }),
  useExecuteConfigAction: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  })
}));

vi.mock('@/hooks/use-channel-auth', () => ({
  useStartChannelAuth: () => ({
    mutateAsync: mocks.startChannelAuthMutateAsync,
    isPending: false
  }),
  usePollChannelAuth: () => ({
    mutateAsync: mocks.pollChannelAuthMutateAsync,
    isPending: false
  })
}));

describe('ChannelsList', () => {
  beforeEach(() => {
    mocks.updateChannelMutate.mockReset();
    mocks.updateChannelMutateAsync.mockReset();
    mocks.startChannelAuthMutateAsync.mockReset();
    mocks.pollChannelAuthMutateAsync.mockReset();
  });

  it('renders weixin qr auth card and starts channel auth', async () => {
    const user = userEvent.setup();
    mocks.startChannelAuthMutateAsync.mockResolvedValue({
      channel: 'weixin',
      kind: 'qr_code',
      sessionId: 'session-1',
      qrCode: 'qr-token',
      qrCodeUrl: 'https://example.com/weixin-qr.png',
      expiresAt: '2026-03-23T10:00:00.000Z',
      intervalMs: 60_000,
      note: '请扫码'
    });

    render(<ChannelsList />);

    await user.click(await screen.findByRole('button', { name: /All Channels/i }));

    expect((await screen.findAllByText('Weixin')).length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Reconnect with QR' })).toBeTruthy();
    expect(screen.getByText('Weixin now uses QR login as the primary setup flow.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reconnect with QR' }));

    await waitFor(() => {
      expect(mocks.startChannelAuthMutateAsync).toHaveBeenCalledWith({
        channel: 'weixin',
        data: expect.objectContaining({
          accountId: '1344b2b24720@im.bot',
          baseUrl: 'https://ilinkai.weixin.qq.com'
        })
      });
    });
  });

  it('saves weixin advanced settings from the advanced section', async () => {
    const user = userEvent.setup();

    const { container } = render(<ChannelsList />);

    await user.click(await screen.findByRole('button', { name: /All Channels/i }));
    await user.click(await screen.findByText('Advanced settings'));

    const timeoutInput = await screen.findByLabelText('Long Poll Timeout (ms)');
    await user.clear(timeoutInput);
    await user.type(timeoutInput, '45000');

    const accountsJson = container.querySelector('textarea#accounts') as HTMLTextAreaElement | null;
    expect(accountsJson).toBeTruthy();
    if (!accountsJson) {
      throw new Error('accounts textarea not found');
    }
    await user.clear(accountsJson);
    fireEvent.change(accountsJson, {
      target: {
        value: JSON.stringify(
          {
            '1344b2b24720@im.bot': {
              enabled: true,
              baseUrl: 'https://ilinkai.weixin.qq.com'
            }
          },
          null,
          2
        )
      }
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mocks.updateChannelMutate).toHaveBeenCalledWith({
        channel: 'weixin',
        data: expect.objectContaining({
          enabled: false,
          defaultAccountId: '1344b2b24720@im.bot',
          baseUrl: 'https://ilinkai.weixin.qq.com',
          pollTimeoutMs: 45000,
          allowFrom: ['o9cq804svxfyCCTIqzddDqRBeMC0@im.wechat'],
          accounts: {
            '1344b2b24720@im.bot': {
              enabled: true,
              baseUrl: 'https://ilinkai.weixin.qq.com'
            }
          }
        })
      });
    });
  });
});
