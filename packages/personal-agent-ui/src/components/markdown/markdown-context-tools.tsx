import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Type, Code2, Plus, GripVertical, Copy, Trash2, Pencil, ArrowUpToLine, ArrowDownToLine, Bold, Italic, Strikethrough, Underline, Highlighter, Code, Link, RemoveFormatting } from "lucide-react";
import { markdownCommands } from "../../configs/markdown-commands.config";
import { AnchoredPopover, Popover } from "../overlays/popover";
import { IconButton } from "../icon-button";
import type { MarkdownBlockManager, MarkdownBlockState, MarkdownBlockAction, MarkdownBlockFormat } from "../../managers/markdown-block.manager";
import type { MarkdownEditorManager } from "../../managers/markdown-editor.manager";
import type { MarkdownEditorLabels, MarkdownSlashState, MarkdownSelection } from "../../types/markdown-editor.types";

const commandIcon = (id: string) => markdownCommands.find(item => item.id === id)!.icon;

export function MarkdownSelectionToolbar({ selection, labels, manager }: {
  selection: MarkdownSelection; labels: MarkdownEditorLabels; manager: MarkdownEditorManager;
}) {
  if (!selection.anchor) return null;
  const items = [
    { action: "bold", icon: Bold, label: labels.bold },
    { action: "italic", icon: Italic, label: labels.italic },
    { action: "underline", icon: Underline, label: labels.rich.underline },
    { action: "highlight", icon: Highlighter, label: labels.rich.highlight },
    { action: "strike", icon: Strikethrough, label: labels.rich.strike },
    { action: "code", icon: Code, label: labels.code },
    { action: "link", icon: Link, label: labels.rich.link },
    { action: "clearFormatting", icon: RemoveFormatting, label: labels.rich.clearFormatting },
  ] as const;
  return <AnchoredPopover anchor={selection.anchor} side="top" label={labels.rich.selectionTools}
    className="ui-markdown-selection-popover" passive onClose={manager.dismissSelectionTools}>
    <div role="toolbar" aria-label={labels.rich.selectionTools} onMouseDown={event => event.preventDefault()}>
      {items.map(({ action, icon: Icon, label }) => <IconButton key={action} label={label} icon={<Icon />}
        aria-pressed={action === "clearFormatting" ? undefined : selection[action]} onClick={() => manager.run(action)} />)}
    </div>
  </AnchoredPopover>;
}

function navigateBlockMenu(event: KeyboardEvent<HTMLDivElement>) {
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault(); event.stopPropagation();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    buttons[(index + delta + buttons.length) % buttons.length]?.focus();
  } else if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); buttons[0]?.click(); }
}

export function MarkdownSlashMenu({ state, labels, manager }: { state: MarkdownSlashState; labels: MarkdownEditorLabels; manager: MarkdownEditorManager }) {
  const active = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const option = active.current, container = list.current;
    if (!option || !container) return;
    const item = option.getBoundingClientRect(), viewport = container.getBoundingClientRect();
    if (item.top < viewport.top) container.scrollTop -= viewport.top - item.top;
    else if (item.bottom > viewport.bottom) container.scrollTop += item.bottom - viewport.bottom;
  }, [state.index]);
  return <AnchoredPopover anchor={state.anchor} label={labels.rich.commands} className="ui-markdown-command-popover" passive onClose={() => manager.closeSlash()}>
    <div className="ui-markdown-command-heading">{labels.rich.commands}</div>
    <div className="ui-markdown-command-list" ref={list} role="listbox" aria-label={labels.rich.commands}>
      {state.items.map((item, index) => {
        const Icon = commandIcon(item.id);
        return <Fragment key={item.id}>
          {(index === 0 || state.items[index - 1].group !== item.group) && <div role="presentation" className="ui-markdown-command-group">{labels.rich[item.group]}</div>}
          <button ref={index === state.index ? active : undefined} type="button" role="option"
          aria-label={item.label} aria-selected={index === state.index} onPointerMove={() => manager.highlightSlash(index)} onMouseDown={event => event.preventDefault()} onClick={() => manager.chooseSlash(index)}>
          <span className="ui-markdown-command-icon"><Icon size={18} /></span>
          <span><span className="ui-markdown-command-label">{item.label}</span><span className="ui-markdown-command-description">{labels.rich.commandDescriptions[item.id]}</span></span>
        </button></Fragment>;
      })}
      {!state.items.length && <p>{labels.rich.noResults}</p>}
    </div>
    <div className="ui-markdown-command-footer"><span>↑ ↓ {labels.rich.commandNavigate}</span><span>↵ {labels.rich.insert}</span><span>esc {labels.rich.close}</span></div>
  </AnchoredPopover>;
}

