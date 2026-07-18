import { render, screen } from '@testing-library/react';
import { SettingsPage } from '@/shared/components/settings/settings-page';

describe('SettingsPage', () => {
  it('owns the shared settings canvas and title rhythm', () => {
    render(
      <SettingsPage title='Settings' description='Description'>
        <div data-testid='settings-content'>Content</div>
      </SettingsPage>
    );

    const page = screen.getByRole('heading', { name: 'Settings' }).parentElement?.parentElement?.parentElement;
    expect(page?.className).toContain('w-full');
    expect(page?.className).toContain('space-y-6');
    expect(page?.className).not.toContain('max-w-5xl');
    expect(screen.getByTestId('settings-content')).toBeTruthy();
  });

  it('adds only the shared list-detail behavior for split pages', () => {
    render(
      <SettingsPage title='Providers' layout='split'>
        <div>Provider content</div>
      </SettingsPage>
    );

    const page = screen.getByRole('heading', { name: 'Providers' }).parentElement?.parentElement?.parentElement;
    expect(page?.className).toContain('md:flex');
    expect(page?.className).toContain('md:min-h-0');
    expect(page?.className).toContain('pb-0');
  });
});
