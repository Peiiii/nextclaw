import { Terminal, FileText, Code2, Search, Globe } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { ChatToolPartViewModel } from '../../../view-models/chat-ui.types';
import { ToolCardRoot, ToolCardContent } from './tool-card-root';
import { ToolCardHeader } from './tool-card-header';
import { ToolCardFileOperationContent } from './tool-card-file-operation';

const TOOL_CARD_AUTO_EXPAND_DELAY_MS = 200;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;

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

function normalizeTerminalOutput(rawOutput?: string): string {
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
    return stripAnsi(extractTerminalOutputFromRecord(parsed) ?? rawOutput);
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

// -------------------------------------------------------------
// 1. Terminal View
// -------------------------------------------------------------
export function TerminalExecutionView({ card }: { card: ChatToolPartViewModel }) {
  const output = normalizeTerminalOutput(card.output);
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
        onToggle={onToggle} 
      />
      {expanded && hasContent && (
        <ToolCardContent>
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
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  const showOutputSection = card.kind === 'result' || card.hasResult;
  const { expanded, onToggle } = useToolCardExpandedState({
    canExpand: showOutputSection || isRunning,
    isRunning,
    statusTone: card.statusTone,
  });

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        icon={Globe} 
        expanded={expanded} 
        canExpand={showOutputSection} 
        onToggle={onToggle} 
      />
      {expanded && output && (
        <ToolCardContent>
          <pre className="text-amber-950/80 whitespace-pre-wrap break-all overflow-y-auto overflow-x-hidden max-h-64 custom-scrollbar-amber w-full min-w-0 max-w-full leading-relaxed">
            {output}
          </pre>
        </ToolCardContent>
      )}
    </ToolCardRoot>
  );
}
