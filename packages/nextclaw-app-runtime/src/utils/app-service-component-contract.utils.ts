import type { AppRuntimeProfile } from "#app-runtime/types/app-manifest.types.js";

export type AppServiceComponentContract = {
  protocol: "mcp" | "wasi-component";
  componentEntry?: string;
};

export function parseAppServiceComponentContract(params: {
  manifest: unknown;
  runtimeProfile: AppRuntimeProfile;
  label: string;
}): AppServiceComponentContract {
  const { label, runtimeProfile } = params;
  const manifest = assertRecord(params.manifest, label);
  const protocol = manifest.protocol === undefined
    ? "mcp"
    : readRequiredString(manifest.protocol, `${label}.protocol`);
  if (protocol !== "mcp" && protocol !== "wasi-component") {
    throw new Error(`${label}.protocol 只支持 mcp 或 wasi-component。`);
  }
  if (runtimeProfile === "wasi" && protocol !== "wasi-component") {
    throw new Error("runtime.profile=wasi 的所有 Service component 必须使用 wasi-component protocol。");
  }
  if (runtimeProfile !== "wasi" && protocol === "wasi-component") {
    throw new Error("wasi-component Service 必须声明根 manifest runtime.profile=wasi。");
  }
  if (protocol === "mcp") {
    return { protocol };
  }
  const component = assertRecord(manifest.component, `${label}.component`);
  const rawEntry = readRequiredString(component.entry, `${label}.component.entry`);
  const componentEntry = normalizeComponentEntry(rawEntry, `${label}.component.entry`);
  return { protocol, componentEntry };
}

export function assertWasmComponentBinary(bytes: Uint8Array, label: string): void {
  const componentHeader = [0x00, 0x61, 0x73, 0x6d, 0x0d, 0x00, 0x01, 0x00];
  if (
    bytes.byteLength < componentHeader.length ||
    componentHeader.some((byte, index) => bytes[index] !== byte)
  ) {
    throw new Error(`${label} 不是 WebAssembly Component binary。`);
  }
}

function normalizeComponentEntry(value: string, label: string): string {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    !normalized.endsWith(".wasm") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`${label} 必须是安全的 package-relative .wasm 路径。`);
  }
  return segments.join("/");
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象。`);
  }
  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} 必须是非空字符串。`);
  }
  return value.trim();
}
