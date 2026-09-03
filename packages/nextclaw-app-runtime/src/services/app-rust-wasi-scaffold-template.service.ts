import { readFileSync } from "node:fs";
import type { AppScaffoldFile } from "./app-ts-http-scaffold-template.service.js";

const RUST_WASI_GUEST_CRATE_NAME = "nextclaw-rust-wasi-guest";
const STANDARD_PORTABLE_WIT_FILES = [
  "deps/http@0.2.6/package.wit",
  "deps/http@0.2.6/handler.wit",
  "deps/http@0.2.6/types.wit",
  "deps/io@0.2.6/error.wit",
  "deps/io@0.2.6/poll.wit",
  "deps/io@0.2.6/streams.wit",
  "deps/io@0.2.6/world.wit",
  "deps/clocks@0.2.6/monotonic-clock.wit",
  "deps/clocks@0.2.6/timezone.wit",
  "deps/clocks@0.2.6/wall-clock.wit",
  "deps/clocks@0.2.6/world.wit",
  "deps/config@0.2.0-draft-2024-09-27/package.wit",
  "deps/config@0.2.0-draft-2024-09-27/store.wit",
  "deps/keyvalue@0.2.0-draft2/store.wit",
  "deps/spin@2.0.0/package.wit",
  "deps/spin@2.0.0/sqlite.wit",
] as const;

export class AppRustWasiScaffoldTemplateService {
  buildFiles = (params: { appId: string; appName: string }): AppScaffoldFile[] => {
    const { appId, appName } = params;
    const packageSlug = appId.replace(/[^a-z0-9]+/g, "-");
    const panelId = `${packageSlug}-panel`;
    const serviceId = `${packageSlug}-service`;
    return [
      {
        relativePath: "manifest.json",
        content: `${JSON.stringify(this.buildManifest(appId, appName, panelId, serviceId), null, 2)}\n`,
      },
      {
        relativePath: "marketplace.json",
        content: `${JSON.stringify(this.buildMarketplaceMetadata(appName), null, 2)}\n`,
      },
      { relativePath: "README.md", content: this.buildReadme(appName, serviceId) },
      {
        relativePath: `panels/${panelId}.panel/panel-app.json`,
        content: `${JSON.stringify(this.buildPanelManifest(panelId, appName, serviceId), null, 2)}\n`,
      },
      { relativePath: `panels/${panelId}.panel/index.html`, content: this.buildPanelHtml(appName) },
      { relativePath: `panels/${panelId}.panel/app.js`, content: this.buildPanelScript(serviceId) },
      {
        relativePath: `service-components/${serviceId}/service-app.json`,
        content: `${JSON.stringify(this.buildServiceManifest(serviceId), null, 2)}\n`,
      },
      { relativePath: "guest/Cargo.toml", content: this.buildCargoToml() },
      { relativePath: "guest/Cargo.lock", content: this.readResource("rust-wasi/Cargo.lock") },
      { relativePath: "guest/src/lib.rs", content: this.buildRustSource() },
      {
        relativePath: "guest/wit/portable-service.wit",
        content: this.readResource("wit/portable-service.wit"),
      },
      ...STANDARD_PORTABLE_WIT_FILES.map((relativePath) => ({
        relativePath: `guest/wit/${relativePath}`,
        content: this.readResource(`wit/${relativePath}`),
      })),
      {
        relativePath: "tests/service-smoke.json",
        content: `${JSON.stringify(this.buildServiceSmokeFixture(serviceId), null, 2)}\n`,
      },
      { relativePath: "assets/icon.svg", content: this.buildIconSvg() },
    ];
  };

  private readResource = (relativePath: string): string => readFileSync(
    new URL(`../../resources/${relativePath}`, import.meta.url),
    "utf8",
  );

  private buildManifest = (
    appId: string,
    appName: string,
    panelId: string,
    serviceId: string,
  ) => ({
    schemaVersion: 2,
    id: appId,
    name: appName,
    version: "0.1.0",
    description: `${appName}，由 Rust/WASI Component 保存持久计数。`,
    icon: "assets/icon.svg",
    engines: { nextclaw: ">=0.45.4" },
    presentation: { primaryPanel: panelId },
    runtime: { profile: "wasi" },
    distribution: { mode: "universal" },
    storage: { scope: "global", schemaVersion: 1 },
    permissions: { storage: { namespace: appId.replace(/\./g, "-") } },
    components: [
      { kind: "panel", path: `panels/${panelId}.panel` },
      { kind: "service", path: `service-components/${serviceId}` },
    ],
  });

  private buildPanelManifest = (panelId: string, appName: string, serviceId: string) => ({
    id: panelId,
    title: appName,
    description: "读取并增加由 Rust/WASI Component 持久保存的计数。",
    icon: "🦀",
    entry: "index.html",
    actions: [`${serviceId}.counter_read`, `${serviceId}.counter_increment`],
  });

