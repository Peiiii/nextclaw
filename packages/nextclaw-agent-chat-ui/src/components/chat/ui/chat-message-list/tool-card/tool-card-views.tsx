import { Terminal, FileText, Code2, Search, Globe } from 'lucide-react';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import type {
  ChatFileOperationBlockViewModel,
  ChatFileOpenActionViewModel,
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ToolCardRoot, ToolCardContent } from './tool-card-root';
import { ToolCardHeader, ToolCardHeaderAction } from './tool-card-header';
import { ToolCardFileOperationContent } from './tool-card-file-operation';
import { ChatTerminalSurface } from './terminal/terminal-panes';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';

const TOOL_CARD_AUTO_EXPAND_DELAY_MS = 200;

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStructuredTerminalRecord(record: Record<string, unknown>): boolean {
  return (
    'command' in record ||
    'workingDir' in record ||
    'exitCode' in record ||
    'durationMs' in record ||
    'stdout' in record ||
    'stderr' in record ||
    'aggregated_output' in record ||
    'combinedOutput' in record
  );
}

function extractTerminalOutputFromRecord(record: Record<string, unknown>): string | null {
  const aggregatedOutput =
    readNonEmptyString(record.aggregated_output) ??
    readNonEmptyString(record.combinedOutput) ??
    readNonEmptyString(record.output);
  if (aggregatedOutput) {
    return aggregatedOutput;
  }

  const stdout = readNonEmptyString(record.stdout);
  const stderr = readNonEmptyString(record.stderr);
  if (!stdout && !stderr) {
    return null;
  }
  return [stdout, stderr].filter((value): value is string => Boolean(value)).join('\n');
}

function normalizeTerminalOutput(rawOutput?: string, structuredOutput?: unknown): string {
  if (isRecord(structuredOutput)) {
    const terminalOutput = extractTerminalOutputFromRecord(structuredOutput);
    if (terminalOutput) {
      return terminalOutput;
    }
    if (isStructuredTerminalRecord(structuredOutput)) {
      return '';
    }
  }
  if (!rawOutput) {
    return '';
  }
  const trimmed = rawOutput.trim();
  if (!trimmed.startsWith('{')) {
    return rawOutput;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) {
      return rawOutput;
    }
    const terminalOutput = extractTerminalOutputFromRecord(parsed);
    if (terminalOutput) {
      return terminalOutput;
    }
    if (isStructuredTerminalRecord(parsed)) {
      return '';
    }
    return rawOutput;
  } catch {
    return rawOutput;
  }
}

function shouldAutoExpandRunningFileOperation(toolName: string): boolean {
  return toolName === 'write_file' || toolName === 'edit_file';
}

function countFileOperationChanges(blocks: ChatFileOperationBlockViewModel[]): {
  additions: number;
  deletions: number;
} {
  return blocks.reduce(
    (totals, block) => ({
      additions:
        totals.additions + block.lines.filter((line) => line.kind === 'add').length,
      deletions:
        totals.deletions + block.lines.filter((line) => line.kind === 'remove').length,
    }),
    { additions: 0, deletions: 0 },
  );
}

