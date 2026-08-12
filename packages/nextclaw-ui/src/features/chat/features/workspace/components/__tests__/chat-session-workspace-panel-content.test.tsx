import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChatSessionWorkspacePanelContent } from '@/features/chat/features/workspace/components/chat-session-workspace-panel-content';
import type { ResolvedChildSessionTab } from '@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { CHAT_WORKSPACE_EXPLORER_DEFAULT_WIDTH } from '@/features/chat/features/workspace/utils/chat-workspace-panel-layout.utils';
import { useWorkspaceProjectTreeStore } from '@/features/chat/features/workspace/stores/workspace-project-tree.store';

const mocks = vi.hoisted(() => ({
  browseEntries: [
    {
      name: 'src',
      path: '/Users/peiwang/Projects/nextbot/src',
      kind: 'directory' as const,
      hidden: false,
    },
    {
      name: 'package.json',
      path: '/private/resolved-worktree/package.json',
      kind: 'file' as const,
      hidden: false,
    },
  ],
  materializeSideChatDraft: vi.fn(),
  createServerPathDirectory: vi.fn(),
  createServerPathFile: vi.fn(),
  deleteServerPathEntry: vi.fn(),
  renameServerPathEntry: vi.fn(),
  uploadServerPathFiles: vi.fn(),
  watchDirectories: vi.fn(),
  refetchBrowse: vi.fn(),
  refetchQueries: vi.fn(),
  requestDirectoryReference: vi.fn(),
  requestFileReference: vi.fn(),
  openChildSessions: vi.fn(),
  openFilePreview: vi.fn(),
  openProjectFiles: vi.fn(),
  openSessionCronPanel: vi.fn(),
  removeWorkspacePath: vi.fn(),
  renameWorkspacePath: vi.fn(),
  selectChildSessionDetail: vi.fn(),
  setWorkspaceExplorerWidth: vi.fn(),
  scrollIntoView: vi.fn(),
}));

vi.mock('@/shared/hooks/use-server-path-watch', () => ({
  useServerPathWatch: mocks.watchDirectories,
}));

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal()),
  useQueryClient: () => ({ refetchQueries: mocks.refetchQueries }),
}));

function firePointerEvent(
  target: Window | Document | Node | Element,
  type: string,
  point: { clientX: number; pointerId?: number },
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: point.clientX },
    pointerId: { value: point.pointerId ?? 1 },
  });
  fireEvent(target, event);
}

vi.mock('@/features/chat/components/providers/chat-presenter.provider', () => ({
  usePresenter: () => ({
    chatThreadManager: {
      ...mocks,
    },
    chatComposerIntentManager: {
      requestDirectoryReference: mocks.requestDirectoryReference,
      requestFileReference: mocks.requestFileReference,
    },
  }),
}));

vi.mock('@/shared/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  createServerPathDirectory: mocks.createServerPathDirectory,
  createServerPathFile: mocks.createServerPathFile,
  deleteServerPathEntry: mocks.deleteServerPathEntry,
  renameServerPathEntry: mocks.renameServerPathEntry,
  uploadServerPathFiles: mocks.uploadServerPathFiles,
}));

vi.mock('@/features/chat/features/conversation/components/session-conversation-area', () => ({
  SessionConversationArea: () => <div data-testid="session-conversation-area" />,
}));

vi.mock('@/shared/hooks/use-server-path-browse', () => ({
  useServerPathBrowse: ({ path }: { path?: string | null }) => ({
    isLoading: false,
    error: null,
    data: path?.endsWith('package.json')
      ? undefined
      : {
          currentPath: '/Users/peiwang/Projects/nextbot',
          parentPath: '/Users/peiwang/Projects',
          homePath: '/Users/peiwang',
          breadcrumbs: [],
          entries: mocks.browseEntries,
        },
    refetch: mocks.refetchBrowse,
  }),
}));

