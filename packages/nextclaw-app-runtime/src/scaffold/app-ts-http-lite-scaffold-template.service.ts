import type { AppScaffoldFile } from "./app-ts-http-scaffold-template.service.js";
import { AppTsHttpScaffoldTemplateService } from "./app-ts-http-scaffold-template.service.js";

export class AppTsHttpLiteScaffoldTemplateService {
  constructor(
    private readonly standardTemplateService: AppTsHttpScaffoldTemplateService = new AppTsHttpScaffoldTemplateService(),
  ) {}

  buildFiles = (params: {
    appId: string;
    appName: string;
  }): AppScaffoldFile[] => {
    const standardFiles = this.standardTemplateService.buildFiles(params);
    return standardFiles.map((file) => {
      switch (file.relativePath) {
        case "marketplace.json":
          return {
            relativePath: file.relativePath,
            content: `${JSON.stringify(this.buildMarketplaceMetadata(params.appName), null, 2)}\n`,
          };
        case "README.md":
          return {
            relativePath: file.relativePath,
            content: this.buildReadme(params.appName, params.appId),
          };
        case "main/package.json":
          return {
            relativePath: file.relativePath,
            content: `${JSON.stringify(this.buildMainPackageJson(params.appId), null, 2)}\n`,
          };
        case "main/src/component.ts":
          return {
            relativePath: file.relativePath,
            content: this.buildComponentSource(),
          };
        default:
          return file;
      }
    });
  };

  private buildMainPackageJson = (appId: string) => {
    return {
      name: `${appId.replace(/\./g, "-")}-main`,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        build: "npm run prepare-wit && npm run guest-types && npm run typecheck && npm run bundle && npm run componentize",
        "prepare-wit": "wkg wit fetch",
        "guest-types": "jco guest-types wit --world-name napp-http --out-dir generated/types",
        typecheck: "tsc --noEmit",
        bundle: "rolldown -c",
        componentize: "jco componentize -w wit -n napp-http -o app.wasm dist/component.js",
      },
      dependencies: {
        "@bytecodealliance/jco-std": "^0.1.3",
      },
      devDependencies: {
        "@bytecodealliance/componentize-js": "^0.20.0",
        "@bytecodealliance/jco": "^1.19.0",
        rolldown: "^1.0.0-rc.17",
        typescript: "^5.6.3",
      },
    };
  };

  private buildMarketplaceMetadata = (appName: string) => {
    return {
      slug: this.normalizeSlug(appName),
      summary: `A lightweight TypeScript WASI HTTP ${appName} scaffold created by napp.`,
      summaryI18n: {
        en: `A lightweight TypeScript WASI HTTP ${appName} scaffold created by napp.`,
        zh: `一个由 napp 创建的轻量 TypeScript WASI HTTP ${appName} 应用骨架。`,
      },
      description: `A lightweight TypeScript NApp scaffold for ${appName}, designed to keep the WASI HTTP backend smaller than the default Hono-based template.`,
      descriptionI18n: {
        en: `A lightweight TypeScript NApp scaffold for ${appName}, designed to keep the WASI HTTP backend smaller than the default Hono-based template.`,
        zh: `一个面向 ${appName} 的轻量 TypeScript NApp 应用骨架，用更薄的 WASI HTTP handler 替代默认的 Hono 模板，优先追求更小包体。`,
      },
      author: "NextClaw",
      tags: ["starter", "typescript", "wasi-http", "official", "lite"],
      sourceRepo: "https://github.com/Peiiii/nextclaw",
      homepage: "https://nextclaw.io",
      featured: false,
    };
  };

  private buildReadme = (appName: string, appId: string): string => {
    return `# ${appName}

This app was created by \`napp create --template ts-http-lite\`.

It keeps the existing NApp directory contract, while making \`main/app.wasm\` a lighter WASI HTTP component without the default Hono routing layer.

## App ID

\`${appId}\`

## Build the TypeScript backend

Recommended:

\`\`\`bash
napp build . --install
\`\`\`

Manual equivalent:

\`\`\`bash
cd main
npm install
npm run build
\`\`\`

The build writes the backend component to:

\`\`\`text
main/app.wasm
\`\`\`

## Local workflow

\`\`\`bash
napp inspect .
napp validate-publish .
napp run . --data ./data
\`\`\`

The runtime mounts the host data directory to guest \`/data\`. This example stores todos in:

\`\`\`text
./data/todos.json
\`\`\`

The frontend still uses ordinary same-origin HTTP:

\`\`\`js
await fetch("/api/todos");
\`\`\`
`;
  };

  private buildComponentSource = (): string => {
    return `import { fire, incomingHandler } from "@bytecodealliance/jco-std/wasi/0.2.6/http/adapters/hono/server";
import { getDirectories } from "wasi:filesystem/preopens@0.2.2";

type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

type TodoInput = {
  title?: string;
};

const TODOS_FILE = "todos.json";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const app = {
  fetch: (request: Request): Promise<Response> => routeRequest(request),
};

fire(app as never);

export { incomingHandler };

async function routeRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === "GET" && pathname === "/api/todos") {
    return json(loadTodos());
  }

  if (request.method === "POST" && pathname === "/api/todos") {
    const input = await request.json() as TodoInput;
    if (!input.title?.trim()) {
      return json({ error: "title is required" }, 400);
    }
    const todos = loadTodos();
    todos.push({
      id: crypto.randomUUID(),
      title: input.title.trim(),
      completed: false,
    });
    saveTodos(todos);
    return json(todos);
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/todos/")) {
    const todoId = pathname.slice("/api/todos/".length);
    const input = await request.json() as Partial<Todo>;
    const todos = loadTodos();
    const todo = todos.find((entry) => entry.id === todoId);
    if (!todo) {
      return json({ error: "todo not found" }, 404);
    }
    if (typeof input.title === "string") {
      todo.title = input.title;
    }
    if (typeof input.completed === "boolean") {
      todo.completed = input.completed;
    }
    saveTodos(todos);
    return json(todos);
  }

  if (request.method === "DELETE" && pathname.startsWith("/api/todos/")) {
    const todoId = pathname.slice("/api/todos/".length);
    const nextTodos = loadTodos().filter((entry) => entry.id !== todoId);
    saveTodos(nextTodos);
    return json(nextTodos);
  }

  return text("Not found", 404);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function text(value: string, status = 200): Response {
  return new Response(value, { status });
}

function loadTodos(): Todo[] {
  const file = openTodosFile({ read: true });
  if (!file) {
    return [];
  }
  const [bytes] = file.read(BigInt(1024 * 1024), BigInt(0));
  if (bytes.length === 0) {
    return [];
  }
  return JSON.parse(decoder.decode(bytes)) as Todo[];
}

function saveTodos(todos: Todo[]): void {
  const file = getDataDirectory().openAt(
    { symlinkFollow: true },
    TODOS_FILE,
    { create: true, truncate: true },
    { write: true },
  );
  file.write(encoder.encode(JSON.stringify(todos, null, 2)), BigInt(0));
}

function openTodosFile(flags: { read?: boolean; write?: boolean }) {
  try {
    return getDataDirectory().openAt({ symlinkFollow: true }, TODOS_FILE, {}, flags);
  } catch {
    return undefined;
  }
}

function getDataDirectory() {
  for (const [descriptor, guestPath] of getDirectories()) {
    if (guestPath === "/data") {
      return descriptor;
    }
  }
  throw new Error("Missing /data preopen. NApp runtime must mount the app data directory at /data.");
}
`;
  };

  private normalizeSlug = (value: string): string => {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };
}
