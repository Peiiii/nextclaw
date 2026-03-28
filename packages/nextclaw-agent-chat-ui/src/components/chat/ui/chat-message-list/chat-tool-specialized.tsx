import { Check, ChevronDown, ChevronRight, Code2, Globe, Loader2, Search, Terminal, FileText, AlertTriangle, Minus } from 'lucide-react';
import type { ChatToolPartViewModel } from '../../view-models/chat-ui.types';
import { cn } from '../../internal/cn';
import { useState, useEffect, useRef } from 'react';

const TOOL_OUTPUT_PREVIEW_MAX = 400;

const STATUS_STYLES = {
  running: { text: 'text-amber-500/80', icon: Loader2, spin: true },
  success: { text: 'text-amber-500/80', icon: Check, spin: false },
  error: { text: 'text-amber-500/80', icon: AlertTriangle, spin: false },
  cancelled: { text: 'text-amber-500/80', icon: Minus, spin: false }
} as const;

function renderStatusMeta(card: ChatToolPartViewModel) {
  const style = STATUS_STYLES[card.statusTone] || STATUS_STYLES.cancelled;
  const Icon = style.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium leading-none shrink-0', style.text)}>
      <Icon className={cn("h-3.5 w-3.5", style.spin && "animate-spin")} strokeWidth={3} />
      {card.statusTone === 'running' ? card.statusLabel : null}
    </span>
  );
}

