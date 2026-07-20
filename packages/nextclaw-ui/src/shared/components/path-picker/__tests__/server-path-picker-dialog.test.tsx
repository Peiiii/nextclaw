import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerPathPickerDialog } from '@/shared/components/path-picker/server-path-picker-dialog';
import { setLanguage } from '@/shared/lib/i18n';

const mocks = vi.hoisted(() => ({
  useServerPathBrowse: vi.fn(),
  useServerPathCreateDirectory: vi.fn(),
  createDirectory: vi.fn(),
  resetCreateDirectory: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/shared/hooks/use-server-path-browse', () => ({
  useServerPathBrowse: mocks.useServerPathBrowse,
}));

vi.mock('@/shared/hooks/use-server-path-create-directory', () => ({
  useServerPathCreateDirectory: mocks.useServerPathCreateDirectory,
}));

type PickerOverrides = {
  allowCreateDirectory?: boolean;
  currentPath?: string;
  defaultWorkspacePath?: string;
  description?: string;
  open?: boolean;
};

const createPickerElement = (overrides?: PickerOverrides) => (
  <ServerPathPickerDialog
    open={overrides?.open ?? true}
    allowCreateDirectory={overrides?.allowCreateDirectory}
    currentPath={overrides?.currentPath ?? '/workspace'}
    defaultWorkspacePath={overrides?.defaultWorkspacePath}
    isSaving={false}
    onOpenChange={() => {}}
    onConfirm={() => {}}
    title="选择目录"
    description={overrides?.description ?? '选择一个目录'}
    pathLabel="目录"
    confirmLabel="确定"
  />
);

const renderPicker = (overrides?: PickerOverrides) => render(createPickerElement(overrides));

