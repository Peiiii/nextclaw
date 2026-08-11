export type AppScaffoldFile = {
  relativePath: string;
  content: string | Buffer;
};

export class AppTsHttpScaffoldTemplateService {
  buildFiles = (params: {
    appId: string;
    appName: string;
  }): AppScaffoldFile[] => {
    const { appId, appName } = params;
    return [
      {
        relativePath: "manifest.json",
        content: `${JSON.stringify(this.buildManifest(appId, appName), null, 2)}\n`,
      },
      {
        relativePath: "marketplace.json",
        content: `${JSON.stringify(this.buildMarketplaceMetadata(appName), null, 2)}\n`,
      },
      {
        relativePath: "README.md",
        content: this.buildReadme(appName, appId),
      },
      {
        relativePath: "main/package.json",
        content: `${JSON.stringify(this.buildMainPackageJson(appId), null, 2)}\n`,
      },
      {
        relativePath: "main/tsconfig.json",
        content: `${JSON.stringify(this.buildTsconfig(), null, 2)}\n`,
      },
      {
        relativePath: "main/rolldown.config.mjs",
        content: this.buildRolldownConfig(),
      },
      {
        relativePath: "main/wit/world.wit",
        content: this.buildWitWorld(),
      },
      {
        relativePath: "main/src/component.ts",
        content: this.buildComponentSource(),
      },
      {
        relativePath: "main/app.wasm",
        content: Buffer.from(APP_WASM_PLACEHOLDER_BASE64, "base64"),
      },
      {
        relativePath: "ui/index.html",
        content: this.buildUiHtml(appName),
      },
      {
        relativePath: "ui/app.js",
        content: this.buildUiScript(),
      },
      {
        relativePath: "assets/icon.svg",
        content: this.buildIconSvg(),
      },
    ];
  };

