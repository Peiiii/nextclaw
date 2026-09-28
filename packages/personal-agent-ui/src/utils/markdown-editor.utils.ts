import { EditorSelection, type EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

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