// ------------------------------------------------------------------
// 1. Terminal Execution View
// ------------------------------------------------------------------
export function TerminalExecutionView({ card }: { card: ChatToolPartViewModel }) {
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  
  const hasContent = !!(card.summary?.trim() || output.length > 0);
  const wasEmptyRef = useRef(!hasContent);
  const [expanded, setExpanded] = useState(hasContent && (isRunning || card.statusTone === 'error' || output.length < 500));
  const [hasUserToggled, setHasUserToggled] = useState(false);
  const prevRunningRef = useRef(isRunning);

  // Auto-reveal: When content arrives during execution, automatically expand once.
  useEffect(() => {
    if (wasEmptyRef.current && hasContent && isRunning) {
      setExpanded(true);
      wasEmptyRef.current = false;
    }
  }, [hasContent, isRunning]);

  // Auto-collapse: When tool finishes, automatically collapse if user haven't manually toggled.
  useEffect(() => {
    if (prevRunningRef.current && !isRunning && !hasUserToggled) {
      setExpanded(false);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, hasUserToggled]);

  const onToggle = (val: boolean) => {
    setExpanded(val);
    setHasUserToggled(true);
  };

  return (
    <div className="my-2 rounded-lg border border-amber-200/50 bg-amber-100/30 shadow-sm overflow-hidden text-[12px] w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full transition-all flex flex-col">
      {!expanded ? (
        // -------------------------------------------------------------
        // COLLAPSED STATE: Single Line (Perfect dimensional sync with other tools)
        // -------------------------------------------------------------
        <div 
          className={cn(
            "flex items-center justify-between px-3 py-2.5 cursor-pointer w-full transition-colors", 
            (output || isRunning) ? "hover:bg-amber-100/30" : ""
          )}
          onClick={() => (output || isRunning) && onToggle(true)}
        >
          <div className="flex items-center gap-2 font-mono min-w-0 max-w-[calc(100%-80px)] text-amber-950/80">
            <Terminal className="h-4 w-4 text-amber-600/80 shrink-0" strokeWidth={3} />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold shrink-0 tracking-tight">{card.toolName}</span>
              <span className="text-amber-300 font-bold select-none shrink-0">›</span>
              <span className="truncate flex-1 min-w-0 font-normal">
                {card.summary ? card.summary.replace(/^(command|path|args|query|input):\s*/i, '') : '...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {renderStatusMeta(card)}
            {(output || isRunning) && <ChevronRight className="h-4 w-4 text-amber-400/80" strokeWidth={3} />}
          </div>
        </div>
      ) : (
        // -------------------------------------------------------------
        // EXPANDED STATE: 3-Layer Semantic Terminal
        // -------------------------------------------------------------
        <>
          {/* Semantic Area 1: Meta Header (Hierarchy Differentiated) */}
          <div 
            className="flex items-center justify-between px-3 py-2.5 bg-transparent border-none cursor-pointer hover:bg-amber-100/30 transition-colors w-full font-mono"
            onClick={() => onToggle(false)}
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-amber-600/80" strokeWidth={3} />
              <span className="tracking-tight text-amber-950/80 font-bold">{card.toolName}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {renderStatusMeta(card)}
              <ChevronDown className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
            </div>
          </div>

          <div className="px-3 pb-0.5 font-mono w-full max-h-48 overflow-y-auto custom-scrollbar-amber min-h-0 text-[12px]">
            <div className="flex items-start gap-2 leading-relaxed">
              <span className="text-amber-500/50 font-medium shrink-0 select-none mt-[1px]">$</span>
              <div className="flex-1 min-w-0">
                {card.summary?.trim() ? (
                  <span className="text-amber-950/80 break-words whitespace-pre-wrap tracking-tight font-medium">
                    {card.summary.replace(/^(command|path|args|query|input):\s*/i, '')}
                  </span>
                ) : (
                  <div className="h-3 w-32 bg-amber-200/30 rounded animate-pulse mt-2" />
                )}
              </div>
            </div>
          </div>
          
          {/* Semantic Area 3: Execution Output (Symmetrical & Subtly Layered) */}
          {(output || (isRunning && hasContent)) && (
            <div className="px-3 py-3 w-full overflow-hidden border-t border-amber-200/15 bg-amber-50/50">
              <pre className="font-mono text-[12px] text-amber-950/70 whitespace-pre-wrap break-all w-full max-w-full max-h-64 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar-amber leading-relaxed">
                {output}
                {isRunning && <span className="inline-block w-1.5 h-3 ml-1 bg-amber-500/60 animate-pulse align-middle" />}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// 2. File Read / Write / Edit
// ------------------------------------------------------------------
export function FileOperationView({ card }: { card: ChatToolPartViewModel }) {
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  const [expanded, setExpanded] = useState(false);
  const [hasUserToggled, setHasUserToggled] = useState(false);
  const prevRunningRef = useRef(isRunning);

  useEffect(() => {
    if (prevRunningRef.current && !isRunning && !hasUserToggled) {
      setExpanded(false);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, hasUserToggled]);

  const onToggle = () => {
    setExpanded(!expanded);
    setHasUserToggled(true);
  };

  const isEdit = card.toolName === 'edit_file' || card.toolName === 'write_file';
  
  const renderLine = (line: string, idx: number) => {
    if (isEdit) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        return <div key={idx} className="bg-emerald-500/10 text-emerald-700 px-2 py-0.5 w-full break-all whitespace-pre-wrap"><span className="select-none opacity-40 mr-2 w-3 inline-block shrink-0">+</span><span>{line.slice(1)}</span></div>;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        return <div key={idx} className="bg-rose-500/10 text-rose-700 px-2 py-0.5 w-full break-all whitespace-pre-wrap"><span className="select-none opacity-40 mr-2 w-3 inline-block shrink-0">-</span><span className="line-through decoration-rose-400/50">{line.slice(1)}</span></div>;
      }
    }
    return <div key={idx} className="px-2 py-0.5 text-amber-950/80 w-full break-all whitespace-pre-wrap"><span className="select-none opacity-0 mr-2 w-3 inline-block shrink-0"> </span><span>{line}</span></div>;
  };

  const lines = output.split('\n');
  const maxLines = 15;
  const isLong = lines.length > maxLines;
  const displayLines = (!expanded && isLong) ? lines.slice(0, maxLines) : lines;

  return (
    <div className="my-2 rounded-lg border border-amber-200/50 bg-amber-100/30 shadow-sm overflow-hidden text-[12px] w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full transition-all">
      <div 
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer bg-transparent hover:bg-amber-100/30 transition-colors w-full" 
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 font-mono min-w-0 max-w-[calc(100%-80px)] text-amber-950/80">
          {isEdit ? (
            <Code2 className="h-4 w-4 text-amber-600/80 shrink-0" strokeWidth={3} />
          ) : (
            <FileText className="h-4 w-4 text-amber-600/80 shrink-0" strokeWidth={3} />
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold shrink-0 tracking-tight">{card.toolName}</span>
            <span className="text-amber-300 font-bold select-none shrink-0">›</span>
            <span className="truncate flex-1 min-w-0 font-normal" title={card.summary || card.toolName}>
              {(card.summary || card.toolName).replace(/^(command|path|args|query|input):\s*/i, '')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {renderStatusMeta(card)}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
          ) : (
            <ChevronRight className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
          )}
        </div>
      </div>

      {expanded && output && (
        <div className="border-t border-amber-200/15 bg-amber-50/50 w-full overflow-hidden">
          <div className="font-mono text-[12px] leading-relaxed py-2 max-h-48 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar-amber text-amber-950/80 w-full px-1">
            {displayLines.map(renderLine)}
            {!expanded && isLong && (
              <div className="px-4 py-2 text-amber-800/60 text-center text-xs border-t border-amber-200/10 cursor-pointer hover:bg-amber-100/20" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
                阅读剩余 {lines.length - maxLines} 行 (Show more)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// 3. Search / Grep (Minimalist List)
// ------------------------------------------------------------------
export function SearchSnippetView({ card }: { card: ChatToolPartViewModel }) {
  const isRunning = card.statusTone === 'running';
  const [expanded, setExpanded] = useState(isRunning);
  const [hasUserToggled, setHasUserToggled] = useState(false);
  const prevRunningRef = useRef(isRunning);
  const output = card.output?.trim() ?? '';

  useEffect(() => {
    if (prevRunningRef.current && !isRunning && !hasUserToggled) {
      setExpanded(false);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, hasUserToggled]);

  const onToggle = () => {
    setExpanded(!expanded);
    setHasUserToggled(true);
  };

  return (
    <div className="my-2 rounded-lg border border-amber-200/50 bg-amber-100/30 shadow-sm overflow-hidden text-[12px] w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full transition-all">
      <div 
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer bg-transparent hover:bg-amber-100/30 transition-colors w-full" 
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 font-mono min-w-0 max-w-[calc(100%-80px)] text-amber-950/80">
          <Search className="h-4 w-4 text-amber-600/80 shrink-0" strokeWidth={3} />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold shrink-0 tracking-tight">{card.toolName}</span>
            <span className="text-amber-300 font-bold select-none shrink-0">›</span>
            <span className="truncate flex-1 min-w-0 font-normal">
              {card.summary ? card.summary.replace(/^(command|path|args|query|input):\s*/i, '') : 'Search Codebase'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {renderStatusMeta(card)}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
          ) : (
            <ChevronRight className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
          )}
        </div>
      </div>
      {expanded && output && (
        <div className="p-3 border-t border-amber-200/15 bg-amber-50/50 w-full overflow-hidden">
           <pre className="font-mono text-[12px] text-amber-950/70 whitespace-pre-wrap break-all w-full max-w-full max-h-64 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar-amber py-2 leading-relaxed">
             {output}
           </pre>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// 4. Default Agent Tool Card (Fallback)
// ------------------------------------------------------------------
export function GenericToolCard({ card }: { card: ChatToolPartViewModel }) {
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  const [expanded, setExpanded] = useState(isRunning);
  const [hasUserToggled, setHasUserToggled] = useState(false);
  const prevRunningRef = useRef(isRunning);
  const showOutputSection = card.kind === 'result' || card.hasResult;

  useEffect(() => {
    if (prevRunningRef.current && !isRunning && !hasUserToggled) {
      setExpanded(false);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, hasUserToggled]);

  const onToggle = () => {
    if (!showOutputSection) return;
    setExpanded(!expanded);
    setHasUserToggled(true);
  };

  return (
    <div className="my-2 rounded-lg border border-amber-200/50 bg-amber-100/30 shadow-sm overflow-hidden text-[12px] w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full transition-all flex flex-col">
      <div 
        className={cn("flex items-center justify-between px-3 py-2.5 w-full transition-colors bg-transparent", showOutputSection && "cursor-pointer hover:bg-amber-100/30")}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 font-mono min-w-0 max-w-[calc(100%-80px)] text-amber-950/80">
          <Globe className="h-4 w-4 text-amber-600/80 shrink-0" strokeWidth={3} />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold shrink-0 tracking-tight">{card.toolName}</span>
            {card.summary && (
              <>
                <span className="text-amber-300 font-bold select-none shrink-0">›</span>
                <span className="truncate flex-1 min-w-0 font-normal">
                  {card.summary.replace(/^(command|path|args|query):\s*/i, '')}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {renderStatusMeta(card)}
          {showOutputSection && (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
            ) : (
              <ChevronRight className="h-4 w-4 text-amber-400/80" strokeWidth={3} />
            )
          )}
        </div>
      </div>

      {expanded && (card.summary || output) && (
        <div className="border-t border-amber-200/15 bg-amber-50/50 font-mono text-[12px] w-full overflow-hidden p-3 pt-2">
          {card.summary && (
            <div className="text-amber-950/80 mb-2 truncate break-words whitespace-normal w-full min-w-0 leading-relaxed font-medium">
              {card.summary.replace(/^(command|path|args|query|input):\s*/i, '')}
            </div>
          )}
          {output && (
            <pre className="mt-1 text-amber-950/80 whitespace-pre-wrap break-all overflow-y-auto overflow-x-hidden max-h-64 custom-scrollbar-amber py-1 w-full min-w-0 max-w-full leading-relaxed">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