vi.mock('@/shared/hooks/use-server-path-read', () => ({
  useServerPathRead: ({ path }: { path: string }) => ({
    isLoading: false,
    error: null,
    data: {
      kind: 'text',
      languageHint: 'json',
      resolvedPath: path,
      startLine: 1,
      text: '{}',
      truncated: false,
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.getBoundingClientRect = () => ({
    bottom: 600,
    height: 600,
    left: 0,
    right: 800,
    top: 0,
    width: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  mocks.browseEntries.splice(
    0,
    mocks.browseEntries.length,
    {
      name: 'src',
      path: '/Users/peiwang/Projects/nextbot/src',
      kind: 'directory',
      hidden: false,
    },
    {
      name: 'package.json',
      path: '/private/resolved-worktree/package.json',
      kind: 'file',
      hidden: false,
    },
  );
  HTMLElement.prototype.scrollIntoView = mocks.scrollIntoView;
  mocks.createServerPathDirectory.mockResolvedValue({
    path: '/Users/peiwang/Projects/nextbot/new-folder',
  });
  mocks.createServerPathFile.mockResolvedValue({
    path: '/Users/peiwang/Projects/nextbot/new-file.md',
  });
  mocks.renameServerPathEntry.mockResolvedValue({
    path: '/Users/peiwang/Projects/nextbot/renamed.md',
    oldPath: '/Users/peiwang/Projects/nextbot/package.json',
    name: 'renamed.md',
    kind: 'file',
  });
  mocks.deleteServerPathEntry.mockResolvedValue({
    path: '/private/resolved-worktree/package.json',
    kind: 'file',
  });
  mocks.uploadServerPathFiles.mockResolvedValue({
    files: [
      {
        name: 'brief.md',
        path: '/Users/peiwang/Projects/nextbot/brief.md',
        sizeBytes: 5,
      },
    ],
    overwritten: false,
  });
  mocks.refetchBrowse.mockResolvedValue(undefined);
  mocks.refetchQueries.mockResolvedValue(undefined);
  useWorkspaceProjectTreeStore.setState({ trees: {} });
  useChatThreadStore.getState().setSnapshot({
    workspaceExplorerOpen: false,
    workspaceExplorerWidth: CHAT_WORKSPACE_EXPLORER_DEFAULT_WIDTH,
  });
});

function createChildTab(): ResolvedChildSessionTab {
  return {
    sessionKey: 'child-1',
    parentSessionKey: 'parent-1',
    title: 'Child title',
    agentId: 'agent-1',
    updatedAt: null,
    lastMessageAt: null,
    readAt: null,
    runStatus: undefined,
    sessionTypeLabel: '原生',
    preferredModel: 'minimax/MiniMax-M3',
    projectName: 'nextbot',
    projectRoot: '/Users/peiwang/Projects/nextbot',
  };
}

it('shows compact child session metadata without repeating the tab title', () => {
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{
        kind: 'child-session',
        tab: createChildTab(),
      }}
      childSessionTabs={[createChildTab()]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot={null}
      sessionWorkingDir={null}
    />,
  );

  expect(screen.queryByText('Child title')).toBeNull();
  expect(screen.getByText('原生')).toBeTruthy();
  expect(screen.getByText('minimax/MiniMax-M3')).toBeTruthy();
  expect(screen.getByText('nextbot')).toBeTruthy();
  expect(screen.getByTitle('/Users/peiwang/Projects/nextbot')).toBeTruthy();
});

it('shows all session workspace entries in the overview', async () => {
  const user = userEvent.setup();
  const childTab = createChildTab();

  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'overview' }}
      childSessionTabs={[childTab]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/tmp/project"
      sessionWorkingDir="/tmp/project"
    />,
  );

  expect(screen.getByText('Overview')).toBeTruthy();
  const childSessionsButton = screen.getByRole('button', {
    name: /Child sessions/,
  });
  const cronJobsButton = screen.getByRole('button', {
    name: /Scheduled tasks/,
  });

  expect((childSessionsButton as HTMLButtonElement).disabled).toBe(false);
  expect((cronJobsButton as HTMLButtonElement).disabled).toBe(false);

  await user.click(childSessionsButton);
  await user.click(cronJobsButton);
  await user.click(screen.getByRole('button', { name: /Project files/ }));

  expect(mocks.openChildSessions).toHaveBeenCalledWith('parent-1');
  expect(mocks.openSessionCronPanel).toHaveBeenCalledWith('parent-1');
  expect(mocks.openProjectFiles).toHaveBeenCalledWith('parent-1');
});

it('shows an empty child sessions page instead of disabling the entry', () => {
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'child-sessions' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot={null}
      sessionWorkingDir={null}
    />,
  );

  expect(screen.getByText('No child sessions yet.')).toBeTruthy();
});

it('shows the selected session project as a hierarchical file tree', () => {
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  expect(screen.getByRole('tree', { name: 'Project files' })).toBeTruthy();
  expect(screen.getByText('nextbot')).toBeTruthy();
  expect(screen.getByRole('treeitem', { name: 'Open directory: src' })).toBeTruthy();
  expect(document.querySelector('[data-file-type-icon="npm"]')).toBeTruthy();
});

it('adds a project file to the targeted chat from its context menu', async () => {
  const user = userEvent.setup();
  mocks.requestFileReference.mockReset();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey={null}
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  fireEvent.contextMenu(screen.getByRole('button', { name: 'package.json' }));

  expect(screen.getByRole('menuitem', { name: 'Copy path' })).toBeTruthy();
  expect(screen.getByRole('menuitem', { name: 'Copy relative path' })).toBeTruthy();
  await user.click(screen.getByRole('menuitem', { name: 'Add to chat' }));

  expect(mocks.requestFileReference).toHaveBeenCalledWith({
    targetSessionKey: null,
    tokenKey: 'package.json',
    label: 'package.json',
  });
});

it('adds a project folder to chat with the directory reference protocol', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  fireEvent.contextMenu(screen.getByRole('button', { name: 'src' }));
  await user.click(screen.getByRole('menuitem', { name: 'Add to chat' }));

  expect(mocks.requestDirectoryReference).toHaveBeenCalledWith({
    targetSessionKey: 'parent-1',
    tokenKey: 'src',
    label: 'src',
  });
});

it('keeps the five Explorer actions distinct and exposes upload from the root menu', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  for (const name of ['New file', 'New folder', 'Refresh project files', 'Collapse all', 'More project file actions']) {
    expect(screen.getByRole('button', { name })).toBeTruthy();
  }
  expect(screen.getByRole('button', { name: 'More actions for package.json' })).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'More project file actions' }));
  expect(screen.getByRole('menuitem', { name: 'Upload files here' })).toBeTruthy();
  await user.keyboard('{Escape}');

  fireEvent.contextMenu(screen.getByRole('button', { name: 'package.json' }));
  const fileMenu = screen.getByRole('menu', {
    name: 'Project file actions',
  });
  for (const name of ['Open', 'Add to chat', 'Download', 'Copy path', 'Copy relative path', 'Rename', 'Delete']) {
    expect(within(fileMenu).getByRole('menuitem', { name })).toBeTruthy();
  }
  expect(within(fileMenu).getAllByRole('group')).toHaveLength(5);
  const download = screen.getByRole('menuitem', { name: 'Download' });
  expect(download.tagName).toBe('A');
  expect(download.getAttribute('download')).toBe('package.json');
  expect(download.getAttribute('href')).toContain(
    '/api/server-paths/content?path=%2Fprivate%2Fresolved-worktree%2Fpackage.json',
  );
});

