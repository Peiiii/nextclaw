import { render, screen } from '@testing-library/react';
import { PanelAppInlineToolCard } from './tool-card-panel-app';

function createInlinePanelAppToolCard() {
  return {
    kind: 'result' as const,
    toolName: 'show_content',
    summary: 'Reader',
    hasResult: true,
    statusTone: 'success' as const,
    statusLabel: 'Completed',
    titleLabel: 'Tool Result',
    outputLabel: 'View Output',
    emptyLabel: 'No output',
    panelApp: {
      appId: 'reader',
      title: 'Reader',
      action: {
        kind: 'show-content' as const,
        label: 'Show content',
        request: {
          target: {
            type: 'panel_app' as const,
            payload: {
              appId: 'reader',
            },
          },
          placement: 'side_panel' as const,
        },
      },
    },
  };
}

it('renders inline panel app cards as pure card content without tool chrome', () => {
  const onToolAction = vi.fn();
  render(
    <PanelAppInlineToolCard
      card={createInlinePanelAppToolCard()}
      onToolAction={onToolAction}
      renderPanelAppCard={(panelApp) => (
        <div data-testid="inline-panel-app-card">{panelApp.appId}</div>
      )}
    />,
  );

  expect(screen.getByTestId('inline-panel-app-card').textContent).toBe('reader');
  expect(screen.queryByText('Tool Result')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Show content' })).toBeNull();
  expect(onToolAction).not.toHaveBeenCalled();
});

it('falls back to the generic tool card when no panel app renderer is available', () => {
  render(
    <PanelAppInlineToolCard
      card={createInlinePanelAppToolCard()}
      onToolAction={vi.fn()}
    />,
  );

  expect(screen.getByText('show content')).toBeTruthy();
  expect(screen.getByText('Reader')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Show content' })).toBeNull();
});
