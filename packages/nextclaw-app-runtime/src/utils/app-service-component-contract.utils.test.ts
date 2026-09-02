import { describe, expect, it } from "vitest";
import {
  assertWasmComponentBinary,
  parseAppServiceComponentContract,
} from "./app-service-component-contract.utils.js";

describe("app Service component contract", () => {
  it("accepts a WASI Service only with a safe component entry", () => {
    expect(parseAppServiceComponentContract({
      runtimeProfile: "wasi",
      label: "service-app.json",
      manifest: {
        protocol: "wasi-component",
        component: { entry: "bin/service.wasm" },
      },
    })).toEqual({
      protocol: "wasi-component",
      componentEntry: "bin/service.wasm",
    });
  });

  it("rejects runtime and protocol mismatches", () => {
    expect(() => parseAppServiceComponentContract({
      runtimeProfile: "wasi",
      label: "service-app.json",
      manifest: { protocol: "mcp" },
    })).toThrow("必须使用 wasi-component");
    expect(() => parseAppServiceComponentContract({
      runtimeProfile: "native-process",
      label: "service-app.json",
      manifest: {
        protocol: "wasi-component",
        component: { entry: "service.wasm" },
      },
    })).toThrow("必须声明根 manifest runtime.profile=wasi");
  });

  it("rejects unsafe entries and core Wasm modules", () => {
    expect(() => parseAppServiceComponentContract({
      runtimeProfile: "wasi",
      label: "service-app.json",
      manifest: {
        protocol: "wasi-component",
        component: { entry: "../service.wasm" },
      },
    })).toThrow("安全的 package-relative .wasm");
    expect(() => assertWasmComponentBinary(
      new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
      "service.wasm",
    )).toThrow("不是 WebAssembly Component binary");
  });
});
