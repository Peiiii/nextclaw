import { Terminal, FileText, Code2, Search, Globe } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { ChatToolPartViewModel } from '../../../view-models/chat-ui.types';
import { ToolCardRoot, ToolCardContent } from './tool-card-root';
import { ToolCardHeader } from './tool-card-header';

// -------------------------------------------------------------
// 1. Terminal View
// -------------------------------------------------------------
export function TerminalExecutionView({ card }: { card: ChatToolPartViewModel }) {
  const output = card.output?.trim() ?? '';
  const isRunning = card.statusTone === 'running';
  const hasContent = !!(card.summary?.trim() || output.length > 0);
  const wasEmptyRef = useRef(!hasContent);
  const [expanded, setExpanded] = useState(hasContent && (isRunning || card.statusTone === 'error' || output.length < 500));
  const [hasUserToggled, setHasUserToggled] = useState(false);
  const prevRunningRef = useRef(isRunning);

  useEffect(() => {
    if (wasEmptyRef.current && hasContent && isRunning) {
      setExpanded(true);
      wasEmptyRef.current = false;
    }
  }, [hasContent, isRunning]);

  useEffect(() => {
    if (prevRunningRef.current && !isRunning && !hasUserToggled) {
      setExpanded(false);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, hasUserToggled]);

  const onToggle = () => {
    if (!output && !isRunning) return;
    setExpanded(!expanded);
    setHasUserToggled(true);
  };

  const commandPart = card.summary?.replace(/^(command|path|args|query|input):\s*/i, '');

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        icon={Terminal} 
        expanded={expanded} 
        canExpand={!!output || isRunning} 
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
    if (!output && !isRunning) return;
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
    return <div key={idx} className="py-0.5 text-amber-950/80 w-full break-all whitespace-pre-wrap"><span>{line}</span></div>;
  };

  const lines = output.split('\n');
  const maxLines = 15;
  const isLong = lines.length > maxLines;
  const displayLines = (!expanded && isLong) ? lines.slice(0, maxLines) : lines;

  return (
    <ToolCardRoot>
      <ToolCardHeader 
        card={card} 
        icon={isEdit ? Code2 : FileText} 
        expanded={expanded} 
        canExpand={!!output || isRunning} 
        onToggle={onToggle} 
      />
      {expanded && output && (
        <ToolCardContent>
          <div className="font-mono text-[12px] leading-relaxed max-h-48 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar-amber text-amber-950/80 w-full">
            {displayLines.map(renderLine)}
          </div>
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
    if (!output && !isRunning) return;
    setExpanded(!expanded);
    setHasUserToggled(true);
  };

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
