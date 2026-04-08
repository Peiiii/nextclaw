import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelConfig } from '@/components/config/ModelConfig';
import { setLanguage } from '@/lib/i18n';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  configQuery: {
    data: {
      agents: {
        defaults: {
          model: 'openai/gpt-5.2',
          workspace: '~/old-workspace'
        }
      },
      providers: {
        openai: {
          enabled: true,
          apiKeySet: true,
          models: ['gpt-5.2']
        }
      }
    },
    isLoading: false
  },
  metaQuery: {
    data: {
      providers: [
        {
          name: 'openai',
          displayName: 'OpenAI',
          modelPrefix: 'openai',
          defaultModels: ['openai/gpt-5.2'],
          keywords: [],
          envKey: 'OPENAI_API_KEY'
        }
      ]
    }
  },
  schemaQuery: {
    data: {
      uiHints: {}
    }
  }
}));

vi.mock('@/hooks/useConfig', () => ({
  useConfig: () => mocks.configQuery,
  useConfigMeta: () => mocks.metaQuery,
  useConfigSchema: () => mocks.schemaQuery,
  useUpdateModel: () => ({
    mutate: mocks.mutate,
    isPending: false
  })
}));

describe('ModelConfig', () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    setLanguage('en');
    mocks.configQuery.data = {
      agents: {
        defaults: {
          model: 'openai/gpt-5.2',
          workspace: '~/old-workspace'
        }
      },
      providers: {
        openai: {
          enabled: true,
          apiKeySet: true,
          models: ['gpt-5.2']
        }
      }
    };
    mocks.metaQuery.data = {
      providers: [
        {
          name: 'openai',
          displayName: 'OpenAI',
          modelPrefix: 'openai',
          defaultModels: ['openai/gpt-5.2'],
          keywords: [],
          envKey: 'OPENAI_API_KEY'
        }
      ]
    };
  });

  it('submits the workspace together with the selected model', async () => {
    const user = userEvent.setup();

    render(<ModelConfig />);

    const workspaceInput = await screen.findByLabelText('Default Path');
    await user.clear(workspaceInput);
    await user.type(workspaceInput, '~/new-workspace');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith({
        model: 'openai/gpt-5.2',
        workspace: '~/new-workspace'
      });
    });
  });

  it('shows a clear empty state and still allows manual model input when no providers are configured', async () => {
    const user = userEvent.setup();
    mocks.configQuery.data = {
      agents: {
        defaults: {
          model: '',
          workspace: '~/workspace'
        }
      },
      providers: {}
    } as typeof mocks.configQuery.data;
    mocks.metaQuery.data = {
      providers: []
    } as typeof mocks.metaQuery.data;

    render(<ModelConfig />);

    expect(await screen.findByText('No providers configured')).toBeTruthy();
    expect(screen.getByText('Add an AI provider to start using the platform.')).toBeTruthy();

    const modelInput = screen.getByPlaceholderText('provider/model');
    await user.type(modelInput, 'openai/gpt-5.1');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith({
        model: 'openai/gpt-5.1',
        workspace: '~/workspace'
      });
    });
  });
});