describe('ServerPathPickerDialog', () => {
  beforeEach(() => {
    setLanguage('zh');
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue(undefined);
    mocks.createDirectory.mockReset();
    mocks.createDirectory.mockResolvedValue({ path: '/workspace/new-folder' });
    mocks.resetCreateDirectory.mockReset();
    mocks.useServerPathCreateDirectory.mockReturnValue({
      mutateAsync: mocks.createDirectory,
      reset: mocks.resetCreateDirectory,
      isPending: false,
      error: null,
    });
    mocks.useServerPathBrowse.mockReturnValue({
      data: {
        currentPath: '/workspace',
        homePath: '/Users/peiwang',
        parentPath: '/',
        breadcrumbs: [{ label: 'workspace', path: '/workspace' }],
        entries: [
          {
            name: 'playground',
            path: '/workspace/playground',
            kind: 'directory',
            hidden: false,
          },
          {
            name: 'nextbot',
            path: '/workspace/nextbot',
            kind: 'directory',
            hidden: false,
          },
        ],
        locations: [
          { kind: 'desktop', path: '/Users/peiwang/Desktop' },
          { kind: 'documents', path: '/Users/peiwang/Documents' },
          { kind: 'downloads', path: '/Users/peiwang/Downloads' },
          { kind: 'icloud-drive', path: '/Users/peiwang/Library/Mobile Documents/com~apple~CloudDocs' },
          { kind: 'applications', path: '/Applications' },
          { kind: 'volumes', path: '/Volumes' },
        ],
      },
      isLoading: false,
      error: null,
      refetch: mocks.refetch,
    });
  });

  it('filters entries inside the current directory', async () => {
    const user = userEvent.setup();
    renderPicker();

    expect(screen.getByText('playground')).toBeTruthy();
    expect(screen.getByText('nextbot')).toBeTruthy();

    await user.type(screen.getAllByPlaceholderText('搜索当前目录')[0], 'play');

    expect(screen.getByText('playground')).toBeTruthy();
    expect(screen.queryByText('nextbot')).toBeNull();
  });

  it('shows server-backed Mac locations and opens sidebar locations with one click', async () => {
    const user = userEvent.setup();
    renderPicker();

    expect(screen.getByRole('button', { name: '桌面' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '文稿' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '下载' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'iCloud 云盘' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '应用程序' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '磁盘与卷' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '下载' }));

    expect(mocks.useServerPathBrowse).toHaveBeenLastCalledWith({
      path: '/Users/peiwang/Downloads',
      enabled: true,
    });
  });

  it('keeps the explicit current path when an older home browse result is still visible', () => {
    mocks.useServerPathBrowse.mockReturnValue({
      data: {
        currentPath: '/Users/peiwang',
        homePath: '/Users/peiwang',
        parentPath: '/Users',
        breadcrumbs: [
          { label: 'Users', path: '/Users' },
          { label: 'peiwang', path: '/Users/peiwang' },
        ],
        entries: [],
      },
      isLoading: false,
      error: null,
      refetch: mocks.refetch,
    });

    renderPicker({ currentPath: '/Users/peiwang/.nextclaw/workspace' });

    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe(
      '/Users/peiwang/.nextclaw/workspace',
    );
    expect(screen.getByText('/Users/peiwang/.nextclaw/workspace')).toBeTruthy();
  });

  it('starts at the workdir and keeps the canonical address and selected folder aligned', () => {
    mocks.useServerPathBrowse.mockReturnValue({
      data: {
        currentPath: '/Users/peiwang/.nextclaw/workspace',
        homePath: '/Users/peiwang',
        parentPath: '/Users/peiwang/.nextclaw',
        breadcrumbs: [
          { label: '/', path: '/' },
          { label: 'Users', path: '/Users' },
          { label: 'peiwang', path: '/Users/peiwang' },
          { label: '.nextclaw', path: '/Users/peiwang/.nextclaw' },
          { label: 'workspace', path: '/Users/peiwang/.nextclaw/workspace' },
        ],
        entries: [],
      },
      isLoading: false,
      error: null,
      refetch: mocks.refetch,
    });

    renderPicker({
      currentPath: '',
      defaultWorkspacePath: '~/.nextclaw/workspace',
      description: undefined,
    });

    expect(mocks.useServerPathBrowse).toHaveBeenLastCalledWith({
      path: '~/.nextclaw/workspace',
      enabled: true,
    });
    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe(
      '/Users/peiwang/.nextclaw/workspace',
    );
    expect(screen.getByRole('button', { name: 'NextClaw 工作区' })).toBeTruthy();
    expect(screen.getByText('workspace')).toBeTruthy();
  });

  it('normalizes a home-relative workdir with Windows separators', () => {
    mocks.useServerPathBrowse.mockReturnValue({
      data: {
        currentPath: 'C:\\Users\\alice\\.nextclaw\\workspace',
        homePath: 'C:\\Users\\alice',
        parentPath: 'C:\\Users\\alice\\.nextclaw',
        breadcrumbs: [
          { label: 'C:', path: 'C:\\' },
          { label: 'Users', path: 'C:\\Users' },
          { label: 'alice', path: 'C:\\Users\\alice' },
          { label: '.nextclaw', path: 'C:\\Users\\alice\\.nextclaw' },
          { label: 'workspace', path: 'C:\\Users\\alice\\.nextclaw\\workspace' },
        ],
        entries: [],
        locations: [],
      },
      isLoading: false,
      error: null,
      refetch: mocks.refetch,
    });

    renderPicker({ currentPath: '', defaultWorkspacePath: '~/.nextclaw/workspace' });

    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe(
      'C:\\Users\\alice\\.nextclaw\\workspace',
    );
    expect(screen.getByText('workspace')).toBeTruthy();
  });

  it('creates a folder in the current directory and selects it without entering it', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '新建文件夹' }));
    await user.type(screen.getByLabelText('文件夹名称'), 'new-folder');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(mocks.createDirectory).toHaveBeenCalledWith({
      parentPath: '/workspace',
      name: 'new-folder',
    });
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe(
      '/workspace/new-folder',
    );
    expect((screen.getByRole('button', { name: '后退' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('hides directory creation when the caller only allows existing directories', () => {
    renderPicker({ allowCreateDirectory: false });

    expect(screen.queryByRole('button', { name: '新建文件夹' })).toBeNull();
    expect(screen.getByText('单击选择，双击进入')).toBeTruthy();
  });

  it('uses single click to select and double click to enter a folder', async () => {
    const user = userEvent.setup();
    renderPicker();
    const playground = screen.getByRole('option', { name: /playground/ });

    expect(screen.getByText('单击选择，双击进入')).toBeTruthy();

    await user.click(playground);

    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe(
      '/workspace/playground',
    );
    expect(mocks.useServerPathBrowse).toHaveBeenLastCalledWith({
      path: '/workspace',
      enabled: true,
    });

    await user.dblClick(playground);

    expect(mocks.useServerPathBrowse).toHaveBeenLastCalledWith({
      path: '/workspace/playground',
      enabled: true,
    });
    expect((screen.getByRole('button', { name: '后退' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('starts a fresh selection session when the dialog is reopened', async () => {
    const user = userEvent.setup();
    const view = renderPicker();

    await user.click(screen.getByRole('option', { name: /playground/ }));
    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe(
      '/workspace/playground',
    );

    view.rerender(createPickerElement({ open: false }));
    view.rerender(createPickerElement());

    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe('/workspace');
    expect((screen.getByRole('button', { name: '后退' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('opens an editable address and records navigation history', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '编辑地址' }));
    const addressInput = screen.getByLabelText('地址');
    await user.clear(addressInput);
    await user.type(addressInput, '/workspace/playground{Enter}');

    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe(
      '/workspace/playground',
    );
    expect((screen.getByRole('button', { name: '后退' }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    await user.click(screen.getByRole('button', { name: '后退' }));
    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe('/workspace');
    expect((screen.getByRole('button', { name: '前进' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('supports arrow selection and Enter navigation from the directory list', async () => {
    const user = userEvent.setup();
    renderPicker();
    const playground = screen.getByRole('option', { name: /playground/ });

    await user.click(playground);
    await user.keyboard('{ArrowDown}');

    expect((screen.getByLabelText('目录') as HTMLInputElement).value).toBe(
      '/workspace/nextbot',
    );
    await user.keyboard('{Enter}');
    expect(mocks.useServerPathBrowse).toHaveBeenLastCalledWith({
      path: '/workspace/nextbot',
      enabled: true,
    });
  });

  it('shows the empty-search hint and keeps the list region scroll-contained', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getAllByPlaceholderText('搜索当前目录')[0], 'missing');

    expect(screen.getByText('当前目录下没有匹配结果。')).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('overflow-hidden');
    expect(dialog.className).toContain('sm:h-[44rem]');
    const scrollArea = screen
      .getByText('当前目录下没有匹配结果。')
      .closest('.overflow-auto');
    expect(scrollArea?.className).toContain('flex-1');
    expect(scrollArea?.className).toContain('min-h-0');
  });
});
