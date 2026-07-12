import type {
  ChatFileOpenActionViewModel,
  ChatPanelAppCardViewModel,
  ChatBuiltInToolStatusKind,
  ChatMessageTexts,
  ChatToolActionViewModel,
  ChatToolPartViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import {
  Bot,
  Brain,
  CalendarClock,
  Eye,
  FolderTree,
  Globe2,
  ImageIcon,
  MessageSquare,
  Send,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { TerminalExecutionView, FileOperationView, SearchSnippetView, GenericToolCard, PanelAppInlineToolCard } from './chat-tool-specialized';

function isTerminalTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'exec' || lowered === 'exec_command' || lowered === 'execute_command' || lowered === 'command_execution' || lowered === 'bash' || lowered === 'shell' || lowered.includes('run_');
}

function isFileTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'read_file' || lowered === 'write_file' || lowered === 'edit_file' || lowered === 'apply_patch' || lowered === 'file_change';
}

function isFileWriteTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'write_file' || lowered === 'edit_file' || lowered === 'apply_patch' || lowered === 'file_change';
}

function isSearchTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'grep_search' || lowered === 'find_files' || lowered.includes('search');
}

type BuiltInToolPresentation = {
  statusKind: ChatBuiltInToolStatusKind;
  icon: LucideIcon;
};

const BUILT_IN_TOOL_PRESENTATIONS: Record<string, BuiltInToolPresentation> = {
  list_dir: { statusKind: 'directory', icon: FolderTree },
  web_fetch: { statusKind: 'web', icon: Globe2 },
  message: { statusKind: 'message', icon: Send },
  sessions_list: { statusKind: 'session', icon: MessageSquare },
  sessions_history: { statusKind: 'session', icon: MessageSquare },
  sessions_request: { statusKind: 'session', icon: MessageSquare },
  spawn: { statusKind: 'agent', icon: Bot },
  sessions_spawn: { statusKind: 'agent', icon: Bot },
  subagents: { statusKind: 'agent', icon: Bot },
  memory_search: { statusKind: 'memory', icon: Brain },
  memory_get: { statusKind: 'memory', icon: Brain },
  cron: { statusKind: 'schedule', icon: CalendarClock },
  gateway: { statusKind: 'system', icon: Settings },
  view_image: { statusKind: 'image', icon: ImageIcon },
  show_file: { statusKind: 'display', icon: Eye },
  show_url: { statusKind: 'display', icon: Eye },
  show_panel_app: { statusKind: 'display', icon: Eye },
  show_content: { statusKind: 'display', icon: Eye },
};

function resolveBuiltInToolPresentation(name: string): BuiltInToolPresentation | null {
  return BUILT_IN_TOOL_PRESENTATIONS[name.toLowerCase()] ?? null;
}

export function ChatToolCard({
  card,
  toolStatusLabels,
  onToolAction,
  onFileOpen,
  renderToolAgent,
  renderPanelAppCard,
}: {
  card: ChatToolPartViewModel;
  toolStatusLabels?: ChatMessageTexts['toolStatusLabels'];
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
}) {
  if (card.panelApp) {
    return (
      <PanelAppInlineToolCard
        card={card}
        onToolAction={onToolAction}
        renderPanelAppCard={renderPanelAppCard}
      />
    );
  }
  const builtInPresentation = resolveBuiltInToolPresentation(card.toolName);
  const builtInLabel = builtInPresentation
    ? toolStatusLabels?.builtIn?.[builtInPresentation.statusKind]?.[card.statusTone]
    : undefined;
  if (isTerminalTool(card.toolName)) {
    return <TerminalExecutionView card={card} toolLabel={toolStatusLabels?.terminal[card.statusTone]} />;
  }
  if (isFileTool(card.toolName)) {
    const toolLabel = isFileWriteTool(card.toolName)
      ? toolStatusLabels?.fileEdit[card.statusTone]
      : toolStatusLabels?.fileRead[card.statusTone];
    return <FileOperationView card={card} toolLabel={toolLabel} onFileOpen={onFileOpen} />;
  }
  if (isSearchTool(card.toolName)) {
    return (
      <SearchSnippetView
        card={card}
        toolLabel={builtInLabel ?? toolStatusLabels?.search[card.statusTone]}
        icon={builtInPresentation?.icon}
      />
    );
  }

  // Fallback minimalist card for read_url_content, multi_replace, etc.
  return (
    <GenericToolCard
      card={card}
      toolLabel={builtInLabel}
      icon={builtInPresentation?.icon}
      onToolAction={onToolAction}
      renderToolAgent={renderToolAgent}
    />
  );
}
