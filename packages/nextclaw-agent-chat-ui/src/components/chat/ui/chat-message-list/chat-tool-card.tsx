import type { ChatToolPartViewModel } from '../../view-models/chat-ui.types';
import { TerminalExecutionView, FileOperationView, SearchSnippetView, GenericToolCard } from './chat-tool-specialized';

function isTerminalTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'exec' || lowered === 'execute_command' || lowered === 'bash' || lowered === 'shell' || lowered.includes('run_');
}

function isFileEditTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'read_file' || lowered === 'write_file' || lowered === 'edit_file' || lowered === 'apply_patch';
}

function isSearchTool(name: string) {
  const lowered = name.toLowerCase();
  return lowered === 'grep_search' || lowered === 'find_files' || lowered.includes('search');
}

export function ChatToolCard({ card }: { card: ChatToolPartViewModel }) {
  if (isTerminalTool(card.toolName)) {
    return <TerminalExecutionView card={card} />;
  }
  if (isFileEditTool(card.toolName)) {
    return <FileOperationView card={card} />;
  }
  if (isSearchTool(card.toolName)) {
    return <SearchSnippetView card={card} />;
  }

  // Fallback minimalist card for read_url_content, multi_replace, etc.
  return <GenericToolCard card={card} />;
}


