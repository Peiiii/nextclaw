import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppManifestBundle } from "../manifest/app-manifest.types.js";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

export class UiServerService {
  constructor(private readonly bundle: AppManifestBundle) {}

  handle = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const requestPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const candidatePaths = [
      path.join(this.bundle.uiDirectoryPath, requestPath.slice(1)),
      path.join(this.bundle.assetsDirectoryPath, requestPath.slice(1)),
    ];

    for (const candidatePath of candidatePaths) {
      if (!(await this.isInsideAllowedDirectory(candidatePath))) {
        continue;
      }
      if (!(await this.exists(candidatePath))) {
        continue;
      }
      const content = await readFile(candidatePath);
      response.writeHead(200, {
        "content-type": this.resolveContentType(candidatePath),
      });
      response.end(content);
      return true;
    }

    response.writeHead(404, {
      "content-type": "text/plain; charset=utf-8",
    });
    response.end(`Not found: ${requestPath}`);
    return true;
  };

  private resolveContentType = (filePath: string): string => {
    const extension = path.extname(filePath).toLowerCase();
    return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
  };

  private exists = async (filePath: string): Promise<boolean> => {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  };

  private isInsideAllowedDirectory = async (candidatePath: string): Promise<boolean> => {
    const allowedDirectories = [this.bundle.uiDirectoryPath, this.bundle.assetsDirectoryPath];
    return allowedDirectories.some((directoryPath) => {
      const relative = path.relative(directoryPath, candidatePath);
      return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
  };
}