it('creates a project file inline from the distinct toolbar action', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  await user.click(screen.getByRole('button', { name: 'New file' }));
  const input = screen.getByRole('textbox', { name: 'File name' });
  await user.type(input, 'notes.md');
  await user.click(screen.getByRole('button', { name: 'Create' }));

  await waitFor(() => {
    expect(mocks.createServerPathFile).toHaveBeenCalledWith({
      basePath: '/Users/peiwang/Projects/nextbot',
      parentPath: '/Users/peiwang/Projects/nextbot',
      name: 'notes.md',
    });
  });
});

it('renames a project file inline and synchronizes open workspace tabs', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  fireEvent.contextMenu(screen.getByRole('button', { name: 'package.json' }));
  await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
  const input = screen.getByRole('textbox', { name: 'New name' });
  await user.clear(input);
  await user.type(input, 'renamed.md');
  await user.click(screen.getByRole('button', { name: 'Rename' }));

  await waitFor(() => {
    expect(mocks.renameServerPathEntry).toHaveBeenCalledWith({
      basePath: '/Users/peiwang/Projects/nextbot',
      path: '/private/resolved-worktree/package.json',
      name: 'renamed.md',
    });
    expect(mocks.renameWorkspacePath).toHaveBeenCalledWith({
      previousPath: '/Users/peiwang/Projects/nextbot/package.json',
      path: '/Users/peiwang/Projects/nextbot/renamed.md',
      label: 'renamed.md',
    });
  });
});

