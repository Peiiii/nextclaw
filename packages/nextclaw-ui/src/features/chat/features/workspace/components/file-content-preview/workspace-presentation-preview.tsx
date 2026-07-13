import { useEffect, useRef, useState } from "react";
import { useWorkspaceFileBuffer } from "./use-workspace-file-buffer";
import { WorkspaceDocumentPreviewState } from "./workspace-document-preview-state";

export function WorkspacePresentationPreview({
  contentUrl,
}: {
  contentUrl: string;
}) {
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
    const abortController = new AbortController();
    let viewer: { destroy: () => void } | null = null;
    container.replaceChildren();
    void import("@aiden0z/pptx-renderer")
      .then(async ({ PptxViewer, RECOMMENDED_ZIP_LIMITS }) => {
        viewer = await PptxViewer.open(
          fileBuffer.data as ArrayBuffer,
          container,
          {
            renderMode: "list",
            fitMode: "contain",
            lazySlides: true,
            lazyMedia: true,
            pdfjs: false,
            scrollContainer: container,
            signal: abortController.signal,
            zipLimits: RECOMMENDED_ZIP_LIMITS,
            listOptions: {
              windowed: true,
              batchSize: 8,
              initialSlides: 4,
              overscanViewport: 1.5,
            },
          },
        );
        if (abortController.signal.aborted) {
          viewer.destroy();
          viewer = null;
          return;
        }
        setRenderState({ contentUrl, status: "ready" });
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          console.error("Failed to render presentation preview", error);
          setRenderState({ contentUrl, status: "error" });
        }
      });

    return () => {
      abortController.abort();
      viewer?.destroy();
      container.replaceChildren();
    };
  }, [contentUrl, fileBuffer.data]);

  return (
    <div className="relative h-full bg-muted/40">
      <WorkspaceDocumentPreviewState status={status} />
      <div
        ref={containerRef}
        className="h-full overflow-auto p-4 custom-scrollbar"
        data-testid="workspace-content-presentation"
      />
    </div>
  );
}