export function MarkdownBlockHandle({ state, labels, manager, onInsert }: { state: MarkdownBlockState; labels: MarkdownEditorLabels; manager: MarkdownBlockManager; onInsert: () => void }) {
  return <>
    {manager.element && createPortal(<>
      <IconButton className="ui-markdown-block-add" label={labels.rich.commands} icon={<Plus />} onMouseDown={event => event.stopPropagation()} onClick={onInsert} />
      <IconButton label={labels.rich.blockActions} icon={<GripVertical />} aria-expanded={state.open} aria-haspopup="menu" onClick={manager.open} onContextMenu={event => { event.preventDefault(); manager.open(); }} />
    </>, manager.element)}
    {state.open && <MarkdownBlockMenu state={state} labels={labels} manager={manager} />}
  </>;
}

function MarkdownBlockMenu({ state, labels, manager }: { state: MarkdownBlockState; labels: MarkdownEditorLabels; manager: MarkdownBlockManager }) {
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const text = labels.rich;
  const actions: { id: MarkdownBlockAction; label: string; icon: typeof Copy }[] = [
    ...(state.kind === "codeBlock" ? [{ id: "copy" as const, label: text.copyCode, icon: Code2 }] : []),
    ...(["image", "blockMath"].includes(state.kind) ? [{ id: "edit" as const, label: text.edit, icon: Pencil }] : []),
    { id: "duplicate", label: text.duplicateBlock, icon: Copy },
    { id: "before", label: text.insertBeforeBlock, icon: ArrowUpToLine },
    { id: "after", label: text.insertAfterBlock, icon: ArrowDownToLine },
    { id: "delete", label: text.deleteBlock, icon: Trash2 },
  ];
  const items = actions.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <AnchoredPopover anchor={state.anchor} side="left" label={text.blockActions} className="ui-markdown-block-menu" onClose={manager.close} onReturnFocus={manager.focus}>
    <div onKeyDown={navigateBlockMenu}>
      <input className="ui-markdown-block-search" aria-label={text.searchBlockActions} placeholder={text.searchBlockActions} value={query} onChange={event => setQuery(event.target.value)} />
      <div className="ui-markdown-block-kind">{text.blockNames[state.kind] ?? text.paragraph}</div>
      <div role="menu" aria-label={text.blockActions}>
        {state.convertible && (!query || text.turnInto.includes(query)) && <MarkdownBlockConversion labels={labels} manager={manager} />}
        {items.map(({ id, label, icon: Icon }) => <button type="button" role="menuitem" key={id} className={`ui-markdown-block-action${id === "delete" ? " is-delete" : ""}`} onClick={() => {
          void manager.perform(id).then(() => { if (id === "copy") setFeedback(text.confirm); }).catch(() => setFeedback(text.error));
        }}><Icon size={18} /><span>{label}</span>{id === "delete" && <kbd>Del</kbd>}</button>)}
        {!items.length && <p className="ui-markdown-block-kind">{text.noResults}</p>}
      </div>
      {feedback && <div role="status" className="ui-markdown-block-kind">{feedback}</div>}
    </div>
  </AnchoredPopover>;
}

function MarkdownBlockConversion({ labels, manager }: { labels: MarkdownEditorLabels; manager: MarkdownBlockManager }) {
  const [open, setOpen] = useState(false);
  const formats: MarkdownBlockFormat[] = ["paragraph", "h1", "h2", "h3", "list", "orderedList", "taskList", "quote", "callout", "toggle", "codeBlock"];
  const label = (format: MarkdownBlockFormat) => format.startsWith("h") ? `${labels.rich.heading} ${format.slice(1)}` : format === "list" ? labels.list : labels.rich[format as Exclude<MarkdownBlockFormat, "h1" | "h2" | "h3" | "list">];
  return <Popover open={open} onOpenChange={setOpen} side="right" label={labels.rich.turnInto} trigger={<button type="button" role="menuitem" className="ui-markdown-block-action" aria-haspopup="menu"><Type size={18} /><span>{labels.rich.turnInto}</span><span aria-hidden="true" className="ui-markdown-block-chevron">›</span></button>}>
    <div role="menu" aria-label={labels.rich.turnInto} className="ui-markdown-block-formats" onKeyDown={navigateBlockMenu}>
      {formats.map(format => { const Icon = commandIcon(format); return <button type="button" role="menuitem" className="ui-markdown-block-action" key={format} onClick={() => manager.convert(format)}><Icon size={18} />{label(format)}</button>; })}
    </div>
  </Popover>;
}