it('creates a project folder from the root toolbar and refreshes the tree', async () => {
  const user = userEvent.setup();
  mocks.createServerPathDirectory.mockImplementationOnce(async () => {
    const path = '/Users/peiwang/Projects/nextbot/research';
    mocks.browseEntries.push({
      name: 'research',
      path,
      kind: 'directory',
      hidden: false,
    });
    return { path };
  });
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  await user.click(screen.getByRole('button', { name: 'New folder' }));
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Folder name' }));
  expect(mocks.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  await user.type(screen.getByRole('textbox', { name: 'Folder name' }), 'research');
  await user.click(screen.getByRole('button', { name: 'Create' }));

  await waitFor(() => {
    expect(mocks.createServerPathDirectory).toHaveBeenCalledWith({
      basePath: '/Users/peiwang/Projects/nextbot',
      parentPath: '/Users/peiwang/Projects/nextbot',
      name: 'research',
    });
    expect(mocks.refetchQueries).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'research' }));
    expect(mocks.scrollIntoView).toHaveBeenCalledTimes(2);
  });
});

it('uses the selected directory as the toolbar target and creates inline', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  await user.click(screen.getByRole('button', { name: 'src' }));
  await user.click(screen.getByRole('button', { name: 'New folder' }));

  const input = screen.getByRole('textbox', { name: 'Folder name' });
  expect(input.closest('[role="group"]')?.parentElement?.getAttribute('aria-label')).toBe('Open directory: src');
  await user.type(input, 'nested');
  await user.click(screen.getByRole('button', { name: 'Create' }));

  await waitFor(() => {
    expect(mocks.createServerPathDirectory).toHaveBeenCalledWith({
      basePath: '/Users/peiwang/Projects/nextbot',
      parentPath: '/Users/peiwang/Projects/nextbot/src',
      name: 'nested',
    });
  });
});

it('opens root actions from blank tree space and reveals an inline draft', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  fireEvent.contextMenu(screen.getByRole('tree', { name: 'Project files' }));
  expect(screen.getByRole('menu', { name: 'Project root actions' })).toBeTruthy();
  expect(screen.getByRole('menuitem', { name: 'Upload files here' })).toBeTruthy();
  await user.click(screen.getByRole('menuitem', { name: 'New folder' }));

  const input = screen.getByRole('textbox', { name: 'Folder name' });
  expect(document.activeElement).toBe(input);
  expect(mocks.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
});

it('uploads multiple project files from the root actions menu', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  await user.click(screen.getByRole('button', { name: 'More project file actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Upload files here' }));
  const file = new File(['brief'], 'brief.md', { type: 'text/markdown' });
  fireEvent.change(screen.getByLabelText('Upload files'), {
    target: { files: [file] },
  });

  await waitFor(() => {
    expect(mocks.uploadServerPathFiles).toHaveBeenCalledWith({
      basePath: '/Users/peiwang/Projects/nextbot',
      targetPath: '/Users/peiwang/Projects/nextbot',
      files: [file],
      overwrite: undefined,
    });
    expect(mocks.refetchQueries).toHaveBeenCalled();
  });
});

it('requires destructive confirmation before deleting a project file', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  fireEvent.contextMenu(screen.getByRole('button', { name: 'package.json' }));
  await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(mocks.deleteServerPathEntry).not.toHaveBeenCalled();
  expect(screen.getByText('Delete package.json?')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => {
    expect(mocks.deleteServerPathEntry).toHaveBeenCalledWith({
      basePath: '/Users/peiwang/Projects/nextbot',
      path: '/private/resolved-worktree/package.json',
    });
    expect(mocks.removeWorkspacePath).toHaveBeenCalledWith('/private/resolved-worktree/package.json');
    expect(mocks.refetchQueries).toHaveBeenCalled();
  });
});

