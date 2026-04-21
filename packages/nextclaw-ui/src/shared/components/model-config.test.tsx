import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ProviderScopedModelInput } from '@/components/common/ProviderScopedModelInput';
import { ModelConfig } from '@/shared/components/model-config';
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
      } as Record<string, { enabled: boolean; apiKeySet: boolean; models: string[] }>
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

vi.mock('@/shared/hooks/use-config', () => ({
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
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
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
        },
        {
          name: 'deepseek',
          displayName: 'DeepSeek',
          modelPrefix: 'deepseek',
          defaultModels: ['deepseek/deepseek-chat', 'deepseek/deepseek-reasoner'],
          keywords: [],
          envKey: 'DEEPSEEK_API_KEY'
        },
        {
          name: 'customhub',
          displayName: 'CustomHub',
          modelPrefix: 'customhub',
          defaultModels: [],
          keywords: [],
          envKey: 'CUSTOMHUB_API_KEY'
        }
      ]
    };
    mocks.configQuery.data.providers = {
      openai: {
        enabled: true,
        apiKeySet: true,
        models: ['gpt-5.2']
      },
      deepseek: {
        enabled: true,
        apiKeySet: true,
        models: ['deepseek-chat', 'deepseek-reasoner']
      },
      customhub: {
        enabled: true,
        apiKeySet: true,
        models: []
      }
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

  it('switches to the new provider without clearing the selection and auto-fills its first model', async () => {
    const user = userEvent.setup();

    render(<ModelConfig />);

    const providerTrigger = screen.getByRole('combobox');
    fireEvent.keyDown(providerTrigger, { key: 'ArrowDown' });
    await user.click(screen.getByRole('option', { name: 'DeepSeek' }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith({
        model: 'deepseek/deepseek-chat',
        workspace: '~/old-workspace'
      });
    });

    expect(providerTrigger.textContent).toContain('DeepSeek');
    expect(screen.getByDisplayValue('deepseek-chat')).toBeTruthy();
  });

  it('keeps the provider selected when the shared input switches to a provider without preset models', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState('openai/gpt-5.2');

      return (
        <ProviderScopedModelInput
          value={value}
          onChange={setValue}
          providerCatalog={[
            {
              name: 'openai',
              displayName: 'OpenAI',
              prefix: 'openai',
              aliases: ['openai'],
              models: ['gpt-5.2'],
              modelThinking: {},
              configured: true
            },
            {
              name: 'customhub',
              displayName: 'CustomHub',
              prefix: 'customhub',
              aliases: ['customhub'],
              models: [],
              modelThinking: {},
              configured: true
            }
          ]}
        />
      );
    }

    render(<Harness />);

    const providerTrigger = screen.getByRole('combobox');
    fireEvent.keyDown(providerTrigger, { key: 'ArrowDown' });
    await user.click(screen.getByRole('option', { name: 'CustomHub' }));

    const modelInput = screen.getByPlaceholderText('provider/model');
    await user.type(modelInput, 'reasoner-v1');

    expect(providerTrigger.textContent).toContain('CustomHub');
    expect(screen.getByDisplayValue('reasoner-v1')).toBeTruthy();
  });
});