  private buildServiceManifest = (serviceId: string) => ({
    id: serviceId,
    title: "Rust/WASI 持久计数组件",
    description: "通过标准 WASI key-value 读取和增加持久计数。",
    protocol: "wasi-component",
    component: { entry: "service.wasm" },
    actions: {
      counter_read: { risk: "read", title: "读取持久计数" },
      counter_increment: {
        risk: "write",
        title: "增加持久计数",
        inputSchema: {
          type: "object",
          properties: { step: { type: "integer", minimum: 1, maximum: 100 } },
          additionalProperties: false,
        },
      },
    },
  });

  private buildServiceSmokeFixture = (serviceId: string) => ({
    schemaVersion: 1,
    component: serviceId,
    resetData: true,
    steps: [
      {
        action: "counter_increment",
        input: { step: 3 },
        expect: { counter: 3, persistedBy: "wasi:keyvalue/store" },
      },
      {
        action: "counter_read",
        input: {},
        expect: { counter: 3, persistedBy: "wasi:keyvalue/store" },
      },
    ],
  });

  private buildCargoToml = (): string => `[package]
name = "${RUST_WASI_GUEST_CRATE_NAME}"
version = "0.1.0"
edition = "2024"
publish = false

[dependencies]
serde_json = "1.0"
wit-bindgen = "0.44.0"

[lib]
crate-type = ["cdylib"]

[package.metadata.component]
package = "nextclaw:portable-service"

[package.metadata.component.target]
path = "wit"
world = "service-app"

[package.metadata.component.target.dependencies]
"fermyon:spin" = { path = "wit/deps/spin@2.0.0" }
"wasi:http" = { path = "wit/deps/http@0.2.6" }
"wasi:io" = { path = "wit/deps/io@0.2.6" }
"wasi:clocks" = { path = "wit/deps/clocks@0.2.6" }
"wasi:keyvalue" = { path = "wit/deps/keyvalue@0.2.0-draft2" }
"wasi:config" = { path = "wit/deps/config@0.2.0-draft-2024-09-27" }
`;

  private buildRustSource = (): string => `wit_bindgen::generate!({
    path: "wit",
    world: "service-app",
    // Generate standard WASI HTTP's transitive interfaces for later use by a Guest.
    generate_all,
});

use exports::nextclaw::portable_service::service::{Action, Guest};
use nextclaw::portable_service::host;
use serde_json::{Value, json};
use wasi::keyvalue::store as keyvalue_store;

const STORE_NAME: &str = "default";

struct Component;

impl Guest for Component {
    fn list_actions() -> Vec<Action> {
        vec![
            Action {
                name: "counter_read".into(),
                title: "读取持久计数".into(),
                description: "从标准 WASI key-value 存储读取计数。".into(),
            },
            Action {
                name: "counter_increment".into(),
                title: "增加持久计数".into(),
                description: "在 Rust/WASM 中计算，并通过标准 WASI key-value 持久化。".into(),
            },
        ]
    }

    fn invoke(action: String, input_json: String) -> Result<String, String> {
        host::log(host::LogLevel::Info, &format!("invoking {action}"));
        let input: Value = serde_json::from_str(&input_json).unwrap_or_else(|_| json!({}));
        match action.as_str() {
            "counter_read" => Ok(counter_result(read_counter()?)),
            "counter_increment" => {
                let step = input.get("step").and_then(Value::as_i64).unwrap_or(1);
                if !(1..=100).contains(&step) {
                    return Err("INVALID_INPUT: step must be between 1 and 100".into());
                }
                let counter = read_counter()?.saturating_add(step);
                let bucket = keyvalue_store::open(STORE_NAME).map_err(format_keyvalue_error)?;
                bucket
                    .set("counter", counter.to_string().as_bytes())
                    .map_err(format_keyvalue_error)?;
                Ok(counter_result(counter))
            }
            _ => Err(format!("UNKNOWN_ACTION: {action}")),
        }
    }

    fn start(_config_json: String) -> Result<String, String> {
        Ok(json!({ "started": true, "mode": "action" }).to_string())
    }

    fn handle_event(_event_json: String) -> Result<String, String> {
        Err("UNSUPPORTED_LIFECYCLE: action component does not accept resident events".into())
    }

    fn stop(_reason_json: String) -> Result<String, String> {
        Ok(json!({ "stopped": true, "mode": "action" }).to_string())
    }
}

fn read_counter() -> Result<i64, String> {
    let bucket = keyvalue_store::open(STORE_NAME).map_err(format_keyvalue_error)?;
    Ok(bucket
        .get("counter")
        .map_err(format_keyvalue_error)?
        .and_then(|value| String::from_utf8(value).ok())
        .and_then(|value| value.parse().ok())
        .unwrap_or(0))
}

fn counter_result(counter: i64) -> String {
    json!({ "counter": counter, "persistedBy": "wasi:keyvalue/store" }).to_string()
}

fn format_keyvalue_error(_error: keyvalue_store::Error) -> String {
    "WASI_KEYVALUE_ERROR: application storage is unavailable".into()
}

export!(Component with_types_in self);
`;

