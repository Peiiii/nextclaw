import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatProjectCreateDialog } from '@/features/chat/features/project/components/chat-project-create-dialog';
import { setLanguage } from '@/shared/lib/i18n';

const pathPickerSpy = vi.fn();

vi.mock('@/shared/components/path-picker/server-path-picker-dialog', () => ({
  ServerPathPickerDialog: (props: unknown) => pathPickerSpy(props),
}));

describe('ChatProjectCreateDialog', () => {
  it('selects the optional target directory with the shared path picker', async () => {
    setLanguage('zh');
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);

    render(
      <ChatProjectCreateDialog
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
        onOpenChange={() => {}}
        onCreate={onCreate}
      />,
    );

    await user.type(screen.getByLabelText('项目名称'), '个人知识库');
    fireEvent.change(document.querySelector('select')!, {
      target: { value: 'knowledge-base' },
    });
    await user.click(screen.getByRole('button', { name: '浏览' }));
    expect(pathPickerSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        currentPath: '',
        defaultWorkspacePath: '/workspace',
        title: '选择项目目标目录',
      }),
    );
    const pickerProps = pathPickerSpy.mock.lastCall?.[0] as {
      onConfirm: (path: string) => void;
    };
    act(() => pickerProps.onConfirm('/srv/knowledge'));
    expect((screen.getByLabelText('目标目录（可选）') as HTMLInputElement).value).toBe(
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
  });
});
