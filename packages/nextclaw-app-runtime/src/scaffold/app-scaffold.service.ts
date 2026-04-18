import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type AppScaffoldResult = {
  appDirectory: string;
  manifestPath: string;
};

export class AppScaffoldService {
  scaffold = async (targetDirectory: string): Promise<AppScaffoldResult> => {
    const appDirectory = path.resolve(targetDirectory);
    await this.assertTargetDoesNotExist(appDirectory);
    await mkdir(path.join(appDirectory, "main"), { recursive: true });
    await mkdir(path.join(appDirectory, "ui"), { recursive: true });
    await mkdir(path.join(appDirectory, "assets"), { recursive: true });

    const appName = this.buildAppName(appDirectory);
    const appId = this.buildAppId(appDirectory);
    const manifestPath = path.join(appDirectory, "manifest.json");

    await Promise.all([
      writeFile(
        manifestPath,
        `${JSON.stringify(this.buildManifest(appId, appName), null, 2)}\n`,
        "utf-8",
      ),
      writeFile(
        path.join(appDirectory, "main", "app.wasm"),
        Buffer.from(APP_WASM_BASE64, "base64"),
      ),
      writeFile(path.join(appDirectory, "main", "app.wat"), this.buildWatSource(), "utf-8"),
      writeFile(path.join(appDirectory, "ui", "index.html"), this.buildUiHtml(appName), "utf-8"),
      writeFile(
        path.join(appDirectory, "ui", "app.controller.js"),
        this.buildUiController(),
        "utf-8",
      ),
      writeFile(path.join(appDirectory, "assets", "icon.svg"), this.buildIconSvg(), "utf-8"),
    ]);

    return {
      appDirectory,
      manifestPath,
    };
  };

  private assertTargetDoesNotExist = async (targetDirectory: string): Promise<void> => {
    try {
      await access(targetDirectory);
    } catch {
      return;
    }
    throw new Error(`目标目录已存在：${targetDirectory}`);
  };

  private buildAppId = (targetDirectory: string): string => {
    const slug = this.normalizeSlug(path.basename(targetDirectory));
    return `nextclaw.${slug}`;
  };

  private buildAppName = (targetDirectory: string): string => {
    const parts = this.normalizeSlug(path.basename(targetDirectory)).split("-");
    return parts.map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
  };

  private normalizeSlug = (value: string): string => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!normalized) {
      throw new Error("应用目录名无法生成合法的应用标识。");
    }
    return normalized;
  };

  private buildManifest = (appId: string, appName: string) => {
    return {
      schemaVersion: 1,
      id: appId,
      name: appName,
      version: "0.1.0",
      description: "A minimal NextClaw micro app scaffold created by napp.",
      icon: "assets/icon.svg",
      main: {
        kind: "wasm",
        entry: "main/app.wasm",
        export: "summarize_notes",
        action: "runStarterDemo",
      },
      ui: {
        entry: "ui/index.html",
      },
      permissions: {
        storage: {
          namespace: appId.replace(/\./g, "-"),
        },
        capabilities: {
          hostBridge: true,
        },
      },
    };
  };

  private buildWatSource = (): string => {
    return `(module
  (func (export "summarize_notes") (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.add
    i32.const 200
    i32.add))\n`;
  };

  private buildUiHtml = (appName: string): string => {
    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${appName}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Sans", "Helvetica Neue", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(255, 206, 134, 0.24), transparent 30%),
          linear-gradient(165deg, #f7f1e7 0%, #fcfcfe 48%, #e1ebf5 100%);
        color: #11233a;
      }

      body {
        margin: 0;
        min-height: 100vh;
      }

      main {
        box-sizing: border-box;
        max-width: 760px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }

      .panel {
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(17, 35, 58, 0.08);
        border-radius: 24px;
        box-shadow: 0 18px 42px rgba(17, 35, 58, 0.12);
        padding: 28px;
        backdrop-filter: blur(18px);
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(30px, 6vw, 54px);
        line-height: 1;
      }

      p {
        line-height: 1.6;
      }

      button {
        border: 0;
        border-radius: 999px;
        background: #11233a;
        color: #fff;
        padding: 12px 18px;
        font-size: 15px;
        cursor: pointer;
      }

      dl {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin: 24px 0 0;
      }

      dt {
        font-size: 12px;
        color: #556881;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      dd {
        margin: 6px 0 0;
        font-size: 24px;
        font-weight: 600;
      }

      pre {
        margin-top: 20px;
        padding: 14px;
        border-radius: 16px;
        background: rgba(17, 35, 58, 0.07);
        overflow: auto;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <p>NextClaw Micro App</p>
        <h1 id="title">Loading...</h1>
        <p id="description">A starter scaffold created by napp create.</p>
        <button id="run-button" type="button">Run Starter Demo</button>
        <dl>
          <div>
            <dt>Action</dt>
            <dd id="action">-</dd>
          </div>
          <div>
            <dt>Documents</dt>
            <dd id="document-count">-</dd>
          </div>
          <div>
            <dt>Text Bytes</dt>
            <dd id="text-bytes">-</dd>
          </div>
          <div>
            <dt>Wasm Score</dt>
            <dd id="wasm-score">-</dd>
          </div>
        </dl>
        <pre id="details"></pre>
      </section>
    </main>
    <script type="module" src="./app.controller.js"></script>
  </body>
</html>
`;
  };

  private buildUiController = (): string => {
    return `const titleNode = document.getElementById("title");
const descriptionNode = document.getElementById("description");
const actionNode = document.getElementById("action");
const documentCountNode = document.getElementById("document-count");
const textBytesNode = document.getElementById("text-bytes");
const wasmScoreNode = document.getElementById("wasm-score");
const detailsNode = document.getElementById("details");
const runButton = document.getElementById("run-button");

const setDetails = (value) => {
  detailsNode.textContent = JSON.stringify(value, null, 2);
};

const loadManifest = async () => {
  const response = await fetch("/__napp/manifest");
  const payload = await response.json();
  titleNode.textContent = payload.manifest.name;
  descriptionNode.textContent = payload.manifest.description;
  actionNode.textContent = payload.manifest.main.action;
  setDetails(payload);
};

const runDemo = async () => {
  runButton.disabled = true;
  try {
    const response = await fetch("/__napp/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: actionNode.textContent,
      }),
    });
    const payload = await response.json();
    documentCountNode.textContent = String(payload.result.input.documentCount);
    textBytesNode.textContent = String(payload.result.input.textBytes);
    wasmScoreNode.textContent = String(payload.result.output.output);
    setDetails(payload);
  } finally {
    runButton.disabled = false;
  }
};

runButton.addEventListener("click", () => {
  void runDemo();
});

await loadManifest();
`;
  };

  private buildIconSvg = (): string => {
    return `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="160" height="160" rx="40" fill="#11233A" />
  <path d="M42 45H118V58H74V115H58V58H42V45Z" fill="#F8C97E" />
  <path d="M92 74H118V87H92V74Z" fill="#FFFFFF" fill-opacity="0.92" />
  <path d="M92 95H118V108H92V95Z" fill="#FFFFFF" fill-opacity="0.72" />
</svg>
`;
  };
}

const APP_WASM_BASE64 =
  "AGFzbQEAAAABBwFgAn9/AX8DAgEABxMBD3N1bW1hcml6ZV9ub3RlcwAACg0BCwAgACABakHIAWoL";
