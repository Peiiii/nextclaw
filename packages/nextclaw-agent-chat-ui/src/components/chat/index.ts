export { ChatInputBar } from './ui/chat-input-bar/chat-input-bar';
export type { ChatInputBarHandle } from './ui/chat-input-bar/chat-input-bar';
export { ChatMessageList } from './ui/chat-message-list/chat-message-list';
export type { ChatMessageListProps } from './ui/chat-message-list/chat-message-list';
export { ChatMessageMarkdown } from './ui/chat-message-list/chat-message-markdown';
export {
  FileOperationCodeSurface,
  FileOperationLinesGrid
} from './ui/chat-message-list/tool-card/tool-card-file-operation-lines';

export { useActiveItemScroll } from './hooks/use-active-item-scroll';
export { useCopyFeedback } from './hooks/use-copy-feedback';
export { useElementWidth } from './hooks/use-element-width';
export { useStickyBottomScroll } from './hooks/use-sticky-bottom-scroll';
export { copyText } from './utils/copy-text.utils';
export {
  createChatComposerTextNode,
  createChatComposerTokenNode,
  createEmptyChatComposerNodes,
  createChatComposerNodesFromText,
  normalizeChatComposerNodes,
  serializeChatComposerDocument,
  serializeChatComposerPlainText,
  extractChatComposerTokenKeys,
  replaceChatComposerRange,
  removeChatComposerTokenNodes,
  CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
  resolveChatComposerActiveInputSurfaceTrigger,
  resolveChatComposerInputSurfaceTrigger,
  resolveChatComposerSlashTrigger
} from './ui/chat-input-bar/chat-composer.utils';
export {
  createInputSurfaceReferenceTokenPlugin,
  createInputSurfaceTriggeredPanelPlugin,
  resolveChatInputSurfaceState,
} from '@agent-chat-ui/lib/input-surface';

export type {
  ChatTexts,
  ChatInputSurfaceConfig,
  ChatInputSurfaceItem,
  ChatInputSurfaceMenuProps,
  ChatInputSurfaceMenuTexts,
  ChatInputSurfaceTrigger,
  ChatInputSurfaceTriggerSpec,
  ChatSlashItem,
  ChatSelectedItem,
  ChatComposerTokenKind,
  ChatComposerTextNode,
  ChatComposerTokenNode,
  ChatComposerNode,
  ChatComposerSelection,
  ChatToolbarIcon,
  ChatToolbarAccessoryIcon,
  ChatToolbarSelectOption,
  ChatToolbarSelectGroup,
  ChatToolbarSelect,
  ChatToolbarAccessory,
  ChatSkillPickerOption,
  ChatSkillPickerProps,
  ChatInputBarActionsProps,
  ChatInputBarToolbarProps,
  ChatInlineHint,
  ChatSlashMenuProps,
  ChatInputBarProps,
  ChatContextWindowIndicator,
  ChatMessageRole,
  ChatFileOperationLineViewModel,
  ChatFileOperationBlockViewModel,
  ChatFileOpenActionViewModel,
  ChatPanelAppCardViewModel,
  ChatUiShowContentPlacement,
  ChatUiShowContentPurpose,
  ChatUiShowContentRequest,
  ChatUiShowContentTarget,
  ChatToolActionViewModel,
  ChatInlineTokenViewModel,
  ChatInlineContentSegmentViewModel,
  ChatToolPartViewModel,
  ChatMessagePartViewModel,
  ChatMessageViewModel,
  ChatMessageTexts
} from './view-models/chat-ui.types';
export type {
  ChatInputSurfacePanel,
  ChatInputSurfacePlugin,
  ChatInputSurfacePluginContext,
  ChatInputSurfaceResolvedState,
} from '@agent-chat-ui/lib/input-surface';
