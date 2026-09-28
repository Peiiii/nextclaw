import { EditorSelection, type EditorState } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/** Presentation only: Markdown remains the lossless, editable document. */
function liveDecorations(view: EditorView): DecorationSet {
  const ranges: ReturnType<Decoration["range"]>[] = [];
  const active = (from: number, to: number) => view.state.selection.ranges.some((selection) =>
    view.state.doc.lineAt(selection.from).from <= to && view.state.doc.lineAt(selection.to).to >= from);
  for (const visible of view.visibleRanges) {
    syntaxTree(view.state).iterate({ from: visible.from, to: visible.to, enter: (node) => {
      const { name, from, to } = node;
      const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name);
      if (heading) ranges.push(Decoration.line({ class: `cm-md-heading cm-md-h${heading[1]}` }).range(view.state.doc.lineAt(from).from));
      const className = ({ StrongEmphasis: "cm-md-strong", Emphasis: "cm-md-em", Strikethrough: "cm-md-strike", InlineCode: "cm-md-code", Link: "cm-md-link" } as Record<string, string>)[name];
      if (className && to > from) ranges.push(Decoration.mark({ class: className }).range(from, to));
      if (name === "Blockquote" || name === "FencedCode") {
        for (let line = view.state.doc.lineAt(Math.max(from, visible.from)); line.from < Math.min(to, visible.to);) {
          ranges.push(Decoration.line({ class: name === "Blockquote" ? "cm-md-quote" : "cm-md-code-line" }).range(line.from));
          if (line.to >= view.state.doc.length) break;
          line = view.state.doc.lineAt(line.to + 1);
        }
      }
      // Never hide markup on a selected line; selections and IME retain native text semantics.
      if (!view.composing && !active(from, to) && /^(HeaderMark|EmphasisMark|StrikethroughMark|CodeMark)$/.test(name)) {
        if (!view.state.doc.sliceString(from, to).includes("\n")) ranges.push(Decoration.replace({}).range(from, to));
      }
    } });
  }
  return Decoration.set(ranges, true);
}

export const liveMarkdown = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = liveDecorations(view); }
  update = (update: ViewUpdate) => {
    if (update.docChanged || update.selectionSet || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) this.decorations = liveDecorations(update.view);
  };
}, { decorations: (plugin) => plugin.decorations });

export function wrapSelection(view: EditorView, marker: string): boolean {
  const changes = view.state.changeByRange((range) => {
    const text = view.state.sliceDoc(range.from, range.to);
    const wrapped = text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2;
    const insert = wrapped ? text.slice(marker.length, -marker.length) : `${marker}${text}${marker}`;
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.range(range.from + (wrapped ? 0 : marker.length), range.from + insert.length - (wrapped ? 0 : marker.length)) };
  });
  view.dispatch({ ...changes, scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

export function prefixLines(view: EditorView, prefix: string): boolean {
  const { from, to } = view.state.selection.main;
  const first = view.state.doc.lineAt(from);
  const last = view.state.doc.lineAt(to);
  const lines = view.state.sliceDoc(first.from, last.to).split("\n");
  const remove = lines.every((line) => line.startsWith(prefix));
  view.dispatch({ changes: { from: first.from, to: last.to, insert: lines.map((line) => remove ? line.slice(prefix.length) : prefix + line).join("\n") }, userEvent: "input" });
  view.focus();
  return true;
}

export function replaceExternalText(state: EditorState, value: string) {
  const previous = state.doc.toString();
  let from = 0;
  while (from < previous.length && from < value.length && previous[from] === value[from]) from++;
  let end = previous.length, nextEnd = value.length;
  while (end > from && nextEnd > from && previous[end - 1] === value[nextEnd - 1]) { end--; nextEnd--; }
  return { from, to: end, insert: value.slice(from, nextEnd) };
}
