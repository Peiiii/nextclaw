import { fireEvent, render, screen } from '@testing-library/react';
import { ChatInputBarToolbar } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar-toolbar';

it('supports fuzzy model search and exposes provider management', () => {
  render(
    <ChatInputBarToolbar
      actions={{
        isSending: false,
        canStopGeneration: false,
        sendDisabled: false,
        stopDisabled: true,
        stopHint: 'Unavailable',
        sendButtonLabel: 'Send',
        stopButtonLabel: 'Stop',
        onSend: vi.fn(),
        onStop: vi.fn(),
      }}
      selects={[]}
      trailingSelects={[{
        key: 'model',
        value: 'deepseek/deepseek-v4-flash',
        placeholder: 'Select model',
        selectedLabel: 'DeepSeek/deepseek-v4-flash',
        options: [
          { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek/deepseek-v4-flash' },
          { value: 'minimax/MiniMax-M3', label: 'MiniMax/MiniMax-M3' },
        ],
        search: { placeholder: 'Search models' },
        manageLabel: 'Manage models and providers',
        manageHref: '/providers',
        onValueChange: vi.fn(),
      }]}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Select model: DeepSeek/deepseek-v4-flash' }));
  const searchInput = screen.getByPlaceholderText('Search models');
  expect(searchInput.className).toContain('border-0');
  expect(searchInput.className).not.toContain('focus:border');
  fireEvent.change(searchInput, { target: { value: 'dsv4' } });

  expect(screen.getByText('DeepSeek/deepseek-v4-flash')).toBeTruthy();
  expect(screen.queryByText('MiniMax/MiniMax-M3')).toBeNull();
  expect(screen.getByRole('link', { name: 'Manage models and providers' }).getAttribute('href')).toBe('/providers');
});
