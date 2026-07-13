import { Terminal, FileText, Code2, Search, type LucideIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type {
  ChatFileOperationBlockViewModel,
  ChatFileOpenActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ToolCardRoot, ToolCardContent, ToolCardDetailSection } from './tool-card-root';
import { ToolCardHeader } from './tool-card-header';
import { ToolCardFileOperationContent } from './tool-card-file-operation';
import { ChatTerminalSurface } from './terminal/terminal-panes';

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

export function useToolCardExpandedState({
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
  const input = card.input?.trim() ?? '';
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  const hasStructuredPreview = Boolean(card.fileOperation?.blocks.length);
  const showRawInput = Boolean(input) && !hasStructuredPreview;
  const hasContent = hasStructuredPreview || Boolean(input) || Boolean(output);
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
          {showRawInput ? (
            <ToolCardDetailSection label={card.inputLabel?.trim() || 'Input'} tone="input">
              {input}
            </ToolCardDetailSection>
          ) : null}
          {showRawInput && output ? <div className="h-2" /> : null}
          {hasStructuredPreview || output ? (
            <ToolCardFileOperationContent
              card={card}
              onFileOpen={onFileOpen}
              // Always show the path header in the content panel so users can
              // open the file and still see +N/-N captions (matches prior UX).
              showPathRow
            />
          ) : null}
        </ToolCardContent>
      ) : null}
    </ToolCardRoot>
  );
}

export function SearchSnippetView({
  card,
  toolLabel,
  icon: Icon = Search,
}: {
  card: ChatToolPartViewModel;
  toolLabel?: string;
  icon?: LucideIcon;
}) {
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
        icon={Icon}
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
