import { Bold, Italic, List, Search, Undo2, Redo2, Plus, GripVertical, Type } from "lucide-react";
import { IconButton } from "../icon-button";
import { ActionMenu, ActionMenuItem } from "../overlays/action-menu";
import { markdownCommandItems, markdownCommands } from "../../configs/markdown-commands.config";
import type { MarkdownEditorManager } from "../../managers/markdown-editor.manager";
import type { MarkdownEditorLabels, MarkdownSelection } from "../../types/markdown-editor.types";

export function MarkdownEditorToolbar({ labels, selection, manager, onSearch, compact = false }: { labels: MarkdownEditorLabels; selection: MarkdownSelection; manager?: MarkdownEditorManager; onSearch: () => void; compact?: boolean }) {
  const text = labels.rich;
  const actions = markdownCommandItems(labels).filter(item => compact || !["paragraph", "h1", "h2", "h3"].includes(item.id));
  return <div className={`ui-markdown-editor-toolbar${compact ? " is-compact" : ""}`} role="toolbar" aria-label={labels.toolbar}>
    {!compact && <><IconButton label={text.commands} icon={<Plus />} onClick={() => void manager?.insertBlock()} />
    <IconButton className="ui-rich-block-shortcut" label={text.currentBlockActions} icon={<GripVertical />} onClick={() => manager?.blocks.openAtSelection()} /></>}
    {!compact && <><select aria-label={text.heading} value={selection.heading} onChange={(event) => manager?.heading(Number(event.target.value))}>
      <option value={0}>{text.paragraph}</option>
      {[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>{text.heading} {level}</option>)}
    </select>
    <IconButton label={labels.bold} icon={<Bold />} aria-pressed={selection.bold} onClick={() => manager?.run("bold")} />
    <IconButton className="ui-rich-italic-shortcut" label={labels.italic} icon={<Italic />} aria-pressed={selection.italic} onClick={() => manager?.run("italic")} />
    <IconButton className="ui-rich-list-shortcut" label={labels.list} icon={<List />} onClick={() => manager?.run("list")} />
    </>}
    <ActionMenu label={labels.more} transferringFocus trigger={compact ? <IconButton label={labels.more} icon={<Type />} /> : undefined}>
      {compact && <ActionMenuItem onSelect={() => void manager?.insertBlock()}><Plus size={16} />{text.commands}</ActionMenuItem>}
      {compact && <ActionMenuItem onSelect={() => manager?.run("bold")}><Bold size={16} />{labels.bold}</ActionMenuItem>}
      <ActionMenuItem onSelect={() => manager?.run("italic")}><Italic size={16} />{labels.italic}</ActionMenuItem>
      <ActionMenuItem onSelect={() => manager?.run("code")}>{labels.code}</ActionMenuItem>
      {actions.map(item => { const Icon = markdownCommands.find(command => command.id === item.id)!.icon; return <ActionMenuItem key={item.id} onSelect={() => manager?.insertCommand(item.id)}><Icon size={16} />{item.label}</ActionMenuItem>; })}
      {compact && [4, 5, 6].map(level => <ActionMenuItem key={level} onSelect={() => manager?.heading(level)}>{text.heading} {level}</ActionMenuItem>)}
      <ActionMenuItem onSelect={() => manager?.run("strike")}>{text.strike}</ActionMenuItem>
      <ActionMenuItem onSelect={() => manager?.run("underline")}>{text.underline}</ActionMenuItem>
      <ActionMenuItem onSelect={() => manager?.run("highlight")}>{text.highlight}</ActionMenuItem>
      {selection.table && (["addRow", "addColumn", "deleteRow", "deleteColumn"] as const).map((action) => <ActionMenuItem key={action} onSelect={() => manager?.run(action)}>{text[action]}</ActionMenuItem>)}
      {selection.table && (["mergeCells", "splitCell"] as const).map(action => <ActionMenuItem key={action} disabled={!selection[action]} onSelect={() => manager?.run(action)}>{text[action]}</ActionMenuItem>)}
      <ActionMenuItem disabled={!selection.undo} onSelect={() => manager?.run("undo")}>{labels.undo}</ActionMenuItem>
      <ActionMenuItem disabled={!selection.redo} onSelect={() => manager?.run("redo")}>{labels.redo}</ActionMenuItem>
      {compact && <ActionMenuItem onSelect={onSearch}><Search size={16} />{labels.search}</ActionMenuItem>}
    </ActionMenu>
    {!compact && <><span className="ui-markdown-editor-toolbar-space" />
    <IconButton className="ui-rich-history" label={labels.undo} disabled={!selection.undo} icon={<Undo2 />} onClick={() => manager?.run("undo")} />
    <IconButton className="ui-rich-history" label={labels.redo} disabled={!selection.redo} icon={<Redo2 />} onClick={() => manager?.run("redo")} />
    <IconButton label={labels.search} icon={<Search />} onClick={onSearch} /></>}
  </div>;
}
