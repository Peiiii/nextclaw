import { ChatUiPrimitives } from '../primitives/chat-ui-primitives';
import type {
  ChatInputBarToolbarProps,
  ChatToolbarAccessoryIcon,
  ChatToolbarIcon,
  ChatToolbarSelect
} from '../../view-models/chat-ui.types';
import { Brain, Paperclip, Sparkles } from 'lucide-react';
import { ChatInputBarActions } from './chat-input-bar-actions';
import { ChatInputBarSkillPicker } from './chat-input-bar-skill-picker';

function ToolbarIcon({ icon }: { icon?: ChatToolbarIcon }) {
  if (icon === 'sparkles') {
    return <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />;
  }
  if (icon === 'brain') {
    return <Brain className="h-3.5 w-3.5 shrink-0 text-gray-500" />;
  }
  return null;
}

function AccessoryIcon({ icon }: { icon?: ChatToolbarAccessoryIcon }) {
  if (icon === 'paperclip') {
    return <Paperclip className="h-4 w-4" />;
  }
  return <ToolbarIcon icon={icon} />;
}

function resolveTriggerWidth(key: string): string {
  if (key === 'model') {
    return 'min-w-[220px]';
  }
  if (key === 'session-type') {
    return 'min-w-[140px]';
  }
  if (key === 'thinking') {
    return 'min-w-[150px]';
  }
  return '';
}

function resolveContentWidth(key: string): string {
  if (key === 'model') {
    return 'w-[320px]';
  }
  if (key === 'session-type') {
    return 'w-[220px]';
  }
  if (key === 'thinking') {
    return 'w-[180px]';
  }
  return '';
}

function ToolbarSelect({ item }: { item: ChatToolbarSelect }) {
  const { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } =
    ChatUiPrimitives;
  const groups =
    item.groups?.filter((group) => group.options.length > 0) ??
    (item.options.length > 0 ? [{ key: `${item.key}-default`, options: item.options }] : []);
  const hasOptions = groups.some((group) => group.options.length > 0);

  return (
    <Select value={item.value} onValueChange={item.onValueChange} disabled={item.disabled}>
      <SelectTrigger
        className={`h-8 w-auto rounded-lg border-0 bg-transparent px-3 text-xs font-medium text-gray-600 shadow-none hover:bg-gray-100 focus:ring-0 ${resolveTriggerWidth(item.key)}`}
      >
        {item.selectedLabel ? (
          <div className="flex min-w-0 items-center gap-2 text-left">
            <ToolbarIcon icon={item.icon} />
            <span className="truncate text-xs font-semibold text-gray-700">{item.selectedLabel}</span>
          </div>
        ) : item.loading ? (
          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
        ) : (
          <SelectValue placeholder={item.placeholder} />
        )}
      </SelectTrigger>
      <SelectContent className={resolveContentWidth(item.key)}>
        {!hasOptions ? (
          item.loading ? (
            <div className="space-y-2 px-3 py-2">
              <div className="h-3 w-36 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          ) : item.emptyLabel ? (
            <div className="px-3 py-2 text-xs text-gray-500">{item.emptyLabel}</div>
          ) : null
        ) : null}
        {groups.map((group, groupIndex) => (
          <div key={group.key}>
            {groupIndex > 0 ? <SelectSeparator /> : null}
            <SelectGroup>
              {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value} className="py-2">
                  {option.description ? (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-xs font-semibold text-gray-800">{option.label}</span>
                      <span className="truncate text-[11px] text-gray-500">{option.description}</span>
                    </div>
                  ) : (
                    <span className="truncate text-xs font-semibold text-gray-800">{option.label}</span>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChatInputBarToolbar(props: ChatInputBarToolbarProps) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  return (
    <div className="flex items-center justify-between px-3 pb-3">
      <div className="flex items-center gap-1">
        {props.skillPicker ? <ChatInputBarSkillPicker picker={props.skillPicker} /> : null}
        {props.selects.map((item) => (
          <ToolbarSelect key={item.key} item={item} />
        ))}
        {props.accessories?.map((item) => {
          const button = (
            <button
              type="button"
              className={`inline-flex items-center rounded-lg py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-400 ${
                item.iconOnly ? 'h-8 w-8 justify-center px-0' : 'gap-1.5 px-3'
              }`}
              onClick={item.onClick}
              disabled={item.disabled}
              aria-label={item.label}
            >
              <AccessoryIcon icon={item.icon} />
              {item.iconOnly ? null : <span>{item.label}</span>}
            </button>
          );
          if (!item.tooltip) {
            return <div key={item.key}>{button}</div>;
          }
          const trigger = item.disabled ? <span className="inline-flex">{button}</span> : button;
          return (
            <TooltipProvider key={item.key}>
              <Tooltip>
                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{item.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      <ChatInputBarActions {...props.actions} />
    </div>
  );
}