it('refreshes the root and every active expanded directory query', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  await user.click(screen.getByRole('button', { name: 'src' }));
  await user.click(screen.getByRole('button', { name: 'Refresh project files' }));

  expect(mocks.refetchQueries).toHaveBeenCalledTimes(1);
  const request = mocks.refetchQueries.mock.calls[0]?.[0] as {
    predicate: (query: { queryKey: readonly unknown[] }) => boolean;
    type: string;
  };
  expect(request.type).toBe('active');
  expect(request.predicate({ queryKey: ['server-path-browse', '/Users/peiwang/Projects/nextbot', '', true] })).toBe(true);
  expect(request.predicate({ queryKey: ['server-path-browse', '/Users/peiwang/Projects/nextbot/src', '', true] })).toBe(true);
  expect(request.predicate({ queryKey: ['server-path-browse', '/tmp/another-project', '', true] })).toBe(false);
});

it('collapses all persisted directories in one action', async () => {
  const user = userEvent.setup();
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: 'project-files' }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  const sourceDirectory = screen.getByRole('treeitem', { name: 'Open directory: src' });
  await user.click(screen.getByRole('button', { name: 'src' }));
  expect(sourceDirectory.getAttribute('aria-expanded')).toBe('true');
  await user.click(screen.getByRole('button', { name: 'Collapse all' }));
  expect(sourceDirectory.getAttribute('aria-expanded')).toBe('false');
});

it('restores expansion and scroll from project view state after remounting', async () => {
  const user = userEvent.setup();
  const props = {
    activeSelection: { kind: 'project-files' as const },
    childSessionTabs: [],
    filePreviewRefreshVersion: 0,
    sessionKey: 'parent-1',
    sessionCronJobs: [],
    sessionProjectRoot: '/Users/peiwang/Projects/nextbot',
    sessionWorkingDir: '/Users/peiwang/Projects/nextbot',
  };
  const first = render(<ChatSessionWorkspacePanelContent {...props} />);
  await user.click(screen.getByRole('button', { name: 'src' }));
  const firstTree = screen.getByRole('tree', { name: 'Project files' });
  firstTree.scrollTop = 144;
  fireEvent.scroll(firstTree);
  first.unmount();

  render(<ChatSessionWorkspacePanelContent {...props} />);
  expect(screen.getAllByRole('treeitem', { name: 'Open directory: src' })[0]?.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('tree', { name: 'Project files' }).scrollTop).toBe(144);
});

it('selects and reveals the active file when it is opened outside the Explorer', async () => {
  const user = userEvent.setup();
  const projectFilesProps = {
    activeSelection: { kind: 'project-files' as const },
    childSessionTabs: [],
    filePreviewRefreshVersion: 0,
    sessionKey: 'parent-1',
    sessionCronJobs: [],
    sessionProjectRoot: '/Users/peiwang/Projects/nextbot',
    sessionWorkingDir: '/Users/peiwang/Projects/nextbot',
  };
  const { rerender } = render(<ChatSessionWorkspacePanelContent {...projectFilesProps} />);
  const sourceDirectory = screen.getByRole('treeitem', { name: 'Open directory: src' });
  const packageEntry = screen.getByRole('treeitem', { name: 'Open file: package.json' });
  await user.click(screen.getByRole('button', { name: 'src' }));
  expect(sourceDirectory.getAttribute('aria-selected')).toBe('true');

  rerender(
    <ChatSessionWorkspacePanelContent
      {...projectFilesProps}
      activeSelection={{
        kind: 'file',
        file: {
          key: 'parent-1::preview::package.json',
          parentSessionKey: 'parent-1',
          path: 'package.json',
          label: 'package.json',
          viewMode: 'preview',
          previewViewer: 'source',
        },
      }}
    />,
  );

  await waitFor(() => {
    expect(packageEntry.getAttribute('aria-selected')).toBe('true');
    expect(sourceDirectory.getAttribute('aria-selected')).toBe('false');
  });
  expect(mocks.scrollIntoView).toHaveBeenCalled();
  expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'package.json' }));
});

