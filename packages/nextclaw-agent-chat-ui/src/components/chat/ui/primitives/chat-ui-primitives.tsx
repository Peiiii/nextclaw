import { ChatInput as DefaultInput } from '../../default-skin/input';
import {
  ChatPopover as DefaultPopover,
  ChatPopoverAnchor as DefaultPopoverAnchor,
  ChatPopoverContent as DefaultPopoverContent,
  ChatPopoverTrigger as DefaultPopoverTrigger
} from '../../default-skin/popover';
import {
  ChatSelect as DefaultSelect,
  ChatSelectContent as DefaultSelectContent,
  ChatSelectGroup as DefaultSelectGroup,
  ChatSelectItem as DefaultSelectItem,
  ChatSelectLabel as DefaultSelectLabel,
  ChatSelectSeparator as DefaultSelectSeparator,
  ChatSelectTrigger as DefaultSelectTrigger,
  ChatSelectValue as DefaultSelectValue
} from '../../default-skin/select';
import {
  ChatTooltip as DefaultTooltip,
  ChatTooltipContent as DefaultTooltipContent,
  ChatTooltipProvider as DefaultTooltipProvider,
  ChatTooltipTrigger as DefaultTooltipTrigger
} from '../../default-skin/tooltip';

// Centralized primitive adapter layer for chat UI.
export const ChatUiPrimitives = {
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
