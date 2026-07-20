import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatProjectAddDialog } from '@/features/chat/features/project/components/chat-project-add-dialog';
import { setLanguage } from '@/shared/lib/i18n';

const pathPickerSpy = vi.fn();

vi.mock('@/shared/components/path-picker/server-path-picker-dialog', () => ({
  ServerPathPickerDialog: (props: unknown) => pathPickerSpy(props),
}));

function renderDialog(overrides: Partial<ComponentProps<typeof ChatProjectAddDialog>> = {}) {
  const onCreate = vi.fn(async () => undefined);
  const onAddExisting = vi.fn(async () => undefined);
  render(
    <ChatProjectAddDialog
      open
      defaultWorkspacePath="/workspace"
      templates={[
        { id: 'empty', name: 'Empty', description: 'Empty project' },
        {
          id: 'knowledge-base',
          name: 'Knowledge base',
          description: 'Knowledge base project',
        },
      ]}
      isCreating={false}
      isAddingExisting={false}
      onOpenChange={() => {}}
      onCreate={onCreate}
      onAddExisting={onAddExisting}
      {...overrides}
    />,
  );
  return { onCreate, onAddExisting };
}

describe('ChatProjectAddDialog', () => {
  beforeEach(() => {
    setLanguage('zh');
    pathPickerSpy.mockClear();
  });

  it('creates a new project with an optional project directory and template', async () => {
    const user = userEvent.setup();
    const { onCreate, onAddExisting } = renderDialog();

    expect(screen.getByRole('heading', { name: '添加项目' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '新建项目' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await user.type(screen.getByLabelText('项目名称'), '个人知识库');
    fireEvent.change(document.querySelector('select')!, {
      target: { value: 'knowledge-base' },
    });
    await user.click(screen.getByRole('button', { name: '浏览' }));
    expect(pathPickerSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        allowCreateDirectory: true,
        currentPath: '',
        defaultWorkspacePath: '/workspace',
        title: '选择或新建项目目录',
      }),
    );
    const pickerProps = pathPickerSpy.mock.lastCall?.[0] as {
      onConfirm: (path: string) => void;
    };
    act(() => pickerProps.onConfirm('/srv/knowledge'));
    expect((screen.getByLabelText('项目目录（可选）') as HTMLInputElement).value).toBe(
      '/srv/knowledge',
    );
    await user.click(screen.getByRole('button', { name: '创建项目' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: '个人知识库',
        rootPath: '/srv/knowledge',
        template: 'knowledge-base',
      });
    });
    expect(onAddExisting).not.toHaveBeenCalled();
  });

  it('adds an existing directory without exposing project initialization', async () => {
    const user = userEvent.setup();
    const { onCreate, onAddExisting } = renderDialog();

    await user.click(screen.getByRole('button', { name: '添加已有目录' }));
    expect(screen.queryByLabelText('项目名称')).toBeNull();
    expect(screen.queryByLabelText('项目模板')).toBeNull();
    expect(screen.getByText(
      '选择服务端机器上的已有目录。项目名称取目录名，不会修改或初始化目录内容。',
    )).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '浏览' }));
    expect(pathPickerSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        allowCreateDirectory: false,
        title: '选择已有项目目录',
      }),
    );
    const pickerProps = pathPickerSpy.mock.lastCall?.[0] as {
      onConfirm: (path: string) => void;
    };
    act(() => pickerProps.onConfirm('/srv/existing-project'));
    await user.click(screen.getByRole('button', { name: '添加到项目列表' }));

    await waitFor(() => {
      expect(onAddExisting).toHaveBeenCalledWith({ rootPath: '/srv/existing-project' });
    });
    expect(onCreate).not.toHaveBeenCalled();
  });
});