it('expands active-file ancestors like an auto-revealing Explorer', async () => {
  useChatThreadStore.getState().setSnapshot({ workspaceExplorerOpen: true });
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{
        kind: 'file',
        file: {
          key: 'parent-1::preview::src/index.ts',
          parentSessionKey: 'parent-1',
          path: '/Users/peiwang/Projects/nextbot/src/index.ts',
          label: 'index.ts',
          viewMode: 'preview',
          previewViewer: 'source',
        },
      }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  const sourceDirectory = within(screen.getByTestId('workspace-shared-explorer')).getAllByRole('treeitem', {
    name: 'Open directory: src',
  })[0];
  await waitFor(() => {
    expect(sourceDirectory.getAttribute('aria-expanded')).toBe('true');
  });
});

it('keeps the file Explorer closed by default and reuses it after an explicit open', () => {
  const projectFilesProps = {
    activeSelection: { kind: 'project-files' as const },
    childSessionTabs: [],
    filePreviewRefreshVersion: 0,
    sessionKey: 'parent-1',
    sessionCronJobs: [],
    sessionProjectRoot: '/Users/peiwang/Projects/nextbot',
    sessionWorkingDir: '/Users/peiwang/Projects/nextbot',
  };
  const { rerender } = render(<ChatSessionWorkspacePanelContent {...projectFilesProps} />);
  const tree = screen.getByRole('tree', { name: 'Project files' });

  rerender(
    <ChatSessionWorkspacePanelContent
      {...projectFilesProps}
      activeSelection={{
        kind: 'file',
        file: {
          key: 'parent-1::preview::package.json',
          parentSessionKey: 'parent-1',
          path: '/Users/peiwang/Projects/nextbot/package.json',
          label: 'package.json',
          viewMode: 'preview',
          previewViewer: 'source',
        },
      }}
    />,
  );

  const explorer = screen.getByTestId('workspace-shared-explorer');
  const breadcrumbs = screen.getByTestId('workspace-file-breadcrumbs');
  const toggle = screen.getByTestId('workspace-explorer-toggle');
  expect(explorer.getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(toggle);
  expect(useChatThreadStore.getState().snapshot.workspaceExplorerOpen).toBe(true);
  expect(screen.getByRole('tree', { name: 'Project files' })).toBe(tree);
  expect(explorer.getAttribute('data-mode')).toBe('side');
  expect(explorer.style.width).toBe('224px');
  expect(breadcrumbs.contains(toggle)).toBe(true);
  expect(toggle.parentElement?.className).not.toContain('border-r');

  const handle = screen.getByRole('separator', {
    name: 'Resize project files',
  });
  firePointerEvent(handle, 'pointerdown', { clientX: 224, pointerId: 1 });
  firePointerEvent(window, 'pointermove', { clientX: 300, pointerId: 1 });
  firePointerEvent(window, 'pointerup', { clientX: 300, pointerId: 1 });
  expect(mocks.setWorkspaceExplorerWidth).toHaveBeenCalledWith(300);
});

it('uses an overlay only below the compact threshold and persists closing it without unmounting', () => {
  HTMLElement.prototype.getBoundingClientRect = () => ({
    bottom: 600,
    height: 600,
    left: 0,
    right: 540,
    top: 0,
    width: 540,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  useChatThreadStore.getState().setSnapshot({ workspaceExplorerOpen: true });
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{
        kind: 'file',
        file: {
          key: 'parent-1::preview::package.json',
          parentSessionKey: 'parent-1',
          path: '/Users/peiwang/Projects/nextbot/package.json',
          label: 'package.json',
          viewMode: 'preview',
          previewViewer: 'source',
        },
      }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  const explorer = screen.getByTestId('workspace-shared-explorer');
  const tree = screen.getByRole('tree', { name: 'Project files' });
  expect(explorer.getAttribute('data-mode')).toBe('overlay');
  expect(screen.queryByTestId('workspace-explorer-resize-handle')).toBeNull();

  fireEvent.click(screen.getByTestId('workspace-explorer-scrim'));
  expect(useChatThreadStore.getState().snapshot.workspaceExplorerOpen).toBe(false);
  expect(explorer.getAttribute('aria-hidden')).toBe('true');
  expect(tree.isConnected).toBe(true);
});
