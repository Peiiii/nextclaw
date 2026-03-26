import { readFile } from "node:fs/promises";
import type { Context } from "hono";
import type { UiNcpAttachmentUploadView, UiNcpAttachmentView } from "../types.js";
import { err, ok } from "./response.js";
import type { UiRouterOptions } from "./types.js";

const ATTACHMENT_CONTENT_BASE_PATH = "/api/ncp/attachments/content";

function buildAttachmentContentUrl(attachmentUri: string): string {
  const query = new URLSearchParams({ uri: attachmentUri });
  return `${ATTACHMENT_CONTENT_BASE_PATH}?${query.toString()}`;
}

function encodeContentDispositionFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(/\*/g, "%2A");
}

function toAttachmentView(record: {
  id: string;
  uri: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): UiNcpAttachmentView {
  return {
    id: record.id,
    name: record.originalName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    attachmentUri: record.uri,
    url: buildAttachmentContentUrl(record.uri),
  };
}

export class NcpAttachmentRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  readonly uploadAttachments = async (c: Context) => {
    const attachmentApi = this.options.ncpAgent?.attachmentApi;
    if (!attachmentApi) {
      return c.json(err("NOT_AVAILABLE", "ncp attachment api unavailable"), 503);
    }

    let formData: FormData;
    try {
      formData = await c.req.raw.formData();
    } catch {
      return c.json(err("INVALID_BODY", "invalid multipart body"), 400);
    }

    const files = Array.from(formData.values()).reduce<
      Array<{
        name: string;
        type: string;
        arrayBuffer: () => Promise<ArrayBuffer>;
      }>
    >((result, value) => {
      if (typeof value !== "string") {
        result.push(value as {
          name: string;
          type: string;
          arrayBuffer: () => Promise<ArrayBuffer>;
        });
      }
      return result;
    }, []);
    if (files.length === 0) {
      return c.json(err("INVALID_BODY", "no files provided"), 400);
    }

    const attachments: UiNcpAttachmentView[] = [];
    for (const file of files) {
      const record = await attachmentApi.saveAttachment({
        fileName: file.name,
        mimeType: file.type || null,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      attachments.push(toAttachmentView(record));
    }

    const payload: UiNcpAttachmentUploadView = { attachments };
    return c.json(ok(payload));
  };

  readonly getAttachmentContent = async (c: Context): Promise<Response> => {
    const attachmentApi = this.options.ncpAgent?.attachmentApi;
    if (!attachmentApi) {
      return c.json(err("NOT_AVAILABLE", "ncp attachment api unavailable"), 503);
    }

    const uri = c.req.query("uri")?.trim();
    if (!uri) {
      return c.json(err("INVALID_URI", "attachment uri is required"), 400);
    }

    const record = await attachmentApi.statAttachment(uri);
    const contentPath = attachmentApi.resolveContentPath(uri);
    if (!record || !contentPath) {
      return c.json(err("NOT_FOUND", `attachment not found: ${uri}`), 404);
    }

    const body = await readFile(contentPath);
    return new Response(body, {
      headers: {
        "content-length": String(body.byteLength),
        "content-type": record.mimeType || "application/octet-stream",
        "content-disposition": `inline; filename*=UTF-8''${encodeContentDispositionFileName(record.originalName)}`,
      },
    });
  };
}
