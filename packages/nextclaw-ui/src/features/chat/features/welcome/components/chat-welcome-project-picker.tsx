import { useState } from 'react';
import { ChevronDown, FolderOpen } from 'lucide-react';
import type { ChatWelcomeProjectOption } from '@/features/chat/features/welcome/utils/chat-welcome-project-options.utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { t } from '@/shared/lib/i18n';
import { getSessionProjectName } from '@/shared/lib/session-project';

type ChatWelcomeProjectPickerProps = {
  defaultProjectRoot?: string | null;
  isSaving: boolean;
  projectOptions: readonly ChatWelcomeProjectOption[];
  projectRoot: string | null;
  selectable: boolean;
  onOpenProjectDialog: () => void;
  onSelectProjectRoot: (projectRoot: string) => Promise<void> | void;
};

const PROJECT_PICKER_MAX_HEIGHT = 'min(20rem, calc(var(--radix-popover-content-available-height) - 0.75rem))';

export function ChatWelcomeProjectPicker({
  defaultProjectRoot,
  isSaving,
  projectOptions,
  projectRoot,
  selectable,
  onOpenProjectDialog,
  onSelectProjectRoot,
}: ChatWelcomeProjectPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const projectLabel =
    getSessionProjectName(projectRoot) ?? t('chatWelcomeProjectPickerPlaceholder');
  const isDefaultProject =
    defaultProjectRoot !== null &&
    defaultProjectRoot !== undefined &&
    projectRoot === defaultProjectRoot;

  const selectProjectRoot = async (nextProjectRoot: string) => {
    setIsOpen(false);
    await onSelectProjectRoot(nextProjectRoot);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          title={projectRoot ?? undefined}
          aria-label={t('chatWelcomeProjectPickerLabel')}
          disabled={!selectable || isSaving}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">{projectLabel}</span>
          {isDefaultProject ? (
            <span className="shrink-0 text-xs font-normal text-gray-400">
              {t('chatWelcomeProjectDefaultBadge')}
            </span>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="flex w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-0 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
        style={{ maxHeight: PROJECT_PICKER_MAX_HEIGHT }}
      >
        <div className="shrink-0 px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
          {t('chatWelcomeProjectRecentTitle')}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
          {projectOptions.length > 0 ? (
            projectOptions.map((option) => (
              <button
                key={option.projectRoot}
                type="button"
                className="flex w-full min-w-0 items-start gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-gray-50"
                title={option.projectRoot}
                onClick={() => {
                  void selectProjectRoot(option.projectRoot);
                }}
              >
                <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-gray-800">
                      {option.projectName}
                    </span>
                    {option.isDefault ? (
                      <span className="shrink-0 text-[10px] font-medium text-gray-400">
                        {t('chatWelcomeProjectDefaultBadge')}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-[11px] leading-4 text-gray-500">
                    {option.projectRoot}
                  </span>
                </span>
                {option.sessionCount > 0 ? (
                  <span className="mt-0.5 shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    {option.sessionCount}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-2 py-5 text-center text-xs text-gray-400">
              {t('chatWelcomeProjectNoRecent')}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-gray-100 p-1.5">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            onClick={() => {
              setIsOpen(false);
              onOpenProjectDialog();
            }}
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-gray-400" />
            <span>{t('chatWelcomeProjectOpenFolder')}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
