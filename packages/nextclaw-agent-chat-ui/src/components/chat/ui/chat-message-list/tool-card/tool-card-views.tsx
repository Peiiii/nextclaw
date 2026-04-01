import { Terminal, FileText, Code2, Search, Globe } from 'lucide-react';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { ChatToolPartViewModel } from '../../../view-models/chat-ui.types';
import { ToolCardRoot, ToolCardContent } from './tool-card-root';
import { ToolCardHeader } from './tool-card-header';
import { ToolCardFileOperationContent } from './tool-card-file-operation';
import { cn } from '../../../internal/cn';

const TOOL_CARD_AUTO_EXPAND_DELAY_MS = 200;
const ANSI_ESCAPE_PREFIX = String.fromCharCode(27);
const ANSI_ESCAPE_PATTERN = new RegExp(`${ANSI_ESCAPE_PREFIX}\\[[0-?]*[ -/]*[@-~]`, 'g');

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, '');
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
      return stripAnsi(terminalOutput);
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
    return stripAnsi(rawOutput);
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) {
      return stripAnsi(rawOutput);
    }
    const terminalOutput = extractTerminalOutputFromRecord(parsed);
    if (terminalOutput) {
      return stripAnsi(terminalOutput);
    }
    if (isStructuredTerminalRecord(parsed)) {
      return '';
    }
    return stripAnsi(rawOutput);
  } catch {
    return stripAnsi(rawOutput);
  }
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
      shell: 'border-stone-200/80 bg-stone-50/90',
      header: 'border-stone-200/80 bg-stone-100/85 text-stone-500',
      dot: 'bg-stone-400/80',
      body: 'text-stone-700',
    },
    output: {
      shell: 'border-amber-200/70 bg-white/90',
      header: 'border-amber-200/70 bg-amber-50/90 text-amber-700',
      dot: 'bg-amber-500/80',
      body: 'text-amber-950/80',
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
    <section
      className={cn(
        'overflow-hidden rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
        style.shell,
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em]',
          style.header,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
        <span>{label}</span>
      </div>
      <div className="w-full overflow-hidden">
        <pre
          className={cn(
            'w-full max-w-full min-w-0 max-h-64 overflow-x-auto overflow-y-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre custom-scrollbar-amber',
            style.body,
          )}
        >
          {children}
        </pre>
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// 1. Terminal View
// -------------------------------------------------------------
export function TerminalExecutionView({ card }: { card: ChatToolPartViewModel }) {
  const output = normalizeTerminalOutput(card.output, card.outputData);
  const isRunning = card.statusTone === 'running';
  const hasContent = !!(card.summary?.trim() || output.trim().length > 0);
  const { expanded, onToggle } = useToolCardExpandedState({
    canExpand: output.trim().length > 0 || isRunning,
    isRunning,
    expandOnError: hasContent,
    statusTone: card.statusTone,
  });

  const commandPart = card.summary?.replace(/^(command|path|args|query|input):\s*/i, '');

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        icon={Terminal} 
        expanded={expanded} 
        canExpand={output.trim().length > 0 || isRunning} 
        onToggle={onToggle} 
      />
      {expanded && (
        <>
          <div className="px-3 pb-2 font-mono w-full max-h-48 overflow-y-auto custom-scrollbar-amber min-h-0 text-[12px]">
            <div className="flex items-start gap-2 leading-relaxed">
              <span className="text-amber-500/50 font-medium shrink-0 select-none mt-[1px]">$</span>
              <div className="flex-1 min-w-0">
                {commandPart ? (
                  <div className="text-amber-950/80 break-words whitespace-pre-wrap tracking-tight font-medium inline-block">
                    {commandPart}
                    {isRunning && !output && (
                      <span className="inline-block w-1.5 h-3 ml-1 bg-amber-500/60 animate-pulse align-middle" />
                    )}
                  </div>
                ) : (
                  <div className="h-3 w-32 bg-amber-200/30 rounded animate-pulse mt-2" />
                )}
              </div>
            </div>
          </div>
          {output && (
            <ToolCardContent>
              <pre className="font-mono text-[12px] text-amber-950/70 whitespace-pre-wrap break-all w-full max-w-full max-h-64 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar-amber leading-relaxed px-0">
                {output}
                {isRunning && <span className="inline-block w-1.5 h-3 ml-1 bg-amber-500/60 animate-pulse align-middle" />}
              </pre>
            </ToolCardContent>
          )}
        </>
      )}
    </ToolCardRoot>
  );
}

// -------------------------------------------------------------
// 2. File Operation View
// -------------------------------------------------------------
export function FileOperationView({ card }: { card: ChatToolPartViewModel }) {
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

  const isEdit = card.toolName === 'edit_file' || card.toolName === 'write_file' || card.toolName === 'apply_patch' || card.toolName === 'file_change';

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        icon={isEdit ? Code2 : FileText} 
        expanded={expanded} 
        canExpand={hasContent || isRunning} 
        hideSummary={expanded && hasStructuredPreview}
        onToggle={onToggle} 
      />
      {expanded && hasContent && (
        <ToolCardContent className="border-t border-amber-200/20 bg-transparent px-0 pt-0 pb-0">
          <ToolCardFileOperationContent card={card} />
        </ToolCardContent>
      )}
    </ToolCardRoot>
  );
}

// -------------------------------------------------------------
// 3. Search View
// -------------------------------------------------------------
export function SearchSnippetView({ card }: { card: ChatToolPartViewModel }) {
  const isRunning = card.statusTone === 'running';
  const output = card.output?.trim() ?? '';
  const { expanded, onToggle } = useToolCardExpandedState({
    canExpand: !!output || isRunning,
    isRunning,
    statusTone: card.statusTone,
  });

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        icon={Search} 
        expanded={expanded} 
        canExpand={!!output || isRunning} 
        onToggle={onToggle} 
      />
      {expanded && output && (
        <ToolCardContent>
           <pre className="font-mono text-[12px] text-amber-950/70 whitespace-pre-wrap break-all w-full max-w-full max-h-64 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar-amber leading-relaxed">
             {output}
           </pre>
        </ToolCardContent>
      )}
    </ToolCardRoot>
  );
}

// -------------------------------------------------------------
// 4. Generic View
// -------------------------------------------------------------
export function GenericToolCard({ card }: { card: ChatToolPartViewModel }) {
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
    statusTone: card.statusTone,
  });

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        icon={Globe} 
        expanded={expanded} 
        canExpand={hasContent || isRunning} 
        onToggle={onToggle} 
      />
      {expanded && hasContent && (
        <ToolCardContent className="bg-transparent px-2.5 py-2.5">
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
