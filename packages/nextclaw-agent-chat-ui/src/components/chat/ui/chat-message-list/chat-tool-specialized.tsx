import { CheckCircle2, ChevronDown, ChevronRight, Code2, Globe, Loader2, Search, Terminal, FileText, AlertCircle, CircleSlash } from 'lucide-react';
import type { ChatToolPartViewModel } from '../../view-models/chat-ui.types';
import { cn } from '../../internal/cn';
import { useState } from 'react';

const TOOL_OUTPUT_PREVIEW_MAX = 400;

const STATUS_STYLES = {
  running: { text: 'text-zinc-500', icon: Loader2, spin: true },
  success: { text: 'text-emerald-600/90', icon: CheckCircle2, spin: false },
  error: { text: 'text-rose-600/90', icon: AlertCircle, spin: false },
  cancelled: { text: 'text-zinc-400', icon: CircleSlash, spin: false }
} as const;

function renderStatusMeta(card: ChatToolPartViewModel) {
  const style = STATUS_STYLES[card.statusTone] || STATUS_STYLES.cancelled;
  const Icon = style.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium leading-none shrink-0', style.text)}>
      <Icon className={cn("h-3.5 w-3.5", style.spin && "animate-spin")} />
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
  const [expanded, setExpanded] = useState(isRunning || card.statusTone === 'error' || output.length < 500);

  return (
    <div className="my-2 rounded-xl border border-zinc-200/80 bg-white overflow-hidden text-[12px] w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full shadow-sm transition-all flex flex-col">
      {!expanded ? (
        // -------------------------------------------------------------
        // COLLAPSED STATE: Single Line (Perfect dimensional sync with other tools)
        // -------------------------------------------------------------
        <div 
          className={cn(
            "flex items-center justify-between px-3 py-2.5 cursor-pointer w-full transition-colors", 
            (output || isRunning) ? "hover:bg-zinc-50/50" : ""
          )}
          onClick={() => (output || isRunning) && setExpanded(true)}
        >
          <div className="flex items-center gap-2 font-mono text-zinc-700 min-w-0 max-w-[calc(100%-80px)]">
            <Terminal className="h-4 w-4 text-zinc-500 shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-zinc-700 shrink-0 tracking-tight">{card.toolName}</span>
              <span className="text-zinc-300 select-none shrink-0">›</span>
              <span className="truncate flex-1 min-w-0 text-zinc-500">{card.summary || '...'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {renderStatusMeta(card)}
            {(output || isRunning) && <ChevronRight className="h-4 w-4 text-zinc-400" />}
          </div>
        </div>
      ) : (
        // -------------------------------------------------------------
        // EXPANDED STATE: 3-Layer Semantic Terminal
        // -------------------------------------------------------------
        <>
          {/* Semantic Area 1: Meta Header (Clickable to collapse) */}
          <div 
            className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 border-b border-zinc-100 cursor-pointer hover:bg-zinc-50/80 transition-colors w-full"
            onClick={() => setExpanded(false)}
          >
            <div className="flex items-center gap-2 font-mono text-zinc-500">
              <Terminal className="h-4 w-4" />
              <span className="tracking-tight text-zinc-700">{card.toolName}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {renderStatusMeta(card)}
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            </div>
          </div>

          {/* Semantic Area 2: Command Input (with layout safety) */}
          <div className="flex items-start gap-2 px-3 py-2.5 font-mono bg-white w-full border-b border-zinc-100/30 max-h-64 overflow-y-auto custom-scrollbar min-h-0">
            <span className="select-none text-zinc-400 font-bold shrink-0 mt-[1px]">$</span>
            <span className="font-medium text-zinc-800 break-words whitespace-pre-wrap min-w-0 tracking-tight leading-relaxed">{card.summary || '...'}</span>
          </div>
          
          {/* Semantic Area 3: Execution Output */}
          <div className="bg-[#FAFAFA] border-t border-zinc-100 font-mono">
            <div className="px-3 py-2.5 text-[11px] leading-relaxed text-zinc-600 max-h-64 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar relative">
              <pre className="whitespace-pre-wrap break-all inline">{output}</pre>
              {isRunning && <span className="inline-block w-1.5 h-3 bg-zinc-400 ml-1 animate-pulse align-middle" />}
            </div>
          </div>
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
  const [expanded, setExpanded] = useState(card.statusTone === 'running' || card.statusTone === 'error' || output.length < 500);

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
    return <div key={idx} className="px-2 py-0.5 text-zinc-700 w-full break-all whitespace-pre-wrap"><span className="select-none opacity-0 mr-2 w-3 inline-block shrink-0"> </span><span>{line}</span></div>;
  };

  const lines = output.split('\n');
  const maxLines = 15;
  const isLong = lines.length > maxLines;
  const displayLines = (!expanded && isLong) ? lines.slice(0, maxLines) : lines;

  return (
    <div className="my-2 rounded-xl border border-zinc-200/80 bg-white overflow-hidden text-[12px] w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full shadow-sm transition-all">
      <div 
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-zinc-50 transition-colors w-full" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 font-mono text-zinc-700 min-w-0 max-w-[calc(100%-80px)]">
          {isEdit ? <Code2 className="h-4 w-4 text-zinc-500 shrink-0" /> : <FileText className="h-4 w-4 text-zinc-500 shrink-0" />}
          <span className="truncate flex-1 min-w-0" title={card.summary || card.toolName}>{card.summary || card.toolName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {renderStatusMeta(card)}
          {expanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
        </div>
      </div>

      {expanded && output && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 w-full overflow-hidden">
          <div className="font-mono text-[11px] leading-[1.6] py-2 max-h-48 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar text-zinc-800 w-full">
            {displayLines.map(renderLine)}
            {!expanded && isLong && (
              <div className="px-4 py-2 text-zinc-500 text-center text-xs border-t border-zinc-100 bg-zinc-50/80 cursor-pointer hover:bg-zinc-100" onClick={(e) => { e.stopPropagation(); setExpanded(true); }}>
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
  const [expanded, setExpanded] = useState(card.statusTone === 'running' || card.statusTone === 'error');
  const output = card.output?.trim() ?? '';

  return (
    <div className="my-2 rounded-xl border border-zinc-200/80 bg-white overflow-hidden text-[12px] w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full shadow-sm transition-all">
      <div 
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-zinc-50 transition-colors w-full" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 font-mono text-zinc-700 min-w-0 max-w-[calc(100%-80px)]">
          <Search className="h-4 w-4 text-zinc-500 shrink-0" />
          <span className="truncate flex-1 min-w-0">{card.summary || 'Search Codebase'}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {renderStatusMeta(card)}
          {expanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
        </div>
      </div>
      {expanded && output && (
        <div className="p-2 border-t border-zinc-100 bg-zinc-50/50 w-full overflow-hidden">
           <pre className="font-mono text-[11px] text-zinc-600 whitespace-pre-wrap break-all w-full max-w-full max-h-64 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar p-1">
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
  const [expanded, setExpanded] = useState(card.statusTone === 'error');
  const showOutputSection = card.kind === 'result' || card.hasResult;

  return (
    <div className="my-2 rounded-xl border border-zinc-200/80 bg-white overflow-hidden text-[12px] w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full shadow-sm transition-all">
      <div 
        className={cn("flex items-center justify-between px-3 py-2.5 w-full transition-colors", showOutputSection && "cursor-pointer hover:bg-zinc-50")}
        onClick={() => showOutputSection && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 font-mono text-zinc-700 min-w-0 max-w-[calc(100%-80px)]">
          <Globe className="h-4 w-4 text-zinc-500 shrink-0" />
          <span className="truncate font-medium flex-1 min-w-0">{card.toolName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {renderStatusMeta(card)}
          {showOutputSection && (expanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />)}
        </div>
      </div>

      {expanded && (card.summary || output) && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 p-3 pt-2 font-mono text-[11px] w-full overflow-hidden">
          {card.summary && (
            <div className="text-zinc-600 mb-2 truncate break-words whitespace-normal w-full min-w-0">
              {card.summary}
            </div>
          )}
          {output && (
            <pre className="mt-1 text-zinc-700 whitespace-pre-wrap break-all overflow-y-auto overflow-x-hidden max-h-64 custom-scrollbar bg-white p-2 rounded-lg border border-zinc-200/60 shadow-sm w-full min-w-0 max-w-full">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
