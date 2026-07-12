import { useState } from 'react';
import { ChevronDown, FolderOpen } from 'lucide-react';
import type { ChatWelcomeProjectOption } from '@/features/chat/features/welcome/utils/chat-welcome-project-options.utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  createPopoverAvailableHeightLimit,
} from '@/shared/components/ui/popover';
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

const PROJECT_PICKER_MAX_HEIGHT = createPopoverAvailableHeightLimit('20rem');

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
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
          title={projectRoot ?? undefined}
          aria-label={t('chatWelcomeProjectPickerLabel')}
          disabled={!selectable || isSaving}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">{projectLabel}</span>
          {isDefaultProject ? (
            <span className="shrink-0 text-xs font-normal text-muted-foreground/70">
              {t('chatWelcomeProjectDefaultBadge')}
            </span>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
        style={{ maxHeight: PROJECT_PICKER_MAX_HEIGHT }}
      >
        <div className="shrink-0 px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t('chatWelcomeProjectRecentTitle')}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
          {projectOptions.length > 0 ? (
            projectOptions.map((option) => (
              <button
                key={option.projectRoot}
                type="button"
                className="flex w-full min-w-0 items-start gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent"
                title={option.projectRoot}
                onClick={() => {
                  void selectProjectRoot(option.projectRoot);
                }}
              >
                <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {option.projectName}
                    </span>
                  </span>
                  <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                    {option.projectRoot}
                  </span>
                </span>
                {option.sessionCount > 0 ? (
                  <span className="mt-0.5 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {option.sessionCount}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-2 py-5 text-center text-xs text-muted-foreground">
              {t('chatWelcomeProjectNoRecent')}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-border p-1.5">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold text-foreground transition-colors hover:bg-accent"
            onClick={() => {
              setIsOpen(false);
              onOpenProjectDialog();
            }}
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>{t('chatWelcomeProjectOpenFolder')}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
