import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowUp, Square } from 'lucide-react';

type ChatInputSendControlsProps = {
  sendError?: string | null;
  draft: string;
  hasModelOptions: boolean;
  sessionTypeUnavailable: boolean;
  isSending: boolean;
  canStopGeneration: boolean;
  resolvedStopHint: string;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
};

export function ChatInputSendControls(props: ChatInputSendControlsProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      {props.sendError?.trim() && <div className="max-w-[420px] text-right text-[11px] text-red-600">{props.sendError}</div>}
      <div className="flex items-center gap-2">
        {props.isSending ? (
          props.canStopGeneration ? (
            <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => void props.onStop()}>
              <Square className="h-3 w-3 fill-current" />
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" disabled>
                      <Square className="h-3 w-3 fill-current" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{props.resolvedStopHint}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        ) : (
          <Button
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => void props.onSend()}
            disabled={props.draft.trim().length === 0 || !props.hasModelOptions || props.sessionTypeUnavailable}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
