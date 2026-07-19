import { ChatInput as DefaultInput } from '@agent-chat-ui/components/chat/default-skin/input';
import {
  ChatDialog as DefaultDialog,
  ChatDialogContent as DefaultDialogContent,
  ChatDialogDescription as DefaultDialogDescription,
  ChatDialogHeader as DefaultDialogHeader,
  ChatDialogTitle as DefaultDialogTitle,
} from '@agent-chat-ui/components/chat/default-skin/dialog';
import {
  ChatPopover as DefaultPopover,
  ChatPopoverAnchor as DefaultPopoverAnchor,
  ChatPopoverContent as DefaultPopoverContent,
  ChatPopoverTrigger as DefaultPopoverTrigger,
  createChatPopoverAvailableHeightLimit
} from '@agent-chat-ui/components/chat/default-skin/popover';
import {
  ChatSelect as DefaultSelect,
  ChatSelectContent as DefaultSelectContent,
  ChatSelectGroup as DefaultSelectGroup,
  ChatSelectItem as DefaultSelectItem,
  ChatSelectLabel as DefaultSelectLabel,
  ChatSelectSeparator as DefaultSelectSeparator,
  ChatSelectTrigger as DefaultSelectTrigger,
  ChatSelectValue as DefaultSelectValue,
  createChatSelectAvailableHeightLimit
} from '@agent-chat-ui/components/chat/default-skin/select';
import {
  ChatTooltip as DefaultTooltip,
  ChatTooltipContent as DefaultTooltipContent,
  ChatTooltipProvider as DefaultTooltipProvider,
  ChatTooltipTrigger as DefaultTooltipTrigger
} from '@agent-chat-ui/components/chat/default-skin/tooltip';

// Centralized primitive adapter layer for chat UI.
export const ChatUiPrimitives = {
  Dialog: DefaultDialog,
  DialogContent: DefaultDialogContent,
  DialogDescription: DefaultDialogDescription,
  DialogHeader: DefaultDialogHeader,
  DialogTitle: DefaultDialogTitle,
  Popover: DefaultPopover,
  PopoverAnchor: DefaultPopoverAnchor,
  PopoverContent: DefaultPopoverContent,
  PopoverTrigger: DefaultPopoverTrigger,
  Input: DefaultInput,
  Select: DefaultSelect,
  SelectContent: DefaultSelectContent,
  SelectGroup: DefaultSelectGroup,
  SelectItem: DefaultSelectItem,
  SelectLabel: DefaultSelectLabel,
  SelectSeparator: DefaultSelectSeparator,
  SelectTrigger: DefaultSelectTrigger,
  SelectValue: DefaultSelectValue,
  Tooltip: DefaultTooltip,
  TooltipContent: DefaultTooltipContent,
  TooltipProvider: DefaultTooltipProvider,
  TooltipTrigger: DefaultTooltipTrigger
};

export {
  createChatPopoverAvailableHeightLimit,
  createChatSelectAvailableHeightLimit
};