  private buildManifest = (appId: string, appName: string) => {
    return {
      schemaVersion: 1,
      id: appId,
      name: appName,
      version: "0.1.0",
      description: "A TypeScript WASI HTTP NApp scaffold created by napp.",
      icon: "assets/icon.svg",
      main: {
        kind: "wasi-http-component",
        entry: "main/app.wasm",
      },
      ui: {
        entry: "ui/index.html",
      },
    };
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
        hono: "^4.10.0",
      },
      devDependencies: {
        "@bytecodealliance/componentize-js": "^0.20.0",
        "@bytecodealliance/jco": "^1.19.0",
        rolldown: "^1.0.0-rc.17",
        typescript: "^5.6.3",
      },
    };
  };

  private buildTsconfig = () => {
    return {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        skipLibCheck: true,
        lib: ["ES2022", "DOM"],
        types: ["./generated/types/interfaces/wasi-filesystem-preopens", "./generated/types/interfaces/wasi-filesystem-types"],
      },
      include: ["src/**/*.ts"],
    };
  };

  private buildMarketplaceMetadata = (appName: string) => {
    return {
      slug: this.normalizeSlug(appName),
      summary: `A TypeScript WASI HTTP ${appName} scaffold created by napp.`,
      summaryI18n: {
        en: `A TypeScript WASI HTTP ${appName} scaffold created by napp.`,
        zh: `一个由 napp 创建的 TypeScript WASI HTTP ${appName} 应用骨架。`,
      },
      description: `A TypeScript NApp scaffold for ${appName}, designed for ordinary frontend-to-backend HTTP development on WASI components.`,
      descriptionI18n: {
        en: `A TypeScript NApp scaffold for ${appName}, designed for ordinary frontend-to-backend HTTP development on WASI components.`,
        zh: `一个面向 ${appName} 的 TypeScript NApp 应用骨架，用 WASI component 承载普通前后端 HTTP 开发心智。`,
      },
      author: "NextClaw",
      tags: ["starter", "typescript", "wasi-http", "official"],
      sourceRepo: "https://github.com/Peiiii/nextclaw",
      homepage: "https://nextclaw.io",
      featured: false,
    };
  };

  private buildReadme = (appName: string, appId: string): string => {
    return `# ${appName}

This app was created by \`napp create --template ts-http\`.

It keeps the existing NApp directory contract, while making \`main/app.wasm\` a WASI HTTP component.

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

The build uses the official Bytecode Alliance toolchain and expects \`wkg\` to be available for fetching WIT dependencies:

\`\`\`bash
cargo install wkg
\`\`\`

## Local workflow

\`\`\`bash
napp inspect .
napp run . --data ./data
\`\`\`

The runtime mounts the host data directory to guest \`/data\`. This example stores todos in:

\`\`\`text
./data/todos.json
\`\`\`

The frontend can call the backend as ordinary same-origin HTTP:

\`\`\`js
await fetch("/api/todos");
\`\`\`
`;
  };

  private buildRolldownConfig = (): string => {
    return `export default {
  input: "src/component.ts",
  output: {
    file: "dist/component.js",
    format: "esm"
  },
  external: [/^wasi:/]
};
`;
  };

  private buildWitWorld = (): string => {
    return `package nextclaw:napp;

world napp-http {
  import wasi:filesystem/types@0.2.2;
  import wasi:filesystem/preopens@0.2.2;

  export wasi:http/incoming-handler@0.2.6;
}
`;
  };

  private buildComponentSource = (): string => {
    return `import { Hono } from "hono";
import { fire } from "@bytecodealliance/jco-std/wasi/0.2.6/http/adapters/hono/server";
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
const app = new Hono();

app.get("/api/todos", (context) => {
  return context.json(loadTodos());
});

app.post("/api/todos", async (context) => {
  const input = await context.req.json<TodoInput>();
  if (!input.title?.trim()) {
    return context.json({ error: "title is required" }, 400);
  }

  const todos = loadTodos();
  todos.push({
    id: crypto.randomUUID(),
    title: input.title.trim(),
    completed: false,
  });
  saveTodos(todos);
  return context.json(todos);
});

app.patch("/api/todos/:id", async (context) => {
  const input = await context.req.json<Partial<Todo>>();
  const todos = loadTodos();
  const todo = todos.find((entry) => entry.id === context.req.param("id"));
  if (!todo) {
    return context.json({ error: "todo not found" }, 404);
  }

  if (typeof input.title === "string") {
    todo.title = input.title;
  }
  if (typeof input.completed === "boolean") {
    todo.completed = input.completed;
  }
  saveTodos(todos);
  return context.json(todos);
});

app.delete("/api/todos/:id", (context) => {
  const nextTodos = loadTodos().filter((entry) => entry.id !== context.req.param("id"));
  saveTodos(nextTodos);
  return context.json(nextTodos);
});

app.notFound((context) => context.text("Not found", 404));

fire(app);

export { incomingHandler } from "@bytecodealliance/jco-std/wasi/0.2.6/http/adapters/hono/server";

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
        background: linear-gradient(135deg, #f4efe6 0%, #eff6f9 50%, #f8fafc 100%);
        color: #13212f;
      }

      body {
        margin: 0;
        min-height: 100vh;
      }

      main {
        box-sizing: border-box;
        max-width: 720px;
        margin: 0 auto;
        padding: 48px 20px;
      }

      .panel {
        border: 1px solid rgba(19, 33, 47, 0.1);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 24px 70px rgba(19, 33, 47, 0.14);
        padding: 28px;
      }

      h1 {
        margin: 0 0 10px;
        font-size: clamp(32px, 7vw, 58px);
        letter-spacing: -0.06em;
      }

      form {
        display: flex;
        gap: 10px;
        margin: 24px 0;
      }

      input {
        flex: 1;
        border: 1px solid rgba(19, 33, 47, 0.18);
        border-radius: 999px;
        padding: 12px 14px;
        font-size: 15px;
      }

      button {
        border: 0;
        border-radius: 999px;
        background: #13212f;
        color: white;
        padding: 12px 18px;
        cursor: pointer;
      }

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid rgba(19, 33, 47, 0.1);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <p>TypeScript WASI HTTP NApp</p>
        <h1>${appName}</h1>
        <form id="todo-form">
          <input id="todo-title" type="text" placeholder="Add a todo" />
          <button type="submit">Add</button>
        </form>
        <ul id="todos"></ul>
      </section>
    </main>
    <script type="module" src="./app.js"></script>
  </body>
</html>
`;
  };

  private buildUiScript = (): string => {
    return `const form = document.getElementById("todo-form");
const input = document.getElementById("todo-title");
const list = document.getElementById("todos");

async function loadTodos() {
  const response = await fetch("/api/todos");
  render(await response.json());
}

async function addTodo(title) {
  const response = await fetch("/api/todos", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ title })
  });
  render(await response.json());
}

async function toggleTodo(todo) {
  const response = await fetch(\`/api/todos/\${todo.id}\`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ completed: !todo.completed })
  });
  render(await response.json());
}

function render(todos) {
  list.replaceChildren(
    ...todos.map((todo) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = todo.completed ? \`✓ \${todo.title}\` : todo.title;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = todo.completed ? "Reopen" : "Done";
      button.addEventListener("click", () => {
        void toggleTodo(todo);
      });
      item.append(label, button);
      return item;
    })
  );
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) {
    return;
  }
  input.value = "";
  void addTodo(title);
});

void loadTodos();
`;
  };

  private buildIconSvg = (): string => {
    return `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="160" height="160" rx="38" fill="#13212F" />
  <path d="M44 49H116V63H44V49Z" fill="#F2C879" />
  <path d="M44 76H116V90H44V76Z" fill="#F7F4EC" />
  <path d="M44 103H92V117H44V103Z" fill="#8FD3C7" />
</svg>
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

const APP_WASM_PLACEHOLDER_BASE64 =
  "AGFzbQEAAAABBwFgAn9/AX8DAgEABxMBD3N1bW1hcml6ZV9ub3RlcwAACg0BCwAgACABakHIAWoL";