  private buildReadme = (appName: string, serviceId: string): string => `# ${appName}

这是一个可以独立构建的 Rust/WASI Component App。Panel 和 Agent 调用同一组 Service Action，计数通过标准 WASI key-value 持久保存。

## 1. 准备 Rust 工具链

\`\`\`bash
rustup target add wasm32-wasip2
\`\`\`

## 2. 构建 Component

\`\`\`bash
cd guest
cargo build --release --target wasm32-wasip2
cp target/wasm32-wasip2/release/nextclaw_rust_wasi_guest.wasm ../service-components/${serviceId}/service.wasm
cd ..
\`\`\`

项目内的 \`guest/wit/portable-service.wit\` 是当前 Service Action 与宿主能力合同；不需要 NextClaw 源码仓库。

## 3. 检查和调试

\`\`\`bash
nextclaw app check .
nextclaw app dev .
nextclaw app call . counter_read
nextclaw app call . counter_increment --input '{"step":2}'
\`\`\`

如果一个包包含多个 Service Component，请增加 \`--component <component-id>\`。

## 4. 打包和安装

\`\`\`bash
nextclaw app pack . --target universal --out ${this.normalizeSlug(appName)}.napp
nextclaw app install ./${this.normalizeSlug(appName)}.napp
\`\`\`
`;

  private buildPanelHtml = (appName: string): string => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${appName}</title>
    <style>
      :root { font-family: ui-sans-serif, system-ui, sans-serif; color: #172033; background: #f5f7fb; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
      main { width: min(420px, calc(100vw - 40px)); padding: 28px; border-radius: 24px; background: white; box-shadow: 0 18px 60px #24324a1f; }
      p { color: #667085; }
      output { display: block; margin: 24px 0; font-size: 64px; font-weight: 700; }
      button { border: 0; border-radius: 999px; padding: 12px 18px; background: #172033; color: white; cursor: pointer; }
      #error { color: #b42318; }
    </style>
  </head>
  <body>
    <main>
      <h1>${appName}</h1>
      <p>这个数字由 Rust/WASI Component 计算，并通过标准 WASI key-value 持久保存。</p>
      <output id="counter">…</output>
      <button id="increment" type="button">增加 1</button>
      <p id="error" role="alert"></p>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`;

  private buildPanelScript = (serviceId: string): string => `const counter = document.querySelector("#counter");
const error = document.querySelector("#error");
const increment = document.querySelector("#increment");

async function readCounter() {
  error.textContent = "";
  try {
    const result = await window.nextclaw.serviceActions.invoke("${serviceId}.counter_read", {});
    counter.textContent = String(result.counter ?? 0);
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
  }
}

async function incrementCounter() {
  error.textContent = "";
  try {
    const result = await window.nextclaw.serviceActions.invoke("${serviceId}.counter_increment", { step: 1 });
    counter.textContent = String(result.counter ?? 0);
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
  }
}

increment.addEventListener("click", incrementCounter);
void readCounter();
`;

  private buildMarketplaceMetadata = (appName: string) => ({
    slug: this.normalizeSlug(appName),
    summary: `${appName} Rust/WASI Component 示例。`,
    summaryI18n: {
      zh: `${appName} Rust/WASI Component 示例。`,
      en: `${appName}, a Rust/WASI Component example.`,
    },
    description: "A minimal Rust/WASI Component App with a Panel and host-managed persistent KV.",
    descriptionI18n: {
      zh: "一个包含 Panel 和宿主持久 KV 的最小 Rust/WASI Component App。",
      en: "A minimal Rust/WASI Component App with a Panel and host-managed persistent KV.",
    },
    author: "NextClaw",
    tags: ["starter", "rust", "wasi-component", "official"],
    sourceRepo: "https://github.com/Peiiii/nextclaw",
    homepage: "https://nextclaw.io",
    featured: false,
  });

  private normalizeSlug = (value: string): string => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "rust-wasi-app";

  private buildIconSvg = (): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="30" fill="#172033"/>
  <path d="M31 40h66v48H31z" fill="#fff" opacity=".12"/>
  <path d="M43 52h42v8H43zm0 16h28v8H43z" fill="#fff"/>
  <circle cx="88" cy="76" r="12" fill="#f59e0b"/>
</svg>
`;
}
