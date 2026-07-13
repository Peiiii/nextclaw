import { useEffect, useState } from "react";
import { useWorkspaceFileBuffer } from "./use-workspace-file-buffer";
import { WorkspaceDocumentPreviewState } from "./workspace-document-preview-state";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const MAX_PREVIEW_ROWS = 500;
const MAX_PREVIEW_COLUMNS = 100;

type SpreadsheetSheet = {
  name: string;
  rows: string[][];
  columnCount: number;
  truncated: boolean;
};

type SpreadsheetState = {
  contentUrl: string;
  status: "ready" | "error";
  sheets: SpreadsheetSheet[];
};

function spreadsheetColumnLabel(index: number): string {
  let label = "";
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function WorkspaceSpreadsheetPreview({
  contentUrl,
}: {
  contentUrl: string;
}) {
  const fileBuffer = useWorkspaceFileBuffer(contentUrl);
  const [spreadsheetState, setSpreadsheetState] =
    useState<SpreadsheetState | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const currentState =
    spreadsheetState?.contentUrl === contentUrl ? spreadsheetState : null;
  const status =
    fileBuffer.status === "ready"
      ? (currentState?.status ?? "loading")
      : fileBuffer.status;
  const activeSheet =
    currentState?.sheets.find((sheet) => sheet.name === selectedSheetName) ??
    currentState?.sheets[0] ??
    null;

  useEffect(() => {
    if (!fileBuffer.data) {
      return undefined;
    }
    let disposed = false;
    void import("xlsx")
      .then((xlsx) => {
        const workbook = xlsx.read(fileBuffer.data as ArrayBuffer, {
          dense: true,
          sheetRows: MAX_PREVIEW_ROWS + 1,
        });
        const sheets = workbook.SheetNames.map((name) => {
          const worksheet = workbook.Sheets[name];
          const allRows = worksheet
            ? xlsx.utils.sheet_to_json<unknown[]>(worksheet, {
                header: 1,
                raw: false,
                defval: "",
                blankrows: false,
              })
            : [];
          const rows = allRows
            .slice(0, MAX_PREVIEW_ROWS)
            .map((row) =>
              row
                .slice(0, MAX_PREVIEW_COLUMNS)
                .map((cell) => String(cell ?? "")),
            );
          return {
            name,
            rows,
            columnCount: Math.min(
              MAX_PREVIEW_COLUMNS,
              rows.reduce((maximum, row) => Math.max(maximum, row.length), 0),
            ),
            truncated:
              allRows.length > MAX_PREVIEW_ROWS ||
              allRows.some((row) => row.length > MAX_PREVIEW_COLUMNS),
          };
        });
        if (!disposed) {
          setSpreadsheetState({ contentUrl, status: "ready", sheets });
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          console.error("Failed to render spreadsheet preview", error);
          setSpreadsheetState({ contentUrl, status: "error", sheets: [] });
        }
      });
    return () => {
      disposed = true;
    };
  }, [contentUrl, fileBuffer.data]);

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-white"
      data-testid="workspace-content-spreadsheet"
    >
      <WorkspaceDocumentPreviewState status={status} />
      {currentState && currentState.sheets.length > 1 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-1.5 custom-scrollbar">
          {currentState.sheets.map((sheet) => (
            <button
              key={sheet.name}
              type="button"
              className={cn(
                "h-7 shrink-0 rounded-md px-2.5 text-xs transition-colors",
                sheet.name === activeSheet?.name
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => setSelectedSheetName(sheet.name)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      ) : null}
      {activeSheet ? (
        <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-full border-collapse text-xs text-foreground">
            <thead className="sticky top-0 z-[1] bg-muted">
              <tr>
                <th className="sticky left-0 z-[2] h-7 min-w-10 border border-border bg-muted px-2" />
                {Array.from({ length: activeSheet.columnCount }, (_, index) => (
                  <th
                    key={index}
                    className="h-7 min-w-24 border border-border px-2 text-center font-medium text-muted-foreground"
                  >
                    {spreadsheetColumnLabel(index)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="sticky left-0 min-w-10 border border-border bg-muted px-2 text-right font-normal text-muted-foreground">
                    {rowIndex + 1}
                  </th>
                  {Array.from(
                    { length: activeSheet.columnCount },
                    (_, columnIndex) => (
                      <td
                        key={columnIndex}
                        className="max-w-80 whitespace-pre-wrap border border-border px-2 py-1.5 align-top"
                      >
                        {row[columnIndex] ?? ""}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {activeSheet?.truncated ? (
        <div className="shrink-0 border-t border-border bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
          {t("chatWorkspaceSpreadsheetPreviewTruncated")}
        </div>
      ) : null}
    </div>
  );
}
