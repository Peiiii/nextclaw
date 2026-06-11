import { fireEvent, render, screen } from '@testing-library/react';
import { PanelAppInlineToolCard } from './tool-card-panel-app';

it('renders inline panel app cards with an expand action', () => {
  const onToolAction = vi.fn();
  render(
    <PanelAppInlineToolCard
      card={{
        kind: 'result',
        toolName: 'show_content',
        summary: 'Reader',
        hasResult: true,
        statusTone: 'success',
        statusLabel: 'Completed',
        titleLabel: 'Tool Result',
        outputLabel: 'View Output',
        emptyLabel: 'No output',
        panelApp: {
          appId: 'reader',
          title: 'Reader',
          action: {
            kind: 'show-content',
            label: 'Show content',
            request: {
              target: {
                type: 'panel_app',
                payload: {
                  appId: 'reader',
                },
              },
              placement: 'side_panel',
            },
          },
        },
      }}
      onToolAction={onToolAction}
      renderPanelAppCard={(panelApp) => (
        <div data-testid="inline-panel-app-card">{panelApp.appId}</div>
      )}
    />,
  );

  expect(screen.getByTestId('inline-panel-app-card').textContent).toBe('reader');
  fireEvent.click(screen.getByRole('button', { name: 'Show content' }));
  expect(onToolAction).toHaveBeenCalledWith({
    kind: 'show-content',
    label: 'Show content',
    request: {
      target: {
        type: 'panel_app',
        payload: {
          appId: 'reader',
        },
      },
      placement: 'side_panel',
    },
  });
});
