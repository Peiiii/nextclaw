import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChannelForm } from '@/features/channels/components/config/channel-form';

const updateChannelMutate = vi.fn();
const updateChannelMutateAsync = vi.fn();
let subscribeHandler:
  | ((event: {
    type: 'channel.config.apply-status';
    payload: {
      channel: string;
      status: 'started' | 'succeeded' | 'failed';
      message?: string;
    };
  }) => void)
  | null = null;

vi.mock('@/hooks/useConfig', () => ({
  useConfig: () => ({
    data: {
      channels: {
        weixin: {
          enabled: false
        }
      }
    }
  }),
  useConfigMeta: () => ({
    data: {
      channels: [
        {
          name: 'weixin',
          displayName: 'Weixin',
          enabled: false
        }
      ]
    }
  }),
  useConfigSchema: () => ({
    data: {
      uiHints: {},
      actions: []
    }
  }),
  useUpdateChannel: () => ({
    mutate: updateChannelMutate,
    mutateAsync: updateChannelMutateAsync,
    isPending: false
  }),
  useExecuteConfigAction: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  })
}));

vi.mock('@/transport', () => ({
  appClient: {
    subscribe: (handler: typeof subscribeHandler) => {
      subscribeHandler = handler;
      return () => {
        subscribeHandler = null;
      };
    }
  }
}));

vi.mock('@/features/channels/components/config/weixin-channel-auth-section', () => ({
  WeixinChannelAuthSection: () => null
}));

afterEach(() => {
  updateChannelMutate.mockReset();
  updateChannelMutateAsync.mockReset();
  subscribeHandler = null;
});

describe('ChannelForm', () => {
  it('renders the empty selection state without entering a render loop', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ChannelForm />);

    expect(await screen.findByText('Select a channel from the left to configure')).toBeTruthy();

    await waitFor(() => {
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some((entry) => typeof entry === 'string' && entry.includes('Maximum update depth exceeded'))
        )
      ).toBe(false);
    });

    consoleErrorSpy.mockRestore();
  });

  it('submits channel updates without waiting for background apply', () => {
    render(<ChannelForm channelName="weixin" />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateChannelMutate).toHaveBeenCalledWith({
      channel: 'weixin',
      data: {
        accounts: {},
        enabled: false
      }
    });
  });

  it('shows apply status updates from realtime events for the active channel', async () => {
    render(<ChannelForm channelName="weixin" />);

    await act(async () => {
      subscribeHandler?.({
        type: 'channel.config.apply-status',
        payload: {
          channel: 'weixin',
          status: 'started'
        }
      });
    });
    expect(screen.getByText('Channel configuration is applying')).toBeTruthy();

    await act(async () => {
      subscribeHandler?.({
        type: 'channel.config.apply-status',
        payload: {
          channel: 'weixin',
          status: 'succeeded'
        }
      });
    });
    expect(screen.getByText('Channel configuration applied')).toBeTruthy();

    await act(async () => {
      subscribeHandler?.({
        type: 'channel.config.apply-status',
        payload: {
          channel: 'weixin',
          status: 'failed',
          message: 'boom'
        }
      });
    });
    expect(screen.getByText('Failed to apply channel configuration: boom')).toBeTruthy();
  });
});
