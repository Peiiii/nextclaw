import { useEffect, useRef, useState } from "react";
import { useWorkspaceFileBuffer } from "./use-workspace-file-buffer";
import { WorkspaceDocumentPreviewState } from "./workspace-document-preview-state";
import "./workspace-docx-preview.css";

function applyResponsiveDocxFallback(container: HTMLDivElement): void {
  const pages = Array.from(
    container.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx"),
  );
  const needsFallback = pages.some(
    (page) => !page.style.width && !page.style.padding,
  );
  container.classList.toggle("workspace-docx-preview--reflow", needsFallback);
  if (!needsFallback) {
    return;
  }
  for (const table of container.querySelectorAll<HTMLTableElement>("table")) {
    if (table.querySelectorAll("col").length < 5) {
      continue;
    }
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "workspace-docx-wide-table";
    table.before(scrollContainer);
    scrollContainer.append(table);
  }
}

export function WorkspaceDocxPreview({ contentUrl }: { contentUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileBuffer = useWorkspaceFileBuffer(contentUrl);
  const [renderState, setRenderState] = useState<{
    contentUrl: string;
    status: "ready" | "error";
  } | null>(null);
  const renderStatus =
    renderState?.contentUrl === contentUrl ? renderState.status : "loading";
  const status =
    fileBuffer.status === "ready" ? renderStatus : fileBuffer.status;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !fileBuffer.data) {
      return undefined;
    }
    let disposed = false;
    container.replaceChildren();
    void import("docx-preview")
      .then(async (docxPreview) => {
        await docxPreview.renderAsync(
          fileBuffer.data as ArrayBuffer,
          container,
          container,
          {
            breakPages: true,
            inWrapper: true,
            ignoreLastRenderedPageBreak: false,
          },
        );
        if (!disposed) {
          applyResponsiveDocxFallback(container);
          setRenderState({ contentUrl, status: "ready" });
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          console.error("Failed to render DOCX preview", error);
          setRenderState({ contentUrl, status: "error" });
        }
      });

    return () => {
      disposed = true;
      container.replaceChildren();
    };
  }, [contentUrl, fileBuffer.data]);

  return (
    <div className="relative h-full overflow-auto bg-muted/40 p-4 custom-scrollbar">
      <WorkspaceDocumentPreviewState status={status} />
      <div
        ref={containerRef}
        className="workspace-docx-preview min-h-full"
        data-testid="workspace-content-docx"
      />
    </div>
  );
}
