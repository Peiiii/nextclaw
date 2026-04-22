import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchConfig } from '@/shared/components/search-config';
import { setLanguage } from '@/shared/lib/i18n';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  useConfigData: {
    data: {
      search: {
        provider: 'tavily',
        enabledProviders: ['bocha', 'tavily'],
        defaults: {
          maxResults: 8
        },
        providers: {
          bocha: {
            enabled: true,
            apiKeySet: false,
            baseUrl: 'https://api.bocha.cn/v1/web-search',
            docsUrl: 'https://open.bocha.cn',
            summary: true,
            freshness: 'noLimit'
          },
          tavily: {
            enabled: true,
            apiKeySet: true,
            apiKeyMasked: 'tv****1234',
            baseUrl: 'https://api.tavily.com/search',
            searchDepth: 'advanced',
            includeAnswer: true
          },
          brave: {
            enabled: false,
            apiKeySet: false,
            baseUrl: 'https://api.search.brave.com/res/v1/web/search'
          }
        }
      }
    }
  },
  useConfigMetaData: {
    data: {
      search: [
        {
          name: 'bocha',
          displayName: 'Bocha Search',
          description: 'China-friendly web search with AI-ready summaries.',
          docsUrl: 'https://open.bocha.cn',
          isDefault: true,
          supportsSummary: true
        },
        {
          name: 'tavily',
          displayName: 'Tavily Search',
          description: 'Research-focused web search with optional synthesized answers.',
          docsUrl: 'https://docs.tavily.com/documentation/api-reference/endpoint/search',
          supportsSummary: true
        },
        {
          name: 'brave',
          displayName: 'Brave Search',
          description: 'Brave web search API kept as an optional provider.',
          supportsSummary: false
        }
      ]
    }
  }
}));

vi.mock('@/shared/hooks/use-config', () => ({
  useConfig: () => mocks.useConfigData,
  useConfigMeta: () => mocks.useConfigMetaData,
  useUpdateSearch: () => ({
    mutate: mocks.mutate,
    isPending: false
  })
}));

describe('SearchConfig', () => {
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

  it('renders Tavily-specific controls and submits Tavily config through updateSearch', async () => {
    const user = userEvent.setup();

    render(<SearchConfig />);

    expect(screen.getByRole('heading', { name: 'Tavily Search' })).toBeTruthy();
    expect(screen.getByText('搜索深度')).toBeTruthy();
    expect(screen.getByText('包含回答')).toBeTruthy();
    expect(screen.getByDisplayValue('https://api.tavily.com/search')).toBeTruthy();
    expect(screen.queryByText('结果摘要')).toBeNull();

    const searchDepthSection = screen.getByText('搜索深度').parentElement;
    const includeAnswerSection = screen.getByText('包含回答').parentElement;
    const searchDepthTrigger = searchDepthSection?.querySelector('[role="combobox"]');
    const includeAnswerTrigger = includeAnswerSection?.querySelector('[role="combobox"]');

    expect(searchDepthTrigger).toBeTruthy();
    expect(includeAnswerTrigger).toBeTruthy();

    await user.click(searchDepthTrigger as HTMLElement);
    await user.click(screen.getByRole('option', { name: '高级' }));
    await user.click(includeAnswerTrigger as HTMLElement);
    await user.click(screen.getByRole('option', { name: '启用' }));

    await user.click(screen.getByRole('button', { name: '保存变更' }));

    expect(mocks.mutate).toHaveBeenCalledWith({
      data: {
        provider: 'tavily',
        enabledProviders: ['bocha', 'tavily'],
        defaults: {
          maxResults: 8
        },
        providers: {
          bocha: {
            apiKey: undefined,
            baseUrl: 'https://api.bocha.cn/v1/web-search',
            summary: true,
            freshness: 'noLimit'
          },
          tavily: {
            apiKey: undefined,
            baseUrl: 'https://api.tavily.com/search',
            searchDepth: 'advanced',
            includeAnswer: true
          },
          brave: {
            apiKey: undefined,
            baseUrl: 'https://api.search.brave.com/res/v1/web/search'
          }
        }
      }
    });
  });
});
