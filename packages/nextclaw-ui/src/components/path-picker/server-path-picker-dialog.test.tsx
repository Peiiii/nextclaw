import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerPathPickerDialog } from '@/components/path-picker/server-path-picker-dialog';
import { setLanguage } from '@/lib/i18n';

const mocks = vi.hoisted(() => ({
  useServerPathBrowse: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/hooks/server-path/use-server-path-browse', () => ({
  useServerPathBrowse: mocks.useServerPathBrowse,
}));

describe('ServerPathPickerDialog', () => {
  beforeEach(() => {
    setLanguage('zh');
    mocks.refetch.mockReset();
    mocks.useServerPathBrowse.mockReturnValue({
      data: {
        currentPath: '/workspace',
        homePath: '/Users/peiwang',
        parentPath: '/',
        breadcrumbs: [
          { label: 'workspace', path: '/workspace' },
        ],
        entries: [
          { name: 'playground', path: '/workspace/playground' },
          { name: 'nextbot', path: '/workspace/nextbot' },
        ],
      },
      isLoading: false,
      error: null,
      refetch: mocks.refetch,
    });
  });

  it('filters entries inside the current directory', async () => {
    const user = userEvent.setup();

    render(
      <ServerPathPickerDialog
        open
        currentPath="/workspace"
        isSaving={false}
        onOpenChange={() => {}}
        onConfirm={() => {}}
        title="选择目录"
        description="选择一个目录"
        pathLabel="目录"
        confirmLabel="确定"
      />
    );

    expect(screen.getByText('playground')).toBeTruthy();
    expect(screen.getByText('nextbot')).toBeTruthy();

    await user.type(screen.getByPlaceholderText('搜索当前目录'), 'play');

    expect(screen.getByText('playground')).toBeTruthy();
    expect(screen.queryByText('nextbot')).toBeNull();
  });

  it('shows the empty-search hint and keeps the list region scroll-contained', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ServerPathPickerDialog
        open
        currentPath="/workspace"
        isSaving={false}
        onOpenChange={() => {}}
        onConfirm={() => {}}
        title="选择目录"
        description="选择一个目录"
        pathLabel="目录"
        confirmLabel="确定"
      />
    );

    await user.type(screen.getByPlaceholderText('搜索当前目录'), 'missing');

    expect(screen.getByText('当前目录下没有匹配结果。')).toBeTruthy();

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('overflow-hidden');
    expect(dialog.className).toContain('sm:h-[42rem]');

    const scrollArea = screen.getByText('当前目录下没有匹配结果。').closest('.overflow-auto');
    expect(scrollArea?.className).toContain('flex-1');
    expect(scrollArea?.className).toContain('min-h-0');
  });
});