function useToolCardExpandedState({
  canExpand,
  isRunning,
  autoExpandWhileRunning = true,
  expandOnError = false,
  statusTone,
}: {
  canExpand: boolean;
  isRunning: boolean;
  autoExpandWhileRunning?: boolean;
  expandOnError?: boolean;
  statusTone: ChatToolPartViewModel['statusTone'];
}) {
  const [expanded, setExpanded] = useState(false);
  const [hasUserToggled, setHasUserToggled] = useState(false);
  const expandTimerRef = useRef<number | null>(null);
  const prevRunningRef = useRef(isRunning);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    return () => {
      if (expandTimerRef.current !== null) {
        window.clearTimeout(expandTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (expandOnError && statusTone === 'error' && canExpand && !hasUserToggled) {
      if (expandTimerRef.current !== null) {
        window.clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
      setExpanded(true);
      prevRunningRef.current = isRunning;
      isFirstRenderRef.current = false;
      return;
    }

    if (
      autoExpandWhileRunning &&
      isRunning &&
      canExpand &&
      !hasUserToggled &&
      !expanded &&
      (isFirstRenderRef.current || !prevRunningRef.current)
    ) {
      expandTimerRef.current = window.setTimeout(() => {
        setExpanded(true);
        expandTimerRef.current = null;
      }, TOOL_CARD_AUTO_EXPAND_DELAY_MS);
    }

    if (!isRunning) {
      if (expandTimerRef.current !== null) {
        window.clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
      if (prevRunningRef.current && !hasUserToggled) {
        setExpanded(false);
      }
    }

    prevRunningRef.current = isRunning;
    isFirstRenderRef.current = false;
  }, [autoExpandWhileRunning, canExpand, expandOnError, expanded, hasUserToggled, isRunning, statusTone]);

  const onToggle = () => {
    if (!canExpand) {
      return;
    }
    if (expandTimerRef.current !== null) {
      window.clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    setExpanded((current) => !current);
    setHasUserToggled(true);
  };

  return { expanded, onToggle };
}

function GenericToolSection({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'input' | 'output' | 'error';
  children: ReactNode;
}) {
  const tones = {
    input: {
      shell: 'border-border bg-card',
      header: 'border-border bg-muted/55 text-muted-foreground',
      dot: 'bg-muted-foreground/60',
      body: 'text-foreground',
    },
    output: {
      shell: 'border-border bg-card',
      header: 'border-border bg-muted/55 text-muted-foreground',
      dot: 'bg-primary/70',
      body: 'text-foreground',
    },
    error: {
      shell: 'border-rose-200/80 bg-rose-50/85',
      header: 'border-rose-200/80 bg-rose-100/80 text-rose-700',
      dot: 'bg-rose-500/80',
      body: 'text-rose-950/85',
    },
  } as const;
  const style = tones[tone];

  return (
    <section className="overflow-hidden rounded-md border border-border/70 bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground">
        <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
        <span className="normal-case tracking-normal">{label}</span>
      </div>
      <div className="w-full overflow-hidden">
        <pre
          className={cn(
            'w-full max-w-full min-w-0 max-h-64 overflow-x-auto overflow-y-auto px-2.5 py-2 font-mono text-[12px] leading-relaxed whitespace-pre custom-scrollbar',
            style.body,
          )}
        >
          {children}
        </pre>
      </div>
    </section>
  );
}

function extractTerminalMeta(structuredOutput?: unknown): {
  exitCode?: number | null;
  workingDir?: string | null;
} {
  if (!isRecord(structuredOutput)) {
    return {};
  }
  const exitCode =
    typeof structuredOutput.exitCode === 'number'
      ? structuredOutput.exitCode
      : typeof structuredOutput.exit_code === 'number'
        ? structuredOutput.exit_code
        : null;
  const workingDir =
    readNonEmptyString(structuredOutput.workingDir) ??
    readNonEmptyString(structuredOutput.cwd) ??
    readNonEmptyString(structuredOutput.working_directory);
  return { exitCode, workingDir };
}

export function TerminalExecutionView({ card, toolLabel }: { card: ChatToolPartViewModel; toolLabel?: string }) {
  const output = normalizeTerminalOutput(card.output, card.outputData);
  const isRunning = card.statusTone === 'running';
  const commandPart = card.summary?.replace(/^(command|path|args|query|input):\s*/i, '');
  const hasOutput = output.trim().length > 0;
  const canExpand = isRunning || hasOutput || Boolean(commandPart?.trim());
  const meta = extractTerminalMeta(card.outputData);
  const { expanded, onToggle } = useToolCardExpandedState({
    canExpand,
    isRunning,
    autoExpandWhileRunning: false,
    expandOnError: canExpand,
    statusTone: card.statusTone,
  });

  return (
    <ToolCardRoot>
      <ToolCardHeader
        card={card}
        toolLabel={toolLabel}
        icon={Terminal}
        expanded={expanded}
        canExpand={canExpand}
        onToggle={onToggle}
      />
      {expanded && (
        <ToolCardContent className="bg-transparent py-0">
          <ChatTerminalSurface
            command={commandPart}
            output={output}
            emptyLabel={card.emptyLabel}
            isRunning={isRunning}
            hasOutput={hasOutput}
            isError={card.statusTone === 'error'}
            exitCode={meta.exitCode}
            workingDir={meta.workingDir}
          />
        </ToolCardContent>
      )}
    </ToolCardRoot>
  );
}

export function FileOperationView({
  card,
  toolLabel,
  onFileOpen,
}: {
  card: ChatToolPartViewModel;
  toolLabel?: string;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
}) {
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  const hasStructuredPreview = Boolean(card.fileOperation?.blocks.length);
  const hasContent = hasStructuredPreview || Boolean(output);
  const previewBlocks = card.fileOperation?.blocks ?? [];
  const previewLineCount = previewBlocks.reduce((count, block) => count + block.lines.length, 0);
  const previewCharCount = previewBlocks.reduce((count, block) => {
    if (block.rawText) {
      return count + block.rawText.length;
    }
    return count + block.lines.reduce((lineCount, line) => lineCount + line.text.length + 1, 0);
  }, 0);
  const shouldAutoExpandWhileRunning =
    shouldAutoExpandRunningFileOperation(card.toolName) &&
    !(
      isRunning &&
      card.toolName === 'write_file' &&
      (previewLineCount > 24 || previewCharCount > 1_200)
    );
  const { expanded, onToggle } = useToolCardExpandedState({
    canExpand: hasContent || isRunning,
    isRunning,
    autoExpandWhileRunning: shouldAutoExpandWhileRunning,
    expandOnError: hasContent,
    statusTone: card.statusTone,
  });

  const isEdit =
    card.toolName === 'edit_file' ||
    card.toolName === 'write_file' ||
    card.toolName === 'apply_patch' ||
    card.toolName === 'file_change';
  const changeSummary = isEdit
    ? countFileOperationChanges(previewBlocks)
    : undefined;

  return (
    <ToolCardRoot>
      <ToolCardHeader
        card={card}
        toolLabel={toolLabel}
        changeSummary={changeSummary}
        icon={isEdit ? Code2 : FileText}
        expanded={expanded}
        canExpand={hasContent || isRunning}
        // Keep overview summary for collapsed scanning.
        hideSummary={false}
        onToggle={onToggle}
      />
      {expanded && hasContent ? (
        <ToolCardContent className="bg-transparent py-0">
          <ToolCardFileOperationContent
            card={card}
            onFileOpen={onFileOpen}
            // Always show the path header in the content panel so users can
            // open the file and still see +N/-N captions (matches prior UX).
            showPathRow
          />
        </ToolCardContent>
      ) : null}
    </ToolCardRoot>
  );
}

export function SearchSnippetView({ card, toolLabel }: { card: ChatToolPartViewModel; toolLabel?: string }) {
  const isRunning = card.statusTone === 'running';
  const output = card.output?.trim() ?? '';
  const { expanded, onToggle } = useToolCardExpandedState({
    canExpand: !!output || isRunning,
    isRunning,
    autoExpandWhileRunning: false,
    statusTone: card.statusTone,
  });

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        toolLabel={toolLabel}
        icon={Search} 
        expanded={expanded} 
        canExpand={!!output || isRunning} 
        onToggle={onToggle} 
      />
      {expanded && output && (
        <ToolCardContent className="py-0">
           <pre className="font-mono text-[12px] text-muted-foreground whitespace-pre-wrap break-all w-full max-w-full max-h-64 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar leading-relaxed">
             {output}
           </pre>
        </ToolCardContent>
      )}
    </ToolCardRoot>
  );
}

export function GenericToolCard({
  card,
  onToolAction,
  renderToolAgent,
}: {
  card: ChatToolPartViewModel;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
}) {
  const input = card.input?.trim() ?? '';
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  const hasInputSection = input.length > 0;
  const hasOutputSection = output.length > 0;
  const hasContent = hasInputSection || hasOutputSection;
  const inputLabel = card.inputLabel?.trim() || 'Input';
  const outputLabel = card.outputLabel?.trim() || 'Output';
  const { expanded, onToggle } = useToolCardExpandedState({
    canExpand: hasContent || isRunning,
    isRunning,
    autoExpandWhileRunning: false,
    statusTone: card.statusTone,
  });

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        icon={Globe} 
        expanded={expanded} 
        canExpand={hasContent || isRunning} 
        actionSlot={
          card.agentId || (card.action && onToolAction) ? (
            <>
              {card.agentId && renderToolAgent ? renderToolAgent(card.agentId) : null}
              {card.action && onToolAction ? (
                <ToolCardHeaderAction
                  action={card.action}
                  onAction={onToolAction}
                />
              ) : null}
            </>
          ) : undefined
        }
        onToggle={onToggle} 
      />
      {expanded && hasContent && (
        <ToolCardContent className="bg-transparent py-0">
          {hasInputSection && (
            <GenericToolSection label={inputLabel} tone="input">
              {input}
            </GenericToolSection>
          )}
          {hasInputSection && hasOutputSection && (
            <div className="h-2" />
          )}
          {hasOutputSection && (
            <GenericToolSection
              label={outputLabel}
              tone={card.statusTone === 'error' ? 'error' : 'output'}
            >
              {output}
            </GenericToolSection>
          )}
        </ToolCardContent>
      )}
    </ToolCardRoot>
  );
}
