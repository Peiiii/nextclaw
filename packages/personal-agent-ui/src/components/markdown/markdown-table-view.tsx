import { createRoot, type Root } from "react-dom/client";
import { TableView } from "@tiptap/extension-table";
import type { Node } from "@tiptap/pm/model";
import { TextSelection, type Command } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { addRowAfter, addRowBefore, addColumnAfter, addColumnBefore, deleteRow, deleteColumn, moveTableRow, moveTableColumn, selectedRect, setCellAttr, CellSelection, TableMap } from "@tiptap/pm/tables";
import { closeHistory } from "@tiptap/pm/history";
import { GripHorizontal, GripVertical, Plus, Trash2, TableProperties, AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "../button";
import { IconButton } from "../icon-button";
import { ActionMenu, ActionMenuItem } from "../overlays/action-menu";
import type { MarkdownEditorLabels } from "../../types/markdown-editor.types";

type Axis = "row" | "column";
type TableAction = "before" | "after" | "delete" | "header" | "left" | "center" | "right" | "moveBefore" | "moveAfter";
const toggleSelectedHeader: Command = (state, dispatch) => {
  if (!(state.selection instanceof CellSelection)) return false;
  const cells: { node: Node; position: number }[] = [];
  state.selection.forEachCell((node, position) => cells.push({ node, position }));
  const type = cells.every(cell => cell.node.type.name === "tableHeader") ? state.schema.nodes.tableCell : state.schema.nodes.tableHeader;
  const transaction = state.tr;
  cells.forEach(cell => transaction.setNodeMarkup(cell.position, type, cell.node.attrs));
  dispatch?.(transaction);
  return true;
};
function TableControls({ labels, cell, bounds, onAppend, onMenu, onAction }: {
  labels: MarkdownEditorLabels; cell: { x: number; y: number; width: number; height: number };
  bounds: Record<Axis, { before: boolean; after: boolean }>;
  onAppend: (axis: Axis) => void; onMenu: (axis: Axis, open: boolean) => void; onAction: (axis: Axis, action: TableAction) => void;
}) {
  const text = labels.rich;
  return <>
    <Button className="ui-table-add ui-table-add-row" tooltip={text.appendRow} aria-label={text.appendRow} onMouseDown={event => event.preventDefault()} onClick={() => onAppend("row")}><Plus size={12} /></Button>
    <Button className="ui-table-add ui-table-add-column" tooltip={text.appendColumn} aria-label={text.appendColumn} onMouseDown={event => event.preventDefault()} onClick={() => onAppend("column")}><Plus size={12} /></Button>
    {(["row", "column"] as const).map(axis => <div key={axis} className={`ui-table-handle ui-table-handle-${axis}`}
      style={axis === "row" ? { top: cell.y + cell.height / 2 - 9 } : { left: cell.x + cell.width / 2 - 9 }}>
      <ActionMenu label={axis === "row" ? text.rowActions : text.columnActions} transferringFocus onOpenChange={open => onMenu(axis, open)}
        trigger={<IconButton className="ui-table-grip" label={axis === "row" ? text.rowActions : text.columnActions} icon={axis === "row" ? <GripVertical /> : <GripHorizontal />} />}>
        <ActionMenuItem onSelect={() => onAction(axis, "before")}><Plus size={16} />{axis === "row" ? text.addRowBefore : text.addColumnBefore}</ActionMenuItem>
        <ActionMenuItem onSelect={() => onAction(axis, "after")}><Plus size={16} />{axis === "row" ? text.addRow : text.addColumn}</ActionMenuItem>
        <ActionMenuItem onSelect={() => onAction(axis, "header")}><TableProperties size={16} />{axis === "row" ? text.toggleHeaderRow : text.toggleHeaderColumn}</ActionMenuItem>
        <ActionMenuItem onSelect={() => onAction(axis, "left")}><AlignLeft size={16} />{text.alignLeft}</ActionMenuItem>
        <ActionMenuItem onSelect={() => onAction(axis, "center")}><AlignCenter size={16} />{text.alignCenter}</ActionMenuItem>
        <ActionMenuItem onSelect={() => onAction(axis, "right")}><AlignRight size={16} />{text.alignRight}</ActionMenuItem>
        <ActionMenuItem disabled={!bounds[axis].before} onSelect={() => onAction(axis, "moveBefore")}>{axis === "row" ? <ArrowUp size={16} /> : <ArrowLeft size={16} />}{axis === "row" ? text.moveRowUp : text.moveColumnLeft}</ActionMenuItem>
        <ActionMenuItem disabled={!bounds[axis].after} onSelect={() => onAction(axis, "moveAfter")}>{axis === "row" ? <ArrowDown size={16} /> : <ArrowRight size={16} />}{axis === "row" ? text.moveRowDown : text.moveColumnRight}</ActionMenuItem>
        <ActionMenuItem danger onSelect={() => onAction(axis, "delete")}><Trash2 size={16} />{axis === "row" ? text.deleteRow : text.deleteColumn}</ActionMenuItem>
      </ActionMenu>
    </div>)}
  </>;
}

/** Extend the kernel's table view; only non-editable controls belong to React. */
export function markdownTableView(labels: MarkdownEditorLabels): typeof TableView {
  return class DocumentTableView extends TableView {
    private readonly controls: HTMLDivElement;
    private readonly scroll: HTMLDivElement;
    private root?: Root;
    private cell?: HTMLTableCellElement;
    private closed = false;
    constructor(node: Node, minWidth: number, private readonly view: EditorView, attributes: Record<string, unknown> = {}) {
      super(node, minWidth, view, attributes);
      this.scroll = this.dom;
      this.dom = document.createElement("div"); this.dom.className = "ui-rich-table";
      this.controls = document.createElement("div"); this.controls.className = "ui-table-controls"; this.controls.contentEditable = "false";
      this.dom.append(this.scroll, this.controls);
      this.dom.addEventListener("pointermove", this.trackCell);
      this.dom.addEventListener("pointerdown", this.trackCell);
      this.dom.addEventListener("pointerenter", this.renderControls);
      this.dom.addEventListener("focusin", this.trackCell);
      this.scroll.addEventListener("scroll", this.renderControls);
      queueMicrotask(() => { if (!this.closed) { this.cell = this.table.rows[0]?.cells[0]; this.renderControls(); } });
    }
    private trackCell = (event: Event) => {
      const target = (event.target as Element).closest<HTMLTableCellElement>("td,th");
      if (target && this.table.contains(target) && target !== this.cell && !this.dom.dataset.menuOpen) { this.cell = target; this.renderControls(); }
    };
    private selectCell = (cell = this.cell) => {
      if (!cell?.isConnected) return false;
      const position = this.view.posAtDOM(cell, 0);
      this.view.dispatch(this.view.state.tr.setSelection(TextSelection.near(this.view.state.doc.resolve(position))));
      return true;
    }
    private command = (axis: Axis, action: TableAction) => {
      if (action === "moveBefore" || action === "moveAfter") {
        const rect = selectedRect(this.view.state), from = axis === "row" ? rect.top : rect.left;
        const to = from + (action === "moveBefore" ? -1 : 1), limit = axis === "row" ? rect.map.height : rect.map.width;
        if (to >= 0 && to < limit) (axis === "row" ? moveTableRow : moveTableColumn)({ from, to })(this.view.state, transaction => this.view.dispatch(closeHistory(transaction)), this.view);
        requestAnimationFrame(() => { if (!this.view.isDestroyed) this.view.focus(); });
        return;
      }
      if (["header", "left", "center", "right"].includes(action)) {
        const command = action === "header" ? toggleSelectedHeader : setCellAttr("align", action);
        command(this.view.state, transaction => this.view.dispatch(closeHistory(transaction)), this.view);
        requestAnimationFrame(() => { if (!this.view.isDestroyed) this.view.focus(); });
        return;
      }
      if (!this.selectCell()) return;
      const selection = this.view.state.selection.$from;
      let depth = selection.depth;
      while (depth > 0 && selection.node(depth).type.spec.tableRole !== "table") depth--;
      if (!depth) return;
      const start = selection.start(depth), map = TableMap.get(selection.node(depth));
      const cell = map.findCell(selection.before(depth + 2) - start);
      const row = cell.top + (axis === "row" && action === "after" ? cell.bottom - cell.top : 0);
      const column = cell.left + (axis === "column" && action === "after" ? cell.right - cell.left : 0);
      const commands: Record<Axis, Partial<Record<TableAction, Command>>> = { row: { before: addRowBefore, after: addRowAfter, delete: deleteRow }, column: { before: addColumnBefore, after: addColumnAfter, delete: deleteColumn } };
      commands[axis][action]!(this.view.state, transaction => {
        if (action !== "delete") {
          const table = transaction.doc.nodeAt(start - 1);
          if (table) {
            const next = TableMap.get(table);
            const position = start + next.positionAt(row, column, table);
            transaction.setSelection(TextSelection.near(transaction.doc.resolve(position + 1))).scrollIntoView();
          }
        }
        this.view.dispatch(transaction);
      }, this.view);
      requestAnimationFrame(() => {
        if (this.view.isDestroyed) return;
        this.view.focus();
        const dom = this.view.domAtPos(this.view.state.selection.from).node;
        const selected = (dom instanceof Element ? dom : dom.parentElement)?.closest<HTMLTableCellElement>("td,th");
        if (selected && this.table.contains(selected)) { this.cell = selected; this.renderControls(); }
      });
    }
    private renderControls = () => {
      if (this.closed || !this.cell?.isConnected) return;
      const box = this.dom.getBoundingClientRect(), rect = this.cell.getBoundingClientRect();
      const position = this.view.state.doc.resolve(this.view.posAtDOM(this.cell, 0) - 1);
      const map = TableMap.get(position.node(-1)), target = map.findCell(position.pos - position.start(-1));
      this.root ??= createRoot(this.controls);
      this.root.render(<TableControls labels={labels} cell={{ x: rect.x - box.x, y: rect.y - box.y, width: rect.width, height: rect.height }}
        bounds={{ row: { before: target.top > 0, after: target.bottom < map.height }, column: { before: target.left > 0, after: target.right < map.width } }}
        onAppend={axis => {
          const row = axis === "row" ? this.table.rows[this.table.rows.length - 1] : this.table.rows[0];
          const cell = axis === "row" ? row?.cells[0] : row?.cells[row.cells.length - 1];
          if (cell) { this.cell = cell; this.command(axis, "after"); }
        }}
        onMenu={(axis, open) => {
          if (open && this.selectCell()) {
            this.dom.dataset.menuOpen = axis;
            const cell = this.view.state.selection.$from.node(-1).type.spec.tableRole;
            if (cell === "cell" || cell === "header_cell") {
              const position = this.view.state.doc.resolve(this.view.state.selection.$from.before(-1));
              this.view.dispatch(this.view.state.tr.setSelection(axis === "row" ? CellSelection.rowSelection(position) : CellSelection.colSelection(position)));
            }
          } else { delete this.dom.dataset.menuOpen; }
        }} onAction={(axis, action) => this.command(axis, action)} />);
    };
    update = (node: Node) => {
      if (!super.update(node)) return false;
      queueMicrotask(() => { if (!this.closed) { if (!this.cell?.isConnected) this.cell = this.table.rows[0]?.cells[0]; this.renderControls(); } });
      return true;
    }
    stopEvent = (event: Event) => { return this.controls.contains(event.target as globalThis.Node); }
    destroy = () => { this.closed = true; const root = this.root; if (root) queueMicrotask(() => root.unmount()); }
  };
}
